/**
 * A small dependency-free syntax highlighter.
 *
 * A full engine (Prism, highlight.js) weighs hundreds of kilobytes and brings
 * either a build with plugins or global variables in the browser. For viewing
 * files a regular-expression pass is enough: comments, strings, numbers,
 * keywords, built-in functions and calls — enough for code to be readable by eye.
 */

/** Token palette: muted, so it reads well in both dark and light themes. */
export const TOKEN_COLORS = {
  comment: '#7f8c9b',
  string: '#a5d6a7',
  number: '#f0b775',
  keyword: '#c792ea',
  builtin: '#82aaff',
  function: '#ffcb6b',
  punctuation: 'inherit',
}

const C_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
  'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
  'volatile', 'while', 'class', 'public', 'private', 'protected', 'virtual', 'template', 'typename',
  'namespace', 'using', 'new', 'delete', 'try', 'catch', 'throw', 'constexpr', 'nullptr', 'true', 'false',
]

const JS_KEYWORDS = [
  'await', 'async', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'try', 'typeof', 'var', 'void', 'while', 'yield', 'true', 'false', 'null', 'undefined', 'interface',
  'type', 'enum', 'implements', 'readonly', 'as', 'satisfies', 'declare',
]

const PY_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'True', 'False', 'None',
]

const LUA_KEYWORDS = [
  'and', 'break', 'do', 'else', 'elseif', 'end', 'for', 'function', 'goto', 'if', 'in', 'local', 'not',
  'or', 'repeat', 'return', 'then', 'until', 'while', 'nil', 'true', 'false',
]

const GO_KEYWORDS = [
  'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func',
  'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
  'switch', 'type', 'var', 'nil', 'true', 'false',
]

const PERL_KEYWORDS = [
  'my', 'our', 'sub', 'use', 'package', 'if', 'elsif', 'else', 'unless', 'while', 'until', 'for',
  'foreach', 'return', 'last', 'next', 'redo', 'local', 'print', 'say', 'die', 'warn', 'require',
  'undef', 'strict', 'warnings',
]

const BASH_KEYWORDS = [
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'in',
  'function', 'return', 'local', 'export', 'readonly', 'shift', 'source', 'eval', 'trap', 'set',
]

const SQL_KEYWORDS = [
  'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table',
  'index', 'view', 'drop', 'alter', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by',
  'order', 'having', 'limit', 'offset', 'as', 'and', 'or', 'not', 'null', 'primary', 'key', 'foreign',
  'references', 'default', 'begin', 'commit', 'rollback',
]

/** Per-language rules: where the comments and quotes are, and what counts as a keyword. */
const LANGUAGES = {
  c: {
    keywords: C_KEYWORDS,
    lineComment: '//',
    blockComment: ['/*', '*/'],
    strings: ['"', "'"],
  },
  js: {
    keywords: JS_KEYWORDS,
    lineComment: '//',
    blockComment: ['/*', '*/'],
    strings: ['"', "'", '`'],
  },
  python: {
    keywords: PY_KEYWORDS,
    lineComment: '#',
    strings: ['"""', "'''", '"', "'"],
  },
  lua: {
    keywords: LUA_KEYWORDS,
    lineComment: '--',
    blockComment: ['--[[', ']]'],
    strings: ['"', "'", '[[', ']]'],
  },
  go: {
    keywords: GO_KEYWORDS,
    lineComment: '//',
    blockComment: ['/*', '*/'],
    strings: ['"', '`'],
  },
  perl: {
    keywords: PERL_KEYWORDS,
    lineComment: '#',
    strings: ['"', "'"],
  },
  bash: {
    keywords: BASH_KEYWORDS,
    lineComment: '#',
    strings: ['"', "'"],
  },
  sql: {
    keywords: SQL_KEYWORDS,
    lineComment: '--',
    blockComment: ['/*', '*/'],
    strings: ["'", '"'],
  },
  json: {
    keywords: ['true', 'false', 'null'],
    strings: ['"'],
  },
  yaml: {
    keywords: ['true', 'false', 'null', 'yes', 'no'],
    lineComment: '#',
    strings: ['"', "'"],
  },
  css: {
    keywords: [],
    blockComment: ['/*', '*/'],
    strings: ['"', "'"],
  },
  html: {
    keywords: [],
    strings: ['"', "'"],
  },
  markdown: {
    keywords: [],
    strings: ['`'],
    multiline: true,
    extra: [
      '(?<string>^```[\\s\\S]*?^```)',
      '(?<keyword>^#{1,6} [^\\n]*)',
      '(?<comment>^>.*)',
      '(?<builtin>\\*\\*[^*\\n]+\\*\\*)',
      '(?<function>^\\s*(?:[-*+]|\\d+[.)]) )',
      '(?<number>\\[[^\\]]*\\]\\([^)]*\\))',
    ],
  },
  diff: {
    keywords: [],
    strings: [],
    multiline: true,
    extra: ['(?<keyword>^@@.*@@)', '(?<string>^\\+.*)', '(?<blockComment>^-.*)'],
  },
  make: {
    keywords: [
      'ifeq', 'ifneq', 'ifdef', 'ifndef', 'else', 'endif', 'include', 'export', 'unexport',
      'define', 'endef', 'override', 'vpath', 'subst', 'patsubst', 'wildcard', 'shell',
    ],
    lineComment: '#',
    strings: ['"', "'"],
    multiline: true,
    extra: [
      '(?<function>^[A-Za-z0-9_./%$() -]+(?=:(?!=)))',
      '(?<number>\\$\\([^)]*\\)|\\$\\{[^}]*\\})',
      '(?<builtin>^\\.[A-Z]+)',
    ],
  },
  plain: { keywords: [], strings: [] },
}

