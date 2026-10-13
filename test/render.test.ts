// render.test.ts: the renderer's pure functions (no Svelte involved).
import { describe, expect, it } from 'vitest'
import { normEffects, planEffects, typeSeconds, splitLetters } from '../src/render/effects.js'
import { frameDraws, normFrame, geometry, frameColor } from '../src/render/frame.js'
import { fullTheme, resolveProps, resolveRefs, schemaOfFields, themeValue } from '../src/render/themecore.js'
import { DEFAULT_THEME, noEffects, noFrame } from '../src/render/types.js'
import { iconColor, isIconKind } from '../src/render/icons.js'

describe('effects', () => {
  it('normEffects fills what is missing', () => {
    expect(normEffects(undefined)).toEqual(noEffects())
    expect(normEffects({ glow: { size: 4 } }).glow).toEqual({ size: 4, strength: 0, color: '' })
  })
  it('normEffects clamps lists to the Go limits', () => {
    const e = normEffects({
      outlines: [{ width: 0, color: 'red' }, { width: 1, color: 'a' }, { width: 2, color: 'b' }, { width: 3, color: 'c' }],
      shadows: Array.from({ length: 9 }, () => ({ x: 1, y: 1, blur: 1, color: 'black' })),
    })
    expect(e.outlines.map((o) => o.color)).toEqual(['a', 'b']) // zero widths dropped, at most 2
    expect(e.shadows).toHaveLength(6)
  })
  it('planEffects of no effects draws a plain fill', () => {
    const p = planEffects(noEffects(), { color: '#fff', size: 40 }, { motion: true, oneLine: false })
    expect(p.anim).toBe('')
    expect(p.letters).toBe(false)
    expect(p.outlines).toEqual([])
    expect(p.back).toBeNull()
    expect(p.fill).toContain('#fff')
  })
  it('planEffects animates only with motion', () => {
    const e = normEffects({ animation: { kind: 'wave', speed: 0, intensity: 0 } })
    expect(planEffects(e, { color: '#fff', size: 40 }, { motion: true, oneLine: false }).anim).toBe('a-wave')
    expect(planEffects(e, { color: '#fff', size: 40 }, { motion: false, oneLine: false }).anim).toBe('')
  })
  it('letters split words and keep the spaces', () => {
    const { tokens, count } = splitLetters([{ text: 'hi yo' }] as never)
    expect(count).toBe(4)
    expect(tokens.length).toBe(3)
  })
  it('typeSeconds is the explicit speed, else bounded by the length', () => {
    expect(typeSeconds(2, 100)).toBe(2)
    expect(typeSeconds(0, 1)).toBeLessThanOrEqual(3)
  })
})

describe('frame', () => {
  it('normFrame fills and clamps', () => {
    expect(normFrame(null)).toEqual(noFrame())
    expect(normFrame({ padding: 99999 }).padding).toBe(2000)
    expect(normFrame({ shape: { slant: 90 } }).shape.slant).toBe(45)
  })
  it('the zero frame draws nothing and a filled one does', () => {
    expect(frameDraws(noFrame())).toBe(false)
    const f = normFrame({ fill: { kind: 'solid', color: '#123456' } })
    expect(frameDraws(f)).toBe(true)
    expect(geometry(f, 100, 50).kind).toBeTruthy()
  })
  it('frameColor refuses a value that could close the declaration', () => {
    expect(frameColor('#fff', 'x')).toBe('#fff')
    expect(frameColor('red; background:url(x)', 'x')).toBe('x')
    expect(frameColor(5, 'x')).toBe('x')
  })
})

describe('theme', () => {
  it('fullTheme fills missing keys and ignores chained references', () => {
    const t = fullTheme({ colors: { accent: '#010203', primary: 'theme:accent' }, fonts: { body: '   ' } })
    expect(t.colors.accent).toBe('#010203')
    expect(t.colors.primary).toBe(DEFAULT_THEME.colors.primary)
    expect(t.fonts.body).toBe(DEFAULT_THEME.fonts.body)
    expect(fullTheme(null)).toEqual(fullTheme(undefined))
  })
  it('references resolve to theme colors and fonts; unknown ones to transparent', () => {
    const t = fullTheme({ colors: { accent: '#010203' }, fonts: { heading: 'Impact' } })
    expect(themeValue('theme:accent', t)).toBe('#010203')
    expect(themeValue('theme:heading', t)).toBe('Impact')
    expect(themeValue('theme:nope', t)).toBe('#00000000')
  })
  it('resolveRefs walks objects and arrays and keeps untouched values', () => {
    const t = fullTheme({ colors: { accent: '#010203' }, fonts: {} })
    const v = { a: 'theme:accent', list: ['x', 'theme:accent'], n: 1 }
    expect(resolveRefs(v, t)).toEqual({ a: '#010203', list: ['x', '#010203'], n: 1 })
    const plain = { a: 'x', b: [1, 2] }
    expect(resolveRefs(plain, t)).toBe(plain)
  })
  it('resolveProps resolves only the schema kinds', () => {
    const t = fullTheme({ colors: { accent: '#010203' }, fonts: {} })
    const schema = schemaOfFields([
      { key: 'color', kind: 'color' },
      { key: 'text', kind: 'text' },
      { key: 'rows', kind: 'items', item: [{ key: 'tint', kind: 'color' }, { key: 'label', kind: 'text' }] },
    ])
    const out = resolveProps({ color: 'theme:accent', text: 'theme:accent', rows: [{ tint: 'theme:accent', label: 'theme:accent' }] }, t, schema)
    expect(out).toEqual({ color: '#010203', text: 'theme:accent', rows: [{ tint: '#010203', label: 'theme:accent' }] })
    const props = { color: 'theme:accent' }
    expect(resolveProps(props, t, undefined)).toBe(props)
  })
})

describe('icons', () => {
  it('knows its kinds and colors', () => {
    expect(isIconKind('twitch')).toBe(true)
    expect(isIconKind('nope')).toBe(false)
    expect(iconColor('heart', '#fff')).toBe('#fff')
  })
})
