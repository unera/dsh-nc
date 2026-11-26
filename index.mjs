/**
 * dsh-nc — file browser for DeepSeek Harness: the host half.
 *
 * It reads files and directories by any absolute path and serves them to the
 * browser over its routes. The routes are registered not on the bare web server
 * but on the **Connection channel** (`ctx.connection.fetch`): the channel contract
 * says the transport has already applied its trust and authentication policy and
 * that only the owner (owner Peer) reaches an exact route. This is essential:
 * `dsh web` on this host sits behind a public domain, and a route of its own on
 * `ctx.webServer` (as many plugins do) would open file reading to anyone who can
 * reach the domain — the dsh token gate does not cover it.
 *
 * Read routes: `home`, `list`, `text`, `raw`, `size`.
 * Write routes: `copy`, `move`, `mkdir`, `delete`, `plan`, `start`, `job`,
 * `cancel`. Writing is the most dangerous part: it runs as the dsh process.
 *
 * The browse scope is set by the `scope` config:
 *   - `workdir` (default) — only inside the root the client sends (usually the
 *     working directory of the session). The boundaries are checked against
 *     `realpath`, so a symlink pointing outside does not help: it is resolved
 *     before the file is touched;
 *   - `filesystem` — the whole file system; enable it deliberately.
 */

import { homedir } from 'node:os'
import { constants, createReadStream } from 'node:fs'
import { access, copyFile, cp, lstat, mkdir, open, readdir, readFile, readlink, realpath, rename, rm, stat, symlink } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-nc'

/** The Connection channel announces itself before the routes are registered. */
export const inject = ['connection']

export const Config = z.object({
  scope: z
    .union([z.const('filesystem'), z.const('workdir')])
    .default('workdir')
    .description(
      'Browsing scope: workdir (default) stays inside the root the client sends; filesystem walks the whole machine and must be enabled deliberately.',
    ),
  maxTextBytes: z
    .number()
    .default(512 * 1024)
    .description('How many bytes of text the preview returns; the rest is reported as truncated.'),
})

const PREFIX = '/dsh-nc'
const DEFAULT_MAX_TEXT = 512 * 1024
const MAX_RAW_BYTES = 64 * 1024 * 1024
/** Limit of entries in a plan: walking / and similar trees otherwise never ends. */
const PLAN_NODE_LIMIT = 200000
/** How many finished jobs to keep and for how long (running jobs are not affected). */
const JOB_HISTORY = 50
const JOB_TTL_MS = 10 * 60 * 1000
/** How long a job may stay silent before it counts as stalled. */
const JOB_STALL_MS = 10 * 60 * 1000
/** How often the stalled jobs are checked. */
const WATCHDOG_MS = 60 * 1000
const BINARY_SNIFF_BYTES = 8192

const CONTENT_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
])

/**
 * Whether the job should be considered stalled now.
 *
 * A running job is not dropped by age: while it makes progress it writes
 * `touchedAt`. A job that has not reported for longer than the threshold is
 * considered stalled.
 * @param job - job record.
 * @param now - current time in milliseconds.
 * @param stallMs - silence threshold.
 * @returns true when the job should be stopped.
 */
export function isStalled(job, now, stallMs = JOB_STALL_MS) {
  return job?.state === 'running' && now - (job.touchedAt ?? job.startedAt ?? now) > stallMs
}

