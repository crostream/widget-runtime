// frame.ts: the geometry and paint plan of a FrameStyle (types.ts), drawn by
// FrameBox, plus a rough cost score for the editor. Kept free of api.ts like
// the rest of the renderer.
//
// A frame is one SVG over its box, in canvas pixels (the stage scales it, so
// it stays crisp at any zoom). Every outline (fill, border, rings, inner and
// outer shadows with spread) is the same shape offset inward or outward by
// some distance: the shape is a polygon whose corners carry a radius (or,
// for the ticket, a rectangle with round bites), and offsetting moves each
// edge along its normal and grows or shrinks the corner radii, so a ring
// around a slanted, notched or rounded panel stays parallel to it.
import { mediaFileUrl, noFrame, type FrameStyle } from './types.js'

const num = (v: unknown, lo: number, hi: number, d = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const quad = (v: unknown): [number, number, number, number] => {
  const a = arr<number>(v)
  return [0, 1, 2, 3].map((i) => num(a[i], 0, 2000)) as [number, number, number, number]
}
// SAFE_COLOR keeps a color from closing the attribute or declaration it is
// written into.
const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s-]+$/
export const frameColor = (c: unknown, fallback: string): string => (typeof c === 'string' && c && SAFE_COLOR.test(c) ? c : fallback)
const r2 = (n: number) => Math.round(n * 100) / 100

// normFrame fills in what a stored value lacks (an overlay saved before a
// field existed, or no frame at all) and clamps the rest to the Go limits.
export function normFrame(v: unknown): FrameStyle {
  const d = noFrame()
  if (!v || typeof v !== 'object') return d
  const x = v as Partial<FrameStyle>
  const sh = x.shape ?? d.shape
  return {
    shape: {
      kind: sh.kind ?? '',
      radius: quad(sh.radius),
      slant: num(sh.slant, -45, 45),
      notch: { ...d.shape.notch, ...sh.notch },
      pointer: { ...d.shape.pointer, ...sh.pointer },
      points: num(sh.points, 0, 12),
      inner: num(sh.inner, 0, 90),
    },
    fill: {
      ...d.fill,
      ...x.fill,
      stops: arr<{ color: string; at: number }>(x.fill?.stops).filter((s) => s && s.color),
      pattern: { ...d.fill.pattern, ...x.fill?.pattern },
    },
    border: { ...d.border, ...x.border, stops: arr<{ color: string; at: number }>(x.border?.stops).filter((s) => s && s.color) },
    rings: arr<FrameStyle['rings'][number]>(x.rings).filter((r) => r && Number(r.width) > 0).slice(0, 2),
    brackets: { ...d.brackets, ...x.brackets },
    shadows: arr<FrameStyle['shadows'][number]>(x.shadows).filter(Boolean).slice(0, 4),
    glow: { ...d.glow, ...x.glow },
    bevel: { ...d.bevel, ...x.bevel },
    texture: { ...d.texture, ...x.texture },
    image: { ...d.image, ...x.image, slice: quad(x.image?.slice), width: quad(x.image?.width) },
    animation: { ...d.animation, ...x.animation },
    padding: num(x.padding, 0, 2000),
  }
}

// ---- Geometry ----

export interface Pt {
  x: number
  y: number
}
interface Vtx extends Pt {
  r: number // corner radius, 0 = sharp
}

// Geom is a frame's outline in its box: a polygon with rounded corners, or a
// ticket (a rectangle with a round bite out of the middle of its left and
// right edges). body is the rectangle the panel itself takes: the box less
// the room a bubble's pointer or a tab takes.
export type Geom =
  | { kind: 'poly'; pts: Vtx[]; body: Box; key?: string }
  | { kind: 'ticket'; body: Box; r: number; bite: number }

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

// Insets are what content keeps clear of on each side, beyond padding.
export interface Insets {
  t: number
  r: number
  b: number
  l: number
}

// fitRadii scales corner radii down so neighbors fit their side (CSS's rule).
function fitRadii(rad: number[], w: number, h: number): number[] {
  const [a, b, c, d] = rad
  let f = 1
  if (a + b > w) f = Math.min(f, w / (a + b))
  if (d + c > w) f = Math.min(f, w / (d + c))
  if (a + d > h) f = Math.min(f, h / (a + d))
  if (b + c > h) f = Math.min(f, h / (b + c))
  return rad.map((r) => Math.max(0, r * f))
}

