/**
 * Browser state: two NC-style panes and the viewer below them.
 *
 * The state snapshot is immutable: every change produces a new object. Otherwise
 * `useSyncExternalStore` sees no difference (it compares by reference) and the UI
 * silently stops updating — that was the cause of the unclickable breadcrumbs.
 *
 * Every session has its own state: the path, the sorting and the "hidden" flag of
 * both panes, the active pane and the files open in the viewer. It lives in the
 * tab's memory, so it survives tab and session switches but not a page reload.
 */

/** State of a single pane. */
export function newPane(path = null) {
  return { path, sortKey: 'name', sortDir: 1, showHidden: false }
}

/** Extension used as the "by type" sort key; without a dot it is an empty string. */
export function typeOf(name) {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Empty state: two panes, the left one active, no cursor. */
function emptyState(key) {
  return {
    key,
    panes: [newPane(), newPane()],
    activePane: 0,
    /** Full path of the highlighted row in each pane — the NC cursor. */
    cursor: [null, null],
    /** Marked rows of each pane: copy and delete operate on them. */
    marks: [[], []],
    openFiles: [],
    activePath: null,
    /** 'panes' — two panes, 'file' — full-screen viewer. */
    viewMode: 'panes',
    /** "Reload the directories" counter: grows after file operations. */
    revision: 0,
    /** The open dialog (plan, progress, size count): kept in the store to survive re-renders. */
    dialog: null,
    /** Jobs moved to the background: survive a page reload. */
    tasks: [],
  }
}

const STORAGE_PREFIX = 'dsh-nc:state:'

/** Read the saved session state from localStorage. */
function loadState(key) {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const saved = JSON.parse(raw)
    const base = emptyState(key)
    return {
      ...base,
      panes: [0, 1].map((index) => {
        const pane = { ...newPane(), ...(saved.panes?.[index] ?? {}) }
        if (pane.sortKey !== 'type') pane.sortKey = 'name'
        if (pane.sortDir !== -1) pane.sortDir = 1
        return pane
      }),
      activePane: saved.activePane === 1 ? 1 : 0,
      cursor: [saved.cursor?.[0] ?? null, saved.cursor?.[1] ?? null],
      marks: [
        Array.isArray(saved.marks?.[0]) ? saved.marks[0] : [],
        Array.isArray(saved.marks?.[1]) ? saved.marks[1] : [],
      ],
      openFiles: Array.isArray(saved.openFiles) ? saved.openFiles : [],
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      fileStates: saved.fileStates && typeof saved.fileStates === 'object' ? saved.fileStates : {},
      activePath: saved.activePath ?? null,
      viewMode: saved.viewMode === 'file' ? 'file' : 'panes',
    }
  } catch {
    return null
  }
}

/** Write the session state to localStorage: a page reload does not lose it. */
function saveState(state) {
  try {
    const { key, dialog, ...rest } = state
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(rest))
  } catch {
    // Private mode without localStorage: the memory stays in the runtime only.
  }
}

/** Persistent memory keyed by session (or by pane when there is no session). */
const memory = new Map()

const listeners = new Set()

/** Current state; replaced as a whole when the session changes. */
let current = emptyState(null)

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Mark the state as changed: build a new object, remember it and notify the listeners.
 * @param patch - top-level fields that change.
 * @param panePatch - keyed by pane index: what changes inside that pane.
 */
function commit(patch, panePatch) {
  const panes = panePatch
    ? current.panes.map((pane, index) => (panePatch[index] ? { ...pane, ...panePatch[index] } : pane))
    : current.panes
  current = { ...current, ...patch, panes }
  if (current.key !== null) {
    memory.set(current.key, current)
    saveState(current)
  }
  emit()
}

