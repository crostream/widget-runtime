// api.test.ts: the self-checks of the sl API model (what the app's
// scripts/check-widget-api.mjs did): the declarations compile strict, the
// cookbook widgets type-check, narrowing and the script problems work, every
// documented member exists, snippets and examples compile, templates read
// data like sl.data and the editor's checker agrees with the runtime.
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  CSS_VARS,
  EVENTS,
  LATEST_TYPES,
  SFX_NAMES,
  SL,
  SL_EVENT_NAMES,
  SNIPPETS,
  TEMPLATE,
  TYPE_VARS,
  USER_VARS,
  WIDGET_DTS,
  WIDGET_ICONS,
  contextDts,
  flatMembers,
  sampleVarsFor,
  scriptProblems,
  type WidgetContext,
} from '../src/api/index.js'
import { compile, lookup, nest, render } from '../src/frame/template.js'
import { checkTemplate } from '../src/tooling/template.js'
import { typeCheck, VIRTUAL_CONTEXT as C, VIRTUAL_DTS as D, VIRTUAL_SCRIPT as J } from '../src/tooling/check.js'
import { COOKBOOK, KITCHEN } from './fixtures/cookbook.js'

const strict = { strict: true }

describe('declarations', () => {
  it('WIDGET_DTS compiles strict', () => {
    expect(typeCheck({ [D]: WIDGET_DTS }, strict)).toEqual([])
  })
  for (const w of [...COOKBOOK, { name: 'kitchen sink', ctx: KITCHEN }, { name: 'empty', ctx: { fields: [], data: [] } }]) {
    it(`WIDGET_DTS + contextDts(${w.name}) compile strict`, () => {
      expect(typeCheck({ [D]: WIDGET_DTS, [C]: contextDts(w.ctx) }, strict)).toEqual([])
    })
  }
  it('has doc comments on the declarations', () => {
    expect((WIDGET_DTS.match(/\/\*\*/g) ?? []).length).toBeGreaterThan(100)
  })
})

describe('cookbook scripts', () => {
  for (const w of COOKBOOK) {
    it(`${w.name}: script + context`, () => {
      expect(typeCheck({ [D]: WIDGET_DTS, [C]: contextDts(w.ctx), [J]: w.js })).toEqual([])
    })
    it(`${w.name}: script, no context`, () => {
      expect(typeCheck({ [D]: WIDGET_DTS, [J]: w.js })).toEqual([])
    })
  }
})

describe('typed reads', () => {
  it('kitchen sink reads', () => {
    const js = `/** @type {string} */ let s
/** @type {number} */ let n
/** @type {boolean} */ let b
s = sl.fields.f_text; s = sl.fields.f_color; s = sl.fields.f_folder; n = sl.fields.f_number; b = sl.fields.f_bool
s = sl.data.chat[0].emotes[0].name
s = sl.data.events[0].summary
n = sl.data.stream.viewers
s = sl.data.credits.gifters[0].user
n = sl.data.hypetrain.level
b = sl.data.poll.choices[0].winner
s = sl.data.prediction.choices[0].color
s = sl.data.latest.twitch.cheer.vars.bits
s = sl.data['latest.twitch.sub'].vars.gifter
s = sl.data['latest.something.new'].vars.user
s = sl.data.latest.steam.game_started.vars.game
n = sl.data.counter.subs
n = sl.data['counter.deaths']
n = sl.data.timer.anything.remainingMs
s = sl.data['timer.My Timer'].mode
n = sl.data.leaders.bits.stream[0].value
s = sl.data.folders.f_folder[0].kind
n = sl.data['folder.folder-01abc'][0].width
n = sl.data.custom.thing.a
b = sl.data['custom.thing']['c-d'].e
sl.on('cue', (c) => { n = c.n + c.at })
sl.on('size', ({ w, h }) => { n = w + h })
sl.on('theme', (t) => { s = t.colors.highlight + t.fonts.heading })
sl.on('muted', (m) => { b = m })
sl.on('show', () => {})
sl.on('hide', () => {})
const off = sl.on('fields', (f) => { n = f.f_number })
off()
sl.manual = true
sl.render()
s = sl.media(sl.fields.f_media) + sl.emote('25') + sl.mode
b = sl.visible && sl.muted
n = window.sl.size.w
sl.root.append(document.createElement('div'))
`
    expect(typeCheck({ [D]: WIDGET_DTS, [C]: contextDts(KITCHEN), [J]: js })).toEqual([])
  })
})

