/**
 * A file browser in the spirit of Norton Commander: two panes with independent
 * directories, a viewer with sub-tabs below them and an action bar at the bottom.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  cancelJob,
  fetchHome,
  fetchList,
  fetchText,
  jobStatus,
  makeDir,
  moveEntry,
  dirSize,
  planTransfer,
  rawUrl,
  startTransfer,
} from './api.js'
import { formatMode, formatSize, formatTime, ncStore, sortEntries } from './store.js'
import { highlight, languageOf, TOKEN_COLORS } from './highlight.js'
import { MarkdownView } from './Markdown.jsx'
import { sendCommentToChat } from './chatBridge.js'
import { useT } from './index.jsx'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'])

function extensionOf(name) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function previewKindOf(name) {
  const ext = extensionOf(name)
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown') return 'markdown'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'mp4' || ext === 'webm') return 'video'
  if (ext === 'mp3' || ext === 'ogg' || ext === 'wav') return 'audio'
  return 'text'
}

const COLORS = {
  border: 'var(--dsw-alias-border-l1, rgba(28,35,51,0.12))',
  text: 'var(--dsw-alias-label-primary, #2b3446)',
  dim: 'var(--dsw-alias-label-secondary, #5a6478)',
  hover: 'var(--dsw-alias-interactive-bg-hover, rgba(28,35,51,0.05))',
  active: 'var(--dsw-alias-interactive-bg-active, rgba(45,102,247,0.12))',
  accent: 'var(--dsw-alias-link, #2d66f7)',
  danger: 'var(--dsw-alias-label-danger, #c0392b)',
}

const styles = {
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    // The background is required: otherwise the chat shows through the empty areas and
    // its width handle catches the mouse instead of our panes.
    background: 'var(--dsw-alias-bg-base, #14181f)',
    isolation: 'isolate',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
    color: COLORS.text,
    // The size comes from the shell: the font slider in the settings moves us too.
    fontSize: 'var(--dsh-content-font-size, 13px)',
  },
  panes: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' },
  pane: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' },
  paneActive: { boxShadow: `inset 0 0 0 1px ${COLORS.accent}` },
  divider: { width: 1, background: COLORS.border, flex: 'none' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 30,
    flexWrap: 'wrap',
  },
  crumb: {
    border: 'none',
    background: 'transparent',
    color: COLORS.accent,
    cursor: 'pointer',
    padding: '1px 2px',
    font: 'inherit',
    borderRadius: 4,
  },
  crumbCurrent: { color: COLORS.text, fontWeight: 600, cursor: 'default' },
  separator: { color: COLORS.dim },
  input: {
    flex: '1 1 120px',
    minWidth: 90,
    padding: '2px 6px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: 'transparent',
    color: COLORS.text,
    font: 'inherit',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: 'transparent',
    color: COLORS.text,
    cursor: 'pointer',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    flex: 'none',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    zIndex: 30,
    minWidth: 210,
    padding: 6,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: 'var(--dsw-alias-bg-layer-2, #1b2029)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  },
  menuTitle: {
    color: COLORS.dim,
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    padding: '4px 8px 2px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '4px 8px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: COLORS.text,
    font: 'inherit',
    fontSize: 'var(--dsh-content-font-size, 13px)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuBox: { width: 12, display: 'inline-block', color: COLORS.accent },
  statName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: COLORS.text,
    fontSize: '0.8em',
    alignSelf: 'center',
    minWidth: 0,
  },
  statRight: {
    color: COLORS.dim,
    fontSize: '0.8em',
    whiteSpace: 'nowrap',
    alignSelf: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  headerRow: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '1fr auto 26px',
    // No caps: a file name is written the way the file system has it.
    textTransform: 'none',
    letterSpacing: 'normal',
    gap: 6,
    padding: '2px 8px',
    borderBottom: `1px solid ${COLORS.border}`,
    color: COLORS.dim,
    fontSize: 'var(--dsh-content-font-size-secondary, 11px)',
  },
  headerButton: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textTransform: 'inherit',
    letterSpacing: 'inherit',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
  list: { flex: 1, overflow: 'auto', minHeight: 0 },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 84px',
    gap: 6,
    alignItems: 'baseline',
    padding: '2px 8px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  rowName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowSize: { color: COLORS.dim, fontSize: 'var(--dsh-content-font-size-secondary, 12px)', textAlign: 'right', whiteSpace: 'nowrap' },
  fullViewer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
  viewerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 32,
  },
  viewerPath: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: COLORS.dim,
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
  },
  fullViewerBody: { flex: 1, overflow: 'auto', minHeight: 0, padding: 10 },
  viewer: {
    display: 'flex',
    flexDirection: 'column',
    flex: '0 0 42%',
    minHeight: 120,
    borderTop: `1px solid ${COLORS.border}`,
  },
  tabs: {
    display: 'flex',
    flex: '0 0 auto',
    gap: 2,
    padding: '3px 6px 0',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 28,
  },
  tab: {
    display: 'flex',
    flex: '0 0 auto',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    color: COLORS.dim,
  },
  tabClose: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    padding: '0 2px',
    font: 'inherit',
    opacity: 0.7,
  },
  viewerBody: { flex: 1, overflow: 'auto', minHeight: 0, padding: 8 },
  pathBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderTop: `1px solid ${COLORS.border}`,
    minHeight: 32,
  },
  pathLabel: { color: COLORS.dim, fontSize: 'var(--dsh-content-font-size-secondary, 12px)', whiteSpace: 'nowrap' },
  pre: {
    margin: 0,
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    lineHeight: 1.5,
    whiteSpace: 'pre',
    tabSize: 4,
  },
  lineNumber: {
    color: COLORS.dim,
    userSelect: 'none',
    paddingRight: 10,
    textAlign: 'right',
    display: 'inline-block',
    minWidth: 38,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderTop: `1px solid ${COLORS.border}`,
    minHeight: 32,
    flexWrap: 'wrap',
  },
  button: {
    padding: '2px 8px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: 'transparent',
    color: COLORS.text,
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
  },
  buttonDisabled: { opacity: 0.45, cursor: 'default' },
  buttonOn: { borderColor: COLORS.accent, color: COLORS.accent },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  dialog: {
    width: 'min(620px, 92%)',
    maxHeight: '80%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    background: 'var(--dsw-alias-bg-layer-2, #1b2029)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  },
  dialogTitle: { fontSize: 'var(--dsh-content-font-size, 13px)', fontWeight: 600 },
  dialogNote: { color: COLORS.dim, fontSize: 'var(--dsh-content-font-size-secondary, 12px)' },
  listBox: {
    maxHeight: 220,
    overflow: 'auto',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '6px 8px',
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  dialogActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  toasts: {
    position: 'absolute',
    right: 12,
    bottom: 96,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    zIndex: 20,
    pointerEvents: 'none',
  },
  toast: {
    background: 'var(--dsw-alias-bg-layer-2, rgba(20,24,34,0.92))',
    color: 'var(--dsw-alias-label-primary, #fff)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 'var(--dsh-content-font-size-secondary, 12px)',
    maxWidth: 460,
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  },
  note: { color: COLORS.dim, fontSize: 12 },
  error: { color: COLORS.danger, padding: 8, fontSize: 12 },
}

/**
 * Breadcrumbs built from the path string: there may be no listing (the directory is
 * unavailable or the path turned out to be a file), but going up must always work.
 */