// An edge of the body box, walked clockwise: from its start corner along u,
// with the outward normal o.
function edgeFrame(edge: string, b: Box): { a: Pt; u: Pt; o: Pt; len: number; start: number; end: number } {
  switch (edge) {
    case 'right':
      return { a: { x: b.x1, y: b.y0 }, u: { x: 0, y: 1 }, o: { x: 1, y: 0 }, len: b.y1 - b.y0, start: 1, end: 2 }
    case 'bottom':
      return { a: { x: b.x1, y: b.y1 }, u: { x: -1, y: 0 }, o: { x: 0, y: 1 }, len: b.x1 - b.x0, start: 2, end: 3 }
    case 'left':
      return { a: { x: b.x0, y: b.y1 }, u: { x: 0, y: -1 }, o: { x: -1, y: 0 }, len: b.y1 - b.y0, start: 3, end: 0 }
    default:
      return { a: { x: b.x0, y: b.y0 }, u: { x: 1, y: 0 }, o: { x: 0, y: -1 }, len: b.x1 - b.x0, start: 0, end: 1 }
  }
}

const EDGES = ['top', 'right', 'bottom', 'left']

// rectPts is a rounded rectangle's corners, clockwise from the top left, with
// extra points inserted after corner `after` (a notch, tab or pointer).
function rectPts(b: Box, rad: number[], extra: Vtx[] = [], after = -1): Vtx[] {
  const c: Vtx[] = [
    { x: b.x0, y: b.y0, r: rad[0] },
    { x: b.x1, y: b.y0, r: rad[1] },
    { x: b.x1, y: b.y1, r: rad[2] },
    { x: b.x0, y: b.y1, r: rad[3] },
  ]
  const out: Vtx[] = []
  c.forEach((p, i) => {
    out.push(p)
    if (i === after) out.push(...extra)
  })
  return out
}