describe('narrowing', () => {
  const chatCtx = contextDts(COOKBOOK[0].ctx)
  const code = (diags: string[], n: number) => expect(diags.some((d) => d.includes(`TS${n}`)), diags.join('; ') || 'no diagnostics').toBe(true)
  it('unknown field is an error', () => code(typeCheck({ [D]: WIDGET_DTS, [C]: chatCtx, [J]: 'sl.fields.nope\n' }), 2339))
  it('undeclared data key is an error', () => code(typeCheck({ [D]: WIDGET_DTS, [C]: chatCtx, [J]: 'sl.data.events\n' }), 2339))
  it('unknown event is an error', () => code(typeCheck({ [D]: WIDGET_DTS, [J]: "sl.on('nope', () => {})\n" }), 2769))
  it('misspelt chat property is an error', () => code(typeCheck({ [D]: WIDGET_DTS, [J]: 'sl.data.chat[0].usr\n' }), 2551))
  it('field type is checked', () => code(typeCheck({ [D]: WIDGET_DTS, [C]: chatCtx, [J]: '/** @type {string} */ const x = sl.fields.count\n' }), 2322))
  it('sl is read-only', () => code(typeCheck({ [D]: WIDGET_DTS, [J]: 'sl.mode = "editor"\n' }), 2540))
  it('for...of over the DOM iterables is clean', () => {
    const js = "for (const el of sl.root.querySelectorAll('li')) el.remove()\nfor (const [k, v] of new FormData().entries()) void [k, v]\n"
    expect(typeCheck({ [D]: WIDGET_DTS, [J]: js })).toEqual([])
  })
})

