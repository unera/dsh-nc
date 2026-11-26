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
import { trace } from './api.js'
import { setChatBridge } from './chatBridge.js'
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

/** Small folder icon for the context menu item; the slot renders any component. */
function NcMenuIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 4.2h4.2l1.3 1.6h7.5v6.7a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.2Z" />
      <path d="M1.5 5.8h13" />
    </svg>
  )
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
/**
 * Tell the user where the file went when the Files view is not mounted yet: the
 * tab can only be selected from inside itself, so the first visit is manual.
 */
function alertOpenedInTab() {
  try {
    trace('open: view switcher is not captured, the file waits in the Files tab')
  } catch {
    // Diagnostics never matter more than the action.
  }
}

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
    trace(`redirect: address=${address} path=${path}`)
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
  const subscribed = whenService(ctx, 'sidebarRightTabs', (target, tabs) => {
    if (!tabs || typeof tabs.register !== 'function') return
    registerRedirectType(target, tabs)
  })
  return subscribed
}

/**
 * Claim file resources on a live tab-type registry and provide the stand-in body.
 * @param ctx - client context owning the effects.
 * @param tabs - the sidebar tab-type registry.
 */
function registerRedirectType(ctx, tabs) {
  trace('registerRedirectType: claiming dsh-resource://file/**')
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
  trace('registerRedirectType: body slot registration')
  try {
    ctx.slots.inject('sidebar.right.pane.tab', () =>
      ctx.slots.register({ name: 'sidebar.right.pane.tab', key: VIEWER_ID }, NcRedirect),
    )
  } catch (error) {
    ctx.logger('dsh-nc:client').info(`dsh-nc: sidebar body slot unavailable (${error.message})`)
  }
}

/**
 * Run `setup` once a client service appears in the context.
 *
 * Plugins load in an arbitrary order: `contextMenus` and `sidebarRightTabs` may
 * not exist yet when `apply()` runs. `ctx.inject` is the reactive declaration for
 * exactly this — it fires when the service arrives and never blocks the plugin.
 * @param ctx - client context.
 * @param name - service name.
 * @param setup - callback receiving the context and the service.
 * @returns whether a subscription or a direct call was arranged.
 */
function whenService(ctx, name, setup) {
  trace(`whenService(${name}) called`)
  const run = (target, service) => {
    try {
      setup(target, service)
    } catch (error) {
      ctx.logger('dsh-nc:client').info(`dsh-nc: ${name} setup failed (${error.message})`)
    }
  }
  // Reading a missing service may throw on the client context, so each read is guarded.
  let present
  try {
    present = ctx[name]
  } catch {
    present = undefined
  }
  if (present === undefined && typeof ctx.get === 'function') {
    try {
      present = ctx.get(name)
      trace(`whenService(${name}): ctx.get returned ${present === undefined ? 'undefined' : 'a service'}`)
    } catch (error) {
      trace(`whenService(${name}): ctx.get threw (${error.message})`)
      present = undefined
    }
  }
  if (present) {
    trace(`whenService(${name}): already present`)
    run(ctx, present)
    return true
  }
  if (typeof ctx.inject === 'function') {
    try {
      trace(`whenService(${name}): subscribed via ctx.inject`)
      ctx.inject([name], (inner) => {
        trace(`whenService(${name}): service arrived`)
        run(inner, inner[name])
      })
      return true
    } catch (error) {
      trace(`whenService(${name}): inject failed ${error.message}`)
      return false
    }
  }
  trace(`whenService(${name}): nothing available`)
  return false
}

/**
 * Add our item to the context menu of a file or directory link.
 *
 * The menu is the public contribution point: a plugin registers a resolver for a
 * target family and returns its own actions, so this path does not depend on the
 * resource registry at all.
 * @param ctx - client context carrying the context menu registry.
 * @param log - plugin logger.
 * @returns whether the contribution was registered.
 */
function registerContextMenu(ctx, log) {
  const t = () => currentTranslate()
  const subscribed = whenService(ctx, 'contextMenus', (target, menus) => {
    if (!menus || typeof menus.register !== 'function') return
    registerMenuItem(target, menus, t)
  })
  if (!subscribed) return false
  log.info('dsh-nc: context menu items registered for file and directory links')
  return true
}

