window.__ModuleLoader__.load({
  id: "@dr-co/dsh-nc",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  useT: () => useT
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// src/client/Browser.jsx
var import_react = require("react");

// src/client/api.js
var BASE = "/api/dsh-nc";
async function call(route, params, root) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null && value !== "") query.set(key, String(value));
  }
  if (root) query.set("root", root);
  const response = await fetch(`${BASE}/${route}?${query.toString()}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
    const failure = new Error(message);
    failure.code = body?.error?.code ?? `http-${response.status}`;
    failure.path = body?.error?.path;
    throw failure;
  }
  return body;
}
async function fetchHome() {
  const body = await call("home", {});
  return body.home;
}
function fetchList(path, { hidden = false, root } = {}) {
  return call("list", { path, hidden: hidden ? 1 : void 0 }, root);
}
function fetchText(path, { maxBytes, root } = {}) {
  return call("text", { path, maxBytes }, root);
}
function rawUrl(path, root) {
  const query = new URLSearchParams({ path });
  if (root) query.set("root", root);
  return `${BASE}/raw?${query.toString()}`;
}
async function post(route, body, root) {
  const query = new URLSearchParams();
  if (root) query.set("root", root);
  const response = await fetch(`${BASE}/${route}?${query.toString()}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  const parsed = await response.json().catch(() => null);
  if (!response.ok || !parsed?.ok) {
    const failure = new Error(parsed?.error?.message ?? `${response.status} ${response.statusText}`);
    failure.code = parsed?.error?.code ?? `http-${response.status}`;
    failure.path = parsed?.error?.path;
    throw failure;
  }
  return parsed;
}
function moveEntry(from, to, { root } = {}) {
  return post("move", { from, to }, root);
}
function planTransfer(op, sources, targetDir, { root } = {}) {
  return post("plan", { op, sources, targetDir }, root);
}
function startTransfer(op, sources, targetDir, { root, overwrite } = {}) {
  return post("start", { op, sources, targetDir, overwrite: overwrite === true }, root);
}
function jobStatus(jobId, { root } = {}) {
  return call("job", { jobId }, root);
}
function cancelJob(jobId, { root } = {}) {
  return post("cancel", { jobId }, root);
}
function dirSize(path, { root } = {}) {
  return call("size", { path }, root);
}
function makeDir(path, { root } = {}) {
  return post("mkdir", { path }, root);
}

// src/client/store.js
function newPane(path = null) {
  return { path, sortKey: "name", sortDir: 1, showHidden: false };
}
function typeOf(name2) {
  const dot = name2.lastIndexOf(".");
  return dot <= 0 ? "" : name2.slice(dot + 1).toLowerCase();
}
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
    viewMode: "panes",
    /** "Reload the directories" counter: grows after file operations. */
    revision: 0,
    /** The open dialog (plan, progress, size count): kept in the store to survive re-renders. */
    dialog: null,
    /** Jobs moved to the background: survive a page reload. */
    tasks: []
  };
}
var STORAGE_PREFIX = "dsh-nc:state:";
function loadState(key) {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const base = emptyState(key);
    return {
      ...base,
      panes: [0, 1].map((index) => {
        const pane = { ...newPane(), ...saved.panes?.[index] ?? {} };
        if (pane.sortKey !== "type") pane.sortKey = "name";
        if (pane.sortDir !== -1) pane.sortDir = 1;
        return pane;
      }),
      activePane: saved.activePane === 1 ? 1 : 0,
      cursor: [saved.cursor?.[0] ?? null, saved.cursor?.[1] ?? null],
      marks: [
        Array.isArray(saved.marks?.[0]) ? saved.marks[0] : [],
        Array.isArray(saved.marks?.[1]) ? saved.marks[1] : []
      ],
      openFiles: Array.isArray(saved.openFiles) ? saved.openFiles : [],
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      activePath: saved.activePath ?? null,
      viewMode: saved.viewMode === "file" ? "file" : "panes"
    };
  } catch {
    return null;
  }
}
function saveState(state) {
  try {
    const { key, dialog, ...rest } = state;
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(rest));
  } catch {
  }
}
var memory = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
var current = emptyState(null);
function emit() {
  for (const listener of listeners) listener();
}
function commit(patch, panePatch) {
  const panes = panePatch ? current.panes.map((pane, index) => panePatch[index] ? { ...pane, ...panePatch[index] } : pane) : current.panes;
  current = { ...current, ...patch, panes };
  if (current.key !== null) {
    memory.set(current.key, current);
    saveState(current);
  }
  emit();
}
var ncStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return current;
  },
  /**
   * Switch to the state of a session: every session has its own panes.
   * @param key - session id or a fixed key for a tab without a session.
   */
  bind(key) {
    if (current.key === key) return;
    if (current.key !== null) memory.set(current.key, current);
    current = memory.get(key) ?? loadState(key) ?? emptyState(key);
    memory.set(key, current);
    emit();
  },
  /** Active pane: a pane click, Tab, or a move into that pane. */
  setActivePane(index) {
    if (current.activePane === index) return;
    commit({ activePane: index });
  },
  /** Tab: switch the active pane. */
  toggleActivePane() {
    commit({ activePane: current.activePane === 0 ? 1 : 0 });
  },
  /** Directory of a single pane. */
  setPath(index, path) {
    if (current.panes[index].path === path) return;
    const marks = [...current.marks];
    marks[index] = [];
    commit({ activePane: index, marks }, { [index]: { path } });
  },
  /** Sorting of a single pane: the same key flips the direction. */
  toggleSort(index, key) {
    const pane = current.panes[index];
    const next = pane.sortKey === key ? { sortDir: -pane.sortDir } : { sortKey: key, sortDir: 1 };
    commit({ activePane: index }, { [index]: next });
  },
  /** Set the pane sort key explicitly (from the menu). */
  setSort(index, key) {
    if (current.panes[index].sortKey === key) return;
    commit({ activePane: index }, { [index]: { sortKey: key } });
  },
  /** Set the direction explicitly: 1 — ascending, -1 — reversed. */
  setSortDir(index, dir) {
    if (current.panes[index].sortDir === dir) return;
    commit({ activePane: index }, { [index]: { sortDir: dir } });
  },
  toggleHidden(index) {
    commit({ activePane: index }, { [index]: { showHidden: !current.panes[index].showHidden } });
  },
  /** Mark or unmark a row (Ctrl-click). */
  toggleMark(index, path) {
    const marks = [...current.marks];
    const pane = marks[index] ?? [];
    marks[index] = pane.includes(path) ? pane.filter((item) => item !== path) : [...pane, path];
    commit({ marks });
  },
  /** Replace the set of marked rows of a pane (Shift-click, "clear all"). */
  setMarks(index, paths) {
    const marks = [...current.marks];
    marks[index] = [...paths];
    commit({ marks });
  },
  /** Clear the marks of both panes — after a completed operation. */
  clearMarks() {
    commit({ marks: [[], []] });
  },
  /** Cursor of a single pane: we remember the path of the highlighted row, not the object. */
  setCursor(index, path) {
    if (current.cursor[index] === path) return;
    const cursor = [...current.cursor];
    cursor[index] = path;
    commit({ cursor }, {});
  },
  /** Open a file: the viewer takes the whole tab screen. */
  /** Open a file by path: the name comes from the path, no duplicates. */
  openPath(path) {
    if (!path) return;
    const name2 = path.split("/").filter(Boolean).pop() ?? path;
    const openFiles = current.openFiles.some((file) => file.path === path) ? current.openFiles : [...current.openFiles, { path, name: name2 }];
    commit({ openFiles, activePath: path, viewMode: "file" });
  },
  openFile(entry) {
    const openFiles = current.openFiles.some((file) => file.path === entry.path) ? current.openFiles : [...current.openFiles, { path: entry.path, name: entry.name }];
    commit({ openFiles, activePath: entry.path, viewMode: "file" });
  },
  /** Return from the viewer to the panes. */
  backToPanes() {
    if (current.viewMode === "panes") return;
    commit({ viewMode: "panes" });
  },
  /** List of background jobs: refreshed by polling, survives a reload. */
  setTasks(value) {
    const next = typeof value === "function" ? value(current.tasks) : value;
    commit({ tasks: next });
  },
  /** Open or close a dialog above the panes (plan, progress, size count). */
  setDialog(value) {
    const next = typeof value === "function" ? value(current.dialog) : value;
    commit({ dialog: next });
  },
  /** Reload the directories of both panes (after a copy, move or rename). */
  refresh() {
    commit({ revision: (current.revision ?? 0) + 1 });
  },
  /** Show an open file again without changing the list of sub-tabs. */
  showFile(path) {
    commit({ activePath: path, viewMode: "file" });
  },
  closeFile(path) {
    const openFiles = current.openFiles.filter((file) => file.path !== path);
    const activePath = current.activePath === path ? openFiles[openFiles.length - 1]?.path ?? null : current.activePath;
    commit({ openFiles, activePath, ...activePath === null ? { viewMode: "panes" } : {} });
  },
  focusFile(path) {
    if (current.activePath === path) return;
    commit({ activePath: path });
  }
};
function sortEntries(entries, key, dir) {
  const byName = (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" });
  return [...entries].sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (b.kind === "dir" && a.kind !== "dir") return 1;
    if (key === "type") {
      const byType = typeOf(a.name).localeCompare(typeOf(b.name), void 0, { sensitivity: "base" });
      if (byType !== 0) return byType * dir;
      return byName(a, b);
    }
    return byName(a, b) * dir;
  });
}
function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
function formatTime(mtimeMs) {
  if (!mtimeMs) return "";
  const date = new Date(mtimeMs);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatMode(mode, kind) {
  if (!Number.isFinite(mode) || mode === 0) return "";
  const type = kind === "dir" ? "d" : "-";
  const triple = (shift) => {
    const bits = mode >> shift & 7;
    return `${bits & 4 ? "r" : "-"}${bits & 2 ? "w" : "-"}${bits & 1 ? "x" : "-"}`;
  };
  return `${type}${triple(6)}${triple(3)}${triple(0)}`;
}

// src/client/highlight.js
var TOKEN_COLORS = {
  comment: "#7f8c9b",
  string: "#a5d6a7",
  number: "#f0b775",
  keyword: "#c792ea",
  builtin: "#82aaff",
  function: "#ffcb6b",
  punctuation: "inherit"
};
var C_KEYWORDS = [
  "auto",
  "break",
  "case",
  "char",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  "class",
  "public",
  "private",
  "protected",
  "virtual",
  "template",
  "typename",
  "namespace",
  "using",
  "new",
  "delete",
  "try",
  "catch",
  "throw",
  "constexpr",
  "nullptr",
  "true",
  "false"
];
var JS_KEYWORDS = [
  "await",
  "async",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "yield",
  "true",
  "false",
  "null",
  "undefined",
  "interface",
  "type",
  "enum",
  "implements",
  "readonly",
  "as",
  "satisfies",
  "declare"
];
var PY_KEYWORDS = [
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "True",
  "False",
  "None"
];
var LUA_KEYWORDS = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "until",
  "while",
  "nil",
  "true",
  "false"
];
var GO_KEYWORDS = [
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var",
  "nil",
  "true",
  "false"
];
var PERL_KEYWORDS = [
  "my",
  "our",
  "sub",
  "use",
  "package",
  "if",
  "elsif",
  "else",
  "unless",
  "while",
  "until",
  "for",
  "foreach",
  "return",
  "last",
  "next",
  "redo",
  "local",
  "print",
  "say",
  "die",
  "warn",
  "require",
  "undef",
  "strict",
  "warnings"
];
var BASH_KEYWORDS = [
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "until",
  "do",
  "done",
  "case",
  "esac",
  "in",
  "function",
  "return",
  "local",
  "export",
  "readonly",
  "shift",
  "source",
  "eval",
  "trap",
  "set"
];
var SQL_KEYWORDS = [
  "select",
  "from",
  "where",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "index",
  "view",
  "drop",
  "alter",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "on",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "offset",
  "as",
  "and",
  "or",
  "not",
  "null",
  "primary",
  "key",
  "foreign",
  "references",
  "default",
  "begin",
  "commit",
  "rollback"
];
var LANGUAGES = {
  c: {
    keywords: C_KEYWORDS,
    lineComment: "//",
    blockComment: ["/*", "*/"],
    strings: ['"', "'"]
  },
  js: {
    keywords: JS_KEYWORDS,
    lineComment: "//",
    blockComment: ["/*", "*/"],
    strings: ['"', "'", "`"]
  },
  python: {
    keywords: PY_KEYWORDS,
    lineComment: "#",
    strings: ['"""', "'''", '"', "'"]
  },
  lua: {
    keywords: LUA_KEYWORDS,
    lineComment: "--",
    blockComment: ["--[[", "]]"],
    strings: ['"', "'", "[[", "]]"]
  },
  go: {
    keywords: GO_KEYWORDS,
    lineComment: "//",
    blockComment: ["/*", "*/"],
    strings: ['"', "`"]
  },
  perl: {
    keywords: PERL_KEYWORDS,
    lineComment: "#",
    strings: ['"', "'"]
  },
  bash: {
    keywords: BASH_KEYWORDS,
    lineComment: "#",
    strings: ['"', "'"]
  },
  sql: {
    keywords: SQL_KEYWORDS,
    lineComment: "--",
    blockComment: ["/*", "*/"],
    strings: ["'", '"']
  },
  json: {
    keywords: ["true", "false", "null"],
    strings: ['"']
  },
  yaml: {
    keywords: ["true", "false", "null", "yes", "no"],
    lineComment: "#",
    strings: ['"', "'"]
  },
  css: {
    keywords: [],
    blockComment: ["/*", "*/"],
    strings: ['"', "'"]
  },
  html: {
    keywords: [],
    strings: ['"', "'"]
  },
  markdown: {
    keywords: [],
    strings: ["`"],
    multiline: true,
    extra: [
      "(?<string>^```[\\s\\S]*?^```)",
      "(?<keyword>^#{1,6} [^\\n]*)",
      "(?<comment>^>.*)",
      "(?<builtin>\\*\\*[^*\\n]+\\*\\*)",
      "(?<function>^\\s*(?:[-*+]|\\d+[.)]) )",
      "(?<number>\\[[^\\]]*\\]\\([^)]*\\))"
    ]
  },
  diff: {
    keywords: [],
    strings: [],
    multiline: true,
    extra: ["(?<keyword>^@@.*@@)", "(?<string>^\\+.*)", "(?<blockComment>^-.*)"]
  },
  make: {
    keywords: [
      "ifeq",
      "ifneq",
      "ifdef",
      "ifndef",
      "else",
      "endif",
      "include",
      "export",
      "unexport",
      "define",
      "endef",
      "override",
      "vpath",
      "subst",
      "patsubst",
      "wildcard",
      "shell"
    ],
    lineComment: "#",
    strings: ['"', "'"],
    multiline: true,
    extra: [
      "(?<function>^[A-Za-z0-9_./%$() -]+(?=:(?!=)))",
      "(?<number>\\$\\([^)]*\\)|\\$\\{[^}]*\\})",
      "(?<builtin>^\\.[A-Z]+)"
    ]
  },
  plain: { keywords: [], strings: [] }
};
var BY_EXTENSION = /* @__PURE__ */ new Map([
  ["c", "c"],
  ["h", "c"],
  ["cc", "c"],
  ["cpp", "c"],
  ["cxx", "c"],
  ["hpp", "c"],
  ["m", "c"],
  ["js", "js"],
  ["mjs", "js"],
  ["cjs", "js"],
  ["jsx", "js"],
  ["ts", "js"],
  ["tsx", "js"],
  ["py", "python"],
  ["lua", "lua"],
  ["go", "go"],
  ["pl", "perl"],
  ["pm", "perl"],
  ["t", "perl"],
  ["sh", "bash"],
  ["bash", "bash"],
  ["zsh", "bash"],
  ["fish", "bash"],
  ["sql", "sql"],
  ["json", "json"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["css", "css"],
  ["scss", "css"],
  ["less", "css"],
  ["html", "html"],
  ["htm", "html"],
  ["xml", "html"],
  ["conf", "bash"],
  ["ini", "bash"],
  ["toml", "bash"],
  ["service", "bash"],
  ["md", "markdown"],
  ["markdown", "markdown"],
  ["mdown", "markdown"],
  ["diff", "diff"],
  ["patch", "diff"],
  ["mk", "make"],
  ["make", "make"]
]);
var BY_NAME = /* @__PURE__ */ new Map([
  ["makefile", "make"],
  ["gnumakefile", "make"],
  ["makefile.am", "make"]
]);
function languageOf(name2) {
  const base = name2.split("/").pop() ?? name2;
  const byName = BY_NAME.get(base.toLowerCase());
  if (byName) return byName;
  const dot = base.lastIndexOf(".");
  if (dot === -1) return "plain";
  return BY_EXTENSION.get(base.slice(dot + 1).toLowerCase()) ?? "plain";
}
function esc(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compile(spec) {
  const branches = [...spec.extra ?? []];
  if (spec.blockComment) {
    const [open, close] = spec.blockComment;
    branches.push(`(?<blockComment>${esc(open)}[\\s\\S]*?(?:${esc(close)}|$))`);
  }
  for (const quote of spec.strings ?? []) {
    if (quote === "[[|]]") continue;
    branches.push(`(?<string>${esc(quote)}(?:\\\\.|[^\\\\${esc(quote)}\\n])*${esc(quote)})`);
  }
  if (spec.lineComment) branches.push(`(?<lineComment>${esc(spec.lineComment)}[^\\n]*)`);
  branches.push("(?<number>\\b(?:0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)");
  if (spec.keywords?.length) branches.push(`(?<keyword>\\b(?:${spec.keywords.map(esc).join("|")})\\b)`);
  branches.push("(?<function>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())");
  return new RegExp(branches.join("|"), spec.multiline ? "gm" : "g");
}
var COMPILED = /* @__PURE__ */ new Map();
function compiledFor(lang) {
  if (COMPILED.has(lang)) return COMPILED.get(lang);
  const spec = LANGUAGES[lang] ?? LANGUAGES.plain;
  const regex = compile(spec);
  COMPILED.set(lang, regex);
  return regex;
}
var HIGHLIGHT_LIMIT = 200 * 1024;
function typeOfMatch(match) {
  const groups = match.groups ?? {};
  if (groups.blockComment !== void 0 || groups.lineComment !== void 0) return "comment";
  if (groups.comment !== void 0) return "comment";
  if (groups.string !== void 0) return "string";
  if (groups.number !== void 0) return "number";
  if (groups.keyword !== void 0) return "keyword";
  if (groups.builtin !== void 0) return "builtin";
  if (groups.function !== void 0) return "function";
  return "plain";
}
function highlightLines(text, lang) {
  const lines = [];
  let line = [];
  const push = (value, type) => {
    if (value === "") return;
    const parts = value.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push(line);
        line = [];
      }
      if (part !== "") line.push({ text: part, type });
    });
  };
  const regex = compiledFor(lang);
  regex.lastIndex = 0;
  let lastIndex = 0;
  let match = regex.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) push(text.slice(lastIndex, match.index), "plain");
    push(match[0], typeOfMatch(match));
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) push(text.slice(lastIndex), "plain");
  lines.push(line);
  return lines;
}
function highlight(text, lang) {
  if (lang === "plain") return null;
  if (text.length > HIGHLIGHT_LIMIT) return null;
  return highlightLines(text, lang);
}

