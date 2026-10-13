// dts.ts: WIDGET_DTS, the TypeScript declarations of a widget script's
// world (the `sl` global and every type it hands out), and contextDts, the
// extra declarations that narrow sl.fields and sl.data to the widget being
// edited. Docs come from the same model as completions and hovers (sl.ts,
// catalog.ts), so every member carries JSDoc.
//
// How the narrowing works: WIDGET_DTS declares three empty interfaces,
// SlWidgetContext, SlWidgetFields and SlWidgetData, and picks the types of
// sl.fields and sl.data with a conditional on SlWidgetContext. contextDts
// merges `known: true` into SlWidgetContext and fills the other two, so a
// program with it sees exactly the widget's fields and data; one without it
// sees every key, loosely typed.
import { DATA_FAMILIES, FIELD_KINDS, SFX_NAMES, LATEST_TYPES, LEADER_METRICS, LEADER_PERIODS, SHAPES, THEME_COLORS, THEME_FONTS, VAR_DOCS, type Shape } from './catalog.js'
import { EVENTS, flatMembers } from './sl.js'
import type { WidgetContext } from './types.js'

// jsdoc renders a doc comment at an indent.
export function jsdoc(doc: string, indent = ''): string {
  const lines = doc.replace(/\*\//g, '*\\/').trim().split('\n')
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`.trimEnd()).join('\n')}\n${indent} */\n`
}

const IDENT = /^[A-Za-z_$][\w$]*$/
const propName = (k: string) => (IDENT.test(k) ? k : JSON.stringify(k))

const members = new Map(flatMembers().map((m) => [m.path, m]))
function memberDoc(path: string): string {
  const m = members.get(path)
  if (!m) throw new Error(`widget api: no member ${path}`)
  return m.example ? `${m.doc}\n@example\n${m.example}` : m.doc
}

function shapeDts(s: Shape): string {
  let out = jsdoc(s.doc) + `interface ${s.name}${s.generic ? `<${s.generic}>` : ''} {\n`
  for (const p of s.props) out += jsdoc(p.doc, '  ') + `  readonly ${p.name}${p.optional ? '?' : ''}: ${p.type}\n`
  if (s.index) out += jsdoc(s.index.doc, '  ') + `  readonly [${s.index.key}: string]: ${s.index.type}\n`
  return out + '}\n'
}

const family = (prefix: string) => DATA_FAMILIES.find((f) => f.prefix === prefix)!
const exact = (key: string) => DATA_FAMILIES.find((f) => !f.prefix && f.key === key)
const latestType = (type: string) => (LATEST_TYPES.some((t) => t.type === type) ? `SlLatestEvent<SlLatestVarsMap[${JSON.stringify(type)}]>` : 'SlLatestEvent')

// Tree is a nested object type built from dotted names.
interface Tree {
  doc?: string
  type?: string
  kids: Map<string, Tree>
}
const tree = (): Tree => ({ kids: new Map() })
function plant(t: Tree, segs: string[], type: string, doc: string): void {
  for (const s of segs) {
    let k = t.kids.get(s)
    if (!k) t.kids.set(s, (k = tree()))
    t = k
  }
  t.type = type
  t.doc = doc
}
function treeDts(t: Tree, indent: string, index?: string): string {
  if (t.type) return t.type
  let out = '{\n'
  for (const [name, k] of t.kids) {
    if (k.doc) out += jsdoc(k.doc, indent + '  ')
    out += `${indent}  readonly ${propName(name)}?: ${treeDts(k, indent + '  ')}\n`
  }
  if (index) out += `${indent}  readonly [name: string]: ${index}\n`
  return out + `${indent}}`
}

function latestVarsMap(): string {
  let out = jsdoc("The variables of each event type's `latest.<type>` key (every one also has `user`, `summary` and, with an amount, `amount`).")
  out += 'interface SlLatestVarsMap {\n'
  for (const t of LATEST_TYPES) {
    out += jsdoc(`${t.label}: \`latest.${t.type}\`.`, '  ')
    if (!t.vars.length) {
      out += `  ${JSON.stringify(t.type)}: SlLatestVars\n`
      continue
    }
    out += `  ${JSON.stringify(t.type)}: SlLatestVars & {\n`
    for (const v of t.vars) out += jsdoc(VAR_DOCS[v] ?? v, '    ') + `    readonly ${v}: string\n`
    out += '  }\n'
  }
  return out + '}\n'
}

const latestDoc = (type: string) => {
  const t = LATEST_TYPES.find((x) => x.type === type)
  return `${t ? t.label.replace(/ \(.*\)$/, '') : 'An event'}: the newest event of this type, \`{vars, time}\`. Key \`latest.${type}\`.`
}
const leaderDoc = (metric: string, period: string) => {
  const m = LEADER_METRICS.find((x) => x.name === metric)
  const p = LEADER_PERIODS.find((x) => x.name === period)
  return `Top 10 by ${m ? m.doc.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : metric}, ${p ? p.doc.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : period}. Key \`leaders.${metric}.${period}\`.`
}

function latestTree(types: string[]): Tree {
  const t = tree()
  for (const type of types) plant(t, type.split('.'), latestType(type), latestDoc(type))
  return t
}
function leadersTree(keys: [string, string][]): Tree {
  const t = tree()
  for (const [m, p] of keys) plant(t, [m, p], 'SlLeader[]', leaderDoc(m, p))
  return t
}
const ALL_LEADERS: [string, string][] = LEADER_METRICS.flatMap((m) => LEADER_PERIODS.map((p) => [m.name, p.name] as [string, string]))

// Pattern index signatures for the prefix families.
const PATTERNS: Record<string, string> = {
  'latest.': 'SlLatestEvent | undefined',
  'counter.': 'number | undefined',
  'timer.': 'SlTimer | undefined',
  'leaders.': 'SlLeader[] | undefined',
  'folders.': 'SlFolderItem[] | undefined',
  'folder.': 'SlFolderItem[] | undefined',
}
const pattern = (prefix: string, indent = '  ') => jsdoc(family(prefix).doc, indent) + `${indent}readonly [key: \`${prefix}\${string}\`]: ${PATTERNS[prefix]}\n`

function allData(): string {
  let out = jsdoc("Every live data key a widget can declare. A widget gets only the keys it declares; one that hasn't been produced yet is missing. Each key is there by its full name (`sl.data['counter.subs']`) and nested by dots (`sl.data.counter.subs`).")
  out += 'interface SlAllData {\n'
  for (const f of DATA_FAMILIES) if (!f.prefix) out += jsdoc(f.doc, '  ') + `  readonly ${f.key}?: ${f.type}\n`
  out += jsdoc('`latest.<type>` keys, nested by dots: `sl.data.latest.twitch.follow`.', '  ') + `  readonly latest?: ${treeDts(latestTree(LATEST_TYPES.map((t) => t.type)), '  ')}\n`
  out += jsdoc('Counters by name, nested: `sl.data.counter.subs` is the key `counter.subs`.', '  ') + '  readonly counter?: { readonly [name: string]: number }\n'
  out += jsdoc('Timers by name, nested: `sl.data.timer.break` is the key `timer.break`.', '  ') + '  readonly timer?: { readonly [name: string]: SlTimer }\n'
  out += jsdoc('Leaderboards, nested: `sl.data.leaders.bits.stream` is the key `leaders.bits.stream`.', '  ') + `  readonly leaders?: ${treeDts(leadersTree(ALL_LEADERS), '  ')}\n`
  out += jsdoc("Media folder files by the folder field's key, nested: `sl.data.folders.pics`.", '  ') + '  readonly folders?: { readonly [field: string]: SlFolderItem[] }\n'
  out += jsdoc("Media folder files by folder ID, nested: `sl.data.folder['folder-…']`.", '  ') + '  readonly folder?: { readonly [id: string]: SlFolderItem[] }\n'
  for (const t of LATEST_TYPES) out += jsdoc(latestDoc(t.type), '  ') + `  readonly ${JSON.stringify('latest.' + t.type)}?: ${latestType(t.type)}\n`
  for (const [m, p] of ALL_LEADERS) out += jsdoc(leaderDoc(m, p), '  ') + `  readonly ${JSON.stringify(`leaders.${m}.${p}`)}?: SlLeader[]\n`
  for (const prefix of Object.keys(PATTERNS)) out += pattern(prefix)
  out += jsdoc('Any other key, by a computed name.', '  ') + '  readonly [key: string]: any\n'
  return out + '}\n'
}

function eventOverloads(): string {
  let out = ''
  for (const e of EVENTS) {
    const handler = e.payload === '()' ? '() => void' : `${e.payload} => void`
    out += jsdoc(`${memberDoc('sl.on')}\n\n**\`'${e.name}'\`**: ${e.doc}${e.example ? `\n@example\n${e.example}` : ''}`, '  ')
    out += `  on(event: '${e.name}', handler: ${handler}): () => void\n`
  }
  return out
}

function eventMap(): string {
  let out = jsdoc('The events of `sl.on` and the arguments each handler gets.') + 'interface SlEventMap {\n'
  for (const e of EVENTS) out += jsdoc(e.doc, '  ') + `  ${e.name}: ${e.payload === '()' ? '() => void' : `${e.payload} => void`}\n`
  return out + '}\n'
}

function themeDts(): string {
  let out = jsdoc(memberDoc('sl.theme.colors')) + 'interface SlThemeColors {\n'
  for (const c of THEME_COLORS) out += jsdoc(members.get(`sl.theme.colors.${c.name}`)!.doc, '  ') + `  readonly ${c.name}: string\n`
  out += '}\n' + jsdoc(memberDoc('sl.theme.fonts')) + 'interface SlThemeFonts {\n'
  for (const f of THEME_FONTS) out += jsdoc(members.get(`sl.theme.fonts.${f.name}`)!.doc, '  ') + `  readonly ${f.name}: string\n`
  out += '}\n' + jsdoc(memberDoc('sl.theme')) + 'interface SlTheme {\n'
  out += jsdoc(memberDoc('sl.theme.colors'), '  ') + '  readonly colors: SlThemeColors\n'
  out += jsdoc(memberDoc('sl.theme.fonts'), '  ') + '  readonly fonts: SlThemeFonts\n'
  return out + '}\n'
}

function buildDts(): string {
  const prop = (path: string, decl: string) => jsdoc(memberDoc(path), '  ') + `  ${decl}\n`
  return `// CroStream widget runtime: the \`sl\` object your script gets.
// Generated from frontend/src/lib/code/api (the widget API model).

${SHAPES.map(shapeDts).join('\n')}
${latestVarsMap()}
${jsdoc('The value of a **Text effects** field: pass it whole to `<sl-text effects="{{key}}">`.')}interface SlTextEffects {
  readonly [key: string]: unknown
}
${jsdoc('The value of a **Frame** field: pass it whole to `<sl-frame frame="{{key}}">`.')}interface SlFrameStyle {
  readonly [key: string]: unknown
}
${jsdoc("One item of a **List** field: an object with the list's item fields by key.")}interface SlListItem {
  readonly [key: string]: any
}

${allData()}
${jsdoc('Field values of a widget whose fields are unknown: any key.')}interface SlAnyFields {
  readonly [key: string]: any
}

${jsdoc('Filled in by the editor for the widget being edited (`known: true`); empty otherwise.')}interface SlWidgetContext {}
${jsdoc("The fields of the widget being edited, filled in by the editor.")}interface SlWidgetFields {}
${jsdoc("The declared data of the widget being edited, filled in by the editor.")}interface SlWidgetData {}

${jsdoc(memberDoc('sl.fields'))}type SlFields = SlWidgetContext extends { readonly known: true } ? SlWidgetFields : SlAnyFields
${jsdoc(memberDoc('sl.data'))}type SlData = SlWidgetContext extends { readonly known: true } ? SlWidgetData : SlAllData

${jsdoc(memberDoc('sl.size'))}interface SlSize {
${jsdoc(memberDoc('sl.size.w'), '  ')}  readonly w: number
${jsdoc(memberDoc('sl.size.h'), '  ')}  readonly h: number
}

${themeDts()}
${jsdoc(memberDoc('sl.mode'))}type SlMode = 'output' | 'editor' | 'thumb'

${jsdoc(EVENTS.find((e) => e.name === 'cue')!.doc)}interface SlCue {
${jsdoc('Counts the cues since the page loaded.', '  ')}  readonly n: number
${jsdoc('When the cue was seen (`performance.now()`).', '  ')}  readonly at: number
}

${jsdoc('A sound preset of `sl.sfx.play`.')}type SlSfxName = ${SFX_NAMES.map((n) => `'${n}'`).join(' | ')}

${jsdoc('One transition of an alert: its kind (`fade`, `slide`, …) and length.')}interface SlTransition {
${jsdoc('The transition kind.', '  ')}  readonly kind: string
${jsdoc('How long it runs, in milliseconds.', '  ')}  readonly ms: number
}

${jsdoc(memberDoc('sl.alert'))}interface SlAlert {
${jsdoc('Counts the alerts shown; a new alert has a new ID.', '  ')}  readonly id: number
${jsdoc('The bus event type that caused it, such as `twitch.cheer`; empty when run without an event.', '  ')}  readonly type: string
${jsdoc("The run's values: `user`, `amount`, `message`…", '  ')}  readonly vars: Readonly<Record<string, string>>
${jsdoc('Milliseconds from the show until the Out transition starts (includes In).', '  ')}  readonly hold: number
${jsdoc('The In transition.', '  ')}  readonly in: SlTransition
${jsdoc('The Out transition.', '  ')}  readonly out: SlTransition
${jsdoc('Milliseconds already elapsed since the show when it reached the frame.', '  ')}  readonly age: number
${jsdoc('True for a test alert.', '  ')}  readonly test: boolean
${jsdoc('True for a preview alert built from the widget samples.', '  ')}  readonly sample: boolean
${jsdoc('True once the Out transition has started.', '  ')}  readonly leaving: boolean
}

${jsdoc('Options of `sl.sfx.play`.')}interface SlSfxOptions {
  /** 0 to 1; default 0.8. */
  volume?: number
  /** Pitch multiplier, 0.25 to 4. */
  pitch?: number
  /** Milliseconds to wait before playing. */
  delay?: number
  /** -1 (left) to 1 (right). */
  pan?: number
}

${jsdoc(memberDoc('sl.sfx'))}interface SlSfx {
${prop('sl.sfx.names', 'readonly names: readonly SlSfxName[]')}${prop('sl.sfx.enabled', 'readonly enabled: boolean')}${prop('sl.sfx.play', 'play(name: SlSfxName, options?: SlSfxOptions): void')}${prop('sl.sfx.stop', 'stop(): void')}${prop('sl.sfx.tone', 'tone(freq: number, options?: { ms?: number; type?: OscillatorType; volume?: number; delay?: number; glide?: number }): void')}}

${eventMap()}
${jsdoc('An event name for `sl.on`.')}type SlEvent = keyof SlEventMap

${jsdoc(SL_DOC)}interface Sl {
${prop('sl.fields', 'readonly fields: SlFields')}${prop('sl.data', 'readonly data: SlData')}${prop('sl.size', 'readonly size: SlSize')}${prop('sl.theme', 'readonly theme: SlTheme')}${prop('sl.mode', 'readonly mode: SlMode')}${prop('sl.visible', 'readonly visible: boolean')}${prop('sl.muted', 'readonly muted: boolean')}${prop('sl.alert', 'readonly alert: SlAlert | null')}${prop('sl.sfx', 'readonly sfx: SlSfx')}${prop('sl.root', 'readonly root: HTMLElement')}${prop('sl.manual', 'manual: boolean')}${eventOverloads()}${prop('sl.get', 'get(path: string): any')}${prop('sl.render', 'render(): void')}${prop('sl.media', 'media(id: string): string')}${prop('sl.emote', 'emote(id: string): string')}${prop('sl.asset', 'asset(path: string): string')}}

${jsdoc(SL_DOC)}declare const sl: Sl

interface Window {
${jsdoc(SL_DOC, '  ')}  readonly sl: Sl
}
`
}

const SL_DOC = memberDoc('sl')

// WIDGET_DTS: the declarations for a widget's script (a global script
// file: no imports or exports).
export const WIDGET_DTS: string = buildDts()

// ---- per widget ----

// valueType guesses a declaration type from a sample value.
function valueType(v: unknown, depth = 0): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.length && depth < 4 ? `${valueType(v[0], depth + 1)}[]` : 'any[]'
  switch (typeof v) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'object': {
      if (depth >= 4) return 'any'
      const ents = Object.entries(v as Record<string, unknown>)
      if (!ents.length) return '{ readonly [key: string]: any }'
      return `{ ${ents.map(([k, x]) => `readonly ${propName(k)}: ${valueType(x, depth + 1)}`).join('; ')} }`
    }
  }
  return 'any'
}