/**
 * Register the two contributions on a live menu registry.
 * @param ctx - client context owning the effects.
 * @param menus - the context menu registry.
 * @param t - translation getter.
 */
function registerMenuItem(ctx, menus, t) {
  trace('registerMenuItem: registering file/directory contributions')
  try {
    ctx.slots.inject('contextMenu.icon', () =>
      ctx.slots.register({ name: 'contextMenu.icon', key: 'dsh-nc.files' }, NcMenuIcon),
    )
  } catch (error) {
    trace(`contextMenu.icon unavailable: ${error.message}`)
  }
  ctx.effect(() =>
    menus.register({
      id: 'dsh-nc.open',
      target: 'file',
      // Ahead of the built-in file actions: the browser is the primary reader here.
      order: 10,
      resolve: (target) => {
        const label = t()('menu.openInFiles')
        trace(`resolve(file): ${target?.path ?? 'no path'} label=${String(label)}`)
        return [
        {
          id: 'dsh-nc.open',
          label,
          icon: { key: 'dsh-nc.files' },
          run: () => {
            if (!openInFilesView(target.path)) alertOpenedInTab()
          },
        },
        ]
      },
    }),
  )

  ctx.effect(() =>
    menus.register({
      id: 'dsh-nc.open-dir',
      target: 'directory',
      order: 10,
      resolve: (target) => {
        trace(`resolve(directory): ${target?.path ?? 'no path'}`)
        return [
        {
          id: 'dsh-nc.open-dir',
          label: t()('menu.openDirInFiles'),
          icon: { key: 'dsh-nc.files' },
          run: () => {
            ncStore.setPath(ncStore.getSnapshot().activePane, target.path)
            if (viewSwitcher) {
              try {
                viewSwitcher('nc-files', target.path)
              } catch {
                // The view is not mounted: the path stays in the store.
              }
            }
          },
        },
        ]
      },
    }),
  )

}

/**
 * Wire the viewer's comment action to the conversation: append the reference to
 * the draft of the session and bring the chat view back.
 *
 * `ctx.conversation.input.for(actx)` needs a session-scoped context, which a root
 * plugin does not have; `requestDraftInitialization(binding, …)` needs only a
 * binding, so the bridge goes through it.
 * @param ctx - client context.
 * @param log - plugin logger.
 */
function registerChatBridge(ctx, log) {
  const services = {}
  const ready = () => services.conversation && services.sessions

  whenService(ctx, 'conversation', (target, conversation) => {
    services.conversation = conversation
    if (ready()) install()
  })
  whenService(ctx, 'sessions', (target, sessions) => {
    services.sessions = sessions
    if (ready()) install()
  })

  function install() {
    setChatBridge(({ sessionId, text }) => {
      const sessions = services.sessions
      const conversation = services.conversation
      if (!sessionId || typeof sessions?.binding !== 'function') return false
      const binding = sessions.binding(sessionId)
      if (!binding) return false
      conversation.input.requestDraftInitialization(binding, {
        prompt: text,
        whenDraftExists: 'append',
      })
      // Back to the chat: available because the Files view is mounted right now.
      if (viewSwitcher) {
        try {
          viewSwitcher('chat', '')
        } catch (error) {
          log.info(`dsh-nc: could not switch back to chat (${error.message})`)
        }
      }
      return true
    })
    log.info('dsh-nc: chat bridge installed')
  }
}

export function apply(ctx) {
  const log = ctx.logger('dsh-nc:client')
  trace('apply: start')

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

  // Extra entry points: the context menu and the resource redirect. Both are optional.
  try {
    registerChatBridge(ctx, log)
  } catch (error) {
    log.info(`dsh-nc: chat bridge disabled (${error.message})`)
  }

  try {
    if (!registerContextMenu(ctx, log)) {
      log.info('dsh-nc: context menu registry is absent, no "open in the file browser" item')
    }
  } catch (error) {
    log.info(`dsh-nc: context menu item disabled (${error.message})`)
  }

  try {
    if (!registerResourceRedirect(ctx)) {
      log.info('dsh-nc: sidebar tab registry is absent, file links keep the built-in preview')
    }
  } catch (error) {
    log.info(`dsh-nc: link interception disabled (${error.message})`)
  }
}
