/**
 * Build the client half into the DSH bundle format: not an ESM module but a
 * script that registers a factory in `window.__ModuleLoader__`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

const result = await build({
  entryPoints: [join(root, 'src/client/index.jsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  write: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
})

const bundled = result.outputFiles?.[0]?.text
if (typeof bundled !== 'string' || bundled === '') throw new Error('dsh-nc: esbuild produced nothing')

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundled}
    return module.exports;
  }
});
`

await mkdir(join(root, 'lib'), { recursive: true })
await writeFile(join(root, 'lib/client.js'), wrapped)
console.log('dsh-nc: client bundle written to lib/client.js')