describe('scriptProblems', () => {
  const problems = (js: string, ctx?: WidgetContext) => scriptProblems(ts, ts.createSourceFile('w.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS), ctx)
  const one = (js: string, ctx: WidgetContext | undefined, re: RegExp) => {
    const ps = problems(js, ctx)
    expect(ps).toHaveLength(1)
    expect(ps[0].message).toMatch(re)
    expect(js.slice(ps[0].from, ps[0].to).length).toBeGreaterThan(2)
  }
  const ctx: WidgetContext = { fields: [{ key: 'pics', type: 'folder' }], data: [{ key: 'counter.subs' }, { key: 'timer.*' }, { key: 'latest.*' }, { key: 'folder.*' }] }
  it('flags an unknown event', () => one("sl.on('cue2', () => {})\n", undefined, /Unknown event "cue2".*Did you mean 'cue'/))
  it('flags an unknown event via window.sl', () => one('window.sl.on(`nope`, () => {})\n', ctx, /Unknown event "nope"/))
  it('knows every event', () => expect(problems(EVENTS.map((e) => `sl.on('${e.name}', () => {})`).join('\n'), ctx)).toEqual([]))
  it('flags an undeclared bracket key', () => one("const n = sl.data['counter.sbus']\n", ctx, /doesn't read data "counter\.sbus".*'counter\.subs'/))
  it('accepts declared and family bracket keys', () => {
    const js = "void [sl.data['counter.subs'], sl.data['counter'], sl.data['timer.My Timer'], sl.data['latest.twitch.follow'], sl.data['folders.pics'], sl.data['folder.folder-01abc'], sl.data['x' + 1]]\n"
    expect(problems(js, ctx)).toEqual([])
  })
  it('needs a declaration for a bracket key', () => one("sl.data['chat']\n", ctx, /doesn't read data "chat"/))
  it('leaves bracket keys unchecked without a context', () => expect(problems("sl.data['anything.at.all']\n", undefined)).toEqual([]))
})

describe('the model', () => {
  const members = flatMembers(SL).filter((m) => m.path !== 'sl')
  it(`${members.length} member paths resolve on sl`, () => {
    const paths = members.map((m) => `void (${m.path})`).join('\n')
    expect(typeCheck({ [D]: WIDGET_DTS, [J]: paths + '\n' }, strict)).toEqual([])
  })
  it('every member is declared and documented', () => {
    for (const m of members) {
      expect(new RegExp(`\\b${m.name}\\b`).test(WIDGET_DTS), `${m.path} not in WIDGET_DTS`).toBe(true)
      expect(m.doc, `${m.path} has no doc`).toBeTruthy()
    }
  })
  it('every event has an sl.on overload', () => {
    for (const e of EVENTS) expect(WIDGET_DTS, e.name).toContain(`on(event: '${e.name}'`)
  })
  it('the event list the frame fires is the documented one', () => {
    expect(EVENTS.map((e) => e.name)).toEqual([...SL_EVENT_NAMES])
  })
  it('CSS vars are named --sl-*', () => {
    for (const v of CSS_VARS) expect(v.name).toMatch(/^--sl-[a-z-]+$/)
  })
  it('examples parse', () => {
    const parses = (code: string) => ts.createSourceFile('x.js', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS) as ts.SourceFile & { parseDiagnostics: ts.Diagnostic[] }
    for (const m of flatMembers(SL)) if (m.example) expect(parses(m.example).parseDiagnostics, m.path).toEqual([])
    for (const e of EVENTS) if (e.example) expect(parses(e.example).parseDiagnostics, e.name).toEqual([])
  })
  it('names the sfx presets and icons', () => {
    expect(SFX_NAMES.length).toBeGreaterThan(10)
    expect(WIDGET_ICONS).toContain('sparkle')
    expect(new Set(WIDGET_ICONS).size).toBe(WIDGET_ICONS.length)
  })
})

describe('snippets and examples', () => {
  // desnip mirrors @codemirror/autocomplete's Snippet.parse: fields become
  // their names, then \{ and \} become braces.
  const desnip = (body: string) =>
    body
      .split('\n')
      .map((line) => {
        let m
        while ((m = /[#$]\{(?:(\d+)(?::([^{}]*))?|((?:\\[{}]|[^{}])*))\}/.exec(line))) {
          const name = (m[2] || m[3] || '').replace(/\\[{}]/g, (x) => x[1])
          line = line.slice(0, m.index) + name + line.slice(m.index + m[0].length)
        }
        return line.replace(/\\([{}])/g, '$1')
      })
      .join('\n')
  it(`${SNIPPETS.length} snippets are sound`, () => {
    for (const s of SNIPPETS) {
      const code = desnip(s.body)
      if (s.lang === 'js') expect(typeCheck({ [D]: WIDGET_DTS, [J]: code }), `snippet js "${s.label}"`).toEqual([])
      else if (s.lang === 'html') expect(() => compile(code), `snippet html "${s.label}"`).not.toThrow()
      else if (/[{}]/.test(code)) expect(code.split('{').length, `snippet css "${s.label}": unbalanced braces`).toBe(code.split('}').length)
    }
  })
  it(`${TEMPLATE.length} template constructs compile`, () => {
    for (const t of TEMPLATE) expect(() => compile(t.example), `TEMPLATE ${t.syntax}`).not.toThrow()
  })
})

describe('templates read data like sl.data', () => {
  const flat = {
    'counter.subs': 7,
    'counter.deaths': 3,
    'latest.twitch.follow': { vars: { user: 'ana' }, time: 't' },
    'latest.twitch': 'a whole key',
    stream: { title: 'Hi' },
  }
  const roots = { fields: {}, data: flat, theme: {}, size: { w: 1, h: 1 }, mode: 'output', visible: true } as never
  const nested = nest(flat)
  const cases: [string, string][] = [
    ['{{data.counter.subs}}', '7'],
    ['{{data.latest.twitch.follow.vars.user}}', 'ana'],
    ['{{data.stream.title}}', 'Hi'],
    ['{{#each data.counter as n}}{{@key}}={{n}};{{/each}}', 'subs=7;deaths=3;'],
    ['{{#if data.counter}}yes{{/if}}', 'yes'],
    ['{{data.counter.nope}}', ''],
    ['{{alert.vars.user}}|{{@alert.type}}', '|'],
  ]
  for (const [src, want] of cases) it(`renders ${src}`, () => expect(render(compile(src), roots, nested)).toBe(want))
  it('sl.get reads the same', () => {
    expect(lookup('data.counter.subs', roots, [], nested)).toBe(7)
    expect(lookup('data.latest.twitch.follow.vars.user', roots, [], nested)).toBe('ana')
  })
  it('the alert root: a live alert reads as alert.vars.user, @alert is always the alert, a field named alert wins', () => {
    const live = { vars: { user: 'bo' }, type: 'twitch.follow' }
    const a = { ...(roots as object), alert: live } as never
    const aCases: [never, string, string][] = [
      [a, '{{alert.vars.user}}|{{@alert.type}}|{{#if alert}}y{{/if}}', 'bo|twitch.follow|y'],
      [{ ...(a as object), fields: { alert: { vars: { user: 'field' } } } } as never, '{{alert.vars.user}}|{{@alert.vars.user}}', 'field|bo'],
      [roots, '{{#if alert}}y{{else}}n{{/if}}', 'n'],
    ]
    for (const [r, src, want] of aCases) expect(render(compile(src), r, nested), src).toBe(want)
    expect(checkTemplate('{{alert.vars.user}}{{@alert.type}}', { fields: [], data: [] })).toEqual([])
  })
  it('the editor template check agrees', () => {
    const ctx: WidgetContext = { fields: [{ key: 'pics', type: 'folder' }], data: [{ key: 'counter.*' }, { key: 'latest.twitch.follow' }, { key: 'folder.*' }] }
    const clean = '{{data.counter}}{{data.counter.subs}}{{#each data.counter as n}}{{n}}{{/each}}{{data.latest.twitch}}{{data.latest.twitch.follow.vars.user}}{{#each data.folders.pics as m}}{{m.id}}{{/each}}'
    expect(checkTemplate(clean, ctx)).toEqual([])
    expect(checkTemplate('{{data.countr.subs}}{{data.latest.twitch.raid}}', ctx)).toHaveLength(2)
  })
})

describe('sample vars', () => {
  it('TYPE_VARS covers every var of every LATEST_TYPES event and names no unknown type', () => {
    const known = new Set(LATEST_TYPES.map((t) => t.type))
    for (const t of LATEST_TYPES) {
      if (!t.vars.length) continue
      const have = TYPE_VARS[t.type]
      expect(have, `${t.type} has vars [${t.vars.join(', ')}] but no TYPE_VARS entry`).toBeDefined()
      expect(t.vars.filter((v) => !(v in have)), `TYPE_VARS['${t.type}'] lacks`).toEqual([])
    }
    for (const t of Object.keys(TYPE_VARS)) expect(known.has(t), `TYPE_VARS has '${t}', which is not in LATEST_TYPES`).toBe(true)
  })
  it('sampleVarsFor lays manifest samples over the type', () => {
    expect(sampleVarsFor('twitch.follow')).toMatchObject({ ...USER_VARS, summary: 'followed' })
    expect(sampleVarsFor('twitch.follow', { user: 'Ana' }).user).toBe('Ana')
    expect(sampleVarsFor('nope.unknown')).toEqual({ user: 'SampleUser', summary: 'did something', amount: '1' })
  })
})
