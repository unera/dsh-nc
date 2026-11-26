/**
 * Client half of dsh-nc: the Files tab next to Chat and Trajectory.
 *
 * While the tab is active the chat input is not needed: the screen belongs to the
 * file browser. There is no supported way to hide it (the composer is the seat of
 * the conversation itself, not of the tab), so for its lifetime the tab tags the
 * document with an attribute and injects a single rule that removes the composer
 * seat. When the tab is left, the attribute is removed and the input comes back.
 */

import { Component, createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { FileBrowser } from './Browser.jsx'
import { ncStore } from './store.js'
import { NAMESPACE, detectLocale, en, fallbackTranslate, ru, zh } from './i18n.js'

export const name = 'dsh-nc'

/** The conversation and its tab slots are provided by this package. */
export const inject = ['slots']

/** Translation: apply() substitutes the value from the shared DSH locale, otherwise the own dictionary is used. */
const TranslateContext = createContext(fallbackTranslate(detectLocale()))

/** Translation hook for the browser components. */
export function useT() {
  return useContext(TranslateContext)
}

/** `openView` captured from the Files view: the only public way to select the tab. */
let viewSwitcher = null

/**
 * Address of a file resource: `dsh-resource://file/session/<session>/<path>`.
 * @param address - resource address from the tab record.
 * @returns the absolute path, or an empty string when the address is not absolute.
 */
function filePathOfAddress(address) {
  const prefix = 'dsh-resource://file/session/'
  if (typeof address !== 'string' || !address.startsWith(prefix)) return ''
  const rest = address.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return ''
  const parts = rest.slice(slash + 1).split('/').filter((part) => part !== '')
  const decoded = []
  for (const part of parts) {
    try {
      decoded.push(decodeURIComponent(part))
    } catch {
      decoded.push(part)
    }
  }
  const path = decoded.join('/')
  if (path === '') return ''
  return path.startsWith('/') ? `/${path.replace(/^\/+/, '')}` : ''
}

/**
 * Hand a file to the Files view: the path goes into the store, and the view is
 * selected when its `openView` has already been captured.
 * @param path - absolute file path.
 * @returns whether the view could be switched right away.
 */
function openInFilesView(path) {
  ncStore.openPath(path)
  if (!viewSwitcher) return false
  try {
    viewSwitcher('nc-files', path)
    return true
  } catch {
    return false
  }
}

/** Current DSH locale and its change counter: the language switches without a reload. */
let localeRuntime = null
let localeRevision = 0
const localeListeners = new Set()

function bumpRevision() {
  localeRevision += 1
  for (const listener of localeListeners) listener()
}

function subscribeLocale(listener) {
  localeListeners.add(listener)
  return () => localeListeners.delete(listener)
}

/** Translation in the current language: the shared locale first, the own dictionary when it is absent. */
function currentTranslate() {
  // The fallback follows the active DSH language, not just the browser language.
  const active = localeRuntime?.getLocale?.().active ?? detectLocale()
  const fallback = fallbackTranslate(active)
  if (!localeRuntime || typeof localeRuntime.bind !== 'function') return fallback
  try {
    const bound = localeRuntime.bind(NAMESPACE)
    return (key, params) => {
      const text = bound(key, params)
      return typeof text === 'string' && text !== '' ? text : fallback(key, params)
    }
  } catch {
    return fallback
  }
}

/** Re-renders the subtree when the language changes. */
function TranslateProvider({ children }) {
  const revision = useSyncExternalStore(subscribeLocale, () => localeRevision, () => localeRevision)
  // Memoization is required: a new function on every render breaks the effect dependencies
  // (the job poller was recreated and repeated the completion messages).
  const translate = useMemo(() => currentTranslate(), [revision])
  return <TranslateContext.Provider value={translate}>{children}</TranslateContext.Provider>
}

const HIDE_CSS_ID = 'dsh-nc/hide-composer'
const DOC_ATTRIBUTE = 'data-dsh-nc'

/**
 * The rule that lives as long as the Files tab: it removes the chat input and gives
 * the tab viewport a bounded height.
 *
 * In the active phase the conversation declares `.viewArea` as `flex: 1 0 auto` with
 * `min-height: auto` — the container grows with its content and the outer
 * `scrollBody` does the scrolling. That is incompatible with a tab that wants its own
 * height (two panes, each with its own scroll, a footer with buttons at the bottom):
 * both panes scroll away together. We give the container `flex: 1 1 0` and
 * `min-height: 0` instead, and turn off the scrolling of the outer body.
 */
const HIDE_CSS = `
html[${DOC_ATTRIBUTE}] [data-composer-seat],
html[${DOC_ATTRIBUTE}] [class*="composerStack"] {
  display: none !important;
}
html[${DOC_ATTRIBUTE}] [class*="viewArea"] {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}
html[${DOC_ATTRIBUTE}] [class*="scrollBody"] {
  overflow: hidden !important;
}
/* The content width handle belongs to the conversation: the file tab has no use for
   it, and it was its grip that caught the mouse above our panes. */
html[${DOC_ATTRIBUTE}] [class*="widthHandle"],
html[${DOC_ATTRIBUTE}] [data-width-handle] {
  display: none !important;
}
@keyframes dsh-nc-spin {
  to { transform: rotate(360deg); }
}
.dsh-nc-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.25));
  border-top-color: var(--dsw-alias-link, #2d66f7);
  border-radius: 50%;
  animation: dsh-nc-spin 0.7s linear infinite;
  vertical-align: -2px;
}
`

/** Insert the rule into the document once: repeated mounts do not duplicate it. */
function ensureHideStyles() {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[data-plugin-css="${HIDE_CSS_ID}"]`)) return
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin', 'dsh-nc')
  tag.setAttribute('data-plugin-css', HIDE_CSS_ID)
  tag.textContent = HIDE_CSS
  document.head.appendChild(tag)
}

/**
 * While the tab is mounted, tag the document; remove the tag on unmount.
 * @returns nothing: the effect lives exactly as long as the tab is on screen.
 */
function useComposerlessScreen() {
  useEffect(() => {
    ensureHideStyles()
    document.documentElement.setAttribute(DOC_ATTRIBUTE, '')
    return () => {
      document.documentElement.removeAttribute(DOC_ATTRIBUTE)
    }
  }, [])
}

/**
 * Render error trap: without it an exception in the browser leaves the tab black
 * and says nothing about what happened. It shows the error text instead of a void.
 */
class NcErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { message: '' }
  }

  static getDerivedStateFromError(error) {
    return { message: error?.message ?? String(error) }
  }

  render() {
    if (this.state.message) {
      return (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--dsw-alias-label-danger, #c0392b)' }}>
          {this.props.t?.('crash', { message: this.state.message }) ?? this.state.message}
          <div style={{ marginTop: 8, color: 'var(--dsw-alias-label-secondary, #5a6478)' }}>
            {this.props.t?.('crash.hint') ?? ''}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/** Working directory of the current session: the browse starts there. */
function cwdOf(useSessions, sessionId) {
  if (typeof useSessions !== 'function' || !sessionId) return undefined
  try {
    return useSessions((snapshot) => snapshot?.byId?.[sessionId]?.cwd)
  } catch {
    return undefined
  }
}

/** Files tab: the browser across the whole available area, without the chat input. */
function NcTabView(props) {
  useComposerlessScreen()
  // `openView` живёт только в props вкладки: запоминаем, чтобы клик по ссылке
  // в чате мог переключить беседу на эту вкладку.
  useEffect(() => {
    viewSwitcher = typeof props.openView === 'function' ? props.openView : null
    return () => {
      viewSwitcher = null
    }
  }, [props.openView])

  const cwd = cwdOf(props.useSessions, props.sessionId)
  return (
    <TranslateProvider>
      <NcErrorBoundary t={currentTranslate()}>
        <FileBrowser
          sessionKey={props.sessionId ?? 'default'}
          startPath={cwd ?? undefined}
          focusRequest={props.viewRequest ?? null}
          onFocusHandled={props.completeViewRequest}
        />
      </NcErrorBoundary>
    </TranslateProvider>
  )
}

/**
 * Register the tab.
 *
 * `ctx.slots.inject(...)` waits until the conversation package declares the tab
 * slot and removes the registration together with it.
 * @param ctx - client context of the plugin.
 */
/**
 * Stand-in tab body for a file resource: it never draws the file, it hands the
 * path to the Files view and closes itself, so a click on a file chip ends in the
 * full-screen viewer instead of the right column.
 */
function NcRedirect(props) {
  const t = useT()
  const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
  const address = info?.tab?.contentId ?? info?.tab?.navigation?.address ?? ''

  useEffect(() => {
    const path = filePathOfAddress(address)
    if (path !== '') openInFilesView(path)
    try {
      info?.tab?.actions?.close()
    } catch {
      // Tab already gone: nothing to close.
    }
  }, [address, info])

  return (
    <div style={{ padding: 12, fontSize: '0.9em', color: 'var(--dsw-alias-label-secondary, #5a6478)' }}>
      {t('msg.openingInNc')}
    </div>
  )
}

const VIEWER_KIND = 'dsh-nc-viewer'
const VIEWER_ID = 'dsh-nc-viewer'

/**
 * Register the redirect type and its body.
 * @param ctx - client context carrying the slot registry and the sidebar registry.
 */
function registerResourceRedirect(ctx) {
  const tabs = ctx.sidebarRightTabs ?? (typeof ctx.get === 'function' ? ctx.get('sidebarRightTabs') : undefined)
  if (!tabs || typeof tabs.register !== 'function') return false
  ctx.effect(() =>
    tabs.register({
      id: VIEWER_ID,
      kind: VIEWER_KIND,
      patterns: ['dsh-resource://file/**'],
      priority: 'extension',
      title: (address) => {
        const name = address.slice(address.lastIndexOf('/') + 1)
        try {
          return decodeURIComponent(name)
        } catch {
          return name
        }
      },
    }),
  )
  // Only claim the body slot when the sidebar really declares it: an unknown slot
  // name throws, and that would take the registration of the tab with it.
  try {
    ctx.slots.inject('sidebar.right.pane.tab', () =>
      ctx.slots.register({ name: 'sidebar.right.pane.tab', key: VIEWER_ID }, NcRedirect),
    )
  } catch (error) {
    ctx.logger('dsh-nc:client').info(`dsh-nc: sidebar body slot unavailable (${error.message})`)
  }
  return true
}

export function apply(ctx) {
  const log = ctx.logger('dsh-nc:client')

  // Dictionaries into the shared DSH locale: then the UI language switches the file browser too.
  const runtime = (typeof ctx.get === 'function' ? ctx.get('locale') : undefined) ?? ctx.locale
  if (runtime && typeof runtime.register === 'function') {
    localeRuntime = runtime
    try {
      ctx.effect(() => runtime.register(NAMESPACE, 'ru', ru))
      ctx.effect(() => runtime.register(NAMESPACE, 'en', en))
      ctx.effect(() => runtime.register(NAMESPACE, 'zh', zh))
      if (typeof runtime.subscribe === 'function') ctx.effect(() => runtime.subscribe(bumpRevision))
      log.info(`dsh-nc: ru/en/zh dictionaries registered (active locale: ${runtime.getLocale?.().active ?? 'unknown'})`)
    } catch (error) {
      log.info(`dsh-nc: dictionaries not registered, using the built-in fallback (${error.message})`)
    }
  } else {
    log.info('dsh-nc: no shared locale in this build, using the built-in fallback')
  }

  // The tab comes first and unconditionally: nothing below may take it down with it.
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({ name: 'conversation.view', id: 'nc-files', order: 20, label: () => 'Files' }, NcTabView),
  )
  log.info('dsh-nc: Files tab registered')

  // The link interception is an extra: if any of it fails, the tab stays usable.
  try {
    if (!registerResourceRedirect(ctx)) {
      log.info('dsh-nc: sidebar tab registry is absent, file links keep the built-in preview')
    }
  } catch (error) {
    log.info(`dsh-nc: link interception disabled (${error.message})`)
  }
}
