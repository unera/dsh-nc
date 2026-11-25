/**
 * Tests of the host half: scope boundaries and file operations.
 *
 * The plugin is booted on a fake context: route registrations are captured and
 * then called directly, the way the Connection channel would call them.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PREFIX = '/api/dsh-nc/'

/** Boot the plugin and get a function that calls its routes. */
async function boot(config) {
  const routes = new Map()
  const ctx = {
    logger: () => ({ info: () => {} }),
    effect: (fn) => (typeof fn === 'function' ? fn() : undefined),
    connection: {
      fetch: {
        register: (route) => {
          routes.set(route.path.slice(PREFIX.length), route)
          return () => {}
        },
      },
    },
  }
  const module = await import('../index.mjs')
  module.apply(ctx, config)

  const call = async (name, { query, body } = {}) => {
    const route = routes.get(name)
    assert.ok(route, `route ${name} is not registered`)
    const search = new URLSearchParams(query ?? {})
    const response = await route.fetch(
      new Request(`http://dsh.test${PREFIX}${name}?${search.toString()}`, {
        method: route.methods[0],
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )
    return { status: response.status, body: await response.json() }
  }
  return { call, routes }
}

/** A fresh directory for a test. */
async function sandbox() {
  return mkdtemp(join(tmpdir(), 'dsh-nc-test-'))
}

test('workdir: a path outside the root is refused', async () => {
  const root = await sandbox()
  const outside = await sandbox()
  const { call } = await boot({ scope: 'workdir', maxTextBytes: 1024 })
  try {
    const inside = await call('list', { query: { path: root, root } })
    assert.equal(inside.status, 200, 'the own directory must open')
    const foreign = await call('list', { query: { path: outside, root } })
    assert.equal(foreign.status, 403, 'a foreign directory must be refused')
    assert.equal(foreign.body.error.code, 'outside-root')
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('workdir: a symlink pointing outside does not open the door', async () => {
  const root = await sandbox()
  const outside = await sandbox()
  await writeFile(join(outside, 'secret.txt'), 'secret')
  await symlink(outside, join(root, 'leak'))
  const { call } = await boot({ scope: 'workdir', maxTextBytes: 1024 })
  try {
    const listing = await call('list', { query: { path: join(root, 'leak'), root } })
    assert.equal(listing.status, 403, 'a symlink outside must hit the boundary')
    const read = await call('text', { query: { path: join(root, 'leak', 'secret.txt'), root } })
    assert.equal(read.status, 403)
    const remove = await call('delete', { query: { root }, body: { path: join(root, 'leak', 'secret.txt') } })
    assert.equal(remove.status, 403, 'delete through a symlink is refused too')
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('copy: an existing target needs explicit overwrite consent', async () => {
  const root = await sandbox()
  await writeFile(join(root, 'a.txt'), 'new')
  await mkdir(join(root, 'dst'))
  await writeFile(join(root, 'dst', 'a.txt'), 'old')
  const { call } = await boot({ scope: 'filesystem' })
  try {
    const plan = await call('plan', { body: { op: 'copy', sources: [join(root, 'a.txt')], targetDir: join(root, 'dst') } })
    assert.equal(plan.body.conflictCount, 1)

    const refused = await call('start', { body: { op: 'copy', sources: [join(root, 'a.txt')], targetDir: join(root, 'dst') } })
    assert.equal(refused.status, 409)
    assert.equal(refused.body.error.code, 'conflicts')
    assert.equal(await readFile(join(root, 'dst', 'a.txt'), 'utf8'), 'old', 'without consent the target is untouched')

    const forced = await call('start', {
      body: { op: 'copy', sources: [join(root, 'a.txt')], targetDir: join(root, 'dst'), overwrite: true },
    })
    assert.equal(forced.status, 200)
    const jobId = forced.body.jobId
    let state
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await call('job', { query: { jobId } })
      state = status.body.state
      if (state !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(state, 'done')
    assert.equal(await readFile(join(root, 'dst', 'a.txt'), 'utf8'), 'new')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('moving a directory is one step no matter how many files are inside', async () => {
  const root = await sandbox()
  await mkdir(join(root, 'src', 'deep', 'deeper'), { recursive: true })
  for (let index = 0; index < 5; index += 1) await writeFile(join(root, 'src', 'deep', `f${index}.txt`), 'x')
  await mkdir(join(root, 'dst'))
  const { call } = await boot({ scope: 'filesystem' })
  try {
    const plan = await call('plan', { body: { op: 'move', sources: [join(root, 'src')], targetDir: join(root, 'dst') } })
    assert.equal(plan.body.steps, 1, 'a directory moves in one step')
    assert.ok(plan.body.files >= 5, 'internals are counted for information')
    const started = await call('start', { body: { op: 'move', sources: [join(root, 'src')], targetDir: join(root, 'dst') } })
    assert.equal(started.status, 200)
    let state
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await call('job', { query: { jobId: started.body.jobId } })
      state = status.body.state
      if (state !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(state, 'done')
    assert.equal((await call('list', { query: { path: join(root, 'src') } })).status, 404, 'the source is gone')
    assert.equal((await call('list', { query: { path: join(root, 'dst', 'src') } })).status, 200, 'the target is in place')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('delete: the root is refused, an ordinary path is removed', async () => {
  const root = await sandbox()
  await mkdir(join(root, 'gone'))
  await writeFile(join(root, 'gone', 'f.txt'), 'x')
  const { call } = await boot({ scope: 'filesystem' })
  try {
    const denied = await call('delete', { body: { path: '/' } })
    assert.equal(denied.status, 400)
    const started = await call('start', { body: { op: 'delete', sources: [join(root, 'gone')] } })
    assert.equal(started.status, 200)
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await call('job', { query: { jobId: started.body.jobId } })
      if (status.body.state !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal((await call('list', { query: { path: join(root, 'gone') } })).status, 404)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('mkdir: an existing directory is not touched', async () => {
  const root = await sandbox()
  const { call } = await boot({ scope: 'filesystem' })
  try {
    const first = await call('mkdir', { body: { path: join(root, 'new') } })
    assert.equal(first.status, 200)
    const again = await call('mkdir', { body: { path: join(root, 'new') } })
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'target-exists')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('text: only the head of the file is read and the answer is marked truncated', async () => {
  const root = await sandbox()
  const path = join(root, 'big.txt')
  await writeFile(path, 'a'.repeat(300000))
  const { call } = await boot({ scope: 'filesystem', maxTextBytes: 1000 })
  try {
    const read = await call('text', { query: { path, maxBytes: 1000 } })
    assert.equal(read.status, 200)
    assert.equal(read.body.kind, 'text')
    assert.equal(read.body.truncated, true)
    assert.ok(read.body.text.length <= 1000, 'the answer is not bigger than requested')
    assert.equal(read.body.size, 300000, 'the real file size is known')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('symlinks: copied as symlinks, a loop does not break the plan', async () => {
  const root = await sandbox()
  await mkdir(join(root, 'src', 'sub'), { recursive: true })
  await writeFile(join(root, 'src', 'sub', 'f.txt'), 'x')
  await symlink(join(root, 'src'), join(root, 'src', 'sub', 'self'))
  await mkdir(join(root, 'dst'))
  const { call } = await boot({ scope: 'filesystem' })
  try {
    const plan = await call('plan', { body: { op: 'copy', sources: [join(root, 'src')], targetDir: join(root, 'dst') } })
    assert.equal(plan.status, 200)
    assert.deepEqual(plan.body.problems, [], 'a symlink loop no longer blocks the plan')
    const started = await call('start', { body: { op: 'copy', sources: [join(root, 'src')], targetDir: join(root, 'dst') } })
    assert.equal(started.status, 200)
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await call('job', { query: { jobId: started.body.jobId } })
      if (status.body.state !== 'running') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal((await call('list', { query: { path: join(root, 'dst', 'src', 'sub') } })).status, 200)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('starting the same task twice is refused', async () => {
  const root = await sandbox()
  await mkdir(join(root, 'src', 'deep'), { recursive: true })
  for (let index = 0; index < 200; index += 1) await writeFile(join(root, 'src', 'deep', `f${index}.txt`), 'x')
  await mkdir(join(root, 'dst'))
  const { call } = await boot({ scope: 'filesystem' })
  try {
    // Overwrite is allowed so that the refusal comes from "already running", not from conflicts.
    const body = { op: 'copy', sources: [join(root, 'src')], targetDir: join(root, 'dst'), overwrite: true }
    const first = await call('start', { body })
    assert.equal(first.status, 200)
    const second = await call('start', { body })
    assert.equal(second.status, 409)
    assert.equal(second.body.error.code, 'already-running')
    await call('cancel', { body: { jobId: first.body.jobId } })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a stalled job is detected by silence, not by age', async () => {
  const module = await import('../index.mjs')
  const now = Date.now()
  // A long but alive job: old age, fresh heartbeat.
  assert.equal(module.isStalled({ state: 'running', startedAt: now - 6 * 3600_000, touchedAt: now - 1000 }, now), false)
  // Silent longer than the threshold.
  assert.equal(module.isStalled({ state: 'running', startedAt: now - 3600_000, touchedAt: now - 11 * 60_000 }, now), true)
  // A finished one is left alone.
  assert.equal(module.isStalled({ state: 'done', startedAt: now - 3600_000, touchedAt: now - 3600_000 }, now), false)
})
