// checks.ts: the widget-specific checks of a script that TypeScript's own
// diagnostics don't make (or make unreadably): sl.on with an event name
// that never fires, and sl.data['…'] with a string key the widget doesn't
// declare. Runs on a TypeScript source file; the TypeScript module is passed
// in, so the model stays free of a typescript import (the editor's worker
// and scripts/check-widget-api.mjs both bring their own).
import type TS from 'typescript'
import { SL_EVENT_NAMES } from './catalog.js'
import type { WidgetContext } from './types.js'

export interface ScriptProblem {
  from: number
  to: number
  message: string
}

// dataKeyKnown reports whether sl.data[key] can hold a value for a widget
// that declares ctx.data: a declared key, a key under a declared 'prefix.*'
// family, the first segment of a declared key (sl.data.counter, the nested
// object) or folders.<field> of a folder field when folder keys are declared.
export function dataKeyKnown(ctx: WidgetContext, key: string): boolean {
  const declared = (ctx.data ?? []).map((d) => d.key).filter(Boolean)
  for (const d of declared) {
    if (d === '*' || d === key) return true
    if (d.endsWith('.*') && key.startsWith(d.slice(0, -1))) return true
    if (!key.includes('.') && d.startsWith(key + '.')) return true
  }
  if (key.startsWith('folders.') && declared.some((d) => d.startsWith('folder.'))) {
    const field = key.slice('folders.'.length)
    return (ctx.fields ?? []).some((f) => f.type === 'folder' && f.key === field)
  }
  if (key === 'folders') return declared.some((d) => d.startsWith('folder.'))
  return false
}

function distance(a: string, b: string): number {
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

function nearest(word: string, names: string[]): string | undefined {
  let best: string | undefined
  let bd = Math.max(1, Math.min(3, Math.ceil(word.length / 3))) + 1
  for (const n of names) {
    const dd = distance(word.toLowerCase(), n.toLowerCase())
    if (dd < bd && n !== word) {
      best = n
      bd = dd
    }
  }
  return best
}

export const EVENT_NAMES: string[] = [...SL_EVENT_NAMES]

const list = (names: string[]) => names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]

// unknownEventMessage is the editor's (and the check script's) wording.
export function unknownEventMessage(name: string): string {
  const near = nearest(name, EVENT_NAMES)
  return `Unknown event "${name}": it never fires. sl.on takes ${list(EVENT_NAMES)}${near ? `. Did you mean '${near}'?` : '.'}`
}

function undeclaredKeyMessage(ctx: WidgetContext, key: string): string {
  const declared = (ctx.data ?? []).map((d) => d.key)
  const near = nearest(key, declared.filter((d) => !d.endsWith('.*')))
  return `This widget doesn't read data "${key}", so sl.data['${key}'] is always undefined. Add the key on the Data & sample tab${near ? `, or did you mean '${near}'?` : '.'}`
}

// isSl matches `sl`, `window.sl`, `globalThis.sl` and `self.sl`.
function isSl(ts: typeof TS, e: TS.Expression): boolean {
  e = skipParens(ts, e)
  if (ts.isIdentifier(e)) return e.text === 'sl'
  return ts.isPropertyAccessExpression(e) && e.name.text === 'sl' && ts.isIdentifier(e.expression) && ['window', 'globalThis', 'self'].includes(e.expression.text)
}

function skipParens(ts: typeof TS, e: TS.Expression): TS.Expression {
  while (ts.isParenthesizedExpression(e)) e = e.expression
  return e
}

const literal = (ts: typeof TS, e: TS.Expression | undefined): TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | undefined =>
  e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e : undefined

// scriptProblems walks a script's syntax tree. Positions are the source
// file's; ctx undefined (a widget whose fields and data aren't known)
// skips the data key check.
export function scriptProblems(ts: typeof TS, sf: TS.SourceFile, ctx: WidgetContext | undefined): ScriptProblem[] {
  const out: ScriptProblem[] = []
  const visit = (n: TS.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = skipParens(ts, n.expression)
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'on' && isSl(ts, callee.expression)) {
        const arg = literal(ts, n.arguments[0])
        if (arg && !EVENT_NAMES.includes(arg.text)) out.push({ from: arg.getStart(sf), to: arg.getEnd(), message: unknownEventMessage(arg.text) })
      }
    } else if (ctx && ts.isElementAccessExpression(n)) {
      const obj = skipParens(ts, n.expression)
      const arg = literal(ts, n.argumentExpression)
      if (arg && ts.isPropertyAccessExpression(obj) && obj.name.text === 'data' && isSl(ts, obj.expression) && !dataKeyKnown(ctx, arg.text)) {
        out.push({ from: arg.getStart(sf), to: arg.getEnd(), message: undeclaredKeyMessage(ctx, arg.text) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}