export const ncStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return current
  },
  /**
   * Switch to the state of a session: every session has its own panes.
   * @param key - session id or a fixed key for a tab without a session.
   */
  bind(key) {
    if (current.key === key) return
    if (current.key !== null) memory.set(current.key, current)
    current = memory.get(key) ?? loadState(key) ?? emptyState(key)
    memory.set(key, current)
    emit()
  },
  /** Active pane: a pane click, Tab, or a move into that pane. */
  setActivePane(index) {
    if (current.activePane === index) return
    commit({ activePane: index })
  },
  /** Tab: switch the active pane. */
  toggleActivePane() {
    commit({ activePane: current.activePane === 0 ? 1 : 0 })
  },
  /** Directory of a single pane. */
  setPath(index, path) {
    if (current.panes[index].path === path) return
    // Changing the directory always clears the marks — as in NC.
    const marks = [...current.marks]
    marks[index] = []
    commit({ activePane: index, marks }, { [index]: { path } })
  },
  /** Sorting of a single pane: the same key flips the direction. */
  toggleSort(index, key) {
    const pane = current.panes[index]
    const next = pane.sortKey === key ? { sortDir: -pane.sortDir } : { sortKey: key, sortDir: 1 }
    commit({ activePane: index }, { [index]: next })
  },
  /** Set the pane sort key explicitly (from the menu). */
  setSort(index, key) {
    if (current.panes[index].sortKey === key) return
    commit({ activePane: index }, { [index]: { sortKey: key } })
  },
  /** Set the direction explicitly: 1 — ascending, -1 — reversed. */
  setSortDir(index, dir) {
    if (current.panes[index].sortDir === dir) return
    commit({ activePane: index }, { [index]: { sortDir: dir } })
  },
  toggleHidden(index) {
    commit({ activePane: index }, { [index]: { showHidden: !current.panes[index].showHidden } })
  },
  /** Mark or unmark a row (Ctrl-click). */
  toggleMark(index, path) {
    const marks = [...current.marks]
    const pane = marks[index] ?? []
    marks[index] = pane.includes(path) ? pane.filter((item) => item !== path) : [...pane, path]
    commit({ marks })
  },
  /** Replace the set of marked rows of a pane (Shift-click, "clear all"). */
  setMarks(index, paths) {
    const marks = [...current.marks]
    marks[index] = [...paths]
    commit({ marks })
  },
  /** Clear the marks of both panes — after a completed operation. */
  clearMarks() {
    commit({ marks: [[], []] })
  },
  /** Cursor of a single pane: we remember the path of the highlighted row, not the object. */
  setCursor(index, path) {
    if (current.cursor[index] === path) return
    const cursor = [...current.cursor]
    cursor[index] = path
    commit({ cursor }, {})
  },
  /** Open a file: the viewer takes the whole tab screen. */
  /** Open a file by path: the name comes from the path, no duplicates. */
  openPath(path) {
    if (!path) return
    const name = path.split('/').filter(Boolean).pop() ?? path
    const openFiles = current.openFiles.some((file) => file.path === path)
      ? current.openFiles
      : [...current.openFiles, { path, name }]
    commit({ openFiles, activePath: path, viewMode: 'file' })
  },
  openFile(entry) {
    const openFiles = current.openFiles.some((file) => file.path === entry.path)
      ? current.openFiles
      : [...current.openFiles, { path: entry.path, name: entry.name }]
    commit({ openFiles, activePath: entry.path, viewMode: 'file' })
  },
  /** Return from the viewer to the panes. */
  backToPanes() {
    if (current.viewMode === 'panes') return
    commit({ viewMode: 'panes' })
  },
  /** List of background jobs: refreshed by polling, survives a reload. */
  setTasks(value) {
    const next = typeof value === 'function' ? value(current.tasks) : value
    commit({ tasks: next })
  },
  /** Open or close a dialog above the panes (plan, progress, size count). */
  setDialog(value) {
    const next = typeof value === 'function' ? value(current.dialog) : value
    commit({ dialog: next })
  },
  /** Remember one file's viewer state: rendered/source mode and the scroll offset. */
  setFileState(path, patch) {
    if (!path) return
    const fileStates = { ...(current.fileStates ?? {}) }
    fileStates[path] = { ...(fileStates[path] ?? {}), ...patch }
    commit({ fileStates })
  },
  /** Reload the directories of both panes (after a copy, move or rename). */
  refresh() {
    commit({ revision: (current.revision ?? 0) + 1 })
  },
  /** Show an open file again without changing the list of sub-tabs. */
  showFile(path) {
    commit({ activePath: path, viewMode: 'file' })
  },
  closeFile(path) {
    const openFiles = current.openFiles.filter((file) => file.path !== path)
    const activePath =
      current.activePath === path ? (openFiles[openFiles.length - 1]?.path ?? null) : current.activePath
    commit({ openFiles, activePath, ...(activePath === null ? { viewMode: 'panes' } : {}) })
  },
  focusFile(path) {
    if (current.activePath === path) return
    commit({ activePath: path })
  },
}

/**
 * Sort the directory rows: directories always come first, then by name or by type.
 * @param entries - listing rows.
 * @param key - 'name' or 'type' (extension).
 * @param dir - 1 for ascending, -1 for descending.
 */
export function sortEntries(entries, key, dir) {
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  return [...entries].sort((a, b) => {
    if (a.kind === 'dir' && b.kind !== 'dir') return -1
    if (b.kind === 'dir' && a.kind !== 'dir') return 1
    if (key === 'type') {
      const byType = typeOf(a.name).localeCompare(typeOf(b.name), undefined, { sensitivity: 'base' })
      if (byType !== 0) return byType * dir
      return byName(a, b)
    }
    return byName(a, b) * dir
  })
}

/** Size in a human-readable form. */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 10 || unit === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

/** File time formatted as YYYY-MM-DD HH:MM. */
export function formatTime(mtimeMs) {
  if (!mtimeMs) return ''
  const date = new Date(mtimeMs)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Permissions in the traditional form: drwxr-xr-x. */
export function formatMode(mode, kind) {
  if (!Number.isFinite(mode) || mode === 0) return ''
  const type = kind === 'dir' ? 'd' : '-'
  const triple = (shift) => {
    const bits = (mode >> shift) & 7
    return `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${bits & 1 ? 'x' : '-'}`
  }
  return `${type}${triple(6)}${triple(3)}${triple(0)}`
}
