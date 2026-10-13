// host: a standalone, framework-agnostic host for CroStream widgets, built as
// its own library (dist/host.js) so a web page (the public gallery) can run a
// .csw package live in the same sandboxed runtime OBS uses. It is the
// DOM-only counterpart of the app's CustomWidget.svelte: same frame
// (dist/widget-frame.html), same message protocol (../protocol.ts), same
// security rules: an iframe with sandbox="allow-scripts" only, messages
// accepted only from that frame's window with this frame's nonce, a load
// after 'ready' counted as the widget navigating away.
//
// Nothing here imports Svelte: only the pure helpers (helpers.ts, the theme
// core) and the API model's sample variables. A test keeps it that way.
import { BLEED, PROTOCOL, type AlertMsg, type Code, type FontFaceData, type FrameMsg, type HostMsg, type Size } from '../protocol.js'
import type { CswAlert, CswField } from '../format.js'
import { sampleVarsFor } from '../api/catalog.js'
import { fullTheme, resolveProps, schemaOfFields, type ResolvedTheme } from '../render/themecore.js'
import { DEFAULT_THEME, type Mode, type Theme } from '../render/types.js'
import { FRAME_READY_MS, FRAME_STALLED, expand, goMs, newNonce, parseFontFaces, pickData, wants } from './helpers.js'

export { DEFAULT_THEME as defaultTheme }
export { PROTOCOL, API_LEVEL } from '../protocol.js'
export type { Mode, Theme, Size }

/** The parts of a decoded .csw file the host reads (a full CswPackage fits). */
export interface WidgetPackage {
  id: string
  name?: string
  size: Size
  fields?: CswField[]
  defaults?: Record<string, unknown>
  data?: string[]
  sample?: Record<string, unknown>
  alert?: CswAlert
  code: Partial<Code>
}

/** The host's name for WidgetPackage before 0.1.0 of the app's widget-host. */
export type { WidgetPackage as CswPackage }

export interface WidgetError {
  message: string
  line?: number
  source?: 'html' | 'css' | 'js'
}

export interface MountOptions {
  /** URL of widget-frame.html. Must be served by the page's own origin and may not be embedded-blocked (no X-Frame-Options: DENY). */
  frameUrl: string
  /** Where /widget-assets/<kind>/<path>, /media/ and /emote/ resolve (the gallery's origin). Default: this page's origin. */
  mediaBase?: string
  /** A @font-face stylesheet to take theme/field fonts from. Default: none (fonts fall back to the stack). */
  fontsUrl?: string
  /** Asset kind: sl.asset(path) resolves to <mediaBase>/widget-assets/<kind>/<path>. Default 'gallery-' + pkg.id. */
  kind?: string
  /** 'editor' (default): inert, shows the sample alert. 'thumb': same, for small cards. 'output': interactive, no idle sample alert. */
  mode?: Mode
  theme?: Theme
  /** Live data keys the widget declared; default pkg.sample. */
  data?: Record<string, unknown>
  /** Field values over pkg.defaults. */
  fields?: Record<string, unknown>
  muted?: boolean
  /** Design size; default pkg.size. The widget is scaled to fit the container. */
  size?: Size
}

export interface Handle {
  /** Run the alert timeline: alert, cue, after the hold leave, then hide, then the sample again. */
  play(eventType?: string, opts?: { sound?: boolean }): void
  setData(data: Record<string, unknown>): void
  setFields(fields: Record<string, unknown>): void
  setTheme(theme: Theme): void
  setMuted(muted: boolean): void
  destroy(): void
  /** Returns an unsubscribe function. */
  on(event: 'ready', cb: () => void): () => void
  on(event: 'error', cb: (e: WidgetError) => void): () => void
}

// How long the first render waits for font files.
const FONT_WAIT_MS = 2000

const plain = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

// fetchFonts reads a @font-face stylesheet and returns the faces whose family
// appears in uses, with their bytes.
async function fetchFonts(cssUrl: string, uses: string): Promise<FontFaceData[]> {
  const hay = uses.toLowerCase()
  try {
    const r = await fetch(cssUrl)
    if (!r.ok) return []
    const faces = parseFontFaces(await r.text()).filter((f) => hay.includes(f.family.toLowerCase()))
    const out = await Promise.all(
      faces.map(async (f): Promise<FontFaceData | null> => {
        try {
          const fr = await fetch(new URL(f.url, new URL(cssUrl, location.href)))
          return fr.ok ? { family: f.family, weight: f.weight, style: f.style, unicodeRange: f.unicodeRange, data: await fr.arrayBuffer() } : null
        } catch {
          return null
        }
      }),
    )
    return out.filter((f): f is FontFaceData => f !== null)
  } catch {
    return []
  }
}

