// effects.ts: how a TextEffects value (types.ts) becomes the CSS of
// StyledText's layers, plus the text splitting of per-letter animations and
// a rough cost score for the editor. Kept free of api.ts like the rest of
// the renderer.
//
// StyledText stacks copies of the same text in one box, bottom first:
//
//   back     highlight band, and the shadows of a clipped fill (gradient,
//            media): text-shadow on a gradient-clipped text would paint over
//            the gradient, so a transparent copy casts them instead
//   outlines outermost first: the text in the outline color with a stroke
//            twice its width (half of it falls inside the glyph); the
//            outermost one carries the shadows of an outlined text as
//            drop-shadow filters, since a stroke casts no text-shadow
//   fill     the text itself (solid color, gradient or media) and its
//            decoration; a solid text with no outlines carries its own
//            shadows and band, so plain looks stay one layer
//   shine    a light band sweeping across the letters (shine animation)
//
// Only properties that don't affect layout differ between the copies, so they
// wrap the same way and stay aligned.
import { mediaFileUrl, noEffects, type TextEffects } from './types.js'

// TextSegment is one run of a text: Alert's accent-colored variables,
// Chat's name and message. Only color may differ from the base look on the
// fill layer; weight applies to every layer (it changes the layout).
export interface TextSegment {
  text: string
  color?: string
  weight?: string
  part?: string // data-part of the run's span (fill layer; not with per-letter effects)
}

const num = (v: unknown, lo: number, hi: number, d = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
// SAFE_COLOR keeps a color from closing the declaration it is written into.
const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s-]+$/
export const cssColor = (c: unknown, fallback: string): string => (typeof c === 'string' && c && SAFE_COLOR.test(c) ? c : fallback)
const px = (n: number) => `${Math.round(n * 100) / 100}px`

// normEffects fills in what a stored value lacks (an overlay saved before a
// field existed, or none at all) and clamps the rest to the Go limits.
export function normEffects(v: unknown): TextEffects {
  const d = noEffects()
  if (!v || typeof v !== 'object') return d
  const x = v as Partial<TextEffects>
  return {
    fill: { ...d.fill, ...x.fill, stops: arr<{ color: string; at: number }>(x.fill?.stops).slice(0, 5) },
    outlines: arr<{ width: number; color: string }>(x.outlines).filter((o) => o && Number(o.width) > 0).slice(0, 2),
    shadows: arr<{ x: number; y: number; blur: number; color: string }>(x.shadows).filter(Boolean).slice(0, 6),
    glow: { ...d.glow, ...x.glow },
    extrude: { ...d.extrude, ...x.extrude },
    highlight: { ...d.highlight, ...x.highlight },
    decoration: { ...d.decoration, ...x.decoration },
    blend: x.blend ?? '',
    layout: { ...d.layout, ...x.layout },
    animation: { ...d.animation, ...x.animation },
  }
}

// Animations. Speeds are seconds per cycle; typewriter's is the time to type
// the whole text (0: by its length, see typeSeconds).
export const LETTER_ANIMATIONS = new Set(['wave', 'bounce', 'jitter'])
const WHOLE_ANIMATIONS = new Set(['pulse', 'float', 'shake'])
const DEFAULT_SPEED: Record<string, number> = {
  pulse: 1.6,
  float: 3,
  shake: 0.6,
  shine: 2.8,
  rainbow: 4,
  wave: 1.6,
  bounce: 1.4,
  jitter: 0.5,
  typewriter: 0,
}

export const typeSeconds = (speed: number, letters: number) => speed || Math.min(3, Math.max(0.5, letters * 0.06))

const RAINBOW = 'linear-gradient(90deg, #ff4d4d, #ffb84d, #f5ff4d, #4dff88, #4dd8ff, #8a4dff, #ff4dd2, #ff4d4d, #ffb84d, #f5ff4d, #4dff88, #4dd8ff, #8a4dff, #ff4dd2, #ff4d4d)'

