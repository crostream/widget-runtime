// sfx.ts: sl.sfx, the widget runtime's built-in sound effects, synthesized
// with WebAudio built-in nodes only (oscillators, a noise buffer, biquad
// filters, gains, a stereo panner, a wave shaper, a compressor): the frame's
// CSP allows no fetch, worklets or workers. One AudioContext per frame is
// created on the first sound and closed after IDLE_MS of silence.
//
// Sounds play only while enabled: not muted, never in a thumbnail, and in the
// editor only during an audition (main.ts feeds sfxState from the host).
import { SFX_NAMES } from '../api/catalog.js'
import type { Mode } from '../render/types.js'

type Name = (typeof SFX_NAMES)[number]
interface PlayOpts {
  volume?: number
  pitch?: number
  delay?: number
  pan?: number
}
interface ToneOpts {
  ms?: number
  type?: OscillatorType
  volume?: number
  delay?: number
  glide?: number
}
// A voice: an oscillator (f → to over d seconds, optionally wobbled by an LFO
// of [Hz, depth Hz]) or filtered noise, shaped by an attack/exponential-decay
// envelope. lp/hp are a lowpass/highpass cutoff, bp a bandpass [from, to] Hz.
interface Voice {
  type?: OscillatorType
  to?: number
  vol?: number
  a?: number
  det?: number
  lp?: number | [number, number]
  hp?: number
  bp?: [number, number]
  q?: number
  wob?: [number, number]
  crush?: number // quantize to this many levels (bit-crush)
}

export const sfxState = { mode: 'output' as Mode, muted: false, audition: false }

const IDLE_MS = 10000
let ctx: AudioContext | null = null
let master: DynamicsCompressorNode | null = null
let noiseBuf: AudioBuffer | null = null
let idle: ReturnType<typeof setTimeout> | undefined
// The output gain of every play still sounding or scheduled, for stop().
const live = new Set<GainNode>()

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}

function context(): AudioContext | null {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createDynamicsCompressor()
    master.connect(ctx.destination)
    const n = ctx.sampleRate
    noiseBuf = ctx.createBuffer(1, n, n)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  } catch {
    ctx = null
  }
  return ctx
}

// S is what a preset gets: its start time and the voices bound to one play.
interface S {
  o(t: number, d: number, f: number, v?: Voice): void
  n(t: number, d: number, v?: Voice): void
  r(lo: number, hi: number): number
}

function chain(c: AudioContext, t: number, d: number, v: Voice, src: AudioNode, out: AudioNode, pitch: number): void {
  let node: AudioNode = src
  const f = (type: BiquadFilterType, hz: number | [number, number]) => {
    const b = c.createBiquadFilter()
    b.type = type
    const [a, z] = Array.isArray(hz) ? hz : [hz, hz]
    b.frequency.setValueAtTime(a * pitch, t)
    if (z !== a) b.frequency.exponentialRampToValueAtTime(z * pitch, t + d)
    if (v.q) b.Q.value = v.q
    node.connect(b)
    node = b
  }
  if (v.hp) f('highpass', v.hp)
  if (v.lp) f('lowpass', v.lp)
  if (v.bp) f('bandpass', v.bp)
  if (v.crush) {
    const w = c.createWaveShaper()
    const curve = new Float32Array(513)
    for (let i = 0; i < 513; i++) curve[i] = Math.round(((i / 256) - 1) * v.crush) / v.crush
    w.curve = curve
    node.connect(w)
    node = w
  }
  const g = c.createGain()
  const a = v.a ?? 0.005
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(v.vol ?? 0.4, t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + d)
  node.connect(g)
  g.connect(out)
}

function synth(c: AudioContext, t0: number, out: AudioNode, pitch: number): S {
  return {
    r: (lo, hi) => lo + Math.random() * (hi - lo),
    o(t, d, f, v = {}) {
      t += t0
      const osc = c.createOscillator()
      osc.type = v.type ?? 'sine'
      if (v.det) osc.detune.value = v.det
      osc.frequency.setValueAtTime(f * pitch, t)
      if (v.to) osc.frequency.exponentialRampToValueAtTime(v.to * pitch, t + d)
      if (v.wob) {
        const lfo = c.createOscillator()
        const depth = c.createGain()
        lfo.frequency.value = v.wob[0]
        depth.gain.setValueAtTime(v.wob[1] * pitch, t)
        depth.gain.exponentialRampToValueAtTime(0.01, t + d)
        lfo.connect(depth)
        depth.connect(osc.frequency)
        lfo.start(t)
        lfo.stop(t + d + 0.05)
      }
      chain(c, t, d, v, osc, out, pitch)
      osc.start(t)
      osc.stop(t + d + 0.05)
    },
    n(t, d, v = {}) {
      t += t0
      const src = c.createBufferSource()
      src.buffer = noiseBuf
      src.loop = true
      chain(c, t, d, v, src, out, pitch)
      src.start(t, Math.random())
      src.stop(t + d + 0.05)
    },
  }
}

