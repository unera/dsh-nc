/** Smoke test: render the client tab in node to catch render-time crashes. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const projectRoot = new URL('..', import.meta.url).pathname
const requireHere = createRequire(`${projectRoot}index.mjs`)
const React = requireHere('react')
const server = requireHere('react-dom/server')

const source = readFileSync(`${projectRoot}lib/client.js`, 'utf8')

let loaded = null
globalThis.window = {
  __ModuleLoader__: {
    load: ({ factory }) => {
      loaded = factory((id) => {
        if (id === 'react') return React
        if (id === 'react/jsx-runtime') return requireHere('react/jsx-runtime')
        throw new Error(`unexpected require: ${id}`)
      })
    },
  },
}

globalThis.fetch = async () =>
  new Response(
    JSON.stringify({ ok: true, home: '/tmp', path: '/tmp', crumbs: [{ name: '/', path: '/' }], entries: [] }),
    { headers: { 'content-type': 'application/json' } },
  )
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.document = {
  documentElement: { setAttribute: () => {}, removeAttribute: () => {} },
  head: { querySelector: () => null, appendChild: () => {} },
  createElement: () => ({ setAttribute: () => {}, textContent: '' }),
  addEventListener: () => {},
  removeEventListener: () => {},
}

new Function('window', source)(globalThis.window)

/** Fake DSH locale: keeps the dictionaries and can pretend the language changed. */
let active = 'ru'
const dicts = new Map()
const localeListeners = new Set()
const fakeLocale = {
  register: (ns, locale, dict) => {
    dicts.set(`${ns}:${locale}`, dict)
    return () => dicts.delete(`${ns}:${locale}`)
  },
  bind: (ns) => (key, params) => {
    const dict = dicts.get(`${ns}:${active}`) ?? dicts.get(`${ns}:en`) ?? {}
    const template = dict[key] ?? key
    return params ? template.replace(/\{(\w+)\}/g, (w, k) => (k in params ? String(params[k]) : w)) : template
  },
  getLocale: () => ({ active, locales: [], revision: 0 }),
  subscribe: (fn) => {
    localeListeners.add(fn)
    return () => localeListeners.delete(fn)
  },
}

/** Fake sidebar tab registry: records the resource type the plugin claims. */
const tabTypes = []
const fakeTabs = {
  register: (definition) => {
    tabTypes.push(definition)
    return () => {}
  },
}

const registrations = []
const ctx = {
  logger: () => ({ info: () => {} }),
  effect: (fn) => (typeof fn === 'function' ? fn() : undefined),
  get: (name) => (name === 'locale' ? fakeLocale : undefined),
  locale: fakeLocale,
  sidebarRightTabs: fakeTabs,
  slots: {
    inject: (_name, fn) => fn(),
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
}
loaded.apply(ctx)
console.log('dictionaries registered:', dicts.size, '→', [...dicts.keys()].join(', '))
console.log('registrations:', registrations.map((r) => `${r.options.name}:${r.options.id}`).join(', '))

console.log(
  'resource type:',
  tabTypes.map((type) => `${type.kind}/${type.priority}/${type.patterns?.join('|')}`).join(', ') || 'нет',
)
const view = registrations.find((r) => r.options.name === 'conversation.view')
const props = {
  sessionId: 'test-session',
  useSessions: (selector) => selector({ byId: { 'test-session': { cwd: '/tmp' } } }),
  useWorkspaces: (selector) => selector({}),
  viewRequest: null,
  openView: () => {},
  completeViewRequest: () => {},
  inspectCall: undefined,
}
const render = () => server.renderToStaticMarkup(React.createElement(view.component, props))

const russian = render()
console.log('render ok, markup length:', russian.length)
console.log('ru:', russian.includes('Копировать (F5)'), '| path:', russian.includes('Путь и Enter'))

active = 'en'
const english = render()
console.log('en:', english.includes('Copy (F5)'), '| path:', english.includes('Path and Enter'))

active = 'zh'
const chinese = render()
console.log('zh:', chinese.includes('复制 (F5)'), '| path:', chinese.includes('路径后回车'))

const ok = russian.includes('Копировать (F5)') && english.includes('Copy (F5)') && chinese.includes('复制 (F5)') && dicts.size === 3
console.log(ok ? 'RESULT: all three locales work' : 'RESULT: something is wrong')
if (!ok) process.exitCode = 1
