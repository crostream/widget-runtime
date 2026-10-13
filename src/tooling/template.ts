// template.ts: the editor's view of the widget template language
// (../frame/template.ts): find the {{…}} tags with positions,
// check their structure like the runtime's compile() does, and warn about
// names that don't resolve to anything this widget has.
import type { WidgetContext } from '../api/index.js'

export interface Tag {
  from: number // the {{
  to: number // after the }}
  body: string // trimmed text between the braces
  bodyFrom: number
  raw: boolean // {{{ }}}
}

const TAG = /\{\{\{\s*([\s\S]*?)\s*\}\}\}|\{\{\s*([\s\S]*?)\s*\}\}/g
const NAME = /^[A-Za-z_$][\w$]*$/
const PATH = /^(@?[\w$-]+)(\.[\w$-]+)*$/

export function scan(src: string): Tag[] {
  const out: Tag[] = []
  for (const m of src.matchAll(TAG)) {
    const from = m.index ?? 0
    const raw = m[1] !== undefined
    const body = (raw ? m[1] : m[2]) ?? ''
    const lead = m[0].indexOf(body, raw ? 3 : 2)
    out.push({ from, to: from + m[0].length, body, bodyFrom: from + Math.max(lead, raw ? 3 : 2), raw })
  }
  return out
}

export interface Problem {
  from: number
  to: number
  severity: 'error' | 'warning'
  message: string
}

// Roots every template can read besides fields and data.
export const BUILTIN_ROOTS: Record<string, string> = {
  theme: "The overlay theme: `theme.colors.<name>`, `theme.fonts.heading` / `body`.",
  size: "The element's size in px: `size.w`, `size.h`. A field named `size` shadows it; `@size` always means the element's.",
  mode: "Where the widget is drawn: `'output'` (OBS / stream), `'editor'` or `'thumb'`.",
  visible: 'True while the element is shown (alerts toggle it).',
  this: 'The innermost `{{#each}}` item, or the fields outside a loop.',
  fields: 'All field values: `fields.<key>`.',
  alert: 'The live alert while an alert plays: `alert.vars.user`, `alert.type`, `alert.leaving`. Empty otherwise. A field named `alert` shadows it; `@alert` always means the alert.',
  data: 'Live data the widget declares on the Data tab, nested by dots like `sl.data`: `data.counter.subs`, `data.latest.twitch.follow.vars.user`.',
}
export const AT_NAMES: Record<string, string> = {
  '@index': 'The position of the current `{{#each}}` item, from 0.',
  '@key': 'The key of the current `{{#each}}` entry (the index for arrays).',
  '@first': 'True for the first `{{#each}}` item.',
  '@last': 'True for the last `{{#each}}` item.',
  '@theme': 'The overlay theme, even when a field is named `theme`.',
  '@size': "The element's size, even when a field is named `size`.",
  '@mode': "The draw mode, even when a field is named `mode`.",
  '@alert': 'The live alert, even when a field is named `alert`.',
  '@visible': 'Whether the element is shown, even when a field is named `visible`.',
}
const LOOP_ONLY = new Set(['@index', '@key', '@first', '@last'])

// covers mirrors lib/widgets/model.ts: a declared key or 'prefix.*'.
const covers = (declared: string[], key: string) => declared.some((d) => (d.endsWith('.*') ? key.startsWith(d.slice(0, -1)) : d === key))

// dataDeclared reports whether data.<segs> can resolve, read like sl.data:
// a declared key (or a path inside its value), a key of a declared
// 'prefix.*' family, the nested object above declared keys
// (data.counter with counter.subs or counter.*), or folders.<field> of a
// folder field when folder keys are declared.
export function dataDeclared(ctx: WidgetContext | undefined, segs: string[]): boolean {
  const declared = (ctx?.data ?? []).map((d) => d.key)
  for (let i = segs.length; i > 0; i--) if (covers(declared, segs.slice(0, i).join('.'))) return true
  const path = segs.join('.')
  if (declared.some((d) => d.startsWith(path + '.'))) return true
  if (segs[0] === 'folders' && declared.some((d) => d.startsWith('folder.'))) {
    return segs.length === 1 || (ctx?.fields ?? []).some((f) => f.type === 'folder' && f.key === segs[1])
  }
  return false
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}

export function closest(word: string, names: string[]): string | undefined {
  let best: string | undefined
  let bd = Math.max(1, Math.min(3, Math.ceil(word.length / 3)))
  for (const n of names) {
    const dd = distance(word.toLowerCase(), n.toLowerCase())
    if (dd <= bd && n !== word) {
      best = n
      bd = dd - 1
    }
  }
  return best
}

interface Frame {
  kind: 'if' | 'unless' | 'each'
  at: Tag
  local?: string
  inElse: boolean
}

// scopeAt lists the each-variables in scope at pos (innermost last) with
// the path each one iterates, and the innermost open block.
export function scopeAt(src: string, pos: number): { locals: { name: string; path: string }[]; open?: Frame['kind'] } {
  const stack: Frame[] = []
  for (const t of scan(src)) {
    if (t.to > pos) break
    open(t, stack)
  }
  const locals = stack
    .filter((f) => f.kind === 'each')
    .map((f) => ({ name: f.local ?? 'this', path: f.at.body.slice(1).trim().split(/\s+/)[1] ?? '' }))
  return { locals, open: stack[stack.length - 1]?.kind }
}

