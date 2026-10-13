// bundle.mjs: the vite library builds the package and its dev server share:
// the widget frame (one inline script) and the host (one ES module).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// bundle builds one entry as a library and returns the code of its chunk.
export async function bundle(entry, lib, plugins) {
  const out = await build({
    configFile: false,
    root,
    logLevel: 'warn',
    mode: 'production',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins,
    build: { write: false, minify: true, sourcemap: false, copyPublicDir: false, lib: { entry: join(root, entry), ...lib } },
  })
  const outputs = Array.isArray(out) ? out : [out]
  const chunk = outputs.flatMap((o) => o.output).find((c) => c.type === 'chunk')
  if (!chunk?.code) throw new Error(`${entry}: no output`)
  return chunk.code
}

// framePage is the frame's document: the runtime inline (a classic inline
// script: an opaque-origin document would need CORS for a module script
// from the app), nothing else. The runtime adds its CSP meta, styles and
// root element itself and gets the widget's code over postMessage.
export const framePage = (code) =>
  '<!doctype html><html><head><meta charset="utf-8"><title>widget</title></head><body>' +
  `<script>${code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')}</script></body></html>`

// RUNTIME_FILE is the runtime script framePageExternal loads, served next to it.
export const RUNTIME_FILE = 'widget-runtime.js'

// framePageExternal is the same document loading the runtime from
// RUNTIME_FILE beside it (still a classic script, so the opaque-origin frame
// needs no CORS). For embedders that can serve both files and allow the
// script in the frame's policy: the browser compiles it off the main thread
// and keeps the compiled code across visits.
export const framePageExternal = () =>
  '<!doctype html><html><head><meta charset="utf-8"><title>widget</title></head><body>' +
  `<script src="${RUNTIME_FILE}"></script></body></html>`


// bundleFrame builds the widget runtime (src/frame) as one self-contained
// IIFE: Svelte, the blocks and their CSS (injected into the shadow roots they
// mount in). Returns its code.
export const bundleFrame = () =>
  bundle('src/frame/main.ts', { formats: ['iife'], name: 'slRuntime', fileName: () => 'widget-runtime.js' }, [svelte({ emitCss: false, compilerOptions: { css: 'injected' } })])
