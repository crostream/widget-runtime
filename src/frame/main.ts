// main.ts: the custom widget runtime, the page every custom widget's
// sandboxed frame loads (FRAME_PATH, built as one inline IIFE by the
// widget-runtime plugin in vite.config.ts and served by the Go servers with
// its own CSP). The widget's code arrives with init.
//
// It defines the building blocks, exposes the `sl` API (types.ts "Custom
// widgets"), talks to the host over postMessage (protocol.ts), renders the
// widget's HTML template into #sl-root on every change and runs the widget's
// JS once after the first render. Errors anywhere are reported to the host
// and never leave the frame.
import { SL_EVENT_NAMES } from '../api/catalog.js'
import { defineBlocks, setReporter } from './elements.svelte.js'
import { env } from './env.svelte.js'
import { sfx, sfxState } from './sfx.js'
import { morphChildren } from './morph.js'
import { ASSET_PREFIX, BLEED, EMOTE_PREFIX, MEDIA_PREFIX, assetPath, PROTOCOL, ROOT_ID, type AlertMsg, type Code, type ErrorSource, type FontFaceData, type FrameMsg, type HostMsg, type InitMsg, type Size } from '../protocol.js'
import { compile, lookup, nest, render as renderTemplate, TemplateError, type Roots } from './template.js'
import type { ResolvedTheme } from '../render/themecore.js'
import type { Cue, Mode } from '../render/types.js'

type Handler = (...args: unknown[]) => void
const EVENT_NAMES = SL_EVENT_NAMES
type EventName = (typeof EVENT_NAMES)[number]

// The host's nonce for this frame is the URL fragment.
const nonce = decodeURIComponent(location.hash.slice(1))
const parent = window.parent

// The document: a CSP meta first (defense in depth: the server sends the
// real policy, but the desktop app's asset server sends none), then the
// frame's own styles and the root. location.protocol/host are the URL's
// even in an opaque-origin document.
const pageOrigin = `${location.protocol}//${location.host}`
{
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `img-src ${pageOrigin}${MEDIA_PREFIX} ${pageOrigin}${EMOTE_PREFIX} ${pageOrigin}${ASSET_PREFIX} data: blob:`,
    `media-src ${pageOrigin}${MEDIA_PREFIX} ${pageOrigin}${ASSET_PREFIX} data: blob:`,
    `font-src ${pageOrigin}${ASSET_PREFIX} data: blob:`,
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
  document.head.prepend(meta)
  const base = document.createElement('style')
  base.textContent = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;color-scheme:normal}#${ROOT_ID}{position:absolute;left:${BLEED}px;top:${BLEED}px;right:${BLEED}px;bottom:${BLEED}px}`
  document.head.append(base)
}
// The widget's CSS (from init), before the node's own (nodeCSS).
const widgetStyle = document.head.appendChild(document.createElement('style'))
let code: Code = { html: '', css: '', js: '' }

// Defense in depth: drop handles to host bridges some embedders expose in
// every frame (WebKit message handlers, WebView2, OBS). The sandbox is what
// actually keeps the widget out of the app (see overlay/custom.ts).
for (const name of ['webkit', 'obsstudio', 'chrome', 'go', 'runtime', 'wails']) {
  try {
    Object.defineProperty(window, name, { value: undefined, configurable: false, writable: false })
  } catch {
    // not configurable here: nothing to hide
  }
}

function post(msg: FrameMsg): void {
  // The parent's origin may be anything (http, wails://); nothing sent here
  // is secret.
  parent.postMessage({ ...msg, sl: PROTOCOL, nonce }, '*')
}

const reported = new Set<string>()
function report(message: string, source: ErrorSource = 'js', line?: number): void {
  const key = `${source}:${line ?? ''}:${message}`
  if (reported.has(key) || reported.size > 50) return
  reported.add(key)
  console.error(`widget ${source}${line ? `:${line}` : ''}: ${message}`)
  post({ type: 'error', message, line, source })
}
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