/** An error carrying an HTTP status and a code for the client. */
class Failure extends Error {
  constructor(status, code, message, path) {
    super(message)
    this.status = status
    this.code = code
    this.path = path
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function failure(error) {
  if (error instanceof Failure) {
    return json({ ok: false, error: { code: error.code, message: error.message, path: error.path } }, error.status)
  }
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'failed'
  const target = error && typeof error === 'object' && 'path' in error ? String(error.path) : ''
  // Permissions and missing paths are ordinary everyday cases, not a server fault.
  if (code === 'EACCES' || code === 'EPERM') {
    return json({ ok: false, error: { code: 'no-access', message: `no access: ${target || message}`, path: target } }, 403)
  }
  if (code === 'ENOENT') {
    return json({ ok: false, error: { code: 'not-found', message: `no such file: ${target || message}`, path: target } }, 404)
  }
  if (code === 'ENOTDIR') {
    return json({ ok: false, error: { code: 'not-a-directory', message: `not a directory: ${target || message}`, path: target } }, 400)
  }
  if (code === 'EEXIST' || code === 'ENOTEMPTY') {
    return json({ ok: false, error: { code: 'target-exists', message: `already exists: ${target || message}`, path: target } }, 409)
  }
  if (code === 'EISDIR') {
    return json({ ok: false, error: { code: 'is-a-directory', message: `is a directory: ${target || message}`, path: target } }, 400)
  }
  if (code === 'EROFS') {
    return json({ ok: false, error: { code: 'read-only', message: `read-only filesystem: ${target || message}`, path: target } }, 403)
  }
  return json({ ok: false, error: { code, message } }, 500)
}

/** Breadcrumbs from the root down to the path: `[/][home][dsh][work]`. */
function crumbsOf(path) {
  const parts = resolve(path).split(sep).filter((part) => part !== '')
  const crumbs = [{ name: '/', path: '/' }]
  let current = ''
  for (const part of parts) {
    current = `${current}/${part}`
    crumbs.push({ name: part, path: current })
  }
  return crumbs
}

function isInside(root, path) {
  const normalizedRoot = resolve(root)
  const normalizedPath = resolve(path)
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${sep}`)
}

/** Check a path against the configured browse scope. */
/**
 * Resolve the symlinks of a path that does not exist yet.
 *
 * `realpath` requires an existing path, but creation targets (mkdir, copy) have to
 * be checked too: we climb to the nearest existing ancestor, resolve it and glue
 * the remainder back on.
 * @param path - absolute path that may not exist.
 * @returns a path whose existing part has its symlinks resolved.
 */
async function realish(path) {
  const absolute = resolve(path)
  let head = absolute
  let tail = ''
  for (;;) {
    try {
      const real = await realpath(head)
      return tail === '' ? real : `${real}${sep}${tail}`.replace(/\/+$/, '')
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      const parent = head.slice(0, head.lastIndexOf(sep)) || sep
      if (parent === head) return absolute
      tail = tail === '' ? head.slice(parent.length + 1) : `${head.slice(parent.length + 1)}${sep}${tail}`
      head = parent
    }
  }
}

/**
 * Check a path against the browse scope and return the path to work with.
 *
 * In `workdir` mode the **real** paths are compared: a symlink leading outside is
 * resolved before the check and therefore does not pass.
 * @param path - requested path.
 * @param scope - `workdir` or `filesystem`.
 * @param root - root of the scope (sent by the client).
 * @returns absolute path for the file operation.
 */
async function guard(path, scope, root) {
  if (typeof path !== 'string' || path === '') throw new Failure(400, 'bad-path', 'path is required')
  const resolved = resolve(path)
  if (scope !== 'workdir') return resolved
  if (typeof root !== 'string' || root === '') {
    throw new Failure(403, 'root-required', 'scope=workdir needs a root query parameter')
  }
  const realRoot = await realish(root)
  const realPath = await realish(resolved)
  if (!isInside(realRoot, realPath)) {
    throw new Failure(403, 'outside-root', `${resolved} is outside ${resolve(root)}`, resolved)
  }
  return resolved
}

async function listLevel(path, showHidden) {
  const info = await stat(path)
  if (!info.isDirectory()) throw new Failure(400, 'not-a-directory', `${path} is not a directory`, path)
  const rows = await readdir(path, { withFileTypes: true })
  const entries = []
  for (const row of rows) {
    if (!showHidden && row.name.startsWith('.')) continue
    let kind = row.isDirectory() ? 'dir' : row.isFile() ? 'file' : row.isSymbolicLink() ? 'link' : 'other'
    let size = 0
    let mtimeMs = 0
    let mode = 0
    try {
      const entryInfo = await stat(join(path, row.name))
      // A symlink to a directory behaves like a directory: otherwise it could not be entered.
      if (kind === 'link') kind = entryInfo.isDirectory() ? 'dir' : 'file'
      size = entryInfo.size
      mtimeMs = entryInfo.mtimeMs
      mode = entryInfo.mode
    } catch {
      // Broken symlink: the row stays, but without size and time.
    }
    entries.push({
      name: row.name,
      path: join(path, row.name),
      kind,
      size,
      mtimeMs,
      mode,
      hidden: row.name.startsWith('.'),
    })
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : b.kind === 'dir' ? 1 : 0
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return {
    path,
    parent: path === '/' ? null : resolve(path, '..'),
    crumbs: crumbsOf(path),
    entries,
  }
}

async function readText(path, maxBytes) {
  const info = await stat(path)
  if (info.isDirectory()) throw new Failure(400, 'is-a-directory', `${path} is a directory`)
  // Read only the beginning of the file: otherwise a "preview" of a gigabyte file pulls it whole into memory.
  const want = Math.max(BINARY_SNIFF_BYTES, maxBytes)
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(want, info.size))
    let filled = 0
    while (filled < buffer.length) {
      const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, filled)
      if (bytesRead === 0) break
      filled += bytesRead
    }
    const bytes = buffer.subarray(0, filled)
    if (bytes.subarray(0, Math.min(filled, BINARY_SNIFF_BYTES)).includes(0)) {
      return { kind: 'binary', size: info.size }
    }
    // Cut at a UTF-8 character boundary: otherwise the last character turns into mojibake.
    let slice = bytes.subarray(0, Math.min(filled, maxBytes))
    while (slice.length > 0 && (slice[slice.length - 1] & 0xc0) === 0x80) slice = slice.subarray(0, slice.length - 1)
    return {
      kind: 'text',
      size: info.size,
      truncated: info.size > slice.length,
      text: slice.toString('utf8'),
    }
  } finally {
    await handle.close()
  }
}

/** Response with the raw file bytes: the browser renders images, PDFs and video itself. */
async function rawFile(path) {
  const info = await stat(path)
  if (info.isDirectory()) throw new Failure(400, 'is-a-directory', `${path} is a directory`)
  if (info.size > MAX_RAW_BYTES) {
    throw new Failure(413, 'too-large', `${info.size} bytes exceeds the ${MAX_RAW_BYTES} byte limit`)
  }
  const type = CONTENT_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream'
  const stream = createReadStream(path)
  const body = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)))
      stream.on('end', () => controller.close())
      stream.on('error', (error) => controller.error(error))
    },
    cancel() {
      stream.destroy()
    },
  })
  return new Response(body, {
    headers: {
      'content-type': type,
      'content-length': String(info.size),
      // A file from a foreign repository must not execute in the DSH origin.
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      'cache-control': 'no-store',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(basename(path))}`,
    },
  })
}