// geometry computes f's outline in a w × h box.
export function geometry(f: FrameStyle, w: number, h: number): Geom {
  const s = f.shape
  const kind = s.kind || 'rect'
  const body: Box = { x0: 0, y0: 0, x1: Math.max(1, w), y1: Math.max(1, h) }
  const rad = s.radius.map((r) => num(r, 0, 2000))

  // A bubble's pointer and a tab stick out of the panel: the panel gives
  // them the room on their edge, so the whole frame stays in the box.
  let edge = ''
  let out = 0
  if (kind === 'bubble' && s.pointer.edge && s.pointer.size > 0) {
    edge = s.pointer.edge
    out = num(s.pointer.size, 0, 2000)
  } else if (kind === 'notch' && s.notch.edge && s.notch.depth > 0 && s.notch.width > 0) {
    edge = s.notch.edge
    out = num(s.notch.depth, 0, 2000)
  }
  if (edge) {
    const lim = (edge === 'top' || edge === 'bottom' ? h : w) * 0.6
    out = Math.min(out, lim)
    if (edge === 'top') body.y0 += out
    if (edge === 'bottom') body.y1 -= out
    if (edge === 'left') body.x0 += out
    if (edge === 'right') body.x1 -= out
  }
  const W = body.x1 - body.x0
  const H = body.y1 - body.y0

  switch (kind) {
    case 'pill': {
      const r = Math.min(W, H) / 2
      return { kind: 'poly', pts: rectPts(body, [r, r, r, r]), body }
    }
    case 'cut': {
      const c = fitRadii(rad, W, H)
      const { x0, y0, x1, y1 } = body
      const pts: Vtx[] = []
      const add = (x: number, y: number) => pts.push({ x, y, r: 0 })
      if (c[0] > 0) (add(x0, y0 + c[0]), add(x0 + c[0], y0))
      else add(x0, y0)
      if (c[1] > 0) (add(x1 - c[1], y0), add(x1, y0 + c[1]))
      else add(x1, y0)
      if (c[2] > 0) (add(x1, y1 - c[2]), add(x1 - c[2], y1))
      else add(x1, y1)
      if (c[3] > 0) (add(x0 + c[3], y1), add(x0, y1 - c[3]))
      else add(x0, y1)
      return { kind: 'poly', pts: dedupe(pts), body }
    }
    case 'slant': {
      const o = Math.min(W * 0.45, Math.abs(H * Math.tan((num(s.slant, -45, 45) * Math.PI) / 180)))
      const { x0, y0, x1, y1 } = body
      const c = fitRadii(rad, W - o, H)
      const pts: Vtx[] =
        s.slant >= 0
          ? [
              { x: x0 + o, y: y0, r: c[0] },
              { x: x1, y: y0, r: c[1] },
              { x: x1 - o, y: y1, r: c[2] },
              { x: x0, y: y1, r: c[3] },
            ]
          : [
              { x: x0, y: y0, r: c[0] },
              { x: x1 - o, y: y0, r: c[1] },
              { x: x1, y: y1, r: c[2] },
              { x: x0 + o, y: y1, r: c[3] },
            ]
      return { kind: 'poly', pts, body }
    }
    case 'hexagon': {
      const p = Math.min(W / 2, H / (2 * Math.sqrt(3)))
      const { x0, y0, x1, y1 } = body
      const ym = (y0 + y1) / 2
      const r = Math.min(rad[0], H / 4, W / 4)
      const pts: Vtx[] = [
        { x: x0 + p, y: y0, r },
        { x: x1 - p, y: y0, r },
        { x: x1, y: ym, r },
        { x: x1 - p, y: y1, r },
        { x: x0 + p, y: y1, r },
        { x: x0, y: ym, r },
      ]
      return { kind: 'poly', pts: dedupe(pts), body }
    }
    case 'ticket': {
      const r = Math.min(rad[1], W / 4, H / 4)
      const bite = Math.min(rad[0] > 0 ? rad[0] : H * 0.2, H / 2 - r - 1, W / 4)
      return { kind: 'ticket', body, r, bite: Math.max(0, bite) }
    }
    case 'notch': {
      const c = fitRadii(rad, W, H)
      const n = s.notch
      if (!n.edge || !(n.width > 0) || !n.depth) return { kind: 'poly', pts: rectPts(body, c), body }
      const e = edgeFrame(n.edge, body)
      const ra = c[e.start]
      const rb = c[e.end]
      const room = Math.max(0, e.len - ra - rb)
      const wd = Math.min(num(n.width, 0, 2000), room)
      if (wd <= 0) return { kind: 'poly', pts: rectPts(body, c), body }
      // at is % along the edge left to right / top to bottom; clockwise
      // walks bottom and left the other way.
      const at = num(n.at, 0, 100, 50) / 100
      const along = n.edge === 'bottom' || n.edge === 'left' ? 1 - at : at
      const mid = Math.min(e.len - rb - wd / 2, Math.max(ra + wd / 2, along * e.len))
      const depth = n.depth > 0 ? Math.min(num(n.depth, 0, 2000), out) : -Math.min(-n.depth, (n.edge === 'top' || n.edge === 'bottom' ? H : W) * 0.9)
      const taper = Math.min(Math.abs(depth) * 0.5, wd / 4)
      const at2 = (t: number, d: number): Vtx => ({ x: e.a.x + e.u.x * t + e.o.x * d, y: e.a.y + e.u.y * t + e.o.y * d, r: 0 })
      const extra = [at2(mid - wd / 2, 0), at2(mid - wd / 2 + taper, depth), at2(mid + wd / 2 - taper, depth), at2(mid + wd / 2, 0)]
      return { kind: 'poly', pts: dedupe(rectPts(body, c, extra, e.start)), body }
    }
    case 'bubble': {
      const c = fitRadii(rad, W, H)
      const p = s.pointer
      if (!edge) return { kind: 'poly', pts: rectPts(body, c), body }
      const e = edgeFrame(p.edge, body)
      const ra = c[e.start]
      const rb = c[e.end]
      const room = Math.max(0, e.len - ra - rb)
      const base = Math.min(out * 1.1, room)
      if (base <= 1) return { kind: 'poly', pts: rectPts(body, c), body }
      const at = num(p.at, 0, 100, 50) / 100
      const along = p.edge === 'bottom' || p.edge === 'left' ? 1 - at : at
      const mid = Math.min(e.len - rb - base / 2, Math.max(ra + base / 2, along * e.len))
      const at2 = (t: number, d: number): Vtx => ({ x: e.a.x + e.u.x * t + e.o.x * d, y: e.a.y + e.u.y * t + e.o.y * d, r: 0 })
      const extra = [at2(mid - base / 2, 0), at2(mid, out), at2(mid + base / 2, 0)]
      return { kind: 'poly', pts: dedupe(rectPts(body, c, extra, e.start)), body }
    }
    case 'ellipse':
    case 'heart': {
      // Curves are fine polygons (under 0.3 px off the curve at any size),
      // so they offset like every other shape.
      const pts = kind === 'ellipse' ? ellipsePts(W, H) : heartPts(W, H)
      return { kind: 'poly', pts: place(pts, body, 0), body, key: `${kind}|${r2(W)}|${r2(H)}|${body.x0}|${body.y0}` }
    }
    case 'triangle':
    case 'star':
    case 'polygon':
    case 'arrow': {
      const unit =
        kind === 'triangle'
          ? [
              { x: 0.5, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ]
          : kind === 'arrow'
            ? arrowPts(W, H, arrowShaft(s))
            : regularPts(shapePoints(s), kind === 'star' ? starInner(s) : 1)
      const r = Math.min(rad[0], W / 4, H / 4)
      const pts = place(unit, body, r)
      return { kind: 'poly', pts: dedupe(pts), body, key: `${kind}|${r2(W)}|${r2(H)}|${body.x0}|${body.y0}|${s.points}|${s.inner}|${r2(r)}` }
    }
    default:
      return { kind: 'poly', pts: rectPts(body, fitRadii(rad, W, H)), body }
  }
}

// ---- Drawn shapes ----
//
// The Frame element's shapes: points in a unit box (or the box's own size
// for the arrow) that place() stretches over the body, clockwise.

// place maps points spanning their own bounding box onto b, clockwise
// (positive area with y down), every corner with radius r.
function place(pts: Pt[], b: Box, r: number): Vtx[] {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  const sx = (b.x1 - b.x0) / (x1 - x0 || 1)
  const sy = (b.y1 - b.y0) / (y1 - y0 || 1)
  const out = pts.map((p) => ({ x: b.x0 + (p.x - x0) * sx, y: b.y0 + (p.y - y0) * sy, r }))
  let area = 0
  for (let i = 0; i < out.length; i++) {
    const a = out[i]
    const c = out[(i + 1) % out.length]
    area += a.x * c.y - c.x * a.y
  }
  return area < 0 ? out.reverse() : out
}

// The star's and polygon's corner count, the star's inner radius (a share of
// the outer one) and the arrow's shaft thickness (a share of the height);
// 0 or missing means the default.
const opt = (v: unknown, lo: number, hi: number, d: number) => (Number(v) > 0 ? num(v, lo, hi, d) : d)
const shapePoints = (s: FrameStyle['shape']) => Math.round(opt(s.points, 3, 12, s.kind === 'star' ? 5 : 6))
const starInner = (s: FrameStyle['shape']) => opt(s.inner, 10, 90, 45) / 100
const arrowShaft = (s: FrameStyle['shape']) => opt(s.inner, 5, 95, 40) / 100

// Enough points that a chord strays under ~0.3 px from the curve.
const curveSteps = (W: number, H: number) => Math.round(Math.min(360, Math.max(48, (W + H) / 5)))

function ellipsePts(W: number, H: number): Pt[] {
  const n = curveSteps(W, H)
  return Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (i / n) * Math.PI * 2
    return { x: Math.cos(t), y: Math.sin(t) }
  })
}