setReporter((m) => report(m, 'html'))

// ---- State ----

let fields: Record<string, unknown> = {}
let flat: Record<string, unknown> = {} // data by key
let nested: Record<string, unknown> = {}
let size: Size = { w: 0, h: 0 }
let theme: ResolvedTheme = env.theme
let mode: Mode = 'output'
let visible = true
let baseUrl = ''
let kind = ''
let started = false
let manual = false
let alert: Readonly<AlertMsg> | null = null

const listeners = new Map<string, Set<Handler>>()
// held collects the emissions of messages replayed after the first render
// (see init); they fire once the widget's script has registered its handlers.
let held: [EventName, unknown[]][] | null = null
function emit(event: EventName, ...args: unknown[]): void {
  if (held) {
    held.push([event, args])
    return
  }
  for (const cb of [...(listeners.get(event) ?? [])]) {
    try {
      cb(...args)
    } catch (e) {
      report(`sl.on('${event}'): ${errText(e)}`)
    }
  }
}

// ---- Template ----

const root = document.getElementById(ROOT_ID) ?? document.body.insertBefore(Object.assign(document.createElement('div'), { id: ROOT_ID }), document.body.firstChild)
let compiled: ReturnType<typeof compile> | null = null
let lastHTML: string | null = null

const roots = (): Roots => ({ fields, data: flat, theme, size, mode, visible, alert })

function render(): void {
  if (!compiled) return
  let html: string
  try {
    html = renderTemplate(compiled, roots(), nested)
  } catch (e) {
    report(e instanceof TemplateError ? e.message : `template: ${errText(e)}`, 'html')
    return
  }
  if (html === lastHTML) return
  lastHTML = html
  const t = document.createElement('template')
  t.innerHTML = html
  morphChildren(root, t.content)
}

let queued = false
function changed(): void {
  if (!started || manual || queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    if (!manual) render()
  })
}

// CSS variables for the widget's CSS: --sl-w/--sl-h (px), the theme colors
// (--sl-primary …) and fonts (--sl-font-heading, --sl-font-body).
function cssVars(): void {
  const s = document.documentElement.style
  s.setProperty('--sl-w', `${size.w}px`)
  s.setProperty('--sl-h', `${size.h}px`)
  for (const [k, v] of Object.entries(theme.colors)) s.setProperty(`--sl-${k}`, v)
  for (const [k, v] of Object.entries(theme.fonts)) s.setProperty(`--sl-font-${k}`, v)
}

// nodeCSS applies the node's own CSS (OverlayNode.css) after the widget's.
let nodeStyle: HTMLStyleElement | null = null
function nodeCSS(css: string): void {
  if (!nodeStyle) {
    if (!css) return
    nodeStyle = document.createElement('style')
    document.head.append(nodeStyle)
  }
  if (nodeStyle.textContent !== css) nodeStyle.textContent = css
}

// ---- Fonts ----

async function addFonts(list: FontFaceData[]): Promise<void> {
  const loads: Promise<unknown>[] = []
  for (const f of list) {
    try {
      const src = typeof f.data === 'string' ? `url(${JSON.stringify(f.data)})` : f.data
      const face = new FontFace(f.family, src, { weight: f.weight || 'normal', style: f.style || 'normal', unicodeRange: f.unicodeRange || undefined, display: 'block' })
      document.fonts.add(face)
      loads.push(face.load().catch((e) => report(`font ${f.family}: ${errText(e)}`, 'css')))
    } catch (e) {
      report(`font ${f.family}: ${errText(e)}`, 'css')
    }
  }
  await Promise.all(loads)
}

// ---- The widget's script ----

