// template.ts: the custom widgets' HTML template language, a small
// Handlebars-like subset compiled once and rendered to a string.
//
//   {{path}}                  the value, HTML-escaped (objects and arrays as
//                             JSON, so effects='{{effects}}' passes an object
//                             to a building block; null/undefined as '')
//   {{{path}}}                the value unescaped
//   {{! comment }}
//   {{#if path}} … {{else if path}} … {{else}} … {{/if}}
//   {{#unless path}} … {{else}} … {{/unless}}
//   {{#each path as item}} … {{else}} … {{/each}}   arrays, or objects by
//                             entry; inside: item, item.x, {{this}} (the
//                             innermost item), {{@index}}, {{@key}},
//                             {{@first}}, {{@last}}
//
// Paths are dot-separated. The first segment picks the root: an each
// variable in scope (innermost first), then data (live data, read like a
// script's sl.data: keys nest by dots, so data.counter.subs is the key
// "counter.subs", data.counter the object of every counter.* key, and
// data.latest.twitch.cheer.vars.user reads .vars.user inside the key
// "latest.twitch.cheer"; where nesting can't reach a key, because a key
// with a value sits on its way, the longest exact key wins), fields
// (explicit), a field of that name, then
// theme, size, mode, visible and alert (the live alert: alert.vars.user; a
// field named like one of these wins: built-in text props have a "size";
// @theme, @size, @mode, @visible and @alert always mean the widget's). Conditions are falsy for false, 0, '', null,
// undefined and empty arrays.

export class TemplateError extends Error {}

type Node =
  | string
  | { t: 'var'; path: string; raw: boolean }
  | { t: 'if'; branches: { path: string; neg: boolean; body: Node[] }[]; else: Node[] }
  | { t: 'each'; path: string; as: string; body: Node[]; else: Node[] }

export interface Roots {
  fields: Record<string, unknown>
  data: Record<string, unknown> // flat, by key
  theme: unknown
  size: unknown
  mode: string
  visible: boolean
  alert?: unknown // the live alert (sl.alert), absent until one arrives
}

interface Local {
  name: string
  value: unknown
  index: number
  key: string | number
  first: boolean
  last: boolean
}

const TAG = /\{\{\{\s*([\s\S]*?)\s*\}\}\}|\{\{\s*([\s\S]*?)\s*\}\}/g
const NAME = /^[A-Za-z_$][\w$]*$/
const PATH = /^(@?[\w$-]+)(\.[\w$-]+)*$/

// Frames of the parser's stack: the block being filled and where its
// current body goes.
type Open =
  | { kind: 'root'; body: Node[] }
  | { kind: 'if' | 'unless'; node: Extract<Node, { t: 'if' }>; body: Node[] }
  | { kind: 'each'; node: Extract<Node, { t: 'each' }>; body: Node[] }

export function compile(src: string): Node[] {
  const root: Open = { kind: 'root', body: [] }
  const stack: Open[] = [root]
  const top = () => stack[stack.length - 1]
  const lineAt = (i: number) => src.slice(0, i).split('\n').length
  const fail = (msg: string, at: number): never => {
    throw new TemplateError(`${msg} (line ${lineAt(at)})`)
  }
  const checkPath = (p: string, at: number) => {
    if (!PATH.test(p)) fail(`bad path "${p}"`, at)
    return p
  }
  let last = 0
  for (const m of src.matchAll(TAG)) {
    const at = m.index ?? 0
    if (at > last) top().body.push(src.slice(last, at))
    last = at + m[0].length
    if (m[1] !== undefined) {
      top().body.push({ t: 'var', path: checkPath(m[1], at), raw: true })
      continue
    }
    const tag = m[2]
    if (tag.startsWith('!')) continue
    if (tag.startsWith('#')) {
      const [word, ...rest] = tag.slice(1).trim().split(/\s+/)
      if (word === 'if' || word === 'unless') {
        if (rest.length !== 1) fail(`{{#${word}}} takes one path`, at)
        const node: Extract<Node, { t: 'if' }> = { t: 'if', branches: [{ path: checkPath(rest[0], at), neg: word === 'unless', body: [] }], else: [] }
        top().body.push(node)
        stack.push({ kind: word, node, body: node.branches[0].body })
      } else if (word === 'each') {
        let as = 'this'
        if (rest.length === 3 && rest[1] === 'as' && NAME.test(rest[2])) as = rest[2]
        else if (rest.length !== 1) fail('{{#each path as name}} expected', at)
        const node: Extract<Node, { t: 'each' }> = { t: 'each', path: checkPath(rest[0], at), as, body: [], else: [] }
        top().body.push(node)
        stack.push({ kind: 'each', node, body: node.body })
      } else fail(`unknown block {{#${word}}}`, at)
      continue
    }
    if (tag.startsWith('/')) {
      const word = tag.slice(1).trim()
      const open = top()
      if (open.kind === 'root') fail(`{{/${word}}} without an open block`, at)
      if (open.kind !== word) fail(`{{/${word}}} closes {{#${open.kind}}}`, at)
      stack.pop()
      continue
    }
    if (tag === 'else' || tag.startsWith('else ')) {
      const open = top()
      const rest = tag.slice(4).trim().split(/\s+/).filter(Boolean)
      if (open.kind === 'root') fail('{{else}} outside a block', at)
      else if (open.kind === 'each') {
        if (rest.length) fail('{{else}} in {{#each}} takes nothing', at)
        open.body = open.node.else
      } else if (!rest.length) open.body = open.node.else
      else if ((rest[0] === 'if' || rest[0] === 'unless') && rest.length === 2) {
        if (open.body === open.node.else) fail('{{else if}} after {{else}}', at)
        const b = { path: checkPath(rest[1], at), neg: rest[0] === 'unless', body: [] as Node[] }
        open.node.branches.push(b)
        open.body = b.body
      } else fail(`bad {{${tag}}}`, at)
      continue
    }
    top().body.push({ t: 'var', path: checkPath(tag, at), raw: false })
  }
  if (last < src.length) top().body.push(src.slice(last))
  if (stack.length > 1) {
    const open = top()
    throw new TemplateError(`{{#${open.kind}}} is never closed`)
  }
  return root.body
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }
export const escapeHTML = (s: string) => s.replace(/[&<>"'`]/g, (c) => ESC[c])

export function toText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  try {
    return JSON.stringify(v) ?? ''
  } catch {
    return ''
  }
}

export const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!v)