// heartPts is the classic heart curve, sampled from its top dip around.
function heartPts(W: number, H: number): Pt[] {
  const n = curveSteps(W, H) + 24
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    const s = Math.sin(t)
    return { x: 16 * s * s * s, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }
  })
}

// regularPts is a regular polygon (inner 1) or a star (2·n points, every
// other one at inner × the radius), a point at the top.
function regularPts(n: number, inner: number): Pt[] {
  const star = inner < 1
  const m = star ? n * 2 : n
  return Array.from({ length: m }, (_, i) => {
    const t = -Math.PI / 2 + (i / m) * Math.PI * 2
    const k = star && i % 2 ? inner : 1
    return { x: Math.cos(t) * k, y: Math.sin(t) * k }
  })
}

// arrowPts points right: a shaft t × the height thick and a head as long
// as half the height (at most 60 % of the width).
function arrowPts(W: number, H: number, t: number): Pt[] {
  const head = Math.min(W * 0.6, H * 0.5)
  const xh = W - head
  const a = (H * (1 - t)) / 2
  return [
    { x: 0, y: a },
    { x: xh, y: a },
    { x: xh, y: 0 },
    { x: W, y: H / 2 },
    { x: xh, y: H },
    { x: xh, y: H - a },
    { x: 0, y: H - a },
  ]
}