function fallbackCrumbs(path) {
  if (!path) return [{ name: '/', path: '/' }]
  const crumbs = [{ name: '/', path: '/' }]
  let current = ''
  for (const part of path.split('/').filter(Boolean)) {
    current = `${current}/${part}`
    crumbs.push({ name: part, path: current })
  }
  return crumbs
}

/** Parent directory of a path. */
function parentOf(path) {
  if (!path || path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : `/${parts.join('/')}`
}

/** A list row: name and size; for a directory the size cell stays empty. */
function EntryRow({ entry, selected, marked, measured, onSelect, onActivate }) {
  return (
    <div
      style={{
        ...styles.row,
        background: marked
          ? 'var(--dsw-alias-interactive-bg-selected, rgba(45,102,247,0.18))'
          : selected
            ? COLORS.active
            : 'transparent',
        fontWeight: marked ? 600 : 400,
        boxShadow: marked ? `inset 2px 0 0 ${COLORS.accent}` : 'none',
      }}
      data-nc-path={entry.path}
      onClick={(event) => onSelect(event)}
      onDoubleClick={onActivate}
      onMouseEnter={(event) => {
        if (!selected) event.currentTarget.style.background = COLORS.hover
      }}
      onMouseLeave={(event) => {
        if (!selected) event.currentTarget.style.background = 'transparent'
      }}
      title={entry.path}
    >
      <span style={styles.rowName}>
        {entry.kind === 'dir' ? '📁 ' : '📄 '}
        {entry.name}
      </span>
      <span style={styles.rowSize}>
        {entry.kind === 'dir' ? (measured ? formatSize(measured.bytes) : '') : formatSize(entry.size)}
      </span>
    </div>
  )
}

/** One pane: breadcrumbs up to the root, the absolute path field, the sortable list. */
function Pane({ index, pane, active, root, cursorPath, onCursor, onResolved, onError, onOpenPath, revision, marks, onCopyPath, onRename, onEntries, dirSizes, onCreateFolder }) {
  const t = useT()
  const [listing, setListing] = useState(null)
  const [tick, setTick] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const listRef = useRef(null)
  // Self-recovery from a saved broken path — once, so we do not silently climb upwards.
  const recovered = useRef(false)

  useEffect(() => {
    if (!pane.path) return undefined
    let cancelled = false
    fetchList(pane.path, { hidden: pane.showHidden, root })
      .then((body) => {
        if (cancelled) return
        recovered.current = false
        setListing(body)
      })
      .catch((failure) => {
        if (cancelled) return
        // The path turned out to be a file: do not push the pane into an error, open it in the viewer.
        if (failure.code === 'not-a-directory') {
          onOpenPath(pane.path, listing?.path ?? parentOf(pane.path))
          return
        }
        onError(failure.message)
        // Unavailable or vanished directory: go one level up, once, otherwise the pane
        // stays empty forever (that is what happened with a saved path to a file).
        if (!recovered.current && !listing) {
          recovered.current = true
          ncStore.setPath(index, parentOf(pane.path))
        }
      })
    return () => {
      cancelled = true
    }
  }, [pane.path, pane.showHidden, root, tick, revision])

  const entries = useMemo(
    () => (listing ? sortEntries(listing.entries, pane.sortKey, pane.sortDir) : []),
    [listing, pane.sortKey, pane.sortDir],
  )

  // The cursor lives in the store (the path of the highlighted row), and the row object is derived from it.
  const selected = useMemo(() => entries.find((entry) => entry.path === cursorPath) ?? null, [entries, cursorPath])

  useEffect(() => {
    onResolved(index, selected)
  }, [selected, index, onResolved])

  // The cursor must be visible: scroll the list to the row under it.
  useEffect(() => {
    if (!cursorPath) return
    const container = listRef.current
    if (!container) return
    const row = container.querySelector(`[data-nc-path="${CSS.escape ? CSS.escape(cursorPath) : cursorPath}"]`)
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [cursorPath, entries])

  // The row list is needed up top: the keyboard arrows walk through it.
  useEffect(() => {
    onEntries(index, entries)
  }, [entries, index, onEntries])

  const go = useCallback(
    (target) => {
      if (!target) return
      // A relative path is resolved against the pane's own directory, not the server's.
      const trimmed = target.trim().replace(/\/+$/, '') || '/'
      const absolute = trimmed.startsWith('/') ? trimmed : `${pane.path ?? ''}/${trimmed}`
      onCursor(index, null)
      ncStore.setPath(index, absolute)
    },
    [index, pane.path, onCursor],
  )

  const activate = (entry) => {
    if (entry.kind === 'dir') {
      go(entry.path)
      return
    }
    ncStore.openFile(entry)
  }

  /** Row click: a plain one sets the cursor, Ctrl marks, Shift selects a range from the cursor. */
  const select = (entry, event) => {
    ncStore.setActivePane(index)
    if (event?.shiftKey && cursorPath && entry) {
      const from = entries.findIndex((row) => row.path === cursorPath)
      const to = entries.findIndex((row) => row.path === entry.path)
      if (from !== -1 && to !== -1) {
        const [low, high] = from < to ? [from, to] : [to, from]
        ncStore.setMarks(index, entries.slice(low, high + 1).map((row) => row.path))
        onCursor(index, entry.path)
        return
      }
    }
    if (event?.ctrlKey || event?.metaKey) {
      ncStore.toggleMark(index, entry.path)
      onCursor(index, entry.path)
      return
    }
    onCursor(index, entry?.path ?? null)
  }

  const sortMark = (key) => (pane.sortKey === key ? (pane.sortDir === 1 ? ' ▲' : ' ▼') : '')

  return (
    <div
      style={{ ...styles.pane, ...(active ? styles.paneActive : null) }}
      onMouseDown={() => ncStore.setActivePane(index)}
    >
      <div style={styles.toolbar}>
        <button
          type="button"
          style={styles.iconButton}
          onClick={async () => {
            try {
              go(await fetchHome())
            } catch {
              go('/')
            }
          }}
          title={t('panel.home')}
        >
          ⌂
        </button>
        {(listing?.crumbs ?? fallbackCrumbs(pane.path)).map((crumb, position, all) => {
          const last = position === all.length - 1
          // The separator lives inside the button: `/`, `home/`, `dsh/`.
          const text = crumb.path === '/' ? '/' : `${crumb.name}/`
          return (
            <button
              key={crumb.path}
              type="button"
              style={{ ...styles.crumb, ...(last ? styles.crumbCurrent : null) }}
              onClick={() => {
                if (!last) go(crumb.path)
              }}
              title={crumb.path}
            >
              {text}
            </button>
          )
        })}
      </div>

      <div style={styles.headerRow}>
        <span style={styles.statName} title={selected?.path ?? ''}>
          {selected?.name ?? ''}
        </span>
        <span style={styles.statRight}>
          {selected
            ? [
                formatMode(selected.mode, selected.kind),
                selected.kind === 'dir'
                  ? (dirSizes[selected.path] ? formatSize(dirSizes[selected.path].bytes) : '')
                  : formatSize(selected.size) || t('unit.zero'),
                selected.mtimeMs ? formatTime(selected.mtimeMs) : '',
              ]
                .filter(Boolean)
                .join('  ')
            : ''}
        </span>
        <button
          type="button"
          style={styles.iconButton}
          onClick={() => setMenuOpen((open) => !open)}
          title={t('panel.menu')}
        >
          ⋮
        </button>

        {menuOpen ? (
          <div style={styles.menu} onMouseLeave={() => setMenuOpen(false)}>
            <div style={styles.menuTitle}>{t('menu.sort')}</div>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => ncStore.setSort(index, 'name')}
            >
              <span style={styles.menuBox}>{pane.sortKey === 'name' ? '✓' : ''}</span>
              {t('sort.byName')}
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => ncStore.setSort(index, 'type')}
            >
              <span style={styles.menuBox}>{pane.sortKey === 'type' ? '✓' : ''}</span>
              {t('sort.byType')}
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => ncStore.setSortDir(index, pane.sortDir === -1 ? 1 : -1)}
            >
              <span style={styles.menuBox}>{pane.sortDir === -1 ? '✓' : ''}</span>
              {t('sort.reverse')}
            </button>
            <div style={styles.menuTitle}>{t('menu.filter')}</div>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => ncStore.toggleHidden(index)}
            >
              <span style={styles.menuBox}>{pane.showHidden ? '✓' : ''}</span>
              {t('filter.hidden')}
            </button>
            <div style={styles.menuTitle}>{t('menu.file')}</div>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                if (selected) onCopyPath(selected.path)
                setMenuOpen(false)
              }}
            >
              <span style={styles.menuBox} />
              {t('file.copyPath')}
            </button>
            <button
              type="button"
              style={{ ...styles.menuItem, ...(selected ? null : { opacity: 0.5 }) }}
              onClick={() => {
                if (selected) onRename(selected.path, selected.name)
                setMenuOpen(false)
              }}
            >
              <span style={styles.menuBox} />
              {t('file.rename')}
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                onCreateFolder()
                setMenuOpen(false)
              }}
            >
              <span style={styles.menuBox} />
              {t('file.mkdir')} (F7)
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                ncStore.setMarks(index, [])
                setMenuOpen(false)
              }}
            >
              <span style={styles.menuBox} />
              {t('file.clearMarks')}
            </button>
          </div>
        ) : null}
      </div>

      <div style={styles.list} ref={listRef} data-nc-list={index}>
        {listing && entries.length === 0 ? <div style={styles.note}>{t('msg.empty')}</div> : null}
        {entries.map((entry) => (
          <EntryRow
            key={entry.path}
            entry={entry}
            selected={selected?.path === entry.path}
            marked={(marks ?? []).includes(entry.path)}
            measured={dirSizes[entry.path]}
            onSelect={(event) => select(entry, event)}
            onActivate={() => activate(entry)}
          />
        ))}
      </div>
    </div>
  )
}