// walk follows segs through own properties of objects and arrays.
export function walk(v: unknown, segs: string[]): unknown {
  for (const s of segs) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, s)) return undefined
    v = (v as Record<string, unknown>)[s]
  }
  return v
}

// dataPath reads live data by a path: the longest exact key, then into its
// value. lookup falls back to it where the nested view (nest() in main.ts)
// doesn't reach.
export function dataPath(data: Record<string, unknown>, segs: string[]): unknown {
  for (let i = segs.length; i > 0; i--) {
    const k = segs.slice(0, i).join('.')
    if (Object.hasOwn(data, k)) return walk(data[k], segs.slice(i))
  }
  return undefined
}

// nest builds sl.data: every key flat, and split on dots into nested
// objects (sl.data.latest.twitch.cheer) where that doesn't collide with a
// value.
export function nest(d: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...d }
  const made = new WeakSet<object>()
  for (const [k, v] of Object.entries(d)) {
    const segs = k.split('.')
    if (segs.length < 2 || segs.some((s) => !s)) continue
    let o: Record<string, unknown> | null = out
    for (const s of segs.slice(0, -1)) {
      const next: unknown = o[s]
      if (next === undefined) {
        const fresh = {}
        made.add(fresh)
        o = o[s] = fresh
      } else if (next && typeof next === 'object' && made.has(next)) o = next as Record<string, unknown>
      else {
        o = null
        break
      }
    }
    if (o && !(segs[segs.length - 1] in o)) o[segs[segs.length - 1]] = v
  }
  return out
}

// lookup resolves a path against the roots and the each scopes.
export function lookup(path: string, roots: Roots, locals: Local[] = [], nested?: unknown): unknown {
  const inner = locals[locals.length - 1]
  if (path.startsWith('@')) {
    const segs = path.slice(1).split('.')
    if (segs[0] === 'theme' || segs[0] === 'size' || segs[0] === 'alert') return walk(roots[segs[0]], segs.slice(1))
    if (path === '@mode') return roots.mode
    if (path === '@visible') return roots.visible
    if (!inner) return undefined
    switch (path) {
      case '@index':
        return inner.index
      case '@key':
        return inner.key
      case '@first':
        return inner.first
      case '@last':
        return inner.last
    }
    return undefined
  }
  const segs = path.split('.')
  const first = segs[0]
  const rest = segs.slice(1)
  if (first === 'this') return inner ? walk(inner.value, rest) : walk(roots.fields, rest)
  for (let i = locals.length - 1; i >= 0; i--) if (locals[i].name === first) return walk(locals[i].value, rest)
  switch (first) {
    case 'data': {
      if (!rest.length) return nested
      // As sl.data reads in a script: nested by dots first, then by the
      // longest whole key.
      const v = nested === undefined ? undefined : walk(nested, rest)
      return v !== undefined ? v : dataPath(roots.data, rest)
    }
    case 'fields':
      return walk(roots.fields, rest)
  }
  if (Object.hasOwn(roots.fields, first)) return walk(roots.fields, segs)
  switch (first) {
    case 'theme':
    case 'size':
    case 'alert':
      return walk(roots[first], rest)
    case 'mode':
      return rest.length ? undefined : roots.mode
    case 'visible':
      return rest.length ? undefined : roots.visible
  }
  return walk(roots.fields, segs)
}

// Arbitrary cap on each-loop output, so a runaway list can't hang the frame.
const MAX_ITEMS = 5000

export function render(nodes: Node[], roots: Roots, nested?: unknown): string {
  let out = ''
  const locals: Local[] = []
  const run = (list: Node[]) => {
    for (const n of list) {
      if (typeof n === 'string') {
        out += n
        continue
      }
      if (n.t === 'var') {
        const s = toText(lookup(n.path, roots, locals, nested))
        out += n.raw ? s : escapeHTML(s)
      } else if (n.t === 'if') {
        const hit = n.branches.find((b) => truthy(lookup(b.path, roots, locals, nested)) !== b.neg)
        run(hit ? hit.body : n.else)
      } else {
        const v = lookup(n.path, roots, locals, nested)
        const entries: [string | number, unknown][] = Array.isArray(v)
          ? v.map((x, i) => [i, x])
          : v && typeof v === 'object'
            ? Object.entries(v)
            : []
        if (!entries.length) {
          run(n.else)
          continue
        }
        const count = Math.min(entries.length, MAX_ITEMS)
        for (let i = 0; i < count; i++) {
          locals.push({ name: n.as, value: entries[i][1], index: i, key: entries[i][0], first: i === 0, last: i === count - 1 })
          run(n.body)
          locals.pop()
        }
      }
    }
  }
  run(nodes)
  return out
}