function dedupe(pts: Vtx[]): Vtx[] {
  const out: Vtx[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (q && Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01) {
      q.r = Math.max(q.r, p.r)
      continue
    }
    out.push({ ...p })
  }
  const a = out[0]
  const z = out[out.length - 1]
  if (out.length > 1 && Math.abs(a.x - z.x) < 0.01 && Math.abs(a.y - z.y) < 0.01) out.pop()
  return out
}

// contentInsets is the room content keeps clear of beyond padding: the
// pointer's or tab's side, and half the lean of slanted and pointed ends.
export function contentInsets(g: Geom, f: FrameStyle, w: number, h: number): Insets {
  const ins: Insets = { t: g.body.y0, r: w - g.body.x1, b: h - g.body.y1, l: g.body.x0 }
  const H = g.body.y1 - g.body.y0
  const W = g.body.x1 - g.body.x0
  if (f.shape.kind === 'hexagon') {
    const p = Math.min(W / 2, H / (2 * Math.sqrt(3)))
    ins.l += p / 2
    ins.r += p / 2
  } else if (f.shape.kind === 'slant') {
    const o = Math.min(W * 0.45, Math.abs(H * Math.tan((num(f.shape.slant, -45, 45) * Math.PI) / 180)))
    ins.l += o / 2
    ins.r += o / 2
  } else if (f.shape.kind === 'ticket' && g.kind === 'ticket') {
    ins.l += g.bite / 2
    ins.r += g.bite / 2
  } else if (f.shape.kind === 'ellipse') {
    // The largest box inside: 1/√2 of each axis.
    ins.l += W * 0.146
    ins.r += W * 0.146
    ins.t += H * 0.146
    ins.b += H * 0.146
  } else if (f.shape.kind === 'triangle') {
    ins.t += H / 2
    ins.l += W / 4
    ins.r += W / 4
  } else if (f.shape.kind === 'star' || f.shape.kind === 'polygon') {
    // A box in the inner circle (the star's inner points, the polygon's
    // edges), roughly centered.
    const k = f.shape.kind === 'star' ? starInner(f.shape) : Math.cos(Math.PI / shapePoints(f.shape))
    const side = (1 - k / Math.SQRT2) / 2
    ins.l += W * side
    ins.r += W * side
    ins.t += H * side
    ins.b += H * side
  } else if (f.shape.kind === 'heart') {
    ins.l += W * 0.2
    ins.r += W * 0.2
    ins.t += H * 0.18
    ins.b += H * 0.3
  } else if (f.shape.kind === 'arrow') {
    const t = arrowShaft(f.shape)
    ins.t += (H * (1 - t)) / 2
    ins.b += (H * (1 - t)) / 2
    ins.r += Math.min(W * 0.6, H * 0.5) * 0.5
  }
  return ins
}

// ---- Outlines ----

const fmt = (n: number) => String(Math.round(n * 100) / 100)

// offsetPoly moves every edge d inward (d < 0: outward) and adjusts the
// corner radii: a convex corner's radius shrinks by d, a concave one's grows;
// sharp corners stay sharp.
function offsetPoly(pts: Vtx[], d: number): Vtx[] {
  const n = pts.length
  if (!d || n < 3) return pts
  const norms: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    norms.push({ x: -dy / l, y: dx / l }) // inward for a clockwise outline (y down)
  }
  const out: Vtx[] = []
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const n0 = norms[(i - 1 + n) % n]
    const n1 = norms[i]
    // The corner moves to the meeting point of both moved edges.
    const dot = n0.x * n1.x + n0.y * n1.y
    const k = d / Math.max(0.05, 1 + dot)
    const x = p.x + (n0.x + n1.x) * k
    const y = p.y + (n0.y + n1.y) * k
    const cross = n0.x * n1.y - n0.y * n1.x
    const convex = cross > 0
    const r = p.r > 0 ? Math.max(0, convex ? p.r - d : p.r + d) : 0
    out.push({ x, y, r })
  }
  return out
}