// fillImage is the CSS background of a clipped fill, or '' for a solid one.
function fillImage(e: TextEffects): string {
  const f = e.fill
  const stops = f.stops.filter((s) => s && s.color)
  if ((f.kind === 'linear' || f.kind === 'radial') && stops.length >= 2) {
    const list = stops.map((s) => `${cssColor(s.color, '#ffffff')} ${num(s.at, 0, 100)}%`).join(', ')
    return f.kind === 'linear' ? `linear-gradient(${num(f.angle, -360, 360, 90)}deg, ${list})` : `radial-gradient(ellipse at center, ${list})`
  }
  if (f.kind === 'media' && f.media) return `url("${mediaFileUrl(f.media)}") center / cover no-repeat`
  return ''
}

export interface Look {
  color: string // the widget's text color: solid fill, default glow and decoration color
  size: number // font size in px
}

export interface PlanOptions {
  motion: boolean // animations play (not in thumbnails, not in chat lines)
  oneLine: boolean // the text is cut to one line with an ellipsis
}

// Plan is what StyledText draws: one style string per layer (null: no such
// layer) and what the text box and letters need.
export interface Plan {
  fx: string // the effects box: skew, stretch, blend, writing mode, timing variables
  anim: string // the animation class ('a-wave'…), '' for none
  letters: boolean // split the text into letter spans
  pos: boolean // move letters with top/left: a transform inside background-clip:text breaks the clip
  clip: boolean // the fill is an image clipped to the letters (segment colors don't apply)
  hue: boolean // rainbow over a gradient or media fill: cycle its hue
  back: string | null
  outlines: string[] // outermost first
  fill: string
  shine: string | null
  band: { layout: string; paint: string } | null // highlight span style: on every layer, painted on one
  bandOn: 'back' | 'fill' | null
  reach: number // px the drawing reaches beyond the glyphs (clip margin of cut text)
  speed: number // seconds per cycle
  amp: number // intensity / 5
}

