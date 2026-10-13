// helpers.ts: the pure helpers of the host library (no DOM beyond crypto, no
// Svelte): the frame's nonce, which live data keys a widget declared, the
// library's @font-face parsing, Go durations and the {var} expansion of alert
// text. Shared with the app's own widget host.

// How long a frame has after loading to say it is ready. A frame that
// doesn't (its page blocked by a policy, a missing file) is reported.
export const FRAME_READY_MS = 5000
export const FRAME_STALLED = "Widget frame didn't start: the frame page is missing or blocked"

// newNonce is a fresh random nonce for one frame.
export function newNonce(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

// wants tells whether a data key is one the widget declared: an exact key,
// "prefix.*" (any key under prefix.) or "*" (everything).
export function wants(key: string, declared: string[]): boolean {
  for (const d of declared) {
    if (d === '*' || d === key) return true
    if (d.endsWith('.*') && key.startsWith(d.slice(0, -1))) return true
  }
  return false
}

// pickData is the widget's view of the live data: the declared keys, with
// the definition's sample filling keys that have no live value (editor and
// thumbnails only). Sample data for keys the widget doesn't declare is
// ignored, as the live page never sends them.
export function pickData(all: Record<string, unknown> | undefined, declared: string[], sample?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (sample) for (const [k, v] of Object.entries(sample)) if (wants(k, declared)) out[k] = v
  if (all) for (const [k, v] of Object.entries(all)) if (v !== undefined && wants(k, declared)) out[k] = v
  return out
}

// ---- Fonts ----

export interface LibraryFace {
  family: string
  weight: string
  style: string
  unicodeRange?: string
  url: string
}

// Declarations of one rule body, split on ; outside quotes and parentheses.
function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  let cur = ''
  let quote = ''
  let depth = 0
  const flush = () => {
    const i = cur.indexOf(':')
    if (i > 0) out[cur.slice(0, i).trim().toLowerCase()] = cur.slice(i + 1).trim()
    cur = ''
  }
  for (const c of body) {
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (c === ';' && !depth) {
      flush()
      continue
    }
    cur += c
  }
  flush()
  return out
}

const unquote = (s: string) => {
  const t = s.trim()
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1).replace(/\\(.)/g, '$1') : t
}

// parseFontFaces reads the library's @font-face stylesheet.
export function parseFontFaces(css: string): LibraryFace[] {
  const out: LibraryFace[] = []
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const d = declarations(m[1])
    const url = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(d.src ?? '')?.[2]
    const family = unquote(d['font-family'] ?? '')
    if (!url || !family) continue
    out.push({ family, weight: d['font-weight'] || 'normal', style: d['font-style'] || 'normal', unicodeRange: d['unicode-range'] || undefined, url })
  }
  return out
}


// A Go duration ("6s", "1m30s", "500ms") in ms; 0 when it isn't one.
export function goMs(d: string | undefined): number {
  let ms = 0
  for (const [, n, u] of (d ?? '').matchAll(/([\d.]+)(ms|s|m|h)/g)) ms += Number(n) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[u as 'ms' | 's' | 'm' | 'h']
  return ms > 0 ? Math.round(ms) : 0
}

// expand fills {name} placeholders (and {name|url}, {name|json}) from vars;
// anything unknown stays literal. Mirrors Go's integration.Expand.
export function expand(tmpl: string, vars: Record<string, string>): string {
  let out = ''
  let s = tmpl
  while (s) {
    const open = s.indexOf('{')
    if (open < 0) return out + s
    out += s.slice(0, open)
    s = s.slice(open)
    const end = s.indexOf('}')
    if (end < 0) return out + s
    const [name, filter] = s.slice(1, end).split(/\|(.*)/s)
    const v = Object.hasOwn(vars, name) ? vars[name] : undefined
    const r = v === undefined ? undefined : filter === undefined ? v : filter === 'url' ? encodeURIComponent(v).replace(/%20/g, '+').replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()) : filter === 'json' ? JSON.stringify(v).slice(1, -1) : undefined
    if (r === undefined) {
      out += '{'
      s = s.slice(1)
    } else {
      out += r
      s = s.slice(end + 1)
    }
  }
  return out
}