// polyPath draws a polygon with rounded corners: each corner is cut where
// a circle of its radius touches both edges, scaled down when two corners'
// cuts would overlap on one edge.
function polyPath(pts: Vtx[]): string {
  const n = pts.length
  if (n < 3) return ''
  const cut: number[] = []
  const info = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const ux = a.x - p.x
    const uy = a.y - p.y
    const vx = b.x - p.x
    const vy = b.y - p.y
    const lu = Math.hypot(ux, uy) || 1
    const lv = Math.hypot(vx, vy) || 1
    const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))
    const theta = Math.acos(cos)
    const tanHalf = Math.tan(theta / 2)
    const t = p.r > 0 && tanHalf > 1e-3 ? p.r / tanHalf : 0
    cut.push(t)
    // Turning clockwise (y down) is convex.
    const turn = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)
    return { u: { x: ux / lu, y: uy / lu }, v: { x: vx / lv, y: vy / lv }, tanHalf, convex: turn > 0, next: lv }
  })
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const len = info[i].next
    if (cut[i] + cut[j] > len) {
      const f = len / (cut[i] + cut[j])
      cut[i] *= f
      cut[j] *= f
    }
  }
  let s = ''
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const t = cut[i]
    const { u, v } = info[i]
    if (t > 0.01) {
      const ax = p.x + u.x * t
      const ay = p.y + u.y * t
      const bx = p.x + v.x * t
      const by = p.y + v.y * t
      const r = t * info[i].tanHalf
      s += `${i ? 'L' : 'M'}${fmt(ax)} ${fmt(ay)}A${fmt(r)} ${fmt(r)} 0 0 ${info[i].convex ? 1 : 0} ${fmt(bx)} ${fmt(by)}`
    } else s += `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`
  }
  return s + 'Z'
}

// ticketPath draws the ticket offset d inward: the bites are circles around
// the middle of the box's left and right edges, growing as the outline
// moves in.
function ticketPath(g: Extract<Geom, { kind: 'ticket' }>, d: number): string {
  const x0 = g.body.x0 + d
  const y0 = g.body.y0 + d
  const x1 = g.body.x1 - d
  const y1 = g.body.y1 - d
  if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return ''
  const r = g.r > 0 ? Math.max(0, g.r - d) : 0
  const ym = (g.body.y0 + g.body.y1) / 2
  const b = g.bite + d
  const dy = b > Math.abs(d) ? Math.sqrt(b * b - d * d) : 0
  const big = d < 0 ? 1 : 0
  const half = (y1 - y0) / 2
  const h = Math.min(dy, half - r - 0.01)
  let s = `M${fmt(x0 + r)} ${fmt(y0)}H${fmt(x1 - r)}`
  if (r) s += `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x1)} ${fmt(y0 + r)}`
  if (h > 0.01) s += `V${fmt(ym - h)}A${fmt(b)} ${fmt(b)} 0 ${big} 0 ${fmt(x1)} ${fmt(ym + h)}`
  s += `V${fmt(y1 - r)}`
  if (r) s += `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x1 - r)} ${fmt(y1)}`
  s += `H${fmt(x0 + r)}`
  if (r) s += `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x0)} ${fmt(y1 - r)}`
  if (h > 0.01) s += `V${fmt(ym + h)}A${fmt(b)} ${fmt(b)} 0 ${big} 0 ${fmt(x0)} ${fmt(ym - h)}`
  s += `V${fmt(y0 + r)}`
  if (r) s += `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x0 + r)} ${fmt(y0)}`
  return s + 'Z'
}

// Path strings are cached: chat rows of one size share them.
const cache = new Map<string, string>()
const CACHE_MAX = 400

// outline is g's outline moved d inward (d < 0: outward), as SVG path data.
export function outline(g: Geom, d: number): string {
  const key = `${g.kind === 'poly' && g.key ? g.key : JSON.stringify(g)}|${r2(d)}`
  let s = cache.get(key)
  if (s !== undefined) return s
  if (g.kind === 'ticket') s = ticketPath(g, d)
  else {
    const W = g.body.x1 - g.body.x0
    const H = g.body.y1 - g.body.y0
    // Inward past the middle there is nothing left to draw.
    s = d > 0 && (d * 2 >= W || d * 2 >= H) ? '' : polyPath(offsetPoly(g.pts, d))
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, s)
  return s
}

// ---- Paint helpers ----