function runScript(): void {
  const js = code.js ?? ''
  if (!js.trim()) return
  const s = document.createElement('script')
  // One line of wrapper before the widget's first line (see the error
  // handler's line offset).
  s.textContent = `(function (sl) {\n${js}\n}).call(undefined, window.sl)`
  document.head.append(s)
  s.remove()
}

addEventListener('error', (e) => {
  // Errors from the widget's script (a syntax error, or one thrown while it
  // runs or later from its timers and handlers) arrive here; lines count
  // from the widget's first line (the wrapper's is subtracted).
  const line = e.lineno ? Math.max(1, e.lineno - 1) : undefined
  report(e.message || errText(e.error), 'js', line)
  e.preventDefault()
})
addEventListener('unhandledrejection', (e) => {
  report(`unhandled rejection: ${errText(e.reason)}`, 'js')
  e.preventDefault()
})

// ---- The sl API ----

const unknownEvents = new Set<string>()

// callerLine is the widget's line that called into sl, when the stack says
// (the widget's script runs from an inline <script>, one wrapper line
// before its first line; see runScript).
function callerLine(): number | undefined {
  const stack = new Error().stack ?? ''
  const lines = stack.split('\n').slice(1)
  // V8: "at fn (url:line:col)"; WebKit/Gecko: "fn@url:line:col". The first
  // two frames are callerLine and sl.on.
  for (const l of lines.slice(2)) {
    const m = /:(\d+):\d+\)?\s*$/.exec(l)
    if (m) return Math.max(1, Number(m[1]) - 1)
  }
  return undefined
}

const sl = {
  get fields() {
    return fields
  },
  get data() {
    return nested
  },
  get size() {
    return size
  },
  get theme() {
    return theme
  },
  get mode() {
    return mode
  },
  get visible() {
    return visible
  },
  get muted() {
    return env.muted
  },
  get alert() {
    return alert
  },
  get sfx() {
    return sfx
  },
  get root() {
    return root
  },
  get manual() {
    return manual
  },
  set manual(v: boolean) {
    manual = !!v
  },
  on(event: EventName, cb: Handler): () => void {
    // An event that never fires is a bug in the widget: say so once per
    // name, in the widget's error list.
    if (!(EVENT_NAMES as readonly string[]).includes(event)) {
      const name = String(event)
      if (!unknownEvents.has(name)) {
        unknownEvents.add(name)
        report(`sl.on: unknown event "${name}" (it never fires). Events: ${EVENT_NAMES.join(', ')}`, 'js', callerLine())
      }
      return () => {}
    }
    if (typeof cb !== 'function') return () => {}
    let set = listeners.get(event)
    if (!set) listeners.set(event, (set = new Set()))
    set.add(cb)
    return () => void set.delete(cb)
  },
  render(): void {
    lastHTML = null
    render()
  },
  // get reads a template path: sl.get('data.latest.twitch.cheer.vars.user').
  get(path: string): unknown {
    try {
      return lookup(String(path), roots(), [], nested)
    } catch {
      return undefined
    }
  },
  media: (id: string) => new URL(`${MEDIA_PREFIX}file/${encodeURIComponent(id)}`, baseUrl || location.href).href,
  emote: (id: string) => new URL(`${EMOTE_PREFIX}${encodeURIComponent(id)}`, baseUrl || location.href).href,
  asset: (path: string) => {
    const p = assetPath(kind, path)
    if (!p) throw new Error(`sl.asset: ${JSON.stringify(path)} is not an asset path`)
    return new URL(p, baseUrl || location.href).href
  },
}
Object.defineProperty(window, 'sl', { value: Object.freeze(sl), enumerable: true })

// ---- Messages from the host ----

let initing = false
// Messages that arrive while init awaits the fonts, replayed in order.
let pending: HostMsg[] = []