const bell = (s: S, t: number, f: number, vol: number, len = 2) =>
  [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.15]].forEach(([m, k]) => s.o(t, len / (m > 1 ? m ** 0.6 : 1), f * m, { vol: vol * k, a: 0.002 }))

const coin = (s: S, t: number, f: number) => {
  s.o(t, 0.07, f, { type: 'square', vol: 0.22, lp: 6000 })
  s.o(t + 0.07, 0.4, f * 1.3348, { type: 'square', vol: 0.22, lp: 6000 }) // up a fourth
}

const PRESETS: Record<Name, (s: S) => void> = {
  chime: (s) => {
    s.o(0, 1.4, 880, { vol: 0.35 })
    s.o(0.09, 1.4, 1318.5, { vol: 0.28 })
    s.o(0, 0.5, 2637, { vol: 0.08 })
  },
  coin: (s) => coin(s, 0, 987.8),
  cash: (s) => {
    for (let i = 0; i < 7; i++) {
      const t = i * 0.045 + s.r(0, 0.015)
      s.o(t, 0.14, s.r(1500, 2600), { type: 'square', vol: 0.12 * (1 - i / 9), lp: 7000 })
      s.o(t, 0.2, s.r(3000, 5200), { type: 'triangle', vol: 0.06 })
    }
  },
  whoosh: (s) => s.n(0, 0.7, { bp: [250, 3200], q: 1.2, a: 0.28, vol: 0.9 }),
  swoosh: (s) => {
    s.n(0, 0.32, { bp: [4200, 350], q: 0.9, a: 0.05, vol: 0.8 })
    s.n(0, 0.2, { hp: 5000, a: 0.02, vol: 0.12 })
  },
  pop: (s) => {
    s.o(0, 0.09, 700, { to: 130, vol: 0.7 })
    s.n(0, 0.02, { hp: 2500, vol: 0.25 })
  },
  bubble: (s) => {
    s.o(0, 0.14, 320, { to: 960, vol: 0.45 })
    s.o(0.09, 0.1, 460, { to: 1250, vol: 0.28 })
  },
  levelup: (s) => {
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      const last = i === 4
      const len = last ? 0.7 : 0.16
      s.o(i * 0.085, len, f, { type: 'square', vol: 0.15, lp: 5000 })
      s.o(i * 0.085, len, f, { type: 'triangle', vol: 0.2, det: 6 })
    })
    s.o(0.34, 0.7, 2637, { vol: 0.05 })
  },
  fanfare: (s) => {
    const chord = (t: number, d: number, notes: number[], top: number) =>
      notes.forEach((f) => [-9, 9].forEach((det) => s.o(t, d, f, { type: 'sawtooth', det, vol: 0.075, a: 0.04, lp: [400, top], q: 2 })))
    chord(0, 0.3, [196, 246.9, 392], 2800) // G stab
    chord(0.3, 1.5, [130.8, 261.6, 329.6, 392, 523.25], 4200) // C swell
  },
  powerup: (s) => {
    s.o(0, 0.55, 220, { to: 1760, type: 'square', vol: 0.13, lp: 6000 })
    s.o(0, 0.55, 440, { to: 3520, type: 'triangle', vol: 0.15 })
    s.o(0.5, 0.35, 1760, { vol: 0.2 })
  },
  laser: (s) => {
    s.o(0, 0.28, 2200, { to: 110, type: 'sawtooth', vol: 0.25, lp: [6000, 500], q: 4 })
    s.o(0, 0.22, 1100, { to: 90, type: 'square', vol: 0.1 })
  },
  zap: (s) => {
    s.n(0, 0.25, { hp: 3000, vol: 0.45, a: 0.002 })
    for (let i = 0; i < 6; i++) s.o(i * 0.035, 0.05, s.r(80, 900), { type: 'sawtooth', vol: 0.18, lp: 3500, a: 0.002 })
  },
  glitch: (s) => {
    for (let i = 0; i < 9; i++) {
      const t = i * 0.035 + s.r(0, 0.02)
      const f = [220, 330, 523, 880, 1760, 2960][Math.floor(s.r(0, 6))]
      s.o(t, 0.03, f, { type: Math.random() < 0.5 ? 'square' : 'sawtooth', vol: 0.2, a: 0.001, to: f * s.r(0.5, 2), crush: 4 })
      if (i % 3 === 0) s.n(t, 0.025, { hp: 1500, vol: 0.2, crush: 3 })
    }
  },
  drumroll: (s) => {
    let t = 0
    for (let gap = 0.09, i = 0; t < 1.3; i++, gap = Math.max(0.022, gap * 0.93)) {
      s.n(t, 0.07, { bp: [260, 200], q: 0.7, vol: 0.18 + 0.4 * (t / 1.3), a: 0.002 })
      s.o(t, 0.06, 150, { to: 90, vol: 0.12 + 0.2 * (t / 1.3), a: 0.002 })
      t += gap
    }
    s.n(t, 0.5, { hp: 5000, vol: 0.35, a: 0.003 })
    s.o(t, 0.4, 110, { to: 45, vol: 0.5 })
  },
  cymbal: (s) => {
    s.n(0, 1.8, { hp: 6500, vol: 0.5, a: 0.002 })
    s.n(0, 0.9, { bp: [9500, 9000], q: 2, vol: 0.4, a: 0.002 })
    ;[263, 400, 421, 474, 587, 845].forEach((f) => s.o(0, 0.7, f * 2, { type: 'square', vol: 0.025, hp: 7000, a: 0.002 }))
  },
  bell: (s) => bell(s, 0, 660, 0.3, 2.6),
  kaching: (s) => {
    s.n(0, 0.05, { bp: [3500, 2500], q: 1.5, vol: 0.5, a: 0.001 })
    s.o(0, 0.06, 140, { to: 70, vol: 0.4 })
    bell(s, 0.1, 2093, 0.22, 1.8)
    coin(s, 0.16, 1568)
  },
  boing: (s) => s.o(0, 0.8, 230, { to: 110, vol: 0.6, wob: [16, 150], lp: 2500 }),
  sparkle: (s) => {
    for (let i = 0; i < 12; i++) {
      const t = i * 0.042 + s.r(0, 0.03)
      s.o(t, 0.22, s.r(2200, 6200), { type: i % 2 ? 'sine' : 'triangle', vol: 0.12 * (1 - i / 16), a: 0.002 })
    }
  },
  thud: (s) => {
    s.o(0, 0.4, 130, { to: 38, vol: 0.9, a: 0.002 })
    s.n(0, 0.05, { lp: 800, vol: 0.4, a: 0.001 })
  },
}