/**
 * Wire up the routes.
 * @param ctx - plugin context with the Connection channel already available.
 * @param config - parsed config (scope and text limit).
 */
export function apply(ctx, config) {
  const scope = config?.scope === 'workdir' ? 'workdir' : 'filesystem'
  const maxText = Number.isFinite(config?.maxTextBytes) ? config.maxTextBytes : DEFAULT_MAX_TEXT
  const log = ctx.logger('dsh-nc')

  // Watchdog: a job that has been silent longer than the threshold is stopped. A
  // running job is not dropped by age — copying hundreds of gigabytes can take hours.
  ctx.effect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      for (const job of jobs.values()) {
        if (isStalled(job, now)) {
          job.stalled = true
          job.cancelled = true
        }
      }
    }, WATCHDOG_MS)
    if (typeof timer.unref === 'function') timer.unref()
    return () => clearInterval(timer)
  })

  /** One exact channel route: parameter parsing, scope guard, response. */
  const route = (suffix, handler, methods = ['GET']) => {
    ctx.effect(() =>
      ctx.connection.fetch.register({
        // Exact Fetch routes live under the shared /api channel, so the
        // registered path carries that prefix; the browser calls /api/dsh-nc/*.
        path: `/api${PREFIX}/${suffix}`,
        methods,
        // Only 'buffered' and 'streaming' are allowed; a GET has no body, hence buffered.
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const url = new URL(request.url)
            return await handler(url.searchParams, request)
          } catch (error) {
            return failure(error)
          }
        },
      }),
    )
  }

  /** Background copy/move jobs: they live in the memory of the process. */
  const jobs = new Map()

  /** How many entries and bytes a directory holds; the limit keeps us off endless trees. */
  const measure = async (path) => {
    let bytes = 0
    let files = 0
    let dirs = 0
    let truncated = false
    const stack = [path]
    while (stack.length > 0) {
      const current = stack.pop()
      let rows
      try {
        rows = await readdir(current, { withFileTypes: true })
      } catch {
        continue
      }
      for (const row of rows) {
        const child = join(current, row.name)
        if (row.isDirectory()) {
          dirs += 1
          if (dirs + files > 200000) {
            truncated = true
            break
          }
          stack.push(child)
        } else {
          files += 1
          try {
            const info = await stat(child)
            bytes += info.size
          } catch {
            // The file vanished between the listing and stat — we simply do not count its size.
          }
        }
      }
      if (truncated) break
    }
    return { bytes, files, dirs, truncated }
  }

  /** Whether the directory is writable: permissions are checked already at plan time. */
  const canWrite = async (dir) => {
    try {
      await access(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Build the plan of an operation.
   *
   * A step is what cannot be interrupted halfway: for a copy it is a file, for a
   * move or a delete it is the entry itself (a directory is renamed as a whole, no
   * matter how many files it holds).
   * @param sources - source paths.
   * @param targetDir - destination directory (not needed for a delete).
   * @param op - copy, move or delete.
   * @returns files, directories, size, conflicts, number of steps and obstacles.
   */
  const buildPlan = async (sources, targetDir, op) => {
    const files = []
    const dirs = []
    const conflicts = []
    const problems = []

    const exists = async (target) => {
      try {
        await access(target)
        return true
      } catch {
        return false
      }
    }

    const visit = async (from, to) => {
      // lstat, not stat: a symlink is walked as a link, otherwise a link to itself
      // turns into an endless walk and ELOOP.
      const info = await lstat(from)
      if (info.isSymbolicLink()) {
        files.push({ from, to, size: 0, link: true })
        if (to && (await exists(to))) conflicts.push(to)
        return
      }
      if (info.isDirectory()) {
        dirs.push({ from, to })
        const rows = await readdir(from, { withFileTypes: true })
        // A delete has no target at all: only the contents are counted.
        for (const row of rows) await visit(join(from, row.name), to === null ? null : join(to, row.name))
        return
      }
      files.push({ from, to, size: info.size })
      if (to && (await exists(to))) conflicts.push(to)
    }

    if (op !== 'delete') {
      if (!(await canWrite(targetDir))) {
        problems.push({ path: targetDir, reason: 'no write permission in the target directory' })
      }
    }

    for (const source of sources) {
      if (files.length + dirs.length > PLAN_NODE_LIMIT) {
        problems.push({ path: source, reason: `tree too large: more than ${PLAN_NODE_LIMIT} objects` })
        break
      }
      const name = source.split('/').filter(Boolean).pop() ?? source
      const parent = source.slice(0, source.lastIndexOf('/')) || '/'
      if (op !== 'copy' && !(await canWrite(parent))) {
        problems.push({ path: source, reason: 'no permission to modify this entry' })
      }
      try {
        await visit(source, op === 'delete' ? null : join(targetDir, name))
      } catch (error) {
        problems.push({ path: source, reason: error.message })
      }
    }

    // Existing subdirectories of the target must be writable as well.
    if (op === 'copy') {
      for (const dir of dirs) {
        if (await exists(dir.to)) {
          const writable = await canWrite(dir.to)
          if (!writable) problems.push({ path: dir.to, reason: 'no write permission in this directory' })
        }
      }
    }

    return {
      files,
      dirs,
      conflicts,
      problems,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
      steps: op === 'copy' ? files.length : sources.length,
    }
  }

  /** Read a transfer request: the operation, the sources, the target. */
  const transferRequest = async (request, params) => {
    const body = await request.json().catch(() => null)
    const op = body?.op === 'move' ? 'move' : body?.op === 'delete' ? 'delete' : 'copy'
    if (!body || !Array.isArray(body.sources) || body.sources.length === 0) {
      throw new Failure(400, 'bad-request', 'a non-empty sources[] is required')
    }
    const root = params.get('root') ?? undefined
    const sources = await Promise.all(body.sources.map((source) => guard(source, scope, root)))
    const overwrite = body.overwrite === true
    if (op === 'delete') return { op, sources, targetDir: null, overwrite }
    if (typeof body.targetDir !== 'string') {
      throw new Failure(400, 'bad-request', 'targetDir is required')
    }
    const targetDir = await guard(body.targetDir, scope, root)
    const targetInfo = await stat(targetDir)
    if (!targetInfo.isDirectory()) throw new Failure(400, 'not-a-directory', `${targetDir} is not a directory`)
    return { op, sources, targetDir, overwrite }
  }

  /**
   * Execute a job in the background.
   *
   * Cancellation is checked before every step: the step already started runs to
   * completion, the next one is not started.
   */
  const runJob = async (job, plan, op) => {
    const exists = async (target) => {
      try {
        await access(target)
        return true
      } catch {
        return false
      }
    }
    try {
      if (op === 'copy') {
        for (const dir of plan.dirs) {
          if (job.cancelled) break
          await mkdir(dir.to, { recursive: true }).catch(() => {})
        }
        for (const file of plan.files) {
          if (job.cancelled) break
          try {
            await mkdir(file.to.slice(0, file.to.lastIndexOf('/')) || '/', { recursive: true })
            if (!job.overwrite && (await exists(file.to))) {
              // The target exists and overwriting is not allowed: skip it and count it separately.
              job.skipped += 1
              continue
            }
            if (file.link) {
              // A link is reproduced as a link: the target may be unavailable or may loop.
              await rm(file.to, { force: true }).catch(() => {})
              await symlink(await readlink(file.from), file.to)
            } else {
              await copyFile(file.from, file.to)
            }
            job.done += 1
            job.bytes += file.size
            job.current = file.to
          } catch (error) {
            job.failed += 1
            if (job.errors.length < 20) job.errors.push(`${file.from}: ${error.message}`)
          }
        }
      } else {
        // Move and delete work per entry: a directory is a single step.
        for (const source of job.sources) {
          if (job.cancelled) break
          const name = source.split('/').filter(Boolean).pop() ?? source
          try {
            if (op === 'delete') {
              await rm(source, { recursive: true, force: false })
            } else {
              const to = `${job.targetDir}/${name}`
              if (!job.overwrite && (await exists(to))) {
                job.skipped += 1
                continue
              }
              try {
                await rename(source, to)
              } catch (error) {
                if (error && error.code === 'EXDEV') {
                  await cp(source, to, { recursive: true, errorOnExist: true, force: false })
                  await rm(source, { recursive: true, force: true })
                } else {
                  throw error
                }
              }
            }
            job.done += 1
            job.current = source
            job.touchedAt = Date.now()
          } catch (error) {
            job.failed += 1
            if (job.errors.length < 20) job.errors.push(`${source}: ${error.message}`)
          }
        }
      }
      job.state = job.stalled ? 'stalled' : job.cancelled ? 'cancelled' : job.failed > 0 ? 'failed' : 'done'
    } catch (error) {
      job.state = 'failed'
      job.errors.push(error.message)
    }
    job.finishedAt = Date.now()
    // A finished job is remembered for a limited time: the Map must not grow forever.
    const timer = setTimeout(() => jobs.delete(job.id), JOB_TTL_MS)
    if (typeof timer.unref === 'function') timer.unref()
    if (jobs.size > JOB_HISTORY) {
      for (const [id, other] of jobs) {
        if (other.state !== 'running' && id !== job.id) {
          jobs.delete(id)
          if (jobs.size <= JOB_HISTORY) break
        }
      }
    }
  }

  /** Body of a write request: two paths, both checked against the browse scope. */
  const pathsOf = async (request, params) => {
    const body = await request.json().catch(() => null)
    if (!body || typeof body.from !== 'string' || typeof body.to !== 'string') {
      throw new Failure(400, 'bad-request', 'from and to are required')
    }
    const root = params.get('root') ?? undefined
    return {
      from: await guard(body.from, scope, root),
      to: await guard(body.to, scope, root),
    }
  }

  /** Where to write: an existing target is not overwritten without consent. */
  const assertFree = async (to) => {
    try {
      await access(to)
    } catch {
      return
    }
    throw new Failure(409, 'target-exists', `already exists: ${to}`, to)
  }

  /**
   * Diagnostic sink for the browser half: the client has no journal of its own,
   * so it posts short trace lines here and they land in the server log.
   */
  route(
    'log',
    async (_params, request) => {
      const body = await request.json().catch(() => null)
      const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : ''
      if (message !== '') log.info(`[client] ${message}`)
      return json({ ok: true })
    },
    ['POST'],
  )

  route('home', async () => json({ ok: true, home: homedir() }))

  route('list', async (params) => {
    const path = await guard(params.get('path') ?? homedir(), scope, params.get('root') ?? undefined)
    const listing = await listLevel(path, params.get('hidden') === '1')
    return json({ ok: true, ...listing })
  })

  route('text', async (params) => {
    const path = await guard(params.get('path'), scope, params.get('root') ?? undefined)
    const requested = Number(params.get('maxBytes'))
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, maxText) : maxText
    const preview = await readText(path, limit)
    return json({ ok: true, path, ...preview })
  })

  route('raw', async (params) => {
    const path = await guard(params.get('path'), scope, params.get('root') ?? undefined)
    return rawFile(path)
  })

  route(
    'copy',
    async (params, request) => {
      const { from, to } = await pathsOf(request, params)
      await assertFree(to)
      await cp(from, to, { recursive: true, errorOnExist: true, force: false })
      return json({ ok: true, from, to })
    },
    ['POST'],
  )

  route(
    'move',
    async (params, request) => {
      const { from, to } = await pathsOf(request, params)
      if (from === to) throw new Failure(400, 'same-path', 'source and target are the same path')
      await assertFree(to)
      try {
        await rename(from, to)
      } catch (error) {
        // A rename is impossible across file systems: copy and delete instead.
        if (error && error.code === 'EXDEV') {
          await cp(from, to, { recursive: true, errorOnExist: true, force: false })
          await rm(from, { recursive: true, force: true })
        } else {
          throw error
        }
      }
      return json({ ok: true, from, to })
    },
    ['POST'],
  )

  route(
    'delete',
    async (params, request) => {
      const body = await request.json().catch(() => null)
      if (!body || typeof body.path !== 'string') {
        throw new Failure(400, 'bad-request', 'path is required')
      }
      const target = await guard(body.path, scope, params.get('root') ?? undefined)
      // The root is never deleted under any circumstances: that is a typo, not an intent.
      if (target === '/') throw new Failure(400, 'refused', 'the filesystem root is never deleted')
      await rm(target, { recursive: true, force: false })
      return json({ ok: true, path: target })
    },
    ['POST'],
  )

  /** Create a directory: one level, without overwriting an existing one. */
  route(
    'mkdir',
    async (params, request) => {
      const body = await request.json().catch(() => null)
      if (!body || typeof body.path !== 'string' || body.path.trim() === '') {
        throw new Failure(400, 'bad-request', 'path is required')
      }
      const target = await guard(body.path, scope, params.get('root') ?? undefined)
      await assertFree(target)
      await mkdir(target)
      return json({ ok: true, path: target })
    },
    ['POST'],
  )

  /** Size and number of entries inside a directory — for the stat line and the F3 count. */
  route('size', async (params) => {
    const path = await guard(params.get('path'), scope, params.get('root') ?? undefined)
    const info = await stat(path)
    if (!info.isDirectory()) throw new Failure(400, 'not-a-directory', `${path} is not a directory`)
    const measured = await measure(path)
    return json({ ok: true, path, ...measured })
  })

  /** Operation plan: how many steps and bytes, what will be overwritten and what blocks the start. */
  route(
    'plan',
    async (params, request) => {
      const { op, sources, targetDir } = await transferRequest(request, params)
      const plan = await buildPlan(sources, targetDir, op)
      return json({
        ok: true,
        op,
        targetDir,
        steps: plan.steps,
        files: plan.files.length,
        dirs: plan.dirs.length,
        bytes: plan.bytes,
        conflicts: plan.conflicts.slice(0, 500),
        conflictCount: plan.conflicts.length,
        problems: plan.problems.slice(0, 50),
      })
    },
    ['POST'],
  )

  /** Start an operation in the background: the plan is recomputed and obstacles forbid the start. */
  route(
    'start',
    async (params, request) => {
      const { op, sources, targetDir, overwrite } = await transferRequest(request, params)
      const plan = await buildPlan(sources, targetDir, op)
      if (plan.problems.length > 0) {
        throw new Failure(409, 'not-executable', plan.problems[0].reason)
      }
      // Overwrite only with explicit consent: otherwise the target stays untouched.
      if (plan.conflicts.length > 0 && !overwrite) {
        throw new Failure(409, 'conflicts', `targets already exist: ${plan.conflicts.length}`)
      }
      const twin = [...jobs.values()].find(
        (job) =>
          job.state === 'running'
          && job.op === op
          && String(job.targetDir) === String(targetDir)
          && job.sources.length === sources.length
          && job.sources.every((source, index) => source === sources[index]),
      )
      if (twin) throw new Failure(409, 'already-running', 'the same task is already running')
      const job = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        op,
        sources,
        targetDir,
        total: plan.steps,
        done: 0,
        skipped: 0,
        failed: 0,
        bytes: 0,
        totalBytes: plan.bytes,
        current: '',
        overwrite,
        errors: [],
        cancelled: false,
        state: 'running',
        startedAt: Date.now(),
        touchedAt: Date.now(),
      }
      jobs.set(job.id, job)
      void runJob(job, plan, op)
      return json({ ok: true, jobId: job.id, total: job.total, totalBytes: job.totalBytes })
    },
    ['POST'],
  )

  /** Job state for the progress dialog. */
  route('job', async (params) => {
    const job = jobs.get(params.get('jobId') ?? '')
    if (!job) throw new Failure(404, 'no-job', 'no such task')
    return json({
      ok: true,
      jobId: job.id,
      state: job.state,
      op: job.op,
      done: job.done,
      total: job.total,
      skipped: job.skipped,
      failed: job.failed,
      bytes: job.bytes,
      totalBytes: job.totalBytes,
      current: job.current,
      touchedAt: job.touchedAt,
      errors: job.errors.slice(0, 20),
    })
  })

  /** Cancel a job: the current file is finished, the rest are skipped. */
  route(
    'cancel',
    async (params, request) => {
      const body = await request.json().catch(() => null)
      const job = jobs.get(body?.jobId ?? params.get('jobId') ?? '')
      if (!job) throw new Failure(404, 'no-job', 'no such task')
      job.cancelled = true
      return json({ ok: true })
    },
    ['POST'],
  )

  log.info(
    `dsh-nc: routes on /api${PREFIX}: read {home,list,text,raw,size}, write {copy,move,mkdir,delete,plan,start,job,cancel}; scope: ${scope}`,
  )
}
