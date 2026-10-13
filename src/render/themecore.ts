// themecore.ts: an overlay's theme and the "theme:<key>" references props make
// to it. Stage provides the overlay's theme (its keys over DEFAULT_THEME)
// through context; NodeView resolves the references in an element's
// effective props before its widget sees them, so widgets only ever get
// plain colors and fonts. Only props of a theme kind (color, font, effects,
// frame, and those inside items) are resolved: a text that happens to start
// with "theme:" is shown as typed. Kept free of api.ts like the rest of the
// renderer. No Svelte in here: the host library uses it too (theme.ts has the
// contexts).
import type { ThemeKind, ThemeSchema } from './themeprops.js'
import { DEFAULT_THEME, THEME_COLOR_KEYS, THEME_FONT_KEYS, THEME_PREFIX, type Theme } from './types.js'

// ResolvedTheme has a value for every key.
export interface ResolvedTheme {
  colors: Record<string, string>
  fonts: Record<string, string>
}

// What an unknown reference becomes.
const NO_COLOR = '#00000000'
const NO_FONT = DEFAULT_THEME.fonts.body

const FONT_KEYS = new Set<string>(THEME_FONT_KEYS)

// fullTheme fills the keys t leaves out (or sets empty) from DEFAULT_THEME.
// A value that is itself a reference is ignored (no chains).
export function fullTheme(t: Theme | null | undefined): ResolvedTheme {
  const colors: Record<string, string> = { ...DEFAULT_THEME.colors }
  const fonts: Record<string, string> = { ...DEFAULT_THEME.fonts }
  for (const k of THEME_COLOR_KEYS) {
    const v = t?.colors?.[k]
    if (typeof v === 'string' && v && !v.startsWith(THEME_PREFIX)) colors[k] = v
  }
  for (const k of THEME_FONT_KEYS) {
    const v = t?.fonts?.[k]
    if (typeof v === 'string' && v.trim() && !v.startsWith(THEME_PREFIX)) fonts[k] = v
  }
  return { colors, fonts }
}

export const DEFAULT_RESOLVED: ResolvedTheme = fullTheme(null)

// themeValue is what one reference stands for: a theme font for a font key,
// a theme color for a color key, transparent for an unknown key.
export function themeValue(ref: string, t: ResolvedTheme): string {
  const key = ref.slice(THEME_PREFIX.length).trim()
  if (FONT_KEYS.has(key)) return t.fonts[key] || NO_FONT
  return t.colors[key] ?? NO_COLOR
}

// resolveRefs returns v with every "theme:…" string (at any depth, in
// objects and arrays) replaced by its value. Parts without references are
// returned as they are, so a value without any is returned itself and
// derived values downstream see no change.
export function resolveRefs<T>(v: T, t: ResolvedTheme): T {
  return walk(v, t, 0) as T
}

function walk(v: unknown, t: ResolvedTheme, depth: number): unknown {
  if (typeof v === 'string') return v.startsWith(THEME_PREFIX) ? themeValue(v, t) : v
  if (!v || typeof v !== 'object' || depth > 12) return v
  if (Array.isArray(v)) {
    let out: unknown[] | null = null
    for (let i = 0; i < v.length; i++) {
      const x = walk(v[i], t, depth + 1)
      if (x !== v[i]) {
        out ??= v.slice()
        out[i] = x
      }
    }
    return out ?? v
  }
  let out: Record<string, unknown> | null = null
  const o = v as Record<string, unknown>
  for (const k in o) {
    const x = walk(o[k], t, depth + 1)
    if (x !== o[k]) {
      out ??= { ...o }
      out[k] = x
    }
  }
  return out ?? v
}

const THEME_KINDS = new Set<string>(['color', 'font', 'effects', 'frame'])

// schemaOfFields is the theme schema of a library widget's field list.
export function schemaOfFields(fields: { key: string; kind: string; item?: { key: string; kind: string }[] }[] | undefined): ThemeSchema | undefined {
  if (!fields) return undefined
  const out: ThemeSchema = {}
  for (const f of fields) {
    if (THEME_KINDS.has(f.kind)) out[f.key] = f.kind as ThemeKind
    else if (f.kind === 'items' && f.item) {
      const sub: Record<string, ThemeKind> = {}
      for (const q of f.item) if (THEME_KINDS.has(q.kind)) sub[q.key] = q.kind as ThemeKind
      if (Object.keys(sub).length) out[f.key] = sub
    }
  }
  return out
}

// resolveProps resolves the theme references of the props the schema lists
// as theme kinds and leaves every other prop alone. Without a schema nothing
// is resolved. Returns props itself when nothing changed.
export function resolveProps<T extends Record<string, unknown>>(props: T, t: ResolvedTheme, schema: ThemeSchema | undefined): T {
  if (!schema || !props) return props
  let out: Record<string, unknown> | null = null
  for (const key in schema) {
    const v = props[key]
    if (v === undefined || v === null) continue
    const kind = schema[key]
    let x: unknown
    if (typeof kind === 'string') x = resolveRefs(v, t)
    else if (Array.isArray(v)) {
      let items: unknown[] | null = null
      v.forEach((item, i) => {
        if (!item || typeof item !== 'object') return
        const r = resolveProps(item as Record<string, unknown>, t, kind)
        if (r !== item) {
          items ??= v.slice()
          items[i] = r
        }
      })
      x = items ?? v
    } else x = v
    if (x !== v) {
      out ??= { ...props }
      out[key] = x
    }
  }
  return (out ?? props) as T
}