// Per-preset trailing silence is generous: the context closes on idle.
const TAIL = 3

function run(opts: (PlayOpts & ToneOpts) | undefined, tone: boolean, fn: (c: AudioContext, t0: number, out: AudioNode) => number): void {
  if (!sfx.enabled) return
  const c = context()
  if (!c || !master) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  const gain = c.createGain()
  gain.gain.value = clamp(opts?.volume, 0, 1, 0.8)
  const pan = c.createStereoPanner?.()
  if (pan) {
    pan.pan.value = clamp(opts?.pan, -1, 1, 0)
    gain.connect(pan)
    pan.connect(master)
  } else gain.connect(master)
  const t0 = c.currentTime + 0.02 + clamp(opts?.delay, 0, 60000, 0) / 1000
  const dur = fn(c, t0, gain)
  live.add(gain)
  setTimeout(() => live.delete(gain), (t0 - c.currentTime + dur + TAIL) * 1000)
  clearTimeout(idle)
  idle = setTimeout(() => {
    const k = ctx
    ctx = master = noiseBuf = null
    live.clear()
    void k?.close().catch(() => {})
  }, (t0 - c.currentTime + dur + (tone ? 0 : TAIL)) * 1000 + IDLE_MS)
}

export const sfx = Object.freeze({
  names: Object.freeze([...SFX_NAMES]),
  get enabled(): boolean {
    return !sfxState.muted && sfxState.mode !== 'thumb' && (sfxState.mode === 'output' || sfxState.audition)
  },
  play(name: Name, opts?: PlayOpts): void {
    const preset = Object.hasOwn(PRESETS, name) ? PRESETS[name] : undefined
    if (!preset) return
    const pitch = clamp(opts?.pitch, 0.25, 4, 1)
    run(opts, false, (c, t0, out) => {
      preset(synth(c, t0, out, pitch))
      return 2
    })
  },
  // stop cuts every sound playing or still scheduled (delay), at once.
  stop(): void {
    for (const g of live) {
      try {
        g.gain.cancelScheduledValues(0)
        g.gain.value = 0
        g.disconnect()
      } catch {
        // already gone
      }
    }
    live.clear()
  },
  tone(freq: number, opts?: ToneOpts): void {
    const f = clamp(freq, 20, 20000, 440)
    const d = clamp(opts?.ms, 10, 10000, 200) / 1000
    const type = (['sine', 'square', 'sawtooth', 'triangle'] as const).find((x) => x === opts?.type) ?? 'sine'
    const to = opts?.glide ? clamp(opts.glide, 20, 20000, f) : 0
    run(opts, true, (c, t0, out) => {
      synth(c, t0, out, 1).o(0, d, f, { type, to: to && to !== f ? to : undefined, vol: 0.5, a: Math.min(0.01, d / 4) })
      return d
    })
  },
})