// planEffects turns e into the layer styles of StyledText.
export function planEffects(e: TextEffects, look: Look, opt: PlanOptions): Plan {
  const kind = opt.motion ? e.animation.kind || '' : ''
  const speed = kind === 'typewriter' ? num(e.animation.speed, 0, 20) : num(e.animation.speed, 0.2, 20, 0) || DEFAULT_SPEED[kind] || 1
  const amp = (num(e.animation.intensity, 0, 10) || 5) / 5
  const base = cssColor(look.color, '#ffffff')

  // Fill.
  let image = fillImage(e)
  let rainbowFill = false
  if (e.animation.kind === 'rainbow' && !image) {
    // Rainbow over a solid color: a rainbow gradient, sliding when animated.
    image = RAINBOW
    rainbowFill = true
  }
  const clip = image !== ''
  const hue = kind === 'rainbow' && clip && !rainbowFill
  let fill = clip
    ? `color: transparent; background: ${image}; -webkit-background-clip: text; background-clip: text;${rainbowFill ? ' background-size: 200% 100%;' : ''}`
    : `color: ${base};`
  const dec = e.decoration
  if (dec.line && dec.line !== 'none') {
    const parts = [dec.line, dec.style || 'solid', dec.color ? cssColor(dec.color, 'currentColor') : '', dec.thickness > 0 ? px(num(dec.thickness, 0, 50)) : '']
    fill += ` --deco: ${parts.filter(Boolean).join(' ')};`
    if (dec.offset) fill += ` text-underline-offset: ${px(num(dec.offset, -50, 50))};`
  }

  // Shadows, glow and extrude: text-shadows (first on top) or, on an
  // outlined text, drop-shadow filters (each also shadows the ones before).
  const outlines = e.outlines.map((o) => ({ w: num(o.width, 0, 50), c: cssColor(o.color, '#000000') })).filter((o) => o.w > 0)
  const filtered = outlines.length > 0
  const shadows: string[] = []
  const ex = e.extrude
  const depth = Math.round(num(ex.depth, 0, 60))
  if (depth > 0) {
    const a = (num(ex.angle, -360, 360, 135) * Math.PI) / 180
    const dx = Math.sin(a)
    const dy = Math.cos(a)
    const c = cssColor(ex.color, '#000000a0')
    if (filtered) {
      // Each pass doubles the block: offsets 0..m, then 0..2m+1, and so on.
      for (let m = 0; m < depth; ) {
        const s = Math.min(m + 1, depth - m)
        shadows.push(`${px(dx * s)} ${px(dy * s)} 0 ${c}`)
        m += s
      }
    } else for (let i = 1; i <= depth; i++) shadows.push(`${px(dx * i)} ${px(dy * i)} 0 ${c}`)
  }
  const g = e.glow
  const glowSize = num(g.size, 0, 200)
  if (glowSize > 0) {
    const n = Math.round(num(g.strength, 1, 5, 1))
    const c = cssColor(g.color, base)
    for (let k = 1; k <= n; k++) shadows.push(`0 0 ${px((glowSize * k) / n)} ${c}`)
  }
  for (const s of e.shadows) shadows.push(`${px(num(s.x, -200, 200))} ${px(num(s.y, -200, 200))} ${px(num(s.blur, 0, 200))} ${cssColor(s.color, '#000000a6')}`)
  const shadowCSS = shadows.length ? (filtered ? `filter: ${shadows.map((s) => `drop-shadow(${s})`).join(' ')};` : `text-shadow: ${shadows.join(', ')};`) : ''

  // Highlight band: padding on every layer's span (same wrapping), color on
  // the lowest layer.
  const h = e.highlight
  const bandColor = h.color ? cssColor(h.color, '') : ''
  let band: Plan['band'] = null
  if (bandColor && !/^#[0-9a-fA-F]{6}00$|^transparent$/.test(bandColor)) {
    const layout = `padding: ${px(num(h.padY, 0, 200))} ${px(num(h.padX, 0, 200))}; -webkit-box-decoration-break: clone; box-decoration-break: clone;`
    band = { layout, paint: `${layout} background: ${bandColor}; border-radius: ${px(num(h.radius, 0, 200))};` }
  }

  // Which layer carries the shadows and the band.
  const shadowsOnFill = !!shadowCSS && !filtered && !clip
  const shadowsOnBack = !!shadowCSS && !filtered && clip
  const bandOn: Plan['bandOn'] = band ? (!clip && !filtered ? 'fill' : 'back') : null
  if (shadowsOnFill) fill += ` ${shadowCSS}`
  const back = shadowsOnBack || bandOn === 'back' ? `color: transparent; ${shadowsOnBack ? shadowCSS : ''}` : null

  // Outlines: the outermost covers the total width.
  const outlineCSS: string[] = []
  let total = outlines.reduce((t, o) => t + o.w, 0)
  for (let k = outlines.length - 1; k >= 0; k--) {
    const o = outlines[k]
    let s = `color: ${o.c}; -webkit-text-stroke: ${px(total * 2)} ${o.c};`
    if (k === outlines.length - 1 && filtered && shadowCSS) s += ` ${shadowCSS}`
    outlineCSS.push(s)
    total -= o.w
  }

  const shine =
    kind === 'shine'
      ? `color: transparent; background: linear-gradient(105deg, transparent 0 40%, rgba(255, 255, 255, ${Math.min(1, 0.3 + amp * 0.3).toFixed(2)}) 50%, transparent 60% 100%) 100% 0 / 300% 100% no-repeat; -webkit-background-clip: text; background-clip: text;`
      : null

  // The effects box.
  const L = e.layout
  const tf: string[] = []
  const skew = num(L.skew, -45, 45)
  const stretch = num(L.stretch, 0, 200) || 100
  if (skew) tf.push(`skewX(${-skew}deg)`)
  const sx = Math.max(50, stretch) / 100
  if (sx !== 1) tf.push(`scaleX(${sx})`)
  let fx = `--sp: ${speed}s; --amp: ${amp};`
  if (tf.length) fx += ` transform: ${tf.join(' ')};`
  // Stretched text wraps at the width it will have once stretched.
  if (sx !== 1) fx += ` max-width: ${(100 / sx).toFixed(3)}%;`
  if (e.blend && e.blend !== 'normal' && /^[a-z-]+$/.test(e.blend)) fx += ` mix-blend-mode: ${e.blend};`
  if (L.vertical) fx += ' writing-mode: vertical-rl;'
  if (L.balance) fx += ' text-wrap: balance;'

  const letterAnim = LETTER_ANIMATIONS.has(kind)
  let reach = outlines.reduce((t, o) => t + o.w, 0) + glowSize + depth
  for (const s of e.shadows) reach = Math.max(reach, Math.max(Math.abs(num(s.x, -200, 200)), Math.abs(num(s.y, -200, 200))) + num(s.blur, 0, 200))
  if (band) reach += Math.max(num(h.padX, 0, 200), num(h.padY, 0, 200))
  if (letterAnim || WHOLE_ANIMATIONS.has(kind)) reach += look.size * 0.5 * amp

  return {
    fx,
    anim: kind && kind !== 'none' ? `a-${kind}` : '',
    letters: letterAnim || kind === 'typewriter',
    pos: letterAnim && clip,
    clip,
    hue,
    back,
    outlines: outlineCSS,
    fill,
    shine,
    band,
    bandOn,
    reach: Math.ceil(reach + 2),
    speed,
    amp,
  }
}