async function init(m: InitMsg): Promise<void> {
  initing = true
  code = { html: String(m.code?.html ?? ''), css: String(m.code?.css ?? ''), js: String(m.code?.js ?? '') }
  widgetStyle.textContent = code.css
  try {
    compiled = compile(code.html)
  } catch (e) {
    report(errText(e), 'html')
  }
  fields = m.fields ?? {}
  flat = m.data ?? {}
  nested = nest(flat)
  size = m.size ?? size
  theme = m.theme ?? theme
  mode = m.mode ?? 'output'
  visible = m.visible !== false
  baseUrl = m.baseUrl ?? ''
  kind = m.kind ?? ''
  env.kind = kind
  env.theme = theme
  env.mode = mode
  env.muted = !!m.muted
  sfxState.mode = mode
  sfxState.muted = env.muted
  document.documentElement.dataset.mode = mode
  nodeCSS(m.css ?? '')
  cssVars()
  // The first render waits (briefly) for the fonts it may use.
  await Promise.race([addFonts(m.fonts ?? []), new Promise((r) => setTimeout(r, 3000))])
  started = true
  // Apply what arrived meanwhile (latest wins), holding the events back until
  // the first render and the widget's script are done: nothing is lost and
  // nothing fires twice.
  held = []
  const queued = pending
  pending = []
  for (const q of queued) {
    try {
      handle(q)
    } catch (e) {
      report(errText(e))
    }
  }
  render()
  runScript()
  const events = held
  held = null
  for (const [event, args] of events) emit(event, ...args)
}

function handle(m: HostMsg): void {
  if (m.type === 'init') {
    if (!started && !initing) void init(m)
    return
  }
  if (m.type === 'fonts') {
    void addFonts(m.fonts ?? [])
    return
  }
  if (!started) {
    if (initing) pending.push(m)
    return
  }
  switch (m.type) {
    case 'fields':
      fields = m.fields ?? {}
      emit('fields', fields)
      break
    case 'data': {
      const next = { ...flat, ...(m.changed ?? {}) }
      for (const k of m.removed ?? []) delete next[k]
      flat = next
      nested = nest(flat)
      emit('data', [...Object.keys(m.changed ?? {}), ...(m.removed ?? [])], nested)
      break
    }
    case 'size':
      size = m.size
      cssVars()
      emit('size', size)
      break
    case 'theme':
      theme = m.theme
      env.theme = theme
      cssVars()
      emit('theme', theme)
      break
    case 'css':
      nodeCSS(m.css ?? '')
      return
    case 'muted':
      env.muted = !!m.muted
      sfxState.muted = env.muted
      emit('muted', env.muted)
      return
    case 'cue':
      env.cue = m.cue as Cue
      emit('cue', m.cue)
      return
    case 'alert': {
      const a = m.alert
      alert = Object.freeze({ ...a, vars: Object.freeze({ ...(a.vars ?? {}) }), in: Object.freeze({ ...a.in }), out: Object.freeze({ ...a.out }), test: !!a.test, leaving: !!a.leaving })
      emit('alert', alert)
      break
    }
    case 'leave':
      if (alert) {
        alert = Object.freeze({ ...alert, leaving: true })
        emit('leave', alert)
      }
      break
    case 'audition':
      sfxState.audition = !!m.on
      env.audition = !!m.on
      return
    case 'show':
    case 'hide':
      visible = m.type === 'show'
      emit(m.type)
      break
    default:
      return
  }
  changed()
}

addEventListener('message', (e: MessageEvent) => {
  if (e.source !== parent) return
  const m = e.data as (HostMsg & { sl?: number; nonce?: string }) | null
  if (!m || typeof m !== 'object' || m.sl !== PROTOCOL || m.nonce !== nonce || typeof m.type !== 'string') return
  try {
    handle(m)
  } catch (err) {
    report(errText(err))
  }
})

defineBlocks()
// Ready once loaded: the host takes any later load of the frame as a
// navigation away from the widget.
if (document.readyState === 'complete') post({ type: 'ready' })
else addEventListener('load', () => post({ type: 'ready' }), { once: true })