// src/client/Markdown.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(!?\[[^\]]*\]\([^)\s]+\))/g;
function inline(text, keyPrefix, file) {
  const nodes = [];
  let lastIndex = 0;
  let match = INLINE.exec(text);
  let index = 0;
  while (match !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${index}`;
    index += 1;
    if (token.startsWith("`")) {
      nodes.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: styles.code, children: token.slice(1, -1) }, key)
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: token.slice(2, -2) }, key)
      );
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: token.slice(1, -1) }, key));
    } else {
      const isImage = token.startsWith("!");
      const link = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token);
      if (link) {
        const [, label, target] = link;
        const scheme = safeScheme(target);
        if (isImage) {
          if (scheme === null) {
            nodes.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label || target }, key));
          } else {
            nodes.push(
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { src: resolveAsset(target, file), alt: label, style: styles.image }, key)
            );
          }
        } else if (scheme === null) {
          nodes.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label || target }, key));
        } else {
          nodes.push(
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: resolveAsset(target, file), target: "_blank", rel: "noreferrer", style: styles.link, children: label || target }, key)
          );
        }
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
    match = INLINE.exec(text);
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
function safeScheme(target) {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(target);
  if (!match) return "link";
  const protocol = match[1].toLowerCase();
  if (protocol === "http" || protocol === "https" || protocol === "mailto") return "link";
  if (protocol === "data" && /^data:image\//i.test(target)) return "image";
  return null;
}
function resolveAsset(target, file) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
  if (target.startsWith("/")) return target;
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
  const joined = `${dir}/${target}`.replace(/\/\.\//g, "/");
  return rawUrl(joined);
}
function CodeBlock({ code, lang }) {
  const painted = highlight(code, lang === "plain" ? "plain" : lang);
  if (!painted) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: styles.pre, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: code }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: styles.pre, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: painted.map((line, number) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: line.length === 0 ? "\u200B" : line.map((piece, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `tok-${piece.type}`, children: piece.text }, index)) }, number)) }) });
}
var styles = {
  root: { lineHeight: 1.6 },
  h: { margin: "0.8em 0 0.4em", fontWeight: 600 },
  p: { margin: "0.5em 0" },
  code: {
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    background: "var(--dsw-alias-interactive-bg-hover, rgba(28,35,51,0.07))",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: "0.95em"
  },
  pre: {
    background: "var(--dsw-alias-bg-layer-1, rgba(28,35,51,0.05))",
    border: "1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.12))",
    borderRadius: 8,
    padding: "8px 10px",
    overflowX: "auto",
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "0.95em",
    lineHeight: 1.5,
    margin: "0.6em 0"
  },
  quote: {
    margin: "0.6em 0",
    padding: "2px 12px",
    borderLeft: "3px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.25))",
    color: "var(--dsw-alias-label-secondary, #5a6478)"
  },
  list: { margin: "0.4em 0", paddingLeft: "1.6em" },
  link: { color: "var(--dsw-alias-link, #2d66f7)", textDecoration: "none" },
  image: { maxWidth: "100%", borderRadius: 6 },
  table: { borderCollapse: "collapse", margin: "0.6em 0" },
  cell: { border: "1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.14))", padding: "4px 8px" },
  hr: { border: "none", borderTop: "1px solid var(--dsw-alias-border-l1, rgba(28,35,51,0.14))", margin: "1em 0" }
};
function MarkdownView({ text, file }) {
  const lines = text.split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = /^\s*```(\S*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ? languageOf(`x.${fence[1]}`) : "plain";
      const collected = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        collected.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlock, { code: collected.join("\n"), lang }, `code-${index}`));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { style: styles.h, children: inline(heading[2], `h${index}`, file) }, `h-${index}`)
      );
      index += 1;
      continue;
    }
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hr", { style: styles.hr }, `hr-${index}`));
      index += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const collected = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        collected.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", { style: styles.quote, children: inline(collected.join(" "), `q${index}`, file) }, `q-${index}`)
      );
      continue;
    }
    if (/\|/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[index + 1])) {
      const header = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      index += 2;
      const rows = [];
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim() !== "") {
        rows.push(lines[index].split("|").map((cell) => cell.trim()).filter(Boolean));
        index += 1;
      }
      blocks.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { style: styles.table, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: header.map((cell, position) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: styles.cell, children: inline(cell, `th${index}-${position}`, file) }, position)) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row, rowIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: row.map((cell, position) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: styles.cell, children: inline(cell, `td${rowIndex}-${position}`, file) }, position)) }, rowIndex)) })
        ] }, `t-${index}`)
      );
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (index < lines.length && (/^\s*[-*+]\s+/.test(lines[index]) || /^\s*\d+[.)]\s+/.test(lines[index]))) {
        items.push(lines[index].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""));
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListTag, { style: styles.list, children: items.map((item, position) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: inline(item, `li${index}-${position}`, file) }, position)) }, `l-${index}`)
      );
      continue;
    }
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() !== "" && !/^\s*(?:#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    if (paragraph.length === 0) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.p, children: inline(paragraph.join("\n"), `p${index}`, file) }, `p-${index}`)
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.root, children: blocks });
}

// src/client/Browser.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"]);
function extensionOf(name2) {
  const dot = name2.lastIndexOf(".");
  return dot === -1 ? "" : name2.slice(dot + 1).toLowerCase();
}
function previewKindOf(name2) {
  const ext = extensionOf(name2);
  if (ext === "md" || ext === "markdown" || ext === "mdown") return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "mp4" || ext === "webm") return "video";
  if (ext === "mp3" || ext === "ogg" || ext === "wav") return "audio";
  return "text";
}
var COLORS = {
  border: "var(--dsw-alias-border-l1, rgba(28,35,51,0.12))",
  text: "var(--dsw-alias-label-primary, #2b3446)",
  dim: "var(--dsw-alias-label-secondary, #5a6478)",
  hover: "var(--dsw-alias-interactive-bg-hover, rgba(28,35,51,0.05))",
  active: "var(--dsw-alias-interactive-bg-active, rgba(45,102,247,0.12))",
  accent: "var(--dsw-alias-link, #2d66f7)",
  danger: "var(--dsw-alias-label-danger, #c0392b)"
};
var styles2 = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    // The background is required: otherwise the chat shows through the empty areas and
    // its width handle catches the mouse instead of our panes.
    background: "var(--dsw-alias-bg-base, #14181f)",
    isolation: "isolate",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
    color: COLORS.text,
    // The size comes from the shell: the font slider in the settings moves us too.
    fontSize: "var(--dsh-content-font-size, 13px)"
  },
  panes: { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" },
  pane: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" },
  paneActive: { boxShadow: `inset 0 0 0 1px ${COLORS.accent}` },
  divider: { width: 1, background: COLORS.border, flex: "none" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 30,
    flexWrap: "wrap"
  },
  crumb: {
    border: "none",
    background: "transparent",
    color: COLORS.accent,
    cursor: "pointer",
    padding: "1px 2px",
    font: "inherit",
    borderRadius: 4
  },
  crumbCurrent: { color: COLORS.text, fontWeight: 600, cursor: "default" },
  separator: { color: COLORS.dim },
  input: {
    flex: "1 1 120px",
    minWidth: 90,
    padding: "2px 6px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: "transparent",
    color: COLORS.text,
    font: "inherit",
    fontSize: "var(--dsh-content-font-size-secondary, 12px)"
  },
  iconButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    padding: 0,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: "transparent",
    color: COLORS.text,
    cursor: "pointer",
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    flex: "none"
  },
  menu: {
    position: "absolute",
    top: "100%",
    right: 0,
    zIndex: 30,
    minWidth: 210,
    padding: 6,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: "var(--dsw-alias-bg-layer-2, #1b2029)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)"
  },
  menuTitle: {
    color: COLORS.dim,
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    padding: "4px 8px 2px",
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "4px 8px",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: COLORS.text,
    font: "inherit",
    fontSize: "var(--dsh-content-font-size, 13px)",
    cursor: "pointer",
    textAlign: "left"
  },
  menuBox: { width: 12, display: "inline-block", color: COLORS.accent },
  statName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLORS.text,
    fontSize: "0.8em",
    alignSelf: "center",
    minWidth: 0
  },
  statRight: {
    color: COLORS.dim,
    fontSize: "0.8em",
    whiteSpace: "nowrap",
    alignSelf: "center",
    fontVariantNumeric: "tabular-nums"
  },
  headerRow: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "1fr auto 26px",
    // No caps: a file name is written the way the file system has it.
    textTransform: "none",
    letterSpacing: "normal",
    gap: 6,
    padding: "2px 8px",
    borderBottom: `1px solid ${COLORS.border}`,
    color: COLORS.dim,
    fontSize: "var(--dsh-content-font-size-secondary, 11px)"
  },
  headerButton: {
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textTransform: "inherit",
    letterSpacing: "inherit",
    cursor: "pointer",
    padding: 0,
    textAlign: "left"
  },
  list: { flex: 1, overflow: "auto", minHeight: 0 },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 84px",
    gap: 6,
    alignItems: "baseline",
    padding: "2px 8px",
    cursor: "pointer",
    userSelect: "none"
  },
  rowName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  rowSize: { color: COLORS.dim, fontSize: "var(--dsh-content-font-size-secondary, 12px)", textAlign: "right", whiteSpace: "nowrap" },
  fullViewer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden"
  },
  viewerBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 32
  },
  viewerPath: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: COLORS.dim,
    fontSize: "var(--dsh-content-font-size-secondary, 12px)"
  },
  fullViewerBody: { flex: 1, overflow: "auto", minHeight: 0, padding: 10 },
  viewer: {
    display: "flex",
    flexDirection: "column",
    flex: "0 0 42%",
    minHeight: 120,
    borderTop: `1px solid ${COLORS.border}`
  },
  tabs: {
    display: "flex",
    flex: "0 0 auto",
    gap: 2,
    padding: "3px 6px 0",
    minWidth: 0,
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "thin",
    borderBottom: `1px solid ${COLORS.border}`,
    minHeight: 28
  },
  tab: {
    display: "flex",
    flex: "0 0 auto",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    color: COLORS.dim
  },
  tabClose: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    padding: "0 2px",
    font: "inherit",
    opacity: 0.7
  },
  viewerBody: { flex: 1, overflow: "auto", minHeight: 0, padding: 8 },
  pathBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderTop: `1px solid ${COLORS.border}`,
    minHeight: 32
  },
  pathLabel: { color: COLORS.dim, fontSize: "var(--dsh-content-font-size-secondary, 12px)", whiteSpace: "nowrap" },
  pre: {
    margin: 0,
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    lineHeight: 1.5,
    whiteSpace: "pre",
    tabSize: 4
  },
  lineNumber: {
    color: COLORS.dim,
    userSelect: "none",
    paddingRight: 10,
    textAlign: "right",
    display: "inline-block",
    minWidth: 38
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderTop: `1px solid ${COLORS.border}`,
    minHeight: 32,
    flexWrap: "wrap"
  },
  button: {
    padding: "2px 8px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    background: "transparent",
    color: COLORS.text,
    cursor: "pointer",
    font: "inherit",
    fontSize: "var(--dsh-content-font-size-secondary, 12px)"
  },
  buttonDisabled: { opacity: 0.45, cursor: "default" },
  buttonOn: { borderColor: COLORS.accent, color: COLORS.accent },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 25
  },
  dialog: {
    width: "min(620px, 92%)",
    maxHeight: "80%",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    background: "var(--dsw-alias-bg-layer-2, #1b2029)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.4)"
  },
  dialogTitle: { fontSize: "var(--dsh-content-font-size, 13px)", fontWeight: 600 },
  dialogNote: { color: COLORS.dim, fontSize: "var(--dsh-content-font-size-secondary, 12px)" },
  listBox: {
    maxHeight: 220,
    overflow: "auto",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "6px 8px",
    fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all"
  },
  dialogActions: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  toasts: {
    position: "absolute",
    right: 12,
    bottom: 96,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    zIndex: 20,
    pointerEvents: "none"
  },
  toast: {
    background: "var(--dsw-alias-bg-layer-2, rgba(20,24,34,0.92))",
    color: "var(--dsw-alias-label-primary, #fff)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: "var(--dsh-content-font-size-secondary, 12px)",
    maxWidth: 460,
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)"
  },
  note: { color: COLORS.dim, fontSize: 12 },
  error: { color: COLORS.danger, padding: 8, fontSize: 12 }
};
function fallbackCrumbs(path) {
  if (!path) return [{ name: "/", path: "/" }];
  const crumbs = [{ name: "/", path: "/" }];
  let current2 = "";
  for (const part of path.split("/").filter(Boolean)) {
    current2 = `${current2}/${part}`;
    crumbs.push({ name: part, path: current2 });
  }
  return crumbs;
}
function parentOf(path) {
  if (!path || path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}
function EntryRow({ entry, selected, marked, measured, onSelect, onActivate }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: {
        ...styles2.row,
        background: marked ? "var(--dsw-alias-interactive-bg-selected, rgba(45,102,247,0.18))" : selected ? COLORS.active : "transparent",
        fontWeight: marked ? 600 : 400,
        boxShadow: marked ? `inset 2px 0 0 ${COLORS.accent}` : "none"
      },
      "data-nc-path": entry.path,
      onClick: (event) => onSelect(event),
      onDoubleClick: onActivate,
      onMouseEnter: (event) => {
        if (!selected) event.currentTarget.style.background = COLORS.hover;
      },
      onMouseLeave: (event) => {
        if (!selected) event.currentTarget.style.background = "transparent";
      },
      title: entry.path,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: styles2.rowName, children: [
          entry.kind === "dir" ? "\u{1F4C1} " : "\u{1F4C4} ",
          entry.name
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.rowSize, children: entry.kind === "dir" ? measured ? formatSize(measured.bytes) : "" : formatSize(entry.size) })
      ]
    }
  );
}
function Pane({ index, pane, active, root, cursorPath, onCursor, onResolved, onError, onOpenPath, revision, marks, onCopyPath, onRename, onEntries, dirSizes, onCreateFolder }) {
  const t = useT();
  const [listing, setListing] = (0, import_react.useState)(null);
  const [tick, setTick] = (0, import_react.useState)(0);
  const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
  const listRef = (0, import_react.useRef)(null);
  const recovered = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (!pane.path) return void 0;
    let cancelled = false;
    fetchList(pane.path, { hidden: pane.showHidden, root }).then((body) => {
      if (cancelled) return;
      recovered.current = false;
      setListing(body);
    }).catch((failure) => {
      if (cancelled) return;
      if (failure.code === "not-a-directory") {
        onOpenPath(pane.path, listing?.path ?? parentOf(pane.path));
        return;
      }
      onError(failure.message);
      if (!recovered.current && !listing) {
        recovered.current = true;
        ncStore.setPath(index, parentOf(pane.path));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pane.path, pane.showHidden, root, tick, revision]);
  const entries = (0, import_react.useMemo)(
    () => listing ? sortEntries(listing.entries, pane.sortKey, pane.sortDir) : [],
    [listing, pane.sortKey, pane.sortDir]
  );
  const selected = (0, import_react.useMemo)(() => entries.find((entry) => entry.path === cursorPath) ?? null, [entries, cursorPath]);
  (0, import_react.useEffect)(() => {
    onResolved(index, selected);
  }, [selected, index, onResolved]);
  (0, import_react.useEffect)(() => {
    if (!cursorPath) return;
    const container = listRef.current;
    if (!container) return;
    const row = container.querySelector(`[data-nc-path="${CSS.escape ? CSS.escape(cursorPath) : cursorPath}"]`);
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
  }, [cursorPath, entries]);
  (0, import_react.useEffect)(() => {
    onEntries(index, entries);
  }, [entries, index, onEntries]);
  const go = (0, import_react.useCallback)(
    (target) => {
      if (!target) return;
      const trimmed = target.trim().replace(/\/+$/, "") || "/";
      const absolute = trimmed.startsWith("/") ? trimmed : `${pane.path ?? ""}/${trimmed}`;
      onCursor(index, null);
      ncStore.setPath(index, absolute);
    },
    [index, pane.path, onCursor]
  );
  const activate = (entry) => {
    if (entry.kind === "dir") {
      go(entry.path);
      return;
    }
    ncStore.openFile(entry);
  };
  const select = (entry, event) => {
    ncStore.setActivePane(index);
    if (event?.shiftKey && cursorPath && entry) {
      const from = entries.findIndex((row) => row.path === cursorPath);
      const to = entries.findIndex((row) => row.path === entry.path);
      if (from !== -1 && to !== -1) {
        const [low, high] = from < to ? [from, to] : [to, from];
        ncStore.setMarks(index, entries.slice(low, high + 1).map((row) => row.path));
        onCursor(index, entry.path);
        return;
      }
    }
    if (event?.ctrlKey || event?.metaKey) {
      ncStore.toggleMark(index, entry.path);
      onCursor(index, entry.path);
      return;
    }
    onCursor(index, entry?.path ?? null);
  };
  const sortMark = (key) => pane.sortKey === key ? pane.sortDir === 1 ? " \u25B2" : " \u25BC" : "";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      style: { ...styles2.pane, ...active ? styles2.paneActive : null },
      onMouseDown: () => ncStore.setActivePane(index),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.toolbar, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: styles2.iconButton,
              onClick: async () => {
                try {
                  go(await fetchHome());
                } catch {
                  go("/");
                }
              },
              title: t("panel.home"),
              children: "\u2302"
            }
          ),
          (listing?.crumbs ?? fallbackCrumbs(pane.path)).map((crumb, position, all) => {
            const last = position === all.length - 1;
            const text = crumb.path === "/" ? "/" : `${crumb.name}/`;
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                style: { ...styles2.crumb, ...last ? styles2.crumbCurrent : null },
                onClick: () => {
                  if (!last) go(crumb.path);
                },
                title: crumb.path,
                children: text
              },
              crumb.path
            );
          })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.headerRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.statName, title: selected?.path ?? "", children: selected?.name ?? "" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.statRight, children: selected ? [
            formatMode(selected.mode, selected.kind),
            selected.kind === "dir" ? dirSizes[selected.path] ? formatSize(dirSizes[selected.path].bytes) : "" : formatSize(selected.size) || t("unit.zero"),
            selected.mtimeMs ? formatTime(selected.mtimeMs) : ""
          ].filter(Boolean).join("  ") : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: styles2.iconButton,
              onClick: () => setMenuOpen((open) => !open),
              title: t("panel.menu"),
              children: "\u22EE"
            }
          ),
          menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.menu, onMouseLeave: () => setMenuOpen(false), children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.menuTitle, children: t("menu.sort") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => ncStore.setSort(index, "name"),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox, children: pane.sortKey === "name" ? "\u2713" : "" }),
                  t("sort.byName")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => ncStore.setSort(index, "type"),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox, children: pane.sortKey === "type" ? "\u2713" : "" }),
                  t("sort.byType")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => ncStore.setSortDir(index, pane.sortDir === -1 ? 1 : -1),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox, children: pane.sortDir === -1 ? "\u2713" : "" }),
                  t("sort.reverse")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.menuTitle, children: t("menu.filter") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => ncStore.toggleHidden(index),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox, children: pane.showHidden ? "\u2713" : "" }),
                  t("filter.hidden")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.menuTitle, children: t("menu.file") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => {
                  if (selected) onCopyPath(selected.path);
                  setMenuOpen(false);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox }),
                  t("file.copyPath")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: { ...styles2.menuItem, ...selected ? null : { opacity: 0.5 } },
                onClick: () => {
                  if (selected) onRename(selected.path, selected.name);
                  setMenuOpen(false);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox }),
                  t("file.rename")
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => {
                  onCreateFolder();
                  setMenuOpen(false);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox }),
                  t("file.mkdir"),
                  " (F7)"
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                style: styles2.menuItem,
                onClick: () => {
                  ncStore.setMarks(index, []);
                  setMenuOpen(false);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.menuBox }),
                  t("file.clearMarks")
                ]
              }
            )
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.list, ref: listRef, "data-nc-list": index, children: [
          listing && entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.note, children: t("msg.empty") }) : null,
          entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            EntryRow,
            {
              entry,
              selected: selected?.path === entry.path,
              marked: (marks ?? []).includes(entry.path),
              measured: dirSizes[entry.path],
              onSelect: (event) => select(entry, event),
              onActivate: () => activate(entry)
            },
            entry.path
          ))
        ] })
      ]
    }
  );
}
function Preview({ path, root, name: name2, mode = "source" }) {
  const t = useT();
  const [state, setState] = (0, import_react.useState)({ status: "loading" });
  const kind = previewKindOf(name2);
  const wantsText = kind === "text" || kind === "markdown";
  (0, import_react.useEffect)(() => {
    if (!wantsText) {
      setState({ status: "media" });
      return void 0;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchText(path, { root }).then((body) => {
      if (cancelled) return;
      setState(body.kind === "binary" ? { status: "binary", size: body.size } : { status: "text", body });
    }).catch((error) => {
      if (!cancelled) setState({ status: "error", message: error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [path, root, wantsText]);
  if (state.status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.note, children: t("msg.loading") });
  if (state.status === "error") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.error, children: state.message });
  if (state.status === "binary") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.note, children: [
      t("msg.binary"),
      ", ",
      formatSize(state.size),
      ".",
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: rawUrl(path, root), target: "_blank", rel: "noreferrer", children: t("btn.download.plain") })
    ] });
  }
  if (state.status === "media") {
    const url = rawUrl(path, root);
    if (kind === "html") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "iframe",
        {
          src: url,
          title: name2,
          sandbox: "",
          style: { width: "100%", height: "100%", border: "none", minHeight: 360, background: "#fff" }
        }
      );
    }
    if (kind === "image") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { src: url, alt: name2, style: { maxWidth: "100%", borderRadius: 6 } });
    if (kind === "pdf") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("iframe", { src: url, title: name2, style: { width: "100%", height: "100%", border: "none", minHeight: 320 } });
    if (kind === "video") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("video", { src: url, controls: true, style: { maxWidth: "100%" } });
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("audio", { src: url, controls: true });
  }
  const text = state.body.text ?? "";
  if (kind === "markdown" && mode === "rendered") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MarkdownView, { text, file: path });
  }
  const painted = highlight(text, languageOf(name2));
  const lines = painted ?? text.split("\n").map((line) => [{ text: line, type: "plain" }]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { style: styles2.pre, children: lines.map((line, number) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.lineNumber, children: number + 1 }),
      line.length === 0 ? "\u200B" : line.map((piece, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: TOKEN_COLORS[piece.type] ?? "inherit" }, children: piece.text }, index))
    ] }, number)) }),
    state.body.truncated ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.note, children: t("msg.truncated", { shown: formatSize((state.body.text ?? "").length), total: formatSize(state.body.size) }) }) : null
  ] });
}
function FileBrowser({ sessionKey, startPath, root, focusRequest, onFocusHandled }) {
  const t = useT();
  const key = sessionKey ?? "default";
  const state = (0, import_react.useSyncExternalStore)(ncStore.subscribe, ncStore.getSnapshot, ncStore.getSnapshot);
  const [resolved, setResolved] = (0, import_react.useState)({ 0: null, 1: null });
  const [pathDraft, setPathDraft] = (0, import_react.useState)("");
  const [toasts, setToasts] = (0, import_react.useState)([]);
  const [sourceView, setSourceView] = (0, import_react.useState)(false);
  const transfer = state.dialog;
  const setTransfer = (0, import_react.useCallback)((value) => ncStore.setDialog(value), []);
  const [dirSizes, setDirSizes] = (0, import_react.useState)({});
  const [sizeQuery, setSizeQuery] = (0, import_react.useState)(null);
  const [allowOverwrite, setAllowOverwrite] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (!focusRequest || focusRequest.view !== "nc-files") return;
    const path = focusRequest.focus;
    if (path) ncStore.openPath(path);
    if (typeof onFocusHandled === "function") onFocusHandled();
  }, [focusRequest, onFocusHandled]);
  const background = state.tasks ?? [];
  const setBackground = (0, import_react.useCallback)((value) => ncStore.setTasks(value), []);
  const announced = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const toast = (0, import_react.useCallback)((text) => {
    const id = Date.now() + Math.random();
    setToasts((previous) => [...previous, { id, text }]);
    setTimeout(() => setToasts((previous) => previous.filter((item) => item.id !== id)), 5e3);
  }, []);
  const openPathInPane = (0, import_react.useCallback)(
    (index) => (path, fallback) => {
      const name2 = path.split("/").filter(Boolean).pop() ?? path;
      ncStore.openFile({ path, name: name2 });
      if (fallback) ncStore.setPath(index, fallback);
    },
    []
  );
  const onResolved = (0, import_react.useCallback)((index, entry) => {
    setResolved((previous) => previous[index] === entry ? previous : { ...previous, [index]: entry });
  }, []);
  const onCursor = (0, import_react.useCallback)((index, path) => {
    ncStore.setCursor(index, path);
  }, []);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const tag = target instanceof HTMLElement ? target.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      const snapshot = ncStore.getSnapshot();
      const nextPane = snapshot.activePane === 0 ? 1 : 0;
      ncStore.toggleActivePane();
      if (!snapshot.cursor[nextPane]) {
        const entries = paneEntries.current[nextPane] ?? [];
        if (entries[0]) ncStore.setCursor(nextPane, entries[0].path);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const state_ = ncStore.getSnapshot();
      if (state_.viewMode === "file" && state_.activePath) ncStore.closeFile(state_.activePath);
      ncStore.backToPanes();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  (0, import_react.useEffect)(() => {
    ncStore.bind(key);
    let cancelled = false;
    const place = async () => {
      const snapshot = ncStore.getSnapshot();
      if (snapshot.panes[0].path && snapshot.panes[1].path) return;
      let start = startPath;
      if (!start) {
        try {
          start = await fetchHome();
        } catch {
          start = "/";
        }
      }
      if (cancelled) return;
      if (!ncStore.getSnapshot().panes[0].path) ncStore.setPath(0, start);
      if (!ncStore.getSnapshot().panes[1].path) ncStore.setPath(1, start);
    };
    void place();
    return () => {
      cancelled = true;
    };
  }, [key, startPath]);
  const panesKey = `${state.panes[0].path ?? ""}|${state.panes[1].path ?? ""}`;
  (0, import_react.useEffect)(() => {
    setDirSizes({});
  }, [panesKey]);
  const pane = state.panes[state.activePane];
  const current2 = resolved[state.activePane];
  (0, import_react.useEffect)(() => {
    setSourceView(false);
  }, [state.activePath]);
  const activeFile = (0, import_react.useMemo)(
    () => state.openFiles.find((file) => file.path === state.activePath) ?? null,
    [state.openFiles, state.activePath]
  );
  const otherDir = state.panes[state.activePane === 0 ? 1 : 0].path;
  const paneEntries = (0, import_react.useRef)({ 0: [], 1: [] });
  const registerEntries = (0, import_react.useCallback)((index, entries) => {
    paneEntries.current[index] = entries;
  }, []);
  const measureDir = (0, import_react.useCallback)(
    async (path) => {
      setSizeQuery(path);
      try {
        const measured = await dirSize(path, { root });
        setDirSizes((previous) => ({ ...previous, [path]: measured }));
      } catch (failure) {
        toast(describeError(t, failure));
      } finally {
        setSizeQuery(null);
      }
    },
    [root, toast]
  );
  const sourcesOf = (0, import_react.useCallback)(() => {
    const marks = state.marks[state.activePane] ?? [];
    if (marks.length > 0) return marks;
    return current2 ? [current2.path] : [];
  }, [state.marks, state.activePane, current2]);
  const openTransfer = (0, import_react.useCallback)(
    async (mode) => {
      const sources = sourcesOf();
      if (sources.length === 0) {
        toast(t("msg.nothingTransfer"));
        return;
      }
      if (mode !== "delete" && !otherDir) {
        toast(t("msg.noOtherPane"));
        return;
      }
      setAllowOverwrite(false);
      setTransfer({ phase: "planning", op: mode, sources, targetDir: mode === "delete" ? null : otherDir });
      try {
        const plan = await planTransfer(mode, sources, otherDir, { root });
        setTransfer({ phase: "plan", op: mode, sources, targetDir: otherDir, plan });
      } catch (failure) {
        setTransfer({ phase: "plan-error", op: mode, sources, targetDir: otherDir, error: describeError(t, failure) });
      }
    },
    [sourcesOf, otherDir, root, toast]
  );
  const runTransfer = (0, import_react.useCallback)(async () => {
    if (!transfer) return;
    setTransfer({ ...transfer, phase: "starting" });
    try {
      const started = await startTransfer(transfer.op, transfer.sources, transfer.targetDir, {
        root,
        overwrite: allowOverwrite
      });
      ncStore.clearMarks();
      setTransfer((previous) => previous ? { ...previous, phase: "progress", jobId: started.jobId, progress: null } : previous);
    } catch (failure) {
      toast(describeError(t, failure));
      setTransfer(null);
    }
  }, [transfer, root, toast, allowOverwrite]);
  const renameEntry = (0, import_react.useCallback)(
    async (path, oldName) => {
      const name2 = window.prompt(t("msg.renamePrompt"), oldName);
      if (!name2 || name2 === oldName) return;
      const dir = path.slice(0, path.lastIndexOf("/")) || "/";
      try {
        await moveEntry(path, `${dir}/${name2}`, { root });
        toast(t("msg.renamed", { from: oldName, to: name2 }));
        ncStore.refresh();
      } catch (failure) {
        toast(describeError(t, failure));
      }
    },
    [root, toast]
  );
  const renameCurrent = (0, import_react.useCallback)(async () => {
    if (!current2) {
      toast(t("msg.nothingRename"));
      return;
    }
    await renameEntry(current2.path, current2.name);
  }, [current2, renameEntry, toast]);
  const mkdirCurrent = (0, import_react.useCallback)(async () => {
    const dir = state.panes[state.activePane].path;
    if (!dir) {
      toast(t("msg.noOtherPane"));
      return;
    }
    const name2 = window.prompt(t("msg.newFolder"), t("msg.newFolder"));
    if (!name2) return;
    const target = `${dir}/${name2.trim()}`.replace(/\/+$/, "");
    try {
      await makeDir(target, { root });
      toast(t("msg.folderCreated", { name: name2.trim() }));
      ncStore.refresh();
    } catch (failure) {
      toast(describeError(t, failure));
    }
  }, [state.panes, state.activePane, root, toast, t]);
  const removeCurrent = (0, import_react.useCallback)(async () => {
    const targets = sourcesOf();
    if (targets.length === 0) {
      toast(t("msg.nothingDelete"));
      return;
    }
    await openTransfer("delete");
  }, [sourcesOf, openTransfer, toast]);
  const downloadCurrent = (0, import_react.useCallback)(() => {
    if (!current2 || current2.kind !== "file") {
      toast(t("msg.fileOnlyDownload"));
      return;
    }
    const link = document.createElement("a");
    link.href = rawUrl(current2.path, root);
    link.download = current2.name;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [current2, root, toast]);
  const copyPath = (0, import_react.useCallback)(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast(t("msg.pathCopied"));
    } catch {
      toast(t("msg.clipboard"));
    }
  }, []);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
      if (event.key === "F3") {
        event.preventDefault();
        if (!current2) return;
        if (current2.kind === "file") ncStore.openFile(current2);
        else void measureDir(current2.path);
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        if (current2?.kind === "file") downloadCurrent();
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        void openTransfer("copy");
        return;
      }
      if (event.key === "F6") {
        event.preventDefault();
        if (event.shiftKey) void renameCurrent();
        else void openTransfer("move");
        return;
      }
      if (event.key === "F7") {
        event.preventDefault();
        void mkdirCurrent();
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        void removeCurrent();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        const entries = paneEntries.current[state.activePane] ?? [];
        if (entries.length === 0) return;
        event.preventDefault();
        const at = entries.findIndex((entry) => entry.path === state.cursor[state.activePane]);
        const last = entries.length - 1;
        const step = event.key === "ArrowDown" ? 1 : -1;
        if (event.shiftKey) {
          const here = entries[at === -1 ? 0 : at];
          if (here) ncStore.toggleMark(state.activePane, here.path);
          const moved = at === -1 ? 0 : Math.min(Math.max(at + step, 0), last);
          if (!(event.key === "ArrowDown" && at === last) && !(event.key === "ArrowUp" && at === 0)) {
            const target2 = entries[moved];
            if (target2) ncStore.setCursor(state.activePane, target2.path);
          }
          return;
        }
        const next = event.key === "Home" ? 0 : event.key === "End" ? last : Math.min(Math.max(at === -1 ? 0 : at + step, 0), last);
        const target = entries[next];
        if (target) ncStore.setCursor(state.activePane, target.path);
        return;
      }
      if (event.key === "Insert" || event.key === " ") {
        const entries = paneEntries.current[state.activePane] ?? [];
        const path = state.cursor[state.activePane];
        if (!path) return;
        event.preventDefault();
        ncStore.toggleMark(state.activePane, path);
        if (event.key === "Insert") {
          const at = entries.findIndex((entry) => entry.path === path);
          const target = entries[Math.min(at + 1, entries.length - 1)];
          if (target && target.path !== path) ncStore.setCursor(state.activePane, target.path);
        }
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        const current_ = state.panes[state.activePane].path;
        if (!current_ || current_ === "/") return;
        const parent = current_.slice(0, current_.lastIndexOf("/")) || "/";
        ncStore.setPath(state.activePane, parent);
        return;
      }
      if (event.key === "Enter") {
        const entries = paneEntries.current[state.activePane] ?? [];
        const entry = entries.find((row) => row.path === state.cursor[state.activePane]);
        if (!entry) return;
        event.preventDefault();
        if (entry.kind === "dir") ncStore.setPath(state.activePane, entry.path);
        else ncStore.openFile(entry);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [current2, openTransfer, renameCurrent, removeCurrent, downloadCurrent, measureDir, mkdirCurrent, state.activePane, state.cursor]);
  const activeJobIds = (0, import_react.useMemo)(() => {
    const ids = [];
    if (transfer?.jobId) ids.push({ id: transfer.jobId, where: "dialog", op: transfer.op });
    for (const job of background) if (job.jobId) ids.push({ id: job.jobId, where: "background", op: job.op });
    return ids;
  }, [transfer?.jobId, transfer?.op, background]);
  const activeKey = activeJobIds.map((job) => `${job.where}:${job.id}`).join(",");
  (0, import_react.useEffect)(() => {
    if (activeKey === "") return void 0;
    let stopped = false;
    let finished = false;
    const timer = setInterval(async () => {
      if (finished) return;
      for (const job of activeJobIds) {
        try {
          const status = await jobStatus(job.id, { root });
          if (stopped) return;
          if (job.where === "dialog") {
            setTransfer(
              (previous) => previous && previous.jobId === job.id ? { ...previous, progress: status } : previous
            );
          } else {
            setBackground(
              (previous) => previous.map((item) => item.jobId === job.id ? { ...item, progress: status } : item)
            );
          }
          if (status.state !== "running") {
            if (job.where === "dialog") setTransfer(null);
            else setBackground((previous) => previous.filter((item) => item.jobId !== job.id));
            ncStore.clearMarks();
            ncStore.refresh();
            if (!announced.current.has(job.id)) {
              announced.current.add(job.id);
              if (status.state === "done") toast(t("msg.done", { done: status.done }));
              else if (status.state === "cancelled") toast(t("msg.cancelled", { done: status.done, total: status.total }));
              else if (status.state === "stalled") toast(t("msg.stalled"));
              else toast(t("msg.failed", { failed: status.failed, total: status.total }));
            }
          }
        } catch (failure) {
          if (failure?.code === "no-job") {
            if (job.where === "dialog") setTransfer(null);
            else setBackground((previous) => previous.filter((item) => item.jobId !== job.id));
            continue;
          }
        }
      }
    }, 1e3);
    return () => {
      stopped = true;
      finished = true;
      clearInterval(timer);
    };
  }, [activeKey, root, toast, t]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.panes, ...state.viewMode === "file" ? { display: "none" } : null }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Pane,
        {
          index: 0,
          pane: state.panes[0],
          active: state.activePane === 0,
          root,
          cursorPath: state.cursor[0],
          onCursor,
          onResolved,
          onError: toast,
          onOpenPath: openPathInPane(0),
          revision: state.revision,
          marks: state.marks[0],
          onCopyPath: copyPath,
          onRename: renameEntry,
          onEntries: registerEntries,
          dirSizes,
          onCreateFolder: mkdirCurrent
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.divider }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Pane,
        {
          index: 1,
          pane: state.panes[1],
          active: state.activePane === 1,
          root,
          cursorPath: state.cursor[1],
          onCursor,
          onResolved,
          onError: toast,
          onOpenPath: openPathInPane(1),
          revision: state.revision,
          marks: state.marks[1],
          onCopyPath: copyPath,
          onRename: renameEntry,
          onEntries: registerEntries,
          dirSizes,
          onCreateFolder: mkdirCurrent
        }
      )
    ] }),
    state.openFiles.length > 0 && state.viewMode === "file" && activeFile ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.fullViewer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.viewerBar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            style: styles2.button,
            onClick: () => ncStore.backToPanes(),
            title: t("preview.backTitle"),
            children: t("preview.back")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.viewerPath, title: activeFile.path, children: activeFile.path }),
        previewKindOf(activeFile.name) === "markdown" || previewKindOf(activeFile.name) === "html" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: { ...styles2.button, ...sourceView ? null : styles2.buttonOn },
              onClick: () => setSourceView(false),
              title: t("preview.renderTitle"),
              children: t("preview.render")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: { ...styles2.button, ...sourceView ? styles2.buttonOn : null },
              onClick: () => setSourceView(true),
              title: t("preview.sourceTitle"),
              children: t("preview.source")
            }
          )
        ] }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.tabs, children: state.openFiles.map((file) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "span",
        {
          style: {
            ...styles2.tab,
            background: file.path === state.activePath ? COLORS.active : "transparent",
            color: file.path === state.activePath ? COLORS.text : COLORS.dim
          },
          onClick: () => ncStore.focusFile(file.path),
          title: file.path,
          children: [
            file.name,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                style: styles2.tabClose,
                onClick: (event) => {
                  event.stopPropagation();
                  ncStore.closeFile(file.path);
                },
                title: t("msg.close"),
                children: "\xD7"
              }
            )
          ]
        },
        file.path
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.fullViewerBody, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Preview,
        {
          path: activeFile.path,
          root,
          name: activeFile.name,
          mode: sourceView ? "source" : "rendered"
        }
      ) })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.pathBar, ...state.viewMode === "file" ? { display: "none" } : null }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          style: { ...styles2.input, flex: "1 1 200px", minWidth: 0 },
          value: pathDraft,
          placeholder: t("path.placeholder"),
          onChange: (event) => setPathDraft(event.target.value),
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            const trimmed = pathDraft.trim().replace(/\/+$/, "");
            if (!trimmed) return;
            const absolute = trimmed.startsWith("/") ? trimmed : `${pane.path ?? ""}/${trimmed}`;
            ncStore.setPath(state.activePane, absolute);
            setPathDraft("");
          }
        }
      ),
      background.map((job) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...styles2.button, ...styles2.buttonOn, flex: "none", whiteSpace: "nowrap" },
          title: t("progress.background"),
          onClick: () => {
            setTransfer({ phase: "progress", op: job.op, jobId: job.jobId, progress: job.progress });
            setBackground((previous) => previous.filter((item) => item.jobId !== job.jobId));
          },
          children: t("progress.task", {
            done: job.progress?.done ?? 0,
            total: job.progress?.total ?? 0
          })
        },
        job.jobId
      ))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.footer, ...state.viewMode === "file" ? { display: "none" } : null }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...styles2.button, ...current2 ? null : styles2.buttonDisabled },
          disabled: !current2,
          onClick: () => {
            if (!current2) return;
            if (current2.kind === "dir") void measureDir(current2.path);
            else ncStore.openFile(current2);
          },
          title: t(current2?.kind === "dir" ? "btn.size" : "btn.view"),
          children: t(current2?.kind === "dir" ? "btn.size" : "btn.view")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "a",
        {
          href: current2 && current2.kind === "file" ? rawUrl(current2.path, root) : void 0,
          download: current2?.name,
          style: {
            ...styles2.button,
            ...current2 && current2.kind === "file" ? null : styles2.buttonDisabled,
            textDecoration: "none"
          },
          onClick: (event) => {
            if (!current2 || current2.kind !== "file") event.preventDefault();
          },
          title: t("title.download"),
          children: t("btn.download")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...styles2.button, ...current2 || (state.marks[state.activePane] ?? []).length > 0 ? null : styles2.buttonDisabled },
          disabled: !current2 && (state.marks[state.activePane] ?? []).length === 0,
          onClick: () => openTransfer("copy"),
          title: t("title.copy"),
          children: t("btn.copy")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...styles2.button, ...current2 || (state.marks[state.activePane] ?? []).length > 0 ? null : styles2.buttonDisabled },
          disabled: !current2 && (state.marks[state.activePane] ?? []).length === 0,
          onClick: () => openTransfer("move"),
          title: t("title.move"),
          children: t("btn.move")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...styles2.button, ...current2 || (state.marks[state.activePane] ?? []).length > 0 ? null : styles2.buttonDisabled },
          disabled: !current2 && (state.marks[state.activePane] ?? []).length === 0,
          onClick: () => removeCurrent(),
          title: t("title.delete"),
          children: t("btn.delete")
        }
      ),
      (state.marks[state.activePane] ?? []).length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.note, children: t("msg.marksCount", { count: state.marks[state.activePane].length }) }) : null
    ] }),
    sizeQuery ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.overlay, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.dialog, width: "min(420px, 92%)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.dialogTitle, children: t("size.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.dialogNote, display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-nc-spinner" }),
        sizeQuery
      ] })
    ] }) }) : null,
    transfer && transfer.phase !== "background" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.overlay, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.dialog, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.dialogTitle, children: [
        t(`plan.title.${transfer.op}`),
        transfer.phase === "plan" && transfer.targetDir ? ` \u2192 ${transfer.targetDir}` : ""
      ] }),
      transfer.phase === "starting" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.dialogNote, display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-nc-spinner" }),
        t("plan.starting")
      ] }) : null,
      transfer.phase === "plan-error" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...styles2.dialogNote, color: COLORS.danger }, children: transfer.error }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.dialogActions, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: styles2.button, onClick: () => setTransfer(null), children: t("plan.cancel") }) })
      ] }) : null,
      transfer.phase === "planning" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...styles2.dialogNote, display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-nc-spinner" }),
        t("plan.preparing")
      ] }) : null,
      transfer.phase === "plan" && transfer.plan ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        transfer.sources?.length ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.dialogNote, children: t("plan.what") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.listBox, children: [
            transfer.sources.slice(0, 50).map((source) => source.split("/").filter(Boolean).pop() ?? source).join("\n"),
            transfer.sources.length > 50 ? `
${t("plan.andMore", { count: transfer.sources.length - 50 })}` : ""
          ] })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.dialogNote, children: t(`plan.will${transfer.op === "copy" ? "Copy" : transfer.op === "move" ? "Move" : "Delete"}`, {
          steps: transfer.plan.steps,
          files: transfer.plan.files,
          size: formatSize(transfer.plan.bytes)
        }) }),
        transfer.op !== "delete" ? transfer.plan.conflictCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { ...styles2.dialogNote, display: "flex", alignItems: "center", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "checkbox",
              checked: allowOverwrite,
              onChange: (event) => setAllowOverwrite(event.target.checked)
            }
          ),
          t("plan.overwrite", { count: transfer.plan.conflictCount }),
          " \u2014 ",
          t("plan.overwriteAsk")
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.dialogNote, children: t("plan.noOverwrite") }) : null,
        transfer.plan.conflicts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.listBox, children: transfer.plan.conflicts.join("\n") }) : null,
        transfer.plan.problems?.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...styles2.dialogNote, color: COLORS.danger }, children: t("plan.blocked") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...styles2.listBox, borderColor: COLORS.danger }, children: transfer.plan.problems.map((item) => `${item.path} \u2014 ${item.reason}`).join("\n") })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.dialogActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: styles2.button, onClick: () => setTransfer(null), children: t("plan.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: {
                ...styles2.button,
                ...transfer.plan.problems?.length > 0 ? styles2.buttonDisabled : styles2.buttonOn
              },
              disabled: transfer.plan.problems?.length > 0 || transfer.plan.conflictCount > 0 && !allowOverwrite,
              onClick: () => runTransfer(),
              title: transfer.plan.problems?.length > 0 ? t("plan.runBlocked") : t("plan.runHint"),
              children: t("plan.run")
            }
          )
        ] })
      ] }) : null,
      transfer.phase === "progress" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.dialogNote, children: [
          transfer.progress ? t("progress.line", {
            done: transfer.progress.done,
            total: transfer.progress.total,
            bytes: formatSize(transfer.progress.bytes),
            totalBytes: formatSize(transfer.progress.totalBytes)
          }) : t("plan.starting"),
          transfer.progress?.failed ? t("msg.errorsSuffix", { count: transfer.progress.failed }) : ""
        ] }),
        transfer.progress?.current ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.listBox, children: transfer.progress.current }) : null,
        transfer.progress?.errors?.length ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.listBox, children: transfer.progress.errors.join("\n") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.dialogActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: styles2.button,
              onClick: () => {
                if (transfer.jobId) void cancelJob(transfer.jobId, { root });
              },
              children: t("progress.cancel")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: styles2.button,
              onClick: () => {
                if (transfer.jobId) {
                  setBackground((previous) => [
                    ...previous,
                    { jobId: transfer.jobId, op: transfer.op, progress: transfer.progress }
                  ]);
                }
                setTransfer(null);
              },
              children: t("progress.background")
            }
          )
        ] })
      ] }) : null
    ] }) }) : null,
    toasts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.toasts, children: toasts.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: { ...styles2.toast, pointerEvents: "auto", cursor: "pointer" },
        title: t("progress.cancel"),
        onClick: () => setToasts((previous) => previous.filter((toast2) => toast2.id !== item.id)),
        children: item.text
      },
      item.id
    )) }) : null
  ] });
}

// src/client/i18n.js
var ru = {
  "menu.sort": "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  "menu.filter": "\u0424\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F",
  "menu.file": "\u0424\u0430\u0439\u043B",
  "msg.empty": "\u041F\u0443\u0441\u0442\u043E",
  "msg.openingInNc": "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u044E \u0432 \u0444\u0430\u0439\u043B\u043E\u0432\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435\u2026",
  "menu.openInFiles": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 \u0444\u0430\u0439\u043B\u043E\u0432\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435",
  "menu.openDirInFiles": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0432 \u0444\u0430\u0439\u043B\u043E\u0432\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435",
  "msg.loading": "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044E\u2026",
  "msg.binary": "\u0414\u0432\u043E\u0438\u0447\u043D\u044B\u0439 \u0444\u0430\u0439\u043B",
  "msg.truncated": "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 {shown} \u0438\u0437 {total}.",
  "preview.back": "\u2190 \u041F\u0430\u043D\u0435\u043B\u0438",
  "preview.backTitle": "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043A \u043F\u0430\u043D\u0435\u043B\u044F\u043C (Esc)",
  "preview.renderTitle": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441 \u0440\u0435\u043D\u0434\u0435\u0440\u0438\u043D\u0433\u043E\u043C",
  "preview.sourceTitle": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442",
  "msg.close": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
  "title.view": "\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0444\u0430\u0439\u043B (F3)",
  "title.size": "\u041F\u043E\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 (F3)",
  "title.download": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B (F2)",
  "title.copy": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438 (F5)",
  "title.move": "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438 (F6)",
  "title.delete": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u043E\u0435 (F8)",
  "title.rename": "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C (Shift-F6)",
  "title.mkdir": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 (F7)",
  "title.task": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043E\u043A\u043D\u043E \u0437\u0430\u0434\u0430\u0447\u0438",
  "crash": "\u0424\u0430\u0439\u043B\u043E\u0432\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0443\u043F\u0430\u043B: {message}",
  "crash.hint": "\u041E\u0431\u043D\u043E\u0432\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443. \u0415\u0441\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u2014 \u0441\u043C\u043E\u0442\u0440\u0438 \u043A\u043E\u043D\u0441\u043E\u043B\u044C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.",
  "msg.errorsSuffix": " \xB7 \u043E\u0448\u0438\u0431\u043E\u043A {count}",
  "unit.zero": "0 \u0411",
  "panel.menu": "\u041C\u0435\u043D\u044E \u043F\u0430\u043D\u0435\u043B\u0438",
  "panel.home": "\u0414\u043E\u043C\u043E\u0439",
  "panel.nothing": "",
  "sort.byName": "\u043F\u043E \u0438\u043C\u0435\u043D\u0438",
  "sort.byType": "\u043F\u043E \u0442\u0438\u043F\u0443",
  "sort.reverse": "\u0432 \u043E\u0431\u0440\u0430\u0442\u043D\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435",
  "filter.hidden": "\u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043A\u0440\u044B\u0442\u044B\u0435",
  "file.copyPath": "\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0443\u0442\u044C",
  "file.rename": "\u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C",
  "file.clearMarks": "\u0441\u043D\u044F\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0438",
  "file.mkdir": "\u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433",
  "msg.newFolder": "\u041D\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430",
  "msg.folderCreated": "\u0441\u043E\u0437\u0434\u0430\u043D \u043A\u0430\u0442\u0430\u043B\u043E\u0433: {name}",
  "btn.view": "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 (F3)",
  "btn.size": "\u0420\u0430\u0437\u043C\u0435\u0440 (F3)",
  "btn.download": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C (F2)",
  "btn.copy": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C (F5)",
  "btn.move": "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C (F6)",
  "btn.delete": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C (F8)",
  "btn.download.plain": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C",
  "preview.render": "\u0420\u0435\u043D\u0434\u0435\u0440",
  "preview.source": "\u0418\u0441\u0445\u043E\u0434\u043D\u0438\u043A",
  "path.placeholder": "\u041F\u0443\u0442\u044C \u0438 Enter \u2014 \u043F\u0435\u0440\u0435\u0439\u0434\u0451\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0430\u043D\u0435\u043B\u044C",
  "plan.title.copy": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435",
  "plan.title.move": "\u041F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0435",
  "plan.title.delete": "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435",
  "plan.preparing": "\u0433\u043E\u0442\u043E\u0432\u0438\u043C \u043F\u043B\u0430\u043D \u0440\u0430\u0431\u043E\u0442\u2026",
  "plan.starting": "\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u2026",
  "plan.what": "\u0447\u0442\u043E:",
  "plan.willCopy": "\u0431\u0443\u0434\u0435\u0442 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E: {steps} \u0444\u0430\u0439\u043B\u043E\u0432 ({size})",
  "plan.willMove": "\u0431\u0443\u0434\u0435\u0442 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u043E: {steps} \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u2014 \u0432\u043D\u0443\u0442\u0440\u0438 {files} \u0444\u0430\u0439\u043B\u043E\u0432 ({size})",
  "plan.willDelete": "\u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u043E: {steps} \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u2014 \u0432\u043D\u0443\u0442\u0440\u0438 {files} \u0444\u0430\u0439\u043B\u043E\u0432 ({size})",
  "plan.overwrite": "\u0431\u0443\u0434\u0443\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u0430\u043D\u044B: {count} \u0444\u0430\u0439\u043B\u043E\u0432",
  "plan.noOverwrite": "\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043F\u0440\u0438\u0434\u0451\u0442\u0441\u044F",
  "plan.blocked": "\u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F:",
  "plan.overwriteAsk": "\u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u044C",
  "progress.skipped": "\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E {count}",
  "plan.andMore": "\u2026 \u0438 \u0435\u0449\u0451 {count}",
  "plan.cancel": "\u041E\u0442\u043C\u0435\u043D\u0430",
  "plan.run": "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C",
  "plan.runHint": "\u041D\u0430\u0447\u0430\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435",
  "plan.runBlocked": "\u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0443\u0441\u0442\u0440\u0430\u043D\u0438\u0442\u0435 \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u044F",
  "progress.cancel": "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C",
  "progress.background": "\u0412 \u0444\u043E\u043D",
  "progress.task": "\u0437\u0430\u0434\u0430\u0447\u0430: {done}/{total}",
  "progress.line": "{done} \u0438\u0437 {total} \u0444\u0430\u0439\u043B\u043E\u0432 \xB7 {bytes} \u0438\u0437 {totalBytes}",
  "progress.errors": "\u043E\u0448\u0438\u0431\u043E\u043A {count}",
  "size.title": "\u0421\u0447\u0438\u0442\u0430\u044E \u0440\u0430\u0437\u043C\u0435\u0440",
  "msg.nothingTransfer": "\u041D\u0435\u0447\u0435\u0433\u043E \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438\u0442\u044C: \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u0438 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E",
  "msg.nothingDelete": "\u041D\u0435\u0447\u0435\u0433\u043E \u0443\u0434\u0430\u043B\u044F\u0442\u044C: \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u0438 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E",
  "msg.nothingRename": "\u041D\u0435\u0447\u0435\u0433\u043E \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u044B\u0432\u0430\u0442\u044C: \u0444\u0430\u0439\u043B \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D",
  "msg.fileOnlyDownload": "\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u0430\u0439\u043B",
  "msg.noOtherPane": "\u0423 \u0432\u0442\u043E\u0440\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438 \u043D\u0435\u0442 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430",
  "msg.pathCopied": "\u041F\u0443\u0442\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D",
  "msg.clipboard": "\u0411\u0443\u0444\u0435\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D",
  "msg.renamePrompt": "\u041D\u043E\u0432\u043E\u0435 \u0438\u043C\u044F",
  "msg.renamed": "\u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u043E: {from} \u2192 {to}",
  "msg.done": "\u0433\u043E\u0442\u043E\u0432\u043E: {done} \u0448\u0430\u0433\u043E\u0432",
  "msg.cancelled": "\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E: \u0441\u0434\u0435\u043B\u0430\u043D\u043E {done} \u0438\u0437 {total}",
  "msg.failed": "\u043E\u0448\u0438\u0431\u043E\u043A {failed} \u0438\u0437 {total}",
  "msg.stalled": "\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E: \u043D\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u0430 10 \u043C\u0438\u043D\u0443\u0442",
  "msg.marksCount": " \xB7 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E {count}",
  "kind.dir": "\u043A\u0430\u0442\u0430\u043B\u043E\u0433",
  "kind.file": "\u0444\u0430\u0439\u043B",
  "error.no-access": "\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430: {path}",
  "error.not-found": "\u043D\u0435\u0442 \u0442\u0430\u043A\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430: {path}",
  "error.not-a-directory": "\u043D\u0435 \u043A\u0430\u0442\u0430\u043B\u043E\u0433: {path}",
  "error.target-exists": "\u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442: {path}",
  "error.not-executable": "\u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E \u043F\u0440\u0430\u0432\u0430\u043C",
  "error.refused": "\u0442\u0430\u043A \u043D\u0435\u043B\u044C\u0437\u044F"
};
var en = {
  "menu.sort": "Sort",
  "menu.filter": "Filter",
  "menu.file": "File",
  "msg.empty": "Empty",
  "msg.openingInNc": "Opening in the file browser\u2026",
  "menu.openInFiles": "Open in the file browser",
  "menu.openDirInFiles": "Open the directory in the file browser",
  "msg.loading": "Loading\u2026",
  "msg.binary": "Binary file",
  "msg.truncated": "Showing the first {shown} of {total}.",
  "preview.back": "\u2190 Panels",
  "preview.backTitle": "Back to panels (Esc)",
  "preview.renderTitle": "Show rendered",
  "preview.sourceTitle": "Show source",
  "msg.close": "Close",
  "title.view": "View the file (F3)",
  "title.size": "Measure the directory (F3)",
  "title.download": "Download the file (F2)",
  "title.copy": "Copy to the other panel directory (F5)",
  "title.move": "Move to the other panel directory (F6)",
  "title.delete": "Delete the marked entries (F8)",
  "title.rename": "Rename (Shift-F6)",
  "title.mkdir": "Create a directory (F7)",
  "title.task": "Show the task window",
  "crash": "The file browser crashed: {message}",
  "crash.hint": "Reload the page. If it repeats, check the browser console.",
  "msg.errorsSuffix": " \xB7 errors {count}",
  "unit.zero": "0 B",
  "panel.menu": "Panel menu",
  "panel.home": "Home",
  "panel.nothing": "",
  "sort.byName": "by name",
  "sort.byType": "by type",
  "sort.reverse": "reverse order",
  "filter.hidden": "show hidden",
  "file.copyPath": "copy path",
  "file.rename": "rename",
  "file.clearMarks": "clear marks",
  "file.mkdir": "new directory",
  "msg.newFolder": "New folder",
  "msg.folderCreated": "directory created: {name}",
  "btn.view": "View (F3)",
  "btn.size": "Size (F3)",
  "btn.download": "Download (F2)",
  "btn.copy": "Copy (F5)",
  "btn.move": "Move (F6)",
  "btn.delete": "Delete (F8)",
  "btn.download.plain": "Download",
  "preview.render": "Rendered",
  "preview.source": "Source",
  "path.placeholder": "Path and Enter \u2014 goes in the active panel",
  "plan.title.copy": "Copy",
  "plan.title.move": "Move",
  "plan.title.delete": "Delete",
  "plan.preparing": "preparing the plan\u2026",
  "plan.starting": "starting\u2026",
  "plan.what": "what:",
  "plan.willCopy": "will copy: {steps} files ({size})",
  "plan.willMove": "will move: {steps} items \u2014 {files} files inside ({size})",
  "plan.willDelete": "will delete: {steps} items \u2014 {files} files inside ({size})",
  "plan.overwrite": "will overwrite: {count} files",
  "plan.noOverwrite": "nothing will be overwritten",
  "plan.blocked": "cannot run:",
  "plan.overwriteAsk": "allow overwriting",
  "progress.skipped": "skipped {count}",
  "plan.andMore": "\u2026 and {count} more",
  "plan.cancel": "Cancel",
  "plan.run": "Run",
  "plan.runHint": "Start the operation",
  "plan.runBlocked": "resolve the blockers first",
  "progress.cancel": "Cancel",
  "progress.background": "To background",
  "progress.task": "task: {done}/{total}",
  "progress.line": "{done} of {total} files \xB7 {bytes} of {totalBytes}",
  "progress.errors": "errors {count}",
  "size.title": "Measuring",
  "msg.nothingTransfer": "Nothing to transfer: no marks and no cursor row",
  "msg.nothingDelete": "Nothing to delete: no marks and no cursor row",
  "msg.nothingRename": "Nothing to rename: no file selected",
  "msg.fileOnlyDownload": "Only a file can be downloaded",
  "msg.noOtherPane": "The other panel has no directory",
  "msg.pathCopied": "Path copied",
  "msg.clipboard": "Clipboard unavailable",
  "msg.renamePrompt": "New name",
  "msg.renamed": "renamed: {from} \u2192 {to}",
  "msg.done": "done: {done} steps",
  "msg.cancelled": "cancelled: {done} of {total} done",
  "msg.failed": "failed {failed} of {total}",
  "msg.stalled": "stopped: no progress for 10 minutes",
  "msg.marksCount": " \xB7 marked {count}",
  "kind.dir": "directory",
  "kind.file": "file",
  "error.no-access": "no access: {path}",
  "error.not-found": "no such file: {path}",
  "error.not-a-directory": "not a directory: {path}",
  "error.target-exists": "already exists: {path}",
  "error.not-executable": "not allowed by permissions",
  "error.refused": "refused"
};
var zh = {
  "menu.sort": "\u6392\u5E8F",
  "menu.filter": "\u8FC7\u6EE4",
  "menu.file": "\u6587\u4EF6",
  "msg.empty": "\u7A7A",
  "msg.openingInNc": "\u6B63\u5728\u6587\u4EF6\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u2026",
  "menu.openInFiles": "\u5728\u6587\u4EF6\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00",
  "menu.openDirInFiles": "\u5728\u6587\u4EF6\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u76EE\u5F55",
  "msg.loading": "\u6B63\u5728\u52A0\u8F7D\u2026",
  "msg.binary": "\u4E8C\u8FDB\u5236\u6587\u4EF6",
  "msg.truncated": "\u4EC5\u663E\u793A\u524D {shown}\uFF0C\u5171 {total}\u3002",
  "preview.back": "\u2190 \u9762\u677F",
  "preview.backTitle": "\u8FD4\u56DE\u9762\u677F (Esc)",
  "preview.renderTitle": "\u663E\u793A\u6E32\u67D3\u7ED3\u679C",
  "preview.sourceTitle": "\u663E\u793A\u6E90\u7801",
  "msg.close": "\u5173\u95ED",
  "title.view": "\u67E5\u770B\u6587\u4EF6 (F3)",
  "title.size": "\u8BA1\u7B97\u76EE\u5F55\u5927\u5C0F (F3)",
  "title.download": "\u4E0B\u8F7D\u6587\u4EF6 (F2)",
  "title.copy": "\u590D\u5236\u5230\u53E6\u4E00\u9762\u677F\u7684\u76EE\u5F55 (F5)",
  "title.move": "\u79FB\u52A8\u5230\u53E6\u4E00\u9762\u677F\u7684\u76EE\u5F55 (F6)",
  "title.delete": "\u5220\u9664\u5DF2\u6807\u8BB0\u9879 (F8)",
  "title.rename": "\u91CD\u547D\u540D (Shift-F6)",
  "title.mkdir": "\u65B0\u5EFA\u76EE\u5F55 (F7)",
  "title.task": "\u663E\u793A\u4EFB\u52A1\u7A97\u53E3",
  "crash": "\u6587\u4EF6\u6D4F\u89C8\u5668\u5D29\u6E83\uFF1A{message}",
  "crash.hint": "\u8BF7\u5237\u65B0\u9875\u9762\u3002\u82E5\u91CD\u590D\u51FA\u73B0\uFF0C\u8BF7\u67E5\u770B\u6D4F\u89C8\u5668\u63A7\u5236\u53F0\u3002",
  "msg.errorsSuffix": " \xB7 \u9519\u8BEF {count}",
  "unit.zero": "0 B",
  "panel.menu": "\u9762\u677F\u83DC\u5355",
  "panel.home": "\u4E3B\u76EE\u5F55",
  "panel.nothing": "",
  "sort.byName": "\u6309\u540D\u79F0",
  "sort.byType": "\u6309\u7C7B\u578B",
  "sort.reverse": "\u53CD\u5411\u987A\u5E8F",
  "filter.hidden": "\u663E\u793A\u9690\u85CF\u6587\u4EF6",
  "file.copyPath": "\u590D\u5236\u8DEF\u5F84",
  "file.rename": "\u91CD\u547D\u540D",
  "file.clearMarks": "\u53D6\u6D88\u6807\u8BB0",
  "file.mkdir": "\u65B0\u5EFA\u76EE\u5F55",
  "msg.newFolder": "\u65B0\u5EFA\u6587\u4EF6\u5939",
  "msg.folderCreated": "\u5DF2\u521B\u5EFA\u76EE\u5F55\uFF1A{name}",
  "btn.view": "\u67E5\u770B (F3)",
  "btn.size": "\u5927\u5C0F (F3)",
  "btn.download": "\u4E0B\u8F7D (F2)",
  "btn.copy": "\u590D\u5236 (F5)",
  "btn.move": "\u79FB\u52A8 (F6)",
  "btn.delete": "\u5220\u9664 (F8)",
  "btn.download.plain": "\u4E0B\u8F7D",
  "preview.render": "\u6E32\u67D3",
  "preview.source": "\u6E90\u7801",
  "path.placeholder": "\u8DEF\u5F84\u540E\u56DE\u8F66 \u2014 \u4F5C\u7528\u4E8E\u5F53\u524D\u9762\u677F",
  "plan.title.copy": "\u590D\u5236",
  "plan.title.move": "\u79FB\u52A8",
  "plan.title.delete": "\u5220\u9664",
  "plan.preparing": "\u6B63\u5728\u751F\u6210\u8BA1\u5212\u2026",
  "plan.starting": "\u6B63\u5728\u542F\u52A8\u2026",
  "plan.what": "\u5185\u5BB9\uFF1A",
  "plan.willCopy": "\u5C06\u590D\u5236\uFF1A{steps} \u4E2A\u6587\u4EF6\uFF08{size}\uFF09",
  "plan.willMove": "\u5C06\u79FB\u52A8\uFF1A{steps} \u4E2A\u5BF9\u8C61 \u2014 \u5185\u542B {files} \u4E2A\u6587\u4EF6\uFF08{size}\uFF09",
  "plan.willDelete": "\u5C06\u5220\u9664\uFF1A{steps} \u4E2A\u5BF9\u8C61 \u2014 \u5185\u542B {files} \u4E2A\u6587\u4EF6\uFF08{size}\uFF09",
  "plan.overwrite": "\u5C06\u8986\u76D6\uFF1A{count} \u4E2A\u6587\u4EF6",
  "plan.noOverwrite": "\u4E0D\u4F1A\u8986\u76D6\u4EFB\u4F55\u6587\u4EF6",
  "plan.blocked": "\u65E0\u6CD5\u6267\u884C\uFF1A",
  "plan.overwriteAsk": "\u5141\u8BB8\u8986\u76D6",
  "progress.skipped": "\u5DF2\u8DF3\u8FC7 {count}",
  "plan.andMore": "\u2026 \u8FD8\u6709 {count} \u4E2A",
  "plan.cancel": "\u53D6\u6D88",
  "plan.run": "\u6267\u884C",
  "plan.runHint": "\u5F00\u59CB\u6267\u884C",
  "plan.runBlocked": "\u8BF7\u5148\u89E3\u51B3\u963B\u788D",
  "progress.cancel": "\u53D6\u6D88",
  "progress.background": "\u8F6C\u5230\u540E\u53F0",
  "progress.task": "\u4EFB\u52A1\uFF1A{done}/{total}",
  "progress.line": "{done}/{total} \u4E2A\u6587\u4EF6 \xB7 {bytes}/{totalBytes}",
  "progress.errors": "\u9519\u8BEF {count}",
  "size.title": "\u6B63\u5728\u8BA1\u7B97\u5927\u5C0F",
  "msg.nothingTransfer": "\u6CA1\u6709\u53EF\u4F20\u8F93\u7684\u5185\u5BB9\uFF1A\u672A\u6807\u8BB0\u4E5F\u672A\u9009\u4E2D",
  "msg.nothingDelete": "\u6CA1\u6709\u53EF\u5220\u9664\u7684\u5185\u5BB9\uFF1A\u672A\u6807\u8BB0\u4E5F\u672A\u9009\u4E2D",
  "msg.nothingRename": "\u6CA1\u6709\u53EF\u91CD\u547D\u540D\u7684\u5185\u5BB9",
  "msg.fileOnlyDownload": "\u53EA\u80FD\u4E0B\u8F7D\u6587\u4EF6",
  "msg.noOtherPane": "\u53E6\u4E00\u9762\u677F\u6CA1\u6709\u76EE\u5F55",
  "msg.pathCopied": "\u8DEF\u5F84\u5DF2\u590D\u5236",
  "msg.clipboard": "\u526A\u8D34\u677F\u4E0D\u53EF\u7528",
  "msg.renamePrompt": "\u65B0\u540D\u79F0",
  "msg.renamed": "\u5DF2\u91CD\u547D\u540D\uFF1A{from} \u2192 {to}",
  "msg.done": "\u5B8C\u6210\uFF1A{done} \u6B65",
  "msg.cancelled": "\u5DF2\u53D6\u6D88\uFF1A\u5B8C\u6210 {done} / {total}",
  "msg.failed": "\u5931\u8D25 {failed} / {total}",
  "msg.stalled": "\u5DF2\u505C\u6B62\uFF1A10 \u5206\u949F\u6CA1\u6709\u8FDB\u5C55",
  "msg.marksCount": " \xB7 \u5DF2\u6807\u8BB0 {count}",
  "kind.dir": "\u76EE\u5F55",
  "kind.file": "\u6587\u4EF6",
  "error.no-access": "\u65E0\u8BBF\u95EE\u6743\u9650\uFF1A{path}",
  "error.not-found": "\u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A{path}",
  "error.not-a-directory": "\u4E0D\u662F\u76EE\u5F55\uFF1A{path}",
  "error.target-exists": "\u5DF2\u5B58\u5728\uFF1A{path}",
  "error.not-executable": "\u6743\u9650\u4E0D\u5141\u8BB8\u6267\u884C",
  "error.refused": "\u5DF2\u62D2\u7EDD"
};
var NAMESPACE = "dsh-nc";
function detectLocale() {
  const tag = (globalThis.navigator?.language ?? "en").toLowerCase();
  if (tag.startsWith("ru")) return "ru";
  if (tag.startsWith("zh")) return "zh";
  return "en";
}
function fill(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) => key in params ? String(params[key]) : whole);
}
function fallbackTranslate(locale) {
  const dict = locale === "zh" ? zh : locale === "ru" ? ru : en;
  return (key, params) => fill(dict[key] ?? en[key] ?? key, params);
}

// src/client/index.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "dsh-nc";
var inject = ["slots"];
var TranslateContext = (0, import_react2.createContext)(fallbackTranslate(detectLocale()));
function useT() {
  return (0, import_react2.useContext)(TranslateContext);
}
var viewSwitcher = null;
function filePathOfAddress(address) {
  const prefix = "dsh-resource://file/session/";
  if (typeof address !== "string" || !address.startsWith(prefix)) return "";
  const rest = address.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return "";
  const parts = rest.slice(slash + 1).split("/").filter((part) => part !== "");
  const decoded = [];
  for (const part of parts) {
    try {
      decoded.push(decodeURIComponent(part));
    } catch {
      decoded.push(part);
    }
  }
  const path = decoded.join("/");
  if (path === "") return "";
  return path.startsWith("/") ? `/${path.replace(/^\/+/, "")}` : "";
}
function openInFilesView(path) {
  ncStore.openPath(path);
  if (!viewSwitcher) return false;
  try {
    viewSwitcher("nc-files", path);
    return true;
  } catch {
    return false;
  }
}
var localeRuntime = null;
var localeRevision = 0;
var localeListeners = /* @__PURE__ */ new Set();
function bumpRevision() {
  localeRevision += 1;
  for (const listener of localeListeners) listener();
}
function subscribeLocale(listener) {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}
function currentTranslate() {
  const active = localeRuntime?.getLocale?.().active ?? detectLocale();
  const fallback = fallbackTranslate(active);
  if (!localeRuntime || typeof localeRuntime.bind !== "function") return fallback;
  try {
    const bound = localeRuntime.bind(NAMESPACE);
    return (key, params) => {
      const text = bound(key, params);
      return typeof text === "string" && text !== "" ? text : fallback(key, params);
    };
  } catch {
    return fallback;
  }
}
function TranslateProvider({ children }) {
  const revision = (0, import_react2.useSyncExternalStore)(subscribeLocale, () => localeRevision, () => localeRevision);
  const translate = (0, import_react2.useMemo)(() => currentTranslate(), [revision]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TranslateContext.Provider, { value: translate, children });
}
var HIDE_CSS_ID = "dsh-nc/hide-composer";
var DOC_ATTRIBUTE = "data-dsh-nc";
var HIDE_CSS = `
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
`;
function ensureHideStyles() {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`style[data-plugin-css="${HIDE_CSS_ID}"]`)) return;
  const tag = document.createElement("style");
  tag.setAttribute("data-plugin", "dsh-nc");
  tag.setAttribute("data-plugin-css", HIDE_CSS_ID);
  tag.textContent = HIDE_CSS;
  document.head.appendChild(tag);
}
function useComposerlessScreen() {
  (0, import_react2.useEffect)(() => {
    ensureHideStyles();
    document.documentElement.setAttribute(DOC_ATTRIBUTE, "");
    return () => {
      document.documentElement.removeAttribute(DOC_ATTRIBUTE);
    };
  }, []);
}
var NcErrorBoundary = class extends import_react2.Component {
  constructor(props) {
    super(props);
    this.state = { message: "" };
  }
  static getDerivedStateFromError(error) {
    return { message: error?.message ?? String(error) };
  }
  render() {
    if (this.state.message) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: 12, fontSize: 12, color: "var(--dsw-alias-label-danger, #c0392b)" }, children: [
        this.props.t?.("crash", { message: this.state.message }) ?? this.state.message,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 8, color: "var(--dsw-alias-label-secondary, #5a6478)" }, children: this.props.t?.("crash.hint") ?? "" })
      ] });
    }
    return this.props.children;
  }
};
function cwdOf(useSessions, sessionId) {
  if (typeof useSessions !== "function" || !sessionId) return void 0;
  try {
    return useSessions((snapshot) => snapshot?.byId?.[sessionId]?.cwd);
  } catch {
    return void 0;
  }
}
function NcTabView(props) {
  useComposerlessScreen();
  (0, import_react2.useEffect)(() => {
    viewSwitcher = typeof props.openView === "function" ? props.openView : null;
    return () => {
      viewSwitcher = null;
    };
  }, [props.openView]);
  const cwd = cwdOf(props.useSessions, props.sessionId);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TranslateProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(NcErrorBoundary, { t: currentTranslate(), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    FileBrowser,
    {
      sessionKey: props.sessionId ?? "default",
      startPath: cwd ?? void 0,
      focusRequest: props.viewRequest ?? null,
      onFocusHandled: props.completeViewRequest
    }
  ) }) });
}
function NcRedirect(props) {
  const t = useT();
  const info = typeof props.useTabInfo === "function" ? props.useTabInfo() : void 0;
  const address = info?.tab?.contentId ?? info?.tab?.navigation?.address ?? "";
  (0, import_react2.useEffect)(() => {
    const path = filePathOfAddress(address);
    if (path !== "") openInFilesView(path);
    try {
      info?.tab?.actions?.close();
    } catch {
    }
  }, [address, info]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 12, fontSize: "0.9em", color: "var(--dsw-alias-label-secondary, #5a6478)" }, children: t("msg.openingInNc") });
}
var VIEWER_KIND = "dsh-nc-viewer";
var VIEWER_ID = "dsh-nc-viewer";
function registerResourceRedirect(ctx) {
  const subscribed = whenService(ctx, "sidebarRightTabs", (target, tabs) => {
    if (!tabs || typeof tabs.register !== "function") return;
    registerRedirectType(target, tabs);
  });
  return subscribed;
}
function registerRedirectType(ctx, tabs) {
  ctx.effect(
    () => tabs.register({
      id: VIEWER_ID,
      kind: VIEWER_KIND,
      patterns: ["dsh-resource://file/**"],
      priority: "extension",
      title: (address) => {
        const name2 = address.slice(address.lastIndexOf("/") + 1);
        try {
          return decodeURIComponent(name2);
        } catch {
          return name2;
        }
      }
    })
  );
  try {
    ctx.slots.inject(
      "sidebar.right.pane.tab",
      () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: VIEWER_ID }, NcRedirect)
    );
  } catch (error) {
    ctx.logger("dsh-nc:client").info(`dsh-nc: sidebar body slot unavailable (${error.message})`);
  }
}
function whenService(ctx, name2, setup) {
  const run = (target, service) => {
    try {
      setup(target, service);
    } catch (error) {
      ctx.logger("dsh-nc:client").info(`dsh-nc: ${name2} setup failed (${error.message})`);
    }
  };
  const present = ctx[name2] ?? (typeof ctx.get === "function" ? ctx.get(name2) : void 0);
  if (present) {
    run(ctx, present);
    return true;
  }
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject([name2], (inner) => run(inner, inner[name2]));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
function registerContextMenu(ctx, log) {
  const t = () => currentTranslate();
  const subscribed = whenService(ctx, "contextMenus", (target, menus) => {
    if (!menus || typeof menus.register !== "function") return;
    registerMenuItem(target, menus, t);
  });
  if (!subscribed) return false;
  log.info("dsh-nc: context menu items registered for file and directory links");
  return true;
}
function registerMenuItem(ctx, menus, t) {
  ctx.effect(
    () => menus.register({
      id: "dsh-nc.open",
      target: "file",
      // Ahead of the built-in file actions: the browser is the primary reader here.
      order: 10,
      resolve: (target) => [
        {
          id: "dsh-nc.open",
          label: t()("menu.openInFiles"),
          run: () => {
            openInFilesView(target.path);
          }
        }
      ]
    })
  );
  ctx.effect(
    () => menus.register({
      id: "dsh-nc.open-dir",
      target: "directory",
      order: 10,
      resolve: (target) => [
        {
          id: "dsh-nc.open-dir",
          label: t()("menu.openDirInFiles"),
          run: () => {
            ncStore.setPath(ncStore.getSnapshot().activePane, target.path);
            if (viewSwitcher) {
              try {
                viewSwitcher("nc-files", target.path);
              } catch {
              }
            }
          }
        }
      ]
    })
  );
}
function apply(ctx) {
  const log = ctx.logger("dsh-nc:client");
  const runtime = (typeof ctx.get === "function" ? ctx.get("locale") : void 0) ?? ctx.locale;
  if (runtime && typeof runtime.register === "function") {
    localeRuntime = runtime;
    try {
      ctx.effect(() => runtime.register(NAMESPACE, "ru", ru));
      ctx.effect(() => runtime.register(NAMESPACE, "en", en));
      ctx.effect(() => runtime.register(NAMESPACE, "zh", zh));
      if (typeof runtime.subscribe === "function") ctx.effect(() => runtime.subscribe(bumpRevision));
      log.info(`dsh-nc: ru/en/zh dictionaries registered (active locale: ${runtime.getLocale?.().active ?? "unknown"})`);
    } catch (error) {
      log.info(`dsh-nc: dictionaries not registered, using the built-in fallback (${error.message})`);
    }
  } else {
    log.info("dsh-nc: no shared locale in this build, using the built-in fallback");
  }
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register({ name: "conversation.view", id: "nc-files", order: 20, label: () => "Files" }, NcTabView)
  );
  log.info("dsh-nc: Files tab registered");
  try {
    if (!registerContextMenu(ctx, log)) {
      log.info('dsh-nc: context menu registry is absent, no "open in the file browser" item');
    }
  } catch (error) {
    log.info(`dsh-nc: context menu item disabled (${error.message})`);
  }
  try {
    if (!registerResourceRedirect(ctx)) {
      log.info("dsh-nc: sidebar tab registry is absent, file links keep the built-in preview");
    }
  } catch (error) {
    log.info(`dsh-nc: link interception disabled (${error.message})`);
  }
}

    return module.exports;
  }
});