// ---- Letters ----

export interface Letter {
  ch: string
  i: number // index among the letters (stagger)
  r: number // a fixed pseudo-random 0–1 (jitter)
  color?: string
  weight?: string
}

// A Token is whitespace (a line can break there) or a word, whose letters
// stay together on one line.
export type Token = { ws: string; letters?: undefined } | { ws?: undefined; letters: Letter[] }

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const graphemes = (s: string): string[] => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s))

// splitLetters splits segments into words of graphemes, across segment
// boundaries ("{user}!" stays one word).
export function splitLetters(segs: TextSegment[]): { tokens: Token[]; count: number } {
  const tokens: Token[] = []
  let i = 0
  for (const s of segs) {
    for (const ch of graphemes(s.text)) {
      const last = tokens[tokens.length - 1]
      if (/^\s+$/.test(ch)) {
        if (last?.ws !== undefined) last.ws += ch
        else tokens.push({ ws: ch })
        continue
      }
      const l: Letter = { ch, i, r: ((i * 9301 + 49297) % 233280) / 233280, color: s.color, weight: s.weight }
      i++
      if (last?.letters) last.letters.push(l)
      else tokens.push({ letters: [l] })
    }
  }
  return { tokens, count: i }
}

// ---- Cost ----

// HEAVY_COST is the effectsCost above which the editor warns that a look may
// strain the streaming PC's GPU.
export const HEAVY_COST = 40

// effectsCost is a rough GPU cost score of e on text of size px: blurred
// shadow and glow layers weighted by their radius, the copies drawn, scaled
// by the text size, plus the animations that repaint every frame (letters
// moved inside a clipped fill relayout; shine and rainbow repaint).
export function effectsCost(e: TextEffects, size: number): number {
  const x = normEffects(e)
  const p = planEffects(x, { color: '#ffffff', size }, { motion: true, oneLine: false })
  const f = Math.min(4, Math.max(0.25, (Number(size) || 32) / 64))
  let blur = 0
  for (const s of x.shadows) blur += 1 + num(s.blur, 0, 200) / 8
  if (x.glow.size > 0) blur += num(x.glow.strength, 1, 5, 1) * (1 + num(x.glow.size, 0, 200) / 8)
  const depth = num(x.extrude.depth, 0, 60)
  if (depth > 0) blur += p.outlines.length ? Math.ceil(Math.log2(depth + 1)) : depth * 0.1
  if (p.outlines.length) blur *= 1.5 // filter passes over a whole layer
  const layers = 1 + p.outlines.length + (p.back !== null ? 1 : 0) + (p.shine !== null ? 1 : 0) + (x.fill.kind === 'media' ? 1 : 0)
  let anim = 0
  if (p.letters && LETTER_ANIMATIONS.has(x.animation.kind)) anim += 6 + (p.pos ? 6 + blur * f * 0.5 : 0)
  if (x.animation.kind === 'shine' || (x.animation.kind === 'rainbow' && !p.hue)) anim += 3 + layers
  if (p.hue) anim += 2
  return Math.round((layers + blur) * f + anim)
}