// keyInfo is the type and doc of one exact data key.
function keyInfo(key: string, sample: unknown, doc?: string): { type: string; doc: string } {
  const e = exact(key)
  if (e) return { type: e.type, doc: doc || e.doc }
  if (key.startsWith('latest.')) return { type: latestType(key.slice(7)), doc: doc || latestDoc(key.slice(7)) }
  if (key.startsWith('leaders.')) {
    const [, m, p] = key.split('.')
    return { type: 'SlLeader[]', doc: doc || leaderDoc(m, p) }
  }
  for (const prefix of ['counter.', 'timer.', 'folders.', 'folder.']) {
    if (key.startsWith(prefix)) {
      const f = family(prefix)
      return { type: f.type, doc: doc || `${f.doc.split('. ')[0]}. Key \`${key}\`.` }
    }
  }
  return { type: sample === undefined ? 'any' : valueType(sample), doc: doc || `The live data key \`${key}\`.` }
}

const clean = (s: string) => s.replace(/\*\//g, '').replace(/\s+/g, ' ')

// contextDts declares the fields and data of one widget. Combined with
// WIDGET_DTS, sl.fields has exactly the widget's fields (typed by kind) and
// sl.data exactly its declared keys, by full key and nested by dots.
export function contextDts(ctx: WidgetContext): string {
  let out = '// The widget being edited.\n\ninterface SlWidgetContext {\n  readonly known: true\n}\n\n'

  out += 'interface SlWidgetFields {\n'
  const seen = new Set<string>()
  for (const f of ctx.fields ?? []) {
    if (!f?.key || seen.has(f.key)) continue
    seen.add(f.key)
    const kind = f.type ? FIELD_KINDS[f.type] : undefined
    const head = [f.label ? `**${clean(f.label)}**` : '', kind ? `(${kind.doc})` : f.type ? `(${f.type})` : ''].filter(Boolean).join(' ')
    const doc = [head || `The field \`${f.key}\`.`, f.doc ?? '', `Template: \`{{${f.key}}}\``].filter(Boolean).join('\n\n')
    out += jsdoc(doc, '  ') + `  readonly ${propName(f.key)}: ${kind?.type ?? 'any'}\n`
  }
  out += '}\n\n'

  // Data: exact keys as properties; wildcards as pattern signatures plus
  // their known members; everything also nested (sl.data.latest.twitch…).
  const flat: string[] = []
  const nested = tree()
  const wild = new Set<string>()
  const seenKeys = new Set<string>()
  const addExact = (key: string, sample: unknown, doc?: string) => {
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    const info = keyInfo(key, sample, doc)
    flat.push(jsdoc(info.doc, '  ') + `  readonly ${propName(key)}?: ${info.type}\n`)
    const segs = key.split('.')
    // nest() in the runtime: dotted keys only, no empty segments.
    if (segs.length > 1 && !segs.some((s) => !s)) plant(nested, segs, info.type, info.doc)
  }
  for (const d of ctx.data ?? []) {
    const key = d?.key
    if (!key) continue
    if (key.endsWith('.*')) {
      const prefix = key.slice(0, -1)
      wild.add(prefix)
      if (prefix === 'latest.') for (const t of LATEST_TYPES) addExact(`latest.${t.type}`, undefined)
      if (prefix === 'leaders.') for (const [m, p] of ALL_LEADERS) addExact(`leaders.${m}.${p}`, undefined)
      // folder.* also brings folders.<field> for every folder field.
      if (prefix === 'folder.') {
        wild.add('folders.')
        for (const f of ctx.fields ?? []) if (f?.type === 'folder' && f.key) addExact(`folders.${f.key}`, undefined)
      }
      continue
    }
    addExact(key, d.sample, d.doc)
    if (key.startsWith('folder.')) for (const f of ctx.fields ?? []) if (f?.type === 'folder' && f.key) addExact(`folders.${f.key}`, undefined)
  }

  out += 'interface SlWidgetData {\n'
  out += flat.join('')
  // Nested roots: a wildcard family's root is open (any name); otherwise
  // only the declared names.
  const roots = new Map(nested.kids)
  for (const prefix of wild) {
    const root = prefix.slice(0, -1)
    if (!roots.has(root)) roots.set(root, tree())
  }
  for (const [root, t] of roots) {
    if (seenKeys.has(root)) continue // an exact key of that name wins (nest() never overwrites it)
    const open = wild.has(root + '.')
    // (| undefined: the declared names are optional properties.)
    const index = open ? (root === 'counter' ? 'number | undefined' : root === 'timer' ? 'SlTimer | undefined' : root === 'folders' || root === 'folder' ? 'SlFolderItem[] | undefined' : 'any') : undefined
    const doc = DATA_FAMILIES.find((f) => f.prefix === root + '.')
    if (doc) out += jsdoc(`Nested by dots. ${doc.doc}`, '  ')
    out += `  readonly ${propName(root)}?: ${treeDts(t, '  ', index)}\n`
  }
  for (const prefix of wild) if (PATTERNS[prefix]) out += pattern(prefix)
  // Computed keys (sl.data['timer.' + name]) are strings, not patterns.
  if (wild.size) out += jsdoc('Any key, by a computed name.', '  ') + '  readonly [key: string]: any\n'
  out += '}\n'
  return out
}