export function mount(container: HTMLElement, pkg: WidgetPackage, opts: MountOptions): Handle {
  const mode: Mode = opts.mode ?? 'editor'
  const size: Size = opts.size ?? pkg.size
  const code: Code = { html: pkg.code.html ?? '', css: pkg.code.css ?? '', js: pkg.code.js ?? '' }
  const declared = pkg.data ?? []
  const schema = schemaOfFields(pkg.fields)
  const base = opts.mediaBase ? opts.mediaBase.replace(/\/*$/, '/') : location.origin + '/'

  let theme: ResolvedTheme = fullTheme(opts.theme)
  let userFields: Record<string, unknown> = { ...opts.fields }
  let userData: Record<string, unknown> = opts.data ?? pkg.sample ?? {}
  let muted = !!opts.muted

  // The vars of the alert being shown: the server expands {var} in the
  // text fields with them (the gallery has no server, so the host does).
  let alertVars: Record<string, string> | null = null
  const fieldsNow = () => {
    const f = resolveProps({ ...(pkg.defaults ?? {}), ...userFields }, theme, schema)
    if (!alertVars) return f
    const out = { ...f }
    for (const d of pkg.fields ?? []) {
      const v = out[d.key]
      if ((d.kind === 'text' || d.kind === 'textarea') && typeof v === 'string' && v.includes('{')) out[d.key] = expand(v, alertVars)
    }
    return out
  }
  const dataNow = () => {
    const out = pickData(userData, declared)
    // An empty folder field shows the sample (as the app's editor does).
    if (pkg.sample && wants('folder.x', declared)) {
      for (const f of pkg.fields ?? []) {
        if (f.kind !== 'folder' || (fieldsNow()[f.key] as string)) continue
        const key = `folders.${f.key}`
        const v = userData[key] ?? Object.entries(userData).find(([k]) => k.startsWith('folder.'))?.[1]
        if (v !== undefined) out[key] = v
      }
    }
    return out
  }

  // ---- DOM: container > stage (scaled) > iframe (BLEED past the box) ----

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
  if (!container.clientHeight) container.style.aspectRatio = `${size.w} / ${size.h}`
  const stage = document.createElement('div')
  stage.style.cssText = `position:absolute;left:0;top:0;width:${size.w}px;height:${size.h}px;transform-origin:0 0`
  container.appendChild(stage)
  const fit = () => {
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!cw || !ch) return
    const s = Math.min(cw / size.w, ch / size.h)
    stage.style.transform = `translate(${(cw - size.w * s) / 2}px,${(ch - size.h * s) / 2}px) scale(${s})`
  }
  const ro = new ResizeObserver(fit)
  ro.observe(container)
  fit()

  // ---- The frame ----

  const listeners: { ready: (() => void)[]; error: ((e: WidgetError) => void)[] } = { ready: [], error: [] }
  const nonce = newNonce()
  const frame = document.createElement('iframe')
  let gotReady = false
  let ready = false
  let dead = false
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let playSeq = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let queuedPlay: [string | undefined, { sound?: boolean } | undefined] | null = null
  let sent = { fields: '', theme: '', data: {} as Record<string, unknown>, muted }

  const send = (msg: HostMsg) => frame.contentWindow?.postMessage({ ...msg, sl: PROTOCOL, nonce }, '*')
  const emitError = (e: WidgetError) => listeners.error.slice().forEach((cb) => cb(e))
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t)
      if (!dead) fn()
    }, ms)
    timers.add(t)
  }
  const clearTimers = () => {
    timers.forEach(clearTimeout)
    timers.clear()
  }
  const arm = (ms: number) => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      if (!gotReady && !dead) emitError({ message: FRAME_STALLED })
    }, ms)
  }

  // The alert for an event type from the package's samples; sample marks the
  // idle preview alert (the app's editor and thumbnails), not a played one.
  const alertFor = (type: string | undefined, sample: boolean): AlertMsg | null => {
    const a = pkg.alert
    if (!a) return null
    const t = type ?? a.events.find((e) => a.samples?.[e]) ?? a.events[0] ?? Object.keys(a.samples ?? {})[0] ?? 'twitch.follow'
    return {
      id: sample ? -1 : ++playSeq,
      type: t,
      vars: sampleVarsFor(t, a.samples?.[t]),
      hold: goMs(a.hold) || 6000,
      in: { kind: 'fade', ms: 400 },
      out: { kind: 'fade', ms: 400 },
      test: !sample,
      leaving: false,
      age: 0,
      sample,
    }
  }
  // showAlert sends the alert with the fields expanded for its vars first.
  const showAlert = (a: AlertMsg) => {
    alertVars = a.vars
    pushFields()
    send({ type: 'alert', alert: a })
  }
  const sendSample = () => {
    const a = alertFor(undefined, true)
    if (a) showAlert(a)
  }

  async function start(): Promise<void> {
    const fonts = opts.fontsUrl ? fetchFonts(opts.fontsUrl, [JSON.stringify(fieldsNow()), JSON.stringify(theme), code.html, code.css, code.js].join('\n')) : Promise.resolve([])
    const first = await Promise.race([fonts, new Promise<null>((r) => setTimeout(() => r(null), FONT_WAIT_MS))])
    if (dead) return
    if (mode !== 'output') alertVars = alertFor(undefined, true)?.vars ?? null
    const fields = fieldsNow()
    const data = dataNow()
    sent = { fields: JSON.stringify(fields), theme: JSON.stringify(theme), data, muted }
    send({ type: 'init', code, fields: plain(fields), data: plain(data), size, theme: plain(theme), mode, baseUrl: base, kind: opts.kind ?? `gallery-${pkg.id}`, fonts: first ?? [], visible: true, muted, css: '' })
    ready = true
    if (mode !== 'output' && alertVars) send({ type: 'alert', alert: alertFor(undefined, true)! })
    if (!first) void fonts.then((f) => !dead && f.length && send({ type: 'fonts', fonts: f }))
    listeners.ready.slice().forEach((cb) => cb())
    if (queuedPlay) {
      const [t, o] = queuedPlay
      queuedPlay = null
      handle.play(t, o)
    }
  }

  const onMessage = (e: MessageEvent) => {
    if (dead || e.source !== frame.contentWindow) return
    const m = e.data as (FrameMsg & { sl?: number; nonce?: string }) | null
    if (!m || typeof m !== 'object' || m.sl !== PROTOCOL || m.nonce !== nonce) return
    if (m.type === 'ready') {
      if (gotReady) return
      gotReady = true
      clearTimeout(watchdog)
      void start()
    } else if (m.type === 'error') {
      emitError({ message: String(m.message ?? 'error').slice(0, 500), line: typeof m.line === 'number' ? m.line : undefined, source: m.source })
    }
  }
  addEventListener('message', onMessage)

  // Any load after 'ready' is the frame navigating away from the widget.
  frame.addEventListener('load', () => {
    if (dead) return
    if (!gotReady) return arm(FRAME_READY_MS)
    ready = false
    clearTimers()
    frame.remove()
    emitError({ message: 'the widget navigated away from its page and was stopped', source: 'js' })
  })
  frame.title = pkg.name ?? pkg.id
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('allow', 'autoplay')
  frame.style.cssText = `position:absolute;left:${-BLEED}px;top:${-BLEED}px;width:${size.w + 2 * BLEED}px;height:${size.h + 2 * BLEED}px;border:0;background:transparent;color-scheme:normal;overflow:hidden${mode === 'output' ? '' : ';pointer-events:none'}`
  frame.src = `${opts.frameUrl.replace(/#.*$/, '')}#${nonce}`
  stage.appendChild(frame)
  arm(3 * FRAME_READY_MS)

  // ---- Updates ----

  const pushFields = () => {
    if (!ready) return
    const f = JSON.stringify(fieldsNow())
    if (f === sent.fields) return
    sent.fields = f
    send({ type: 'fields', fields: JSON.parse(f) })
  }
  const pushData = () => {
    if (!ready) return
    const d = dataNow()
    const changed: Record<string, unknown> = {}
    const removed: string[] = []
    for (const k in d) if (JSON.stringify(d[k]) !== JSON.stringify(sent.data[k])) changed[k] = d[k]
    for (const k in sent.data) if (!(k in d)) removed.push(k)
    sent.data = d
    if (Object.keys(changed).length || removed.length) send({ type: 'data', changed: plain(changed), removed })
  }

  const handle: Handle = {
    // play runs the alert timeline: the alert, its cue, after the hold the
    // 'leave', after the out transition hide, then the sample again.
    play(eventType, o) {
      if (dead) return
      if (!ready) {
        queuedPlay = [eventType, o]
        return
      }
      clearTimers()
      const a = alertFor(eventType, false)
      send({ type: 'audition', on: !!o?.sound })
      if (a) showAlert(a)
      send({ type: 'cue', cue: { n: ++playSeq, at: performance.now() } })
      if (!a) return
      later(() => send({ type: 'leave' }), a.hold)
      later(() => {
        send({ type: 'hide' })
        send({ type: 'audition', on: false })
        alertVars = null
        pushFields()
        later(() => {
          send({ type: 'show' })
          if (mode !== 'output') sendSample()
        }, 150)
      }, a.hold + a.out.ms)
    },
    setData(d) {
      userData = d
      pushData()
    },
    setFields(f) {
      userFields = { ...f }
      pushFields()
    },
    setTheme(t) {
      theme = fullTheme(t)
      pushFields() // theme references in fields
      if (!ready) return
      const s = JSON.stringify(theme)
      if (s === sent.theme) return
      sent.theme = s
      send({ type: 'theme', theme: JSON.parse(s) })
    },
    setMuted(b) {
      muted = b
      if (!ready || b === sent.muted) return
      sent.muted = b
      send({ type: 'muted', muted: b })
    },
    destroy() {
      if (dead) return
      dead = true
      clearTimers()
      clearTimeout(watchdog)
      removeEventListener('message', onMessage)
      ro.disconnect()
      stage.remove()
      listeners.ready = []
      listeners.error = []
    },
    on(event: 'ready' | 'error', cb: never) {
      const list = listeners[event] as unknown[]
      list.push(cb)
      return () => {
        const i = list.indexOf(cb)
        if (i >= 0) list.splice(i, 1)
      }
    },
  }
  return handle
}