// open applies one tag's effect on the block stack; returns a problem
// message for structural errors.
function open(t: Tag, stack: Frame[]): string | undefined {
  const b = t.body
  if (t.raw || b.startsWith('!')) return
  if (b.startsWith('#')) {
    const [word, ...rest] = b.slice(1).trim().split(/\s+/)
    if (word === 'if' || word === 'unless') {
      stack.push({ kind: word, at: t, inElse: false })
      if (rest.length !== 1) return `{{#${word}}} takes one path`
    } else if (word === 'each') {
      let local: string | undefined
      let msg: string | undefined
      if (rest.length === 3 && rest[1] === 'as' && NAME.test(rest[2])) local = rest[2]
      else if (rest.length !== 1) msg = 'Expected {{#each path as name}}'
      stack.push({ kind: 'each', at: t, local, inElse: false })
      return msg
    } else return `Unknown block {{#${word}}}: use #if, #unless or #each`
    return
  }
  if (b.startsWith('/')) {
    const word = b.slice(1).trim()
    const top = stack[stack.length - 1]
    if (!top) return `{{/${word}}} has no open block to close`
    if (top.kind !== word) {
      stack.pop()
      return `{{/${word}}} closes {{#${top.kind}}}`
    }
    stack.pop()
    return
  }
  if (b === 'else' || b.startsWith('else ')) {
    const top = stack[stack.length - 1]
    const rest = b.slice(4).trim().split(/\s+/).filter(Boolean)
    if (!top) return '{{else}} outside a block'
    if (top.kind === 'each') {
      if (rest.length) return '{{else}} in {{#each}} takes nothing'
      top.inElse = true
      return
    }
    if (!rest.length) {
      top.inElse = true
      return
    }
    if ((rest[0] === 'if' || rest[0] === 'unless') && rest.length === 2) {
      if (top.inElse) return '{{else if}} after {{else}}'
      return
    }
    return `Bad {{${b}}}`
  }
}

// pathsOf returns the paths a tag reads, with their offsets.
export function pathsOf(t: Tag): { path: string; from: number }[] {
  const b = t.body
  if (b.startsWith('!') && !t.raw) return []
  if (t.raw) return [{ path: b, from: t.bodyFrom }]
  if (b.startsWith('/')) return []
  let words: string[]
  let skip: number
  if (b.startsWith('#')) {
    words = b.slice(1).trim().split(/\s+/)
    skip = 1 // the block word
    words = words.slice(skip, skip + 1)
  } else if (b === 'else' || b.startsWith('else ')) {
    const rest = b.slice(4).trim().split(/\s+/).filter(Boolean)
    words = rest.length === 2 ? [rest[1]] : []
  } else words = [b]
  return words.map((w) => ({ path: w, from: t.bodyFrom + Math.max(0, b.indexOf(w, b.startsWith('#') ? 1 : 0)) }))
}

export function checkTemplate(src: string, ctx: WidgetContext | undefined): Problem[] {
  const out: Problem[] = []
  const stack: Frame[] = []
  const fieldKeys = new Set((ctx?.fields ?? []).map((f) => f.key))
  for (const t of scan(src)) {
    const msg = open(t, stack)
    if (msg) out.push({ from: t.from, to: t.to, severity: 'error', message: msg })
    const locals = stack.filter((f) => f.kind === 'each').map((f) => f.local ?? 'this')
    // an each opens its scope after its own path
    const own = t.body.startsWith('#each') ? 1 : 0
    const inLoop = locals.length - own > 0
    const scope = new Set(locals.slice(0, locals.length - own))
    for (const p of pathsOf(t)) {
      const to = p.from + p.path.length
      if (!PATH.test(p.path)) {
        out.push({ from: p.from, to, severity: 'error', message: `Bad path "${p.path}": use names and dots, like data.stream.title` })
        continue
      }
      if (!ctx) continue
      const segs = p.path.split('.')
      const first = segs[0]
      if (first.startsWith('@')) {
        if (!(first in AT_NAMES)) out.push({ from: p.from, to, severity: 'warning', message: `Unknown ${first}: use @index, @key, @first, @last, @theme, @size, @mode, @visible or @alert` })
        else if (LOOP_ONLY.has(first) && !inLoop) out.push({ from: p.from, to, severity: 'warning', message: `${first} only has a value inside {{#each}}` })
        continue
      }
      if (first === 'this' || scope.has(first)) continue
      if (first === 'data') {
        if (segs.length > 1 && !dataDeclared(ctx, segs.slice(1))) {
          const keys = (ctx.data ?? []).map((d) => d.key)
          const near = closest(segs[1], keys.map((k) => k.split('.')[0]))
          out.push({
            from: p.from + 5,
            to,
            severity: 'warning',
            message: `This widget doesn't read data "${segs.slice(1).join('.')}". Add the key on the Data & sample tab${near ? `, or did you mean data.${near}?` : '.'}`,
          })
        }
        continue
      }
      if (first === 'fields') {
        if (segs.length > 1 && !fieldKeys.has(segs[1])) {
          const near = closest(segs[1], [...fieldKeys])
          out.push({ from: p.from + 7, to: p.from + 7 + segs[1].length, severity: 'warning', message: `No field "${segs[1]}"${near ? `. Did you mean ${near}?` : ''}` })
        }
        continue
      }
      if (fieldKeys.has(first) || first in BUILTIN_ROOTS) continue
      const names = [...fieldKeys, ...scope, ...Object.keys(BUILTIN_ROOTS)]
      const near = closest(first, names)
      out.push({
        from: p.from,
        to: p.from + first.length,
        severity: 'warning',
        message: `"${first}" isn't a field, a loop variable or a template name, so it renders empty${near ? `. Did you mean ${near}?` : '.'}`,
      })
    }
  }
  for (const f of stack) out.push({ from: f.at.from, to: f.at.to, severity: 'error', message: `{{#${f.kind}}} is never closed: add {{/${f.kind}}}` })
  return out
}

// tagAt returns the tag around pos.
export function tagAt(src: string, pos: number): Tag | undefined {
  return scan(src).find((t) => t.from <= pos && pos <= t.to)
}