/** View of the contents of the open file. */
function Preview({ path, root, name, mode = 'source', sessionId, selection, setSelection }) {
  const t = useT()

  useEffect(() => {
    setSelection(null)
  }, [path, setSelection])

  const selectLine = (row) => {
    setSelection((previous) => (previous && previous.from === row && previous.to === row ? null : { from: row, to: row }))
  }
  const [state, setState] = useState({ status: 'loading' })
  const kind = previewKindOf(name)
  // Markdown in "Render" mode and html in "Source" mode need the text as well.
  const wantsText = kind === 'text' || kind === 'markdown'

  useEffect(() => {
    if (!wantsText) {
      setState({ status: 'media' })
      return undefined
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetchText(path, { root })
      .then((body) => {
        if (cancelled) return
        setState(body.kind === 'binary' ? { status: 'binary', size: body.size } : { status: 'text', body })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message })
      })
    return () => {
      cancelled = true
    }
  }, [path, root, wantsText])

  if (state.status === 'loading') return <div style={styles.note}>{t('msg.loading')}</div>
  if (state.status === 'error') return <div style={styles.error}>{state.message}</div>
  if (state.status === 'binary') {
    return (
      <div style={styles.note}>
        {t('msg.binary')}, {formatSize(state.size)}.{' '}
        <a href={rawUrl(path, root)} target="_blank" rel="noreferrer">
          {t('btn.download.plain')}
        </a>
      </div>
    )
  }
  if (state.status === 'media') {
    const url = rawUrl(path, root)
    if (kind === 'html') {
      return (
        <iframe
          src={url}
          title={name}
          sandbox=""
          style={{ width: '100%', height: '100%', border: 'none', minHeight: 360, background: '#fff' }}
        />
      )
    }
    if (kind === 'image') return <img src={url} alt={name} style={{ maxWidth: '100%', borderRadius: 6 }} />
    if (kind === 'pdf') return <iframe src={url} title={name} style={{ width: '100%', height: '100%', border: 'none', minHeight: 320 }} />
    if (kind === 'video') return <video src={url} controls style={{ maxWidth: '100%' }} />
    return <audio src={url} controls />
  }
  const text = state.body.text ?? ''
  if (kind === 'markdown' && mode === 'rendered') {
    return <MarkdownView text={text} file={path} />
  }
  const painted = highlight(text, languageOf(name))
  const lines = painted ?? text.split('\n').map((line) => [{ text: line, type: 'plain' }])
  return (
    <div>
      <pre style={styles.pre}>
        {lines.map((line, number) => {
          const row = number + 1
          const inSelection = selection !== null && row >= selection.from && row <= selection.to
          return (
          <div
            key={number}
            style={inSelection ? styles.lineSelected : undefined}
            data-line={row}
            onMouseDown={(event) => {
              if (event.shiftKey && selection) {
                // Shift extends the range; the anchor stays where the first click was.
                event.preventDefault()
                setSelection({ from: Math.min(selection.from, row), to: Math.max(selection.from, row), anchor: row })
                return
              }
              selectLine(row)
            }}
          >
            <span style={{ ...styles.lineNumber, ...(inSelection ? styles.lineNumberSelected : null) }}>
              {row}
            </span>
            {line.length === 0
              ? '\u200b'
              : line.map((piece, index) => (
                  <span key={index} style={{ color: TOKEN_COLORS[piece.type] ?? 'inherit' }}>
                    {piece.text}
                  </span>
                ))}
          </div>
          )
        })}
      </pre>
      {state.body.truncated ? (
        <div style={styles.note}>
          {t('msg.truncated', { shown: formatSize((state.body.text ?? '').length), total: formatSize(state.body.size) })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The browser: two panes and the viewer.
 * @param props.sessionKey - state key: every session has its own panes and open files.
 * @param props.startPath - directory both panes start from in a new session.
 * @param props.root - root of the browse scope in workdir mode.
 */
export function FileBrowser({ sessionKey, startPath, root, focusRequest, onFocusHandled }) {
  const t = useT()
  const key = sessionKey ?? 'default'
  // The third argument is for server rendering and tests: the same snapshot as in the browser.
  const state = useSyncExternalStore(ncStore.subscribe, ncStore.getSnapshot, ncStore.getSnapshot)
  const [resolved, setResolved] = useState({ 0: null, 1: null })
  const [pathDraft, setPathDraft] = useState('')
  const [toasts, setToasts] = useState([])
  // Line selection of the text viewer: { from, to }, 1-based and inclusive.
  const [lineSelection, setLineSelection] = useState(null)
  // View mode: rendered or source. Markdown and HTML have two views, the rest have one.
  const [sourceView, setSourceView] = useState(false)
  // The transfer dialog lives in the store: a re-render or a remount does not dismiss it.
  const transfer = state.dialog
  const setTransfer = useCallback((value) => ncStore.setDialog(value), [])
  // Measured directory sizes: path → {bytes, files, dirs}; they live until we change the directory.
  const [dirSizes, setDirSizes] = useState({})
  // What F3 is counting right now (the directory path) — for the dialog with the spinner.
  const [sizeQuery, setSizeQuery] = useState(null)
  // Permission to overwrite existing targets: off by default.
  const [allowOverwrite, setAllowOverwrite] = useState(false)
  // External focus request (a click on a file link in chat): open that file.
  useEffect(() => {
    if (!focusRequest || focusRequest.view !== 'nc-files') return
    const path = focusRequest.focus
    if (path) ncStore.openPath(path)
    if (typeof onFocusHandled === 'function') onFocusHandled()
  }, [focusRequest, onFocusHandled])

  // Jobs moved to the background: they live in the store and survive a page reload.
  const background = state.tasks ?? []
  const setBackground = useCallback((value) => ncStore.setTasks(value), [])
  // Which job has already been reported — otherwise the poller repeats the message.
  const announced = useRef(new Set())

  /** Show a message for five seconds: the pane keeps working meanwhile. */
  const toast = useCallback((text) => {
    const id = Date.now() + Math.random()
    setToasts((previous) => [...previous, { id, text }])
    setTimeout(() => setToasts((previous) => previous.filter((item) => item.id !== id)), 5000)
  }, [])

  /** The path turned out to be a file: open it and return the pane to its previous directory. */
  const openPathInPane = useCallback(
    (index) => (path, fallback) => {
      const name = path.split('/').filter(Boolean).pop() ?? path
      ncStore.openFile({ path, name })
      if (fallback) ncStore.setPath(index, fallback)
    },
    [],
  )

  const onResolved = useCallback((index, entry) => {
    setResolved((previous) => (previous[index] === entry ? previous : { ...previous, [index]: entry }))
  }, [])

  const onCursor = useCallback((index, path) => {
    ncStore.setCursor(index, path)
  }, [])

  // Tab switches the active pane, as in NC. Inside input fields Tab stays a normal
  // Tab: otherwise the path field could not be left with the keyboard.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      const tag = target instanceof HTMLElement ? target.tagName : ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      event.preventDefault()
      // A snapshot rather than the effect closure: otherwise the active pane is read from the first render.
      const snapshot = ncStore.getSnapshot()
      const nextPane = snapshot.activePane === 0 ? 1 : 0
      ncStore.toggleActivePane()
      // The cursor of the new pane may not be set — stand on the first row.
      if (!snapshot.cursor[nextPane]) {
        const entries = paneEntries.current[nextPane] ?? []
        if (entries[0]) ncStore.setCursor(nextPane, entries[0].path)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Esc closes the open file: once no sub-tabs are left we return to the panes.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      const state_ = ncStore.getSnapshot()
      if (state_.viewMode === 'file' && state_.activePath) ncStore.closeFile(state_.activePath)
      // Close the tab and return to the panes in any case, even if many files remain open.
      ncStore.backToPanes()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Own state per session: both panes start in the start directory if this session has
  // not walked them yet. bind must not be called during a render — it notifies subscribers.
  useEffect(() => {
    ncStore.bind(key)
    let cancelled = false
    const place = async () => {
      const snapshot = ncStore.getSnapshot()
      if (snapshot.panes[0].path && snapshot.panes[1].path) return
      let start = startPath
      if (!start) {
        try {
          start = await fetchHome()
        } catch {
          start = '/'
        }
      }
      if (cancelled) return
      if (!ncStore.getSnapshot().panes[0].path) ncStore.setPath(0, start)
      if (!ncStore.getSnapshot().panes[1].path) ncStore.setPath(1, start)
    }
    void place()
    return () => {
      cancelled = true
    }
  }, [key, startPath])

  // The size cache belongs to the directories where it was measured; it is not needed after leaving.
  const panesKey = `${state.panes[0].path ?? ''}|${state.panes[1].path ?? ''}`
  useEffect(() => {
    setDirSizes({})
  }, [panesKey])

  const pane = state.panes[state.activePane]
  const current = resolved[state.activePane]
  useEffect(() => {
    setSourceView(false)
  }, [state.activePath])

  const activeFile = useMemo(
    () => state.openFiles.find((file) => file.path === state.activePath) ?? null,
    [state.openFiles, state.activePath],
  )

  /** The directory of the other pane — that is where we copy and move, as in NC. */
  const otherDir = state.panes[state.activePane === 0 ? 1 : 0].path

  /** Rows of each pane: the keyboard arrows walk through them. */
  const paneEntries = useRef({ 0: [], 1: [] })
  const registerEntries = useCallback((index, entries) => {
    paneEntries.current[index] = entries
  }, [])

  /** Count the size of a directory (F3): a dialog with a spinner, the result goes to the stat line. */
  const measureDir = useCallback(
    async (path) => {
      setSizeQuery(path)
      try {
        const measured = await dirSize(path, { root })
        setDirSizes((previous) => ({ ...previous, [path]: measured }))
      } catch (failure) {
        toast(describeError(t, failure))
      } finally {
        setSizeQuery(null)
      }
    },
    [root, toast],
  )

  /** What we transfer: the marked rows, or the row under the cursor when nothing is marked. */
  const sourcesOf = useCallback(() => {
    const marks = state.marks[state.activePane] ?? []
    if (marks.length > 0) return marks
    return current ? [current.path] : []
  }, [state.marks, state.activePane, current])

  /** Copy (F5) and move (F6): the plan first, then the confirmation. */
  const openTransfer = useCallback(
    async (mode) => {
      const sources = sourcesOf()
      if (sources.length === 0) {
        toast(t('msg.nothingTransfer'))
        return
      }
      if (mode !== 'delete' && !otherDir) {
        toast(t('msg.noOtherPane'))
        return
      }
      // The dialog first, the request after: walking a large directory is not instant,
      // and without this the button seems not to work.
      setAllowOverwrite(false)
      setTransfer({ phase: 'planning', op: mode, sources, targetDir: mode === 'delete' ? null : otherDir })
      try {
        const plan = await planTransfer(mode, sources, otherDir, { root })
        setTransfer({ phase: 'plan', op: mode, sources, targetDir: otherDir, plan })
      } catch (failure) {
        // The dialog is not closed: the reason shows up where the wait was.
        setTransfer({ phase: 'plan-error', op: mode, sources, targetDir: otherDir, error: describeError(t, failure) })
      }
    },
    [sourcesOf, otherDir, root, toast],
  )

  /** Execute the shown plan: the job goes to the background and the dialog becomes the progress. */
  const runTransfer = useCallback(async () => {
    if (!transfer) return
    // A visible reaction to the button first: the server recomputes the plan before it answers.
    setTransfer({ ...transfer, phase: 'starting' })
    try {
      const started = await startTransfer(transfer.op, transfer.sources, transfer.targetDir, {
        root,
        overwrite: allowOverwrite,
      })
      // The marks are cleared right after the start: if the tab is closed the polling stops
      // and nobody would clear them — and a selection must not outlive the operation.
      ncStore.clearMarks()
      setTransfer((previous) => (previous ? { ...previous, phase: 'progress', jobId: started.jobId, progress: null } : previous))
    } catch (failure) {
      toast(describeError(t, failure))
      setTransfer(null)
    }
  }, [transfer, root, toast, allowOverwrite])

  /** Rename: a new name in the same directory (the pane menu and Shift-F6). */
  const renameEntry = useCallback(
    async (path, oldName) => {
      const name = window.prompt(t('msg.renamePrompt'), oldName)
      if (!name || name === oldName) return
      const dir = path.slice(0, path.lastIndexOf('/')) || '/'
      try {
        await moveEntry(path, `${dir}/${name}`, { root })
        toast(t('msg.renamed', { from: oldName, to: name }))
        ncStore.refresh()
      } catch (failure) {
        toast(describeError(t, failure))
      }
    },
    [root, toast],
  )

  /** Shift-F6: rename the row under the cursor. */
  const renameCurrent = useCallback(async () => {
    if (!current) {
      toast(t('msg.nothingRename'))
      return
    }
    await renameEntry(current.path, current.name)
  }, [current, renameEntry, toast])

  /** Create a directory (F7): we ask for the name and do not descend into it. */
  const mkdirCurrent = useCallback(async () => {
    const dir = state.panes[state.activePane].path
    if (!dir) {
      toast(t('msg.noOtherPane'))
      return
    }
    const name = window.prompt(t('msg.newFolder'), t('msg.newFolder'))
    if (!name) return
    const target = `${dir}/${name.trim()}`.replace(/\/+$/, '')
    try {
      await makeDir(target, { root })
      toast(t('msg.folderCreated', { name: name.trim() }))
      ncStore.refresh()
    } catch (failure) {
      toast(describeError(t, failure))
    }
  }, [state.panes, state.activePane, root, toast, t])

  /** Delete (F8): the plan comes first — it is the confirmation as well. */
  const removeCurrent = useCallback(async () => {
    const targets = sourcesOf()
    if (targets.length === 0) {
      toast(t('msg.nothingDelete'))
      return
    }
    await openTransfer('delete')
  }, [sourcesOf, openTransfer, toast])

  /** Download the selected file (F2): the same raw route as the link in the footer. */
  const downloadCurrent = useCallback(() => {
    if (!current || current.kind !== 'file') {
      toast(t('msg.fileOnlyDownload'))
      return
    }
    const link = document.createElement('a')
    link.href = rawUrl(current.path, root)
    link.download = current.name
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [current, root, toast])

  const copyPath = useCallback(async (text) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast(t('msg.pathCopied'))
    } catch {
      toast(t('msg.clipboard'))
    }
  }, [])

  // F3 — view or size, F5 — copy, F6 — move, Shift-F6 — rename.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return
      if (event.key === 'F3') {
        event.preventDefault()
        if (!current) return
        if (current.kind === 'file') ncStore.openFile(current)
        else void measureDir(current.path)
        return
      }
      if (event.key === 'F2') {
        event.preventDefault()
        if (current?.kind === 'file') downloadCurrent()
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        void openTransfer('copy')
        return
      }
      if (event.key === 'F6') {
        event.preventDefault()
        if (event.shiftKey) void renameCurrent()
        else void openTransfer('move')
        return
      }
      if (event.key === 'F7') {
        event.preventDefault()
        void mkdirCurrent()
        return
      }
      if (event.key === 'F8') {
        event.preventDefault()
        void removeCurrent()
        return
      }

      // Arrows: Shift first toggles the mark of the current row, then moves the cursor.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        const entries = paneEntries.current[state.activePane] ?? []
        if (entries.length === 0) return
        event.preventDefault()
        const at = entries.findIndex((entry) => entry.path === state.cursor[state.activePane])
        const last = entries.length - 1
        const step = event.key === 'ArrowDown' ? 1 : -1
        // Shift at the edge of the list only toggles the mark, the cursor does not move.
        if (event.shiftKey) {
          const here = entries[at === -1 ? 0 : at]
          if (here) ncStore.toggleMark(state.activePane, here.path)
          const moved = at === -1 ? 0 : Math.min(Math.max(at + step, 0), last)
          if (!(event.key === 'ArrowDown' && at === last) && !(event.key === 'ArrowUp' && at === 0)) {
            const target = entries[moved]
            if (target) ncStore.setCursor(state.activePane, target.path)
          }
          return
        }
        const next = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : Math.min(Math.max(at === -1 ? 0 : at + step, 0), last)
        const target = entries[next]
        if (target) ncStore.setCursor(state.activePane, target.path)
        return
      }

      if (event.key === 'Insert' || event.key === ' ') {
        const entries = paneEntries.current[state.activePane] ?? []
        const path = state.cursor[state.activePane]
        if (!path) return
        event.preventDefault()
        ncStore.toggleMark(state.activePane, path)
        if (event.key === 'Insert') {
          const at = entries.findIndex((entry) => entry.path === path)
          const target = entries[Math.min(at + 1, entries.length - 1)]
          if (target && target.path !== path) ncStore.setCursor(state.activePane, target.path)
        }
        return
      }

      // Backspace goes one directory up (changing the directory clears the marks).
      if (event.key === 'Backspace') {
        event.preventDefault()
        const current_ = state.panes[state.activePane].path
        if (!current_ || current_ === '/') return
        const parent = current_.slice(0, current_.lastIndexOf('/')) || '/'
        ncStore.setPath(state.activePane, parent)
        return
      }

      // Enter: a directory goes inside, a file goes to the viewer.
      if (event.key === 'Enter') {
        const entries = paneEntries.current[state.activePane] ?? []
        const entry = entries.find((row) => row.path === state.cursor[state.activePane])
        if (!entry) return
        event.preventDefault()
        if (entry.kind === 'dir') ncStore.setPath(state.activePane, entry.path)
        else ncStore.openFile(entry)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [current, openTransfer, renameCurrent, removeCurrent, downloadCurrent, measureDir, mkdirCurrent, state.activePane, state.cursor])

  // Active jobs: the dialog one and everything moved to the background. Polled once a second.
  const activeJobIds = useMemo(() => {
    const ids = []
    if (transfer?.jobId) ids.push({ id: transfer.jobId, where: 'dialog', op: transfer.op })
    for (const job of background) if (job.jobId) ids.push({ id: job.jobId, where: 'background', op: job.op })
    return ids
  }, [transfer?.jobId, transfer?.op, background])
  // The key includes "where": moving a job to the background keeps the job but updates another list.
  const activeKey = activeJobIds.map((job) => `${job.where}:${job.id}`).join(',')

  useEffect(() => {
    if (activeKey === '') return undefined
    let stopped = false
    let finished = false
    const timer = setInterval(async () => {
      if (finished) return
      for (const job of activeJobIds) {
        try {
          const status = await jobStatus(job.id, { root })
          if (stopped) return
          if (job.where === 'dialog') {
            setTransfer((previous) =>
              previous && previous.jobId === job.id ? { ...previous, progress: status } : previous,
            )
          } else {
            setBackground((previous) =>
              previous.map((item) => (item.jobId === job.id ? { ...item, progress: status } : item)),
            )
          }
          if (status.state !== 'running') {
            if (job.where === 'dialog') setTransfer(null)
            else setBackground((previous) => previous.filter((item) => item.jobId !== job.id))
            ncStore.clearMarks()
            ncStore.refresh()
            if (!announced.current.has(job.id)) {
              announced.current.add(job.id)
              if (status.state === 'done') toast(t('msg.done', { done: status.done }))
              else if (status.state === 'cancelled') toast(t('msg.cancelled', { done: status.done, total: status.total }))
              else if (status.state === 'stalled') toast(t('msg.stalled'))
              else toast(t('msg.failed', { failed: status.failed, total: status.total }))
            }
          }
        } catch (failure) {
          // The job vanished with a server restart: drop the button, otherwise it hangs forever.
          if (failure?.code === 'no-job') {
            if (job.where === 'dialog') setTransfer(null)
            else setBackground((previous) => previous.filter((item) => item.jobId !== job.id))
            continue
          }
          // The network blinked — the next tick will try again.
        }
      }
    }, 1000)
    return () => {
      stopped = true
      finished = true
      clearInterval(timer)
    }
  }, [activeKey, root, toast, t])

  return (
    <div style={styles.root}>
      <div style={{ ...styles.panes, ...(state.viewMode === 'file' ? { display: 'none' } : null) }}>
        <Pane
          index={0}
          pane={state.panes[0]}
          active={state.activePane === 0}
          root={root}
          cursorPath={state.cursor[0]}
          onCursor={onCursor}
          onResolved={onResolved}
          onError={toast}
          onOpenPath={openPathInPane(0)}
          revision={state.revision}
          marks={state.marks[0]}
          onCopyPath={copyPath}
          onRename={renameEntry}
          onEntries={registerEntries}
          dirSizes={dirSizes}
          onCreateFolder={mkdirCurrent}
        />
        <div style={styles.divider} />
        <Pane
          index={1}
          pane={state.panes[1]}
          active={state.activePane === 1}
          root={root}
          cursorPath={state.cursor[1]}
          onCursor={onCursor}
          onResolved={onResolved}
          onError={toast}
          onOpenPath={openPathInPane(1)}
          revision={state.revision}
          marks={state.marks[1]}
          onCopyPath={copyPath}
          onRename={renameEntry}
          onEntries={registerEntries}
          dirSizes={dirSizes}
          onCreateFolder={mkdirCurrent}
        />
      </div>

      {state.openFiles.length > 0 && state.viewMode === 'file' && activeFile ? (
        <div style={styles.fullViewer}>
          <div style={styles.viewerBar}>
            <button
              type="button"
              style={styles.button}
              onClick={() => ncStore.backToPanes()}
              title={t('preview.backTitle')}
            >
              {t('preview.back')}
            </button>
            <span style={styles.viewerPath} title={activeFile.path}>
              {activeFile.path}
            </span>
            {lineSelection ? (
              <>
                <span style={styles.viewerSelection}>
                  {activeFile.name}:{lineSelection.from}
                  {lineSelection.to > lineSelection.from ? `-${lineSelection.to}` : ''}
                </span>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.buttonOn }}
                  title={t('lines.comment')}
                  onClick={() => {
                    const suffix =
                      lineSelection.to > lineSelection.from
                        ? `${lineSelection.from}-${lineSelection.to}`
                        : `${lineSelection.from}`
                    const text = `> ${activeFile.name}:${suffix}:`
                    const ok = sendCommentToChat({ sessionId: sessionKey, text })
                    if (!ok) {
                      alert(t('lines.failed'))
                      return
                    }
                    try {
                      void navigator.clipboard?.writeText(text)
                    } catch {
                      // The reference is already in the draft.
                    }
                    setLineSelection(null)
                  }}
                >
                  {t('lines.comment')}
                </button>
              </>
            ) : null}

            {previewKindOf(activeFile.name) === 'markdown' || previewKindOf(activeFile.name) === 'html' ? (
              <>
                <button
                  type="button"
                  style={{ ...styles.button, ...(sourceView ? null : styles.buttonOn) }}
                  onClick={() => setSourceView(false)}
                  title={t('preview.renderTitle')}
                >
                  {t('preview.render')}
                </button>
                <button
                  type="button"
                  style={{ ...styles.button, ...(sourceView ? styles.buttonOn : null) }}
                  onClick={() => setSourceView(true)}
                  title={t('preview.sourceTitle')}
                >
                  {t('preview.source')}
                </button>
              </>
            ) : null}
          </div>
          <div style={styles.tabs}>
            {state.openFiles.map((file) => (
              <span
                key={file.path}
                style={{
                  ...styles.tab,
                  background: file.path === state.activePath ? COLORS.active : 'transparent',
                  color: file.path === state.activePath ? COLORS.text : COLORS.dim,
                }}
                onClick={() => ncStore.focusFile(file.path)}
                title={file.path}
              >
                {file.name}
                <button
                  type="button"
                  style={styles.tabClose}
                  onClick={(event) => {
                    event.stopPropagation()
                    ncStore.closeFile(file.path)
                  }}
                  title={t('msg.close')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={styles.fullViewerBody}>
            <Preview
              path={activeFile.path}
              root={root}
              name={activeFile.name}
              mode={sourceView ? 'source' : 'rendered'}
              sessionId={sessionKey}
              selection={lineSelection}
              setSelection={setLineSelection}
            />
          </div>
        </div>
      ) : null}

      <div style={{ ...styles.pathBar, ...(state.viewMode === 'file' ? { display: 'none' } : null) }}>
        <input
          style={{ ...styles.input, flex: '1 1 200px', minWidth: 0 }}
          value={pathDraft}
          placeholder={t('path.placeholder')}
          onChange={(event) => setPathDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            const trimmed = pathDraft.trim().replace(/\/+$/, '')
            if (!trimmed) return
            const absolute = trimmed.startsWith('/') ? trimmed : `${pane.path ?? ''}/${trimmed}`
            ncStore.setPath(state.activePane, absolute)
            setPathDraft('')
          }}
        />
        {background.map((job) => (
          <button
            key={job.jobId}
            type="button"
            style={{ ...styles.button, ...styles.buttonOn, flex: 'none', whiteSpace: 'nowrap' }}
            title={t('progress.background')}
            onClick={() => {
              setTransfer({ phase: 'progress', op: job.op, jobId: job.jobId, progress: job.progress })
              setBackground((previous) => previous.filter((item) => item.jobId !== job.jobId))
            }}
          >
            {t('progress.task', {
              done: job.progress?.done ?? 0,
              total: job.progress?.total ?? 0,
            })}
          </button>
        ))}
      </div>

      <div style={{ ...styles.footer, ...(state.viewMode === 'file' ? { display: 'none' } : null) }}>
        <button
          type="button"
          style={{ ...styles.button, ...(current ? null : styles.buttonDisabled) }}
          disabled={!current}
          onClick={() => {
            if (!current) return
            if (current.kind === 'dir') void measureDir(current.path)
            else ncStore.openFile(current)
          }}
          title={t(current?.kind === 'dir' ? 'btn.size' : 'btn.view')}
        >
          {t(current?.kind === 'dir' ? 'btn.size' : 'btn.view')}
        </button>
        <a
          href={current && current.kind === 'file' ? rawUrl(current.path, root) : undefined}
          download={current?.name}
          style={{
            ...styles.button,
            ...(current && current.kind === 'file' ? null : styles.buttonDisabled),
            textDecoration: 'none',
          }}
          onClick={(event) => {
            if (!current || current.kind !== 'file') event.preventDefault()
          }}
          title={t('title.download')}
        >
          {t('btn.download')}
        </a>
        <button
          type="button"
          style={{ ...styles.button, ...(current || (state.marks[state.activePane] ?? []).length > 0 ? null : styles.buttonDisabled) }}
          disabled={!current && (state.marks[state.activePane] ?? []).length === 0}
          onClick={() => openTransfer('copy')}
          title={t('title.copy')}
        >
          {t('btn.copy')}
        </button>
        <button
          type="button"
          style={{ ...styles.button, ...(current || (state.marks[state.activePane] ?? []).length > 0 ? null : styles.buttonDisabled) }}
          disabled={!current && (state.marks[state.activePane] ?? []).length === 0}
          onClick={() => openTransfer('move')}
          title={t('title.move')}
        >
          {t('btn.move')}
        </button>
        <button
          type="button"
          style={{ ...styles.button, ...(current || (state.marks[state.activePane] ?? []).length > 0 ? null : styles.buttonDisabled) }}
          disabled={!current && (state.marks[state.activePane] ?? []).length === 0}
          onClick={() => removeCurrent()}
          title={t('title.delete')}
        >
          {t('btn.delete')}
        </button>
        {(state.marks[state.activePane] ?? []).length > 0 ? (
          <span style={styles.note}>{t('msg.marksCount', { count: state.marks[state.activePane].length })}</span>
        ) : null}
      </div>

      {sizeQuery ? (
        <div style={styles.overlay}>
          <div style={{ ...styles.dialog, width: 'min(420px, 92%)' }}>
            <div style={styles.dialogTitle}>{t('size.title')}</div>
            <div style={{ ...styles.dialogNote, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dsh-nc-spinner" />
              {sizeQuery}
            </div>
          </div>
        </div>
      ) : null}

      {transfer && transfer.phase !== 'background' ? (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <div style={styles.dialogTitle}>
              {t(`plan.title.${transfer.op}`)}
              {transfer.phase === 'plan' && transfer.targetDir ? ` → ${transfer.targetDir}` : ''}
            </div>

            {transfer.phase === 'starting' ? (
              <div style={{ ...styles.dialogNote, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dsh-nc-spinner" />
                {t('plan.starting')}
              </div>
            ) : null}

            {transfer.phase === 'plan-error' ? (
              <>
                <div style={{ ...styles.dialogNote, color: COLORS.danger }}>{transfer.error}</div>
                <div style={styles.dialogActions}>
                  <button type="button" style={styles.button} onClick={() => setTransfer(null)}>
                    {t('plan.cancel')}
                  </button>
                </div>
              </>
            ) : null}

            {transfer.phase === 'planning' ? (
              <div style={{ ...styles.dialogNote, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dsh-nc-spinner" />
                {t('plan.preparing')}
              </div>
            ) : null}

            {transfer.phase === 'plan' && transfer.plan ? (
              <>
                {transfer.sources?.length ? (
                  <>
                    <div style={styles.dialogNote}>{t('plan.what')}</div>
                    <div style={styles.listBox}>
                      {transfer.sources
                        .slice(0, 50)
                        .map((source) => source.split('/').filter(Boolean).pop() ?? source)
                        .join('\n')}
                      {transfer.sources.length > 50 ? `\n${t('plan.andMore', { count: transfer.sources.length - 50 })}` : ''}
                    </div>
                  </>
                ) : null}
                <div style={styles.dialogNote}>
                  {t(`plan.will${transfer.op === 'copy' ? 'Copy' : transfer.op === 'move' ? 'Move' : 'Delete'}`, {
                    steps: transfer.plan.steps,
                    files: transfer.plan.files,
                    size: formatSize(transfer.plan.bytes),
                  })}
                </div>
                {transfer.op !== 'delete' ? (
                  transfer.plan.conflictCount > 0 ? (
                    <label style={{ ...styles.dialogNote, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={allowOverwrite}
                        onChange={(event) => setAllowOverwrite(event.target.checked)}
                      />
                      {t('plan.overwrite', { count: transfer.plan.conflictCount })} — {t('plan.overwriteAsk')}
                    </label>
                  ) : (
                    <div style={styles.dialogNote}>{t('plan.noOverwrite')}</div>
                  )
                ) : null}
                {transfer.plan.conflicts.length > 0 ? (
                  <div style={styles.listBox}>{transfer.plan.conflicts.join('\n')}</div>
                ) : null}
                {transfer.plan.problems?.length > 0 ? (
                  <>
                    <div style={{ ...styles.dialogNote, color: COLORS.danger }}>
                      {t('plan.blocked')}
                    </div>
                    <div style={{ ...styles.listBox, borderColor: COLORS.danger }}>
                      {transfer.plan.problems.map((item) => `${item.path} — ${item.reason}`).join('\n')}
                    </div>
                  </>
                ) : null}
                <div style={styles.dialogActions}>
                  <button type="button" style={styles.button} onClick={() => setTransfer(null)}>
                    {t('plan.cancel')}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.button,
                      ...(transfer.plan.problems?.length > 0 ? styles.buttonDisabled : styles.buttonOn),
                    }}
                    disabled={
                      transfer.plan.problems?.length > 0
                      || (transfer.plan.conflictCount > 0 && !allowOverwrite)
                    }
                    onClick={() => runTransfer()}
                    title={transfer.plan.problems?.length > 0 ? t('plan.runBlocked') : t('plan.runHint')}
                  >
                    {t('plan.run')}
                  </button>
                </div>
              </>
            ) : null}

            {transfer.phase === 'progress' ? (
              <>
                <div style={styles.dialogNote}>
                  {transfer.progress
                    ? t('progress.line', {
                        done: transfer.progress.done,
                        total: transfer.progress.total,
                        bytes: formatSize(transfer.progress.bytes),
                        totalBytes: formatSize(transfer.progress.totalBytes),
                      })
                    : t('plan.starting')}
                  {transfer.progress?.failed ? t('msg.errorsSuffix', { count: transfer.progress.failed }) : ''}
                </div>
                {transfer.progress?.current ? (
                  <div style={styles.listBox}>{transfer.progress.current}</div>
                ) : null}
                {transfer.progress?.errors?.length ? (
                  <div style={styles.listBox}>{transfer.progress.errors.join('\n')}</div>
                ) : null}
                <div style={styles.dialogActions}>
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      if (transfer.jobId) void cancelJob(transfer.jobId, { root })
                    }}
                  >
                    {t('progress.cancel')}
                  </button>
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      if (transfer.jobId) {
                        setBackground((previous) => [
                          ...previous,
                          { jobId: transfer.jobId, op: transfer.op, progress: transfer.progress },
                        ])
                      }
                      setTransfer(null)
                    }}
                  >
                    {t('progress.background')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div style={styles.toasts}>
          {toasts.map((item) => (
            <div
              key={item.id}
              style={{ ...styles.toast, pointerEvents: 'auto', cursor: 'pointer' }}
              title={t('progress.cancel')}
              onClick={() => setToasts((previous) => previous.filter((toast) => toast.id !== item.id))}
            >
              {item.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
