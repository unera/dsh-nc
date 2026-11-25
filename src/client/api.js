/** Requests to the host half: everything lives under /api/dsh-nc, behind the dsh token gate. */

const BASE = '/api/dsh-nc'

async function call(route, params, root) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  if (root) query.set('root', root)
  const response = await fetch(`${BASE}/${route}?${query.toString()}`, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`
    const failure = new Error(message)
    // The caller needs the code: "not a directory" is not a failure but an attempt to open a file.
    failure.code = body?.error?.code ?? `http-${response.status}`
    failure.path = body?.error?.path
    throw failure
  }
  return body
}

/** Home directory of the host — the starting point of the browse scope. */
export async function fetchHome() {
  const body = await call('home', {})
  return body.home
}

/** One directory level plus the breadcrumbs from the root. */
export function fetchList(path, { hidden = false, root } = {}) {
  return call('list', { path, hidden: hidden ? 1 : undefined }, root)
}

/** Text or a "binary file" marker. */
export function fetchText(path, { maxBytes, root } = {}) {
  return call('text', { path, maxBytes }, root)
}

/** Direct link to the bytes — used by img, the PDF iframe and video. */
export function rawUrl(path, root) {
  const query = new URLSearchParams({ path })
  if (root) query.set('root', root)
  return `${BASE}/raw?${query.toString()}`
}

/** Write request: a body with two paths; errors arrive in the same envelope. */
async function post(route, body, root) {
  const query = new URLSearchParams()
  if (root) query.set('root', root)
  const response = await fetch(`${BASE}/${route}?${query.toString()}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const parsed = await response.json().catch(() => null)
  if (!response.ok || !parsed?.ok) {
    const failure = new Error(parsed?.error?.message ?? `${response.status} ${response.statusText}`)
    failure.code = parsed?.error?.code ?? `http-${response.status}`
    failure.path = parsed?.error?.path
    throw failure
  }
  return parsed
}

/** Copy a file or directory; the host does not overwrite an existing target. */
export function copyEntry(from, to, { root } = {}) {
  return post('copy', { from, to }, root)
}

/** Move or rename (a rename is a move inside the same directory). */
export function moveEntry(from, to, { root } = {}) {
  return post('move', { from, to }, root)
}

/** Delete a file or directory (a directory goes with all of its contents). */
export function deleteEntry(path, { root } = {}) {
  return post('delete', { path }, root)
}

/** Transfer plan: how many files, how many bytes, and which targets will be overwritten. */
export function planTransfer(op, sources, targetDir, { root } = {}) {
  return post('plan', { op, sources, targetDir }, root)
}

/** Start a transfer in the background; the state is then read through jobStatus. */
export function startTransfer(op, sources, targetDir, { root, overwrite } = {}) {
  return post('start', { op, sources, targetDir, overwrite: overwrite === true }, root)
}

/** State of a background job. */
export function jobStatus(jobId, { root } = {}) {
  return call('job', { jobId }, root)
}

/** Ask a job to stop after the current file. */
export function cancelJob(jobId, { root } = {}) {
  return post('cancel', { jobId }, root)
}

/** Size and number of entries inside a directory. */
export function dirSize(path, { root } = {}) {
  return call('size', { path }, root)
}

/** Create a directory; an existing one is not overwritten. */
export function makeDir(path, { root } = {}) {
  return post('mkdir', { path }, root)
}