// cssGradientLine is where a CSS linear-gradient at angle (0 = to top,
// 90 = to the right) runs in a w × h box, for an SVG gradient in user space.
export function cssGradientLine(angle: number, w: number, h: number, ox = 0, oy = 0): { x1: number; y1: number; x2: number; y2: number } {
  const a = (num(angle, -3600, 3600, 90) * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const len = Math.abs(w * dx) + Math.abs(h * dy)
  const cx = ox + w / 2
  const cy = oy + h / 2
  return { x1: r2(cx - (dx * len) / 2), y1: r2(cy - (dy * len) / 2), x2: r2(cx + (dx * len) / 2), y2: r2(cy + (dy * len) / 2) }
}

export const gradientStops = (stops: { color: string; at: number }[]) =>
  stops.map((s) => ({ offset: `${num(s.at, 0, 100)}%`, color: frameColor(s.color, '#ffffff') }))

export const nineSliceUrl = (id: string) => mediaFileUrl(id)

// Default seconds per cycle of each animation.
export const FRAME_SPEED: Record<string, number> = { running: 3, ants: 1, pulse: 2, shine: 3.2 }

export const frameSpeed = (f: FrameStyle) => num(f.animation.speed, 0.2, 20, 0) || FRAME_SPEED[f.animation.kind] || 2

// frameDraws reports whether f draws anything at all (the zero frame
// doesn't; its padding may still inset content).
export function frameDraws(f: FrameStyle): boolean {
  if (f.image.media) return true
  const fill = f.fill.kind && f.fill.kind !== 'none'
  return !!(
    (fill && (f.fill.kind !== 'solid' || f.fill.color)) ||
    (f.fill.pattern.kind && f.fill.pattern.kind !== 'none') ||
    f.border.width > 0 ||
    f.rings.length ||
    (f.brackets.length > 0 && f.brackets.width > 0) ||
    f.shadows.length ||
    f.glow.size > 0 ||
    f.bevel.size > 0 ||
    (f.texture.kind && f.texture.kind !== 'none' && f.texture.opacity > 0) ||
    (f.animation.kind && f.animation.kind !== 'none')
  )
}

// ---- Cost ----

// HEAVY_FRAME_COST is the frameCost above which the editor warns that a
// frame may strain the streaming PC's GPU.
export const HEAVY_FRAME_COST = 40

// frameCost is a rough GPU cost score of f drawn at w × h canvas pixels:
// the blurred layers (shadows, glow, bevel) weighted by their radius, the
// noise texture, and the layers drawn, scaled by the frame's size (about 1
// for a 400 × 400 box), plus the animations that repaint every frame (the
// running light repaints its blurred path, shine a clipped band, pulse
// recomposites the glow).
export function frameCost(f: FrameStyle, w: number, h: number): number {
  const x = normFrame(f)
  const a = Math.min(5, Math.max(0.25, Math.sqrt(Math.max(1, w) * Math.max(1, h)) / 400))
  if (x.image.media) return Math.round(2 * a + x.shadows.filter((s) => !s.inset).length * a)
  let layers = 0
  let blur = 0
  if (x.fill.kind && x.fill.kind !== 'none') layers += x.fill.kind === 'media' ? 2 : 1
  if (x.fill.pattern.kind && x.fill.pattern.kind !== 'none') layers += 1
  if (x.border.width > 0) layers += x.border.style === 'double' ? 1 : 0.5
  layers += x.rings.length * 0.5
  if (x.brackets.length > 0) layers += 0.5
  for (const s of x.shadows) blur += 1 + num(s.blur, 0, 200) / 8 + (s.inset ? 0.5 : 0)
  const anim = x.animation.kind || ''
  const glowSize = x.glow.size > 0 ? num(x.glow.size, 0, 200) : anim === 'pulse' ? 14 : 0
  if (glowSize > 0) blur += num(x.glow.strength, 1, 5, 1) * (1 + glowSize / 8)
  if (x.bevel.size > 0) blur += 2 + num(x.bevel.size, 0, 200) / 8
  if (x.texture.kind && x.texture.kind !== 'none' && x.texture.opacity > 0) blur += 6
  let motion = 0
  if (anim === 'running') motion += 4 + 3 * a
  if (anim === 'ants') motion += 2 + a
  if (anim === 'pulse') motion += 3 + 2 * a
  if (anim === 'shine') motion += 3 + 3 * a
  return Math.round((layers + blur) * a + motion)
}
