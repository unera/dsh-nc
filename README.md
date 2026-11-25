# @dr-co/dsh-nc

A Norton Commander style file browser for [DeepSeek Harness](https://github.com/deepseek-ai/dsh): a **Files** tab in the web UI with two panels, file viewing and plan-first file operations.

Chat is good at talking about files; sometimes you just want to look at them and move them around. This plugin adds a plain two-panel file manager next to the conversation:

- two panels with independent directories, breadcrumbs and an absolute path field;
- a viewer for text (with syntax highlighting and line numbers), Markdown (rendered or source), images, PDF, HTML, video and audio;
- copy, move, rename, delete and create-directory — each one showing a plan (how many files, how many bytes, what will be overwritten) before anything is touched, then running in the background with visible progress;
- keyboard-first operation: the function keys do what they did in Norton Commander;
- Russian, English and Chinese UI through the DSH locale.

## Install

```bash
dsh plugin --profile web add @dr-co/dsh-nc
```

Restart the profile (or let `dsh-hmr` pick it up) and open the web UI.

## Opening it

The plugin registers a **Files** tab in the conversation view, next to **Chat** and **Trajectory**. While the tab is open the chat composer is hidden and the whole area belongs to the browser; leaving the tab brings the composer back.

## Two-panel mode

The screen is split into two panes. Each pane has its own directory, its own sorting (by name or by type, ascending or descending) and its own "show hidden" flag, plus its own cursor and marks. One pane is active at a time — the active one has an accent border, and every operation applies to the active pane and targets the directory of the other one, exactly like Norton Commander.

Both panes start in the working directory of the session (`scope: workdir`) or in the home directory (`scope: filesystem`). Each session keeps its own panes: switching tabs or sessions does not lose the state, though a page reload keeps only the paths, sorting and background jobs.

## Keyboard

| Key | Action |
| --- | --- |
| `Tab` | Switch the active panel |
| `↑` `↓` `Home` `End` | Move the cursor |
| `Insert`, `Space` | Toggle the mark on the current row |
| `Shift+↑` / `Shift+↓` | Mark the row and move the cursor |
| `Enter` | Enter the directory under the cursor, or open the file in the viewer |
| `Backspace` | Go one directory up |
| `F2` | Download the file under the cursor |
| `F3` | View the file, or count the size of the directory |
| `F5` | Copy to the other panel |
| `F6` | Move to the other panel |
| `F7` | Create a directory |
| `F8` | Delete |
| `Esc` | Close the open file and return to the panels |
| `Ctrl`-click / `Shift`-click | Multiple selection: toggle a mark or select a range from the cursor |

Inside the path field and other inputs `Tab` stays an ordinary `Tab`, so the keyboard can still leave the field.

`Shift+F6` renames the row under the cursor; the pane menu (`⋮`) also offers rename, copy path, create directory and "clear marks".

## File operations

Nothing is executed silently:

1. **The plan comes first.** For copy, move and delete the browser asks the host for a plan: how many files and bytes are involved, how many steps the operation takes, which targets already exist and would be overwritten, and what blocks the start (missing write permission on the target, a directory that is too large to walk, and so on). Blocking problems disable the run button and are shown with their reasons.
2. **Overwrite only on explicit consent.** If the plan reports conflicts, the run button stays disabled until you tick "overwrite existing" — the checkbox is the only way to accept the loss of the existing targets. Without it the host refuses the start with `409`.
3. **Progress, and then the background.** After the start the dialog turns into a progress view (files done / total, bytes done / total, the current path, the collected errors) with **Cancel** and **Background** buttons. A job moved to the background keeps running; it is listed in the path bar as a button that brings the dialog back, and it survives a page reload.
4. **Cancellation happens between steps.** A step that has already begun is finished — a file in a copy, a whole entry in a move or a delete — and the next one is not started.
5. **A stalled job stops itself.** While a job makes progress it keeps a heartbeat; a job that has not reported for ten minutes is marked stalled and stopped, so a dead network share cannot leave a job running forever. A long but alive job is never killed by age.

Errors collected during a job are kept (up to 20) and shown in the progress dialog; the final state is reported once as a toast (`done`, `cancelled`, `stalled`, `failed`).

## Copying a file, step by step

1. Put the cursor on the file (arrows) or mark several files (`Insert`, `Space`, `Ctrl`-click, or drag with `Shift+↑`/`Shift+↓`).
2. Switch to the other panel with `Tab` and enter the target directory there (`Enter`, breadcrumbs or the path field).
3. Switch back with `Tab` and press `F5`.
4. The plan dialog appears: sources, number of steps, files, total size, the target directory, and — if any target already exists — the list of conflicting paths with a disabled run button.
5. If the conflicts are expected, tick the overwrite checkbox; the run button becomes active.
6. Press **Run**. The dialog becomes the progress view and the marks are cleared.
7. Watch it, press **Cancel** to stop between steps, or **Background** to keep working in the panels. The job button in the path bar returns to the progress view at any time.
8. When the job finishes the panes reload themselves and a toast reports the result.

Moving (`F6`) and deleting (`F8`) follow the same path; for a move a directory is renamed as a single step, however many files it holds.

## Configuration

The plugin reads two options from the profile patch:

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `scope` | `workdir` \| `filesystem` | `workdir` | Where the browser may go: only inside the root the client sends (the session working directory), or the whole file system |
| `maxTextBytes` | number | `524288` | How many bytes of a text file to send for the preview; the rest is marked as truncated |

Example — `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- id: nc
  name: dsh-nc
  config:
    scope: filesystem
    maxTextBytes: 524288
```

The same entry works inside an `insert:` list of a bundle patch. Changes apply after a restart of the profile (or through `dsh-hmr`, when it is enabled).

## Security

- **The routes live on the authenticated Connection channel**, not on the bare web server: `ctx.connection.fetch`. The channel contract states that the transport has already applied its trust and authentication policy, so only the owner reaches these routes. A plugin route registered directly on `ctx.webServer` would be reachable by anyone who can reach the domain, with no dsh token gate in front of it — that is exactly why this plugin does not do it.
- **Boundaries are checked against `realpath`.** In `workdir` mode a path is resolved through its symlinks before the check, and creation targets that do not exist yet are resolved through their nearest existing ancestor, so a symlink pointing outside the root does not open the way — neither for reading nor for writing. Symlinks are copied as links and never followed into a cycle.
- **`filesystem` gives write access to the whole file system**, under the rights of the dsh process. Enable it deliberately. `/` is never deleted, and an existing target is never overwritten without explicit consent, but that is a guard against mistakes, not a sandbox.
- Raw files are served with `nosniff` and a restrictive `Content-Security-Policy`, so a file from a foreign repository cannot execute in the DSH origin; Markdown is rendered into React elements without `dangerouslySetInnerHTML`, and links are limited to `http(s)`, `mailto` and relative paths.

## Localization

The interface is translated into Russian, English and Chinese. The dictionaries are registered in the shared DSH locale, so the language follows **Settings → Language** and switches without a reload; when the shared locale is unavailable the plugin falls back to the browser language and then to English.

## Development

```bash
npm install        # dependencies (esbuild, react, react-dom, schemastery)
npm run build      # build src/client/index.jsx into lib/client.js (DSH bundle format)
npm test           # build, then the host tests and the render smoke test
```

`npm test` runs `test/host.test.mjs` (the host half: scope boundaries, symlinks, plan and conflicts, move/delete, mkdir, text truncation, duplicate jobs, stall detection) and `scripts/render-smoke.mjs`, which renders the tab with react-dom/server in all three languages and fails if any of them breaks.

The package layout:

| Path | Contents |
| --- | --- |
| `index.mjs` | Host half: the `/api/dsh-nc/*` routes on the Connection channel, the browse scope, plans and background jobs |
| `src/client/index.jsx` | Tab registration in `conversation.view`, the locale provider, the CSS rule that hides the composer |
| `src/client/Browser.jsx` | The interface: panels, cursor, marks, keyboard, plan and progress dialogs, toasts |
| `src/client/store.js` | Session state (panes, cursor, marks, open files, background jobs), sorting and formatting |
| `src/client/api.js` | Host requests |
| `src/client/highlight.js` | A small dependency-free syntax highlighter |
| `src/client/Markdown.jsx` | Markdown rendered into React elements |
| `src/client/i18n.js` | The ru/en/zh dictionaries |
| `cordis.patch.yml` | Bundle patch that inserts the plugin into the profile |

## License

MIT.