/** Extension → language. */
const BY_EXTENSION = new Map([
  ['c', 'c'], ['h', 'c'], ['cc', 'c'], ['cpp', 'c'], ['cxx', 'c'], ['hpp', 'c'], ['m', 'c'],
  ['js', 'js'], ['mjs', 'js'], ['cjs', 'js'], ['jsx', 'js'], ['ts', 'js'], ['tsx', 'js'],
  ['py', 'python'], ['lua', 'lua'], ['go', 'go'], ['pl', 'perl'], ['pm', 'perl'], ['t', 'perl'],
  ['sh', 'bash'], ['bash', 'bash'], ['zsh', 'bash'], ['fish', 'bash'],
  ['sql', 'sql'], ['json', 'json'], ['yaml', 'yaml'], ['yml', 'yaml'],
  ['css', 'css'], ['scss', 'css'], ['less', 'css'], ['html', 'html'], ['htm', 'html'], ['xml', 'html'],
  ['conf', 'bash'], ['ini', 'bash'], ['toml', 'bash'], ['service', 'bash'],
  ['md', 'markdown'], ['markdown', 'markdown'], ['mdown', 'markdown'],
  ['diff', 'diff'], ['patch', 'diff'],
  ['mk', 'make'], ['make', 'make'],
])

/** By file name without an extension: Makefile and its relatives. */
const BY_NAME = new Map([
  ['makefile', 'make'],
  ['gnumakefile', 'make'],
  ['makefile.am', 'make'],
])

/** Language by file name; an unknown extension means no highlighting. */
export function languageOf(name) {
  const base = name.split('/').pop() ?? name
  const byName = BY_NAME.get(base.toLowerCase())
  if (byName) return byName
  const dot = base.lastIndexOf('.')
  if (dot === -1) return 'plain'
  return BY_EXTENSION.get(base.slice(dot + 1).toLowerCase()) ?? 'plain'
}

/** Escape the special characters of a regular expression. */
function esc(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build the regular expression for a language: the order of the branches sets the token priority. */
function compile(spec) {
  const branches = [...(spec.extra ?? [])]
  if (spec.blockComment) {
    const [open, close] = spec.blockComment
    branches.push(`(?<blockComment>${esc(open)}[\\s\\S]*?(?:${esc(close)}|$))`)
  }
  for (const quote of spec.strings ?? []) {
    if (quote === '[[|]]') continue
    branches.push(`(?<string>${esc(quote)}(?:\\\\.|[^\\\\${esc(quote)}\\n])*${esc(quote)})`)
  }
  if (spec.lineComment) branches.push(`(?<lineComment>${esc(spec.lineComment)}[^\\n]*)`)
  branches.push('(?<number>\\b(?:0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)')
  if (spec.keywords?.length) branches.push(`(?<keyword>\\b(?:${spec.keywords.map(esc).join('|')})\\b)`)
  branches.push('(?<function>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())')
  return new RegExp(branches.join('|'), spec.multiline ? 'gm' : 'g')
}

const COMPILED = new Map()

function compiledFor(lang) {
  if (COMPILED.has(lang)) return COMPILED.get(lang)
  const spec = LANGUAGES[lang] ?? LANGUAGES.plain
  const regex = compile(spec)
  COMPILED.set(lang, regex)
  return regex
}

/** How many bytes we still highlight: beyond that the browser starts to lag noticeably. */
export const HIGHLIGHT_LIMIT = 200 * 1024

/** Token type by the name of the group that matched. */
function typeOfMatch(match) {
  const groups = match.groups ?? {}
  if (groups.blockComment !== undefined || groups.lineComment !== undefined) return 'comment'
  if (groups.comment !== undefined) return 'comment'
  if (groups.string !== undefined) return 'string'
  if (groups.number !== undefined) return 'number'
  if (groups.keyword !== undefined) return 'keyword'
  if (groups.builtin !== undefined) return 'builtin'
  if (groups.function !== undefined) return 'function'
  return 'plain'
}

/**
 * Split the text into lines made of highlighted pieces.
 * @param text - contents of the file.
 * @param lang - language from `languageOf`.
 * @returns an array of lines, each an array of pieces `{ text, type }`.
 */
export function highlightLines(text, lang) {
  const lines = []
  let line = []

  /** Push a piece, splitting it across the lines. */
  const push = (value, type) => {
    if (value === '') return
    const parts = value.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push(line)
        line = []
      }
      if (part !== '') line.push({ text: part, type })
    })
  }

  const regex = compiledFor(lang)
  regex.lastIndex = 0
  let lastIndex = 0
  let match = regex.exec(text)
  while (match !== null) {
    if (match.index > lastIndex) push(text.slice(lastIndex, match.index), 'plain')
    push(match[0], typeOfMatch(match))
    lastIndex = regex.lastIndex
    match = regex.exec(text)
  }
  if (lastIndex < text.length) push(text.slice(lastIndex), 'plain')
  lines.push(line)
  return lines
}

/**
 * Highlight the text: the usual path for the viewer.
 * @param text - contents of the file.
 * @param lang - language from `languageOf`.
 * @returns lines with pieces, or `null` when the file is too large or the language is unknown.
 */
export function highlight(text, lang) {
  if (lang === 'plain') return null
  if (text.length > HIGHLIGHT_LIMIT) return null
  return highlightLines(text, lang)
}
