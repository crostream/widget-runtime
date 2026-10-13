// types.ts: the part of the overlay's types the renderer draws with: where a
// widget is drawn (Mode), the play cue, media URLs, text effects, frame
// styles, themes and icon kinds. Extracted from the CroStream app's
// overlay/types.ts (the document and widget schema stay in the app).

// Mode tells widgets where they are drawn:
//   output: the OBS page (play media, draw nothing for invisible widgets)
//   editor: the editor canvas (mute, show markers and placeholders)
//   thumb:  small previews in lists (no playback; video shows its thumbnail)
export type Mode = 'output' | 'editor' | 'thumb'

// Cue is one observed change of NodeState.play: n counts them since the page
// loaded and at is when it was seen (performance.now()).
export interface Cue {
  n: number
  at: number
}

export const mediaFileUrl = (id: string) => `/media/file/${encodeURIComponent(id)}`
export const mediaThumbUrl = (id: string) => `/media/thumb/${encodeURIComponent(id)}`

export type FillKind = 'solid' | 'linear' | 'radial' | 'media'
export type DecorationLine = 'none' | 'underline' | 'line-through' | 'overline'
export type DecorationStyle = 'solid' | 'wavy' | 'dotted' | 'dashed' | 'double'
export type AnimationKind = 'none' | 'pulse' | 'float' | 'shake' | 'shine' | 'rainbow' | 'wave' | 'bounce' | 'jitter' | 'typewriter'
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn'
  | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface TextEffects {
  fill: { kind: FillKind | ''; angle: number; stops: { color: string; at: number }[]; media: string }
  outlines: { width: number; color: string }[] // ≤ 2, the first innermost
  shadows: { x: number; y: number; blur: number; color: string }[] // ≤ 6, the first on top
  glow: { size: number; strength: number; color: string } // size 0 = off; strength 1–5 layers
  extrude: { depth: number; angle: number; color: string } // depth 0 = off; angle 0 = down, 90 = right
  highlight: { color: string; padX: number; padY: number; radius: number } // color '' = off
  decoration: { line: DecorationLine | ''; style: DecorationStyle | ''; color: string; thickness: number; offset: number }
  blend: BlendMode | ''
  layout: {
    fit: 'none' | 'shrink' | ''
    minSize: number // 0 = 12
    ellipsis: boolean // one line, cut with …
    balance: boolean
    skew: number // degrees
    stretch: number // percent, 0 = 100
    vertical: boolean
  }
  animation: { kind: AnimationKind | ''; speed: number; intensity: number } // speed: seconds per cycle (0 = default); intensity 1–10 (0 = 5)
}

export const noEffects = (): TextEffects => ({
  fill: { kind: '', angle: 90, stops: [], media: '' },
  outlines: [],
  shadows: [],
  glow: { size: 0, strength: 0, color: '' },
  extrude: { depth: 0, angle: 45, color: '' },
  highlight: { color: '', padX: 0, padY: 0, radius: 0 },
  decoration: { line: '', style: '', color: '', thickness: 0, offset: 0 },
  blend: '',
  layout: { fit: '', minSize: 0, ellipsis: false, balance: false, skew: 0, stretch: 0, vertical: false },
  animation: { kind: '', speed: 0, intensity: 0 },
})

// ---- Frames, lines and themes (Go: internal/overlay/frame.go) ----
//
// A FrameStyle styles a box (prop kind 'frame'): the Frame widget's `frame`,
// and box/row styles on other widgets — chat `frame` + `rowFrame` and alert
// `frame`. One component (FrameBox) draws them all. The zero frame draws nothing.
//
// Colors anywhere in props (plain color props, effects, frames) may be
// "#rrggbb", "#rrggbbaa" or a theme reference "theme:<key>"; fonts may be
// "theme:heading" / "theme:body". The renderer resolves references from the
// overlay's theme (missing keys fall back to DEFAULT_THEME).

export type ShapeKind =
  | 'rect' | 'cut' | 'notch' | 'pill' | 'slant' | 'ticket' | 'hexagon' | 'bubble'
  | 'ellipse' | 'triangle' | 'star' | 'polygon' | 'heart' | 'arrow' // shapes for the Frame element: points (star/polygon 3..12), inner (star's inner radius 10..90 %)
export type Edge = 'top' | 'right' | 'bottom' | 'left'
export type PatternKind = 'none' | 'stripes' | 'dots' | 'grid' | 'checker' | 'scanlines' | 'carbon'
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'
export type FrameAnimationKind = 'none' | 'running' | 'ants' | 'pulse' | 'shine'

export interface FrameStyle {
  shape: {
    kind: ShapeKind | '' // '' = rect
    radius: [number, number, number, number] // top-left, top-right, bottom-right, bottom-left (cut: cut sizes; ticket: [0] is the bite)
    slant: number // slant: -45..45 degrees
    notch: { edge: Edge | ''; at: number; width: number; depth: number } // depth > 0 tab out, < 0 notch in; at = % along the edge
    pointer: { edge: Edge | ''; at: number; size: number } // bubble
    points?: number // star and polygon: 3..12 (0 = 5 for a star, 6 for a polygon)
    inner?: number // star: inner radius in % of the outer, 10..90 (0 = 45); arrow: shaft thickness % (0 = 40)
  }
  fill: {
    kind: 'none' | 'solid' | 'linear' | 'radial' | 'media' | '' // '' / none = transparent (webcam frame)
    color: string
    angle: number
    stops: { color: string; at: number }[]
    media: string
    pattern: { kind: PatternKind | ''; color: string; size: number; angle: number } // size 0 = 16
  }
  border: { width: number; style: BorderStyle | ''; color: string; angle: number; stops: { color: string; at: number }[]; inset: number } // ≥ 2 stops = gradient border
  rings: { width: number; gap: number; color: string }[] // ≤ 2, outside the border
  brackets: { length: number; width: number; color: string; inset: number } // length 0 = off
  shadows: { x: number; y: number; blur: number; spread: number; color: string; inset: boolean }[] // ≤ 4
  glow: { size: number; strength: number; color: string }
  bevel: { size: number; light: string; dark: string }
  texture: { kind: 'none' | 'noise' | 'grain' | ''; opacity: number }
  image: { media: string; slice: [number, number, number, number]; width: [number, number, number, number]; repeat: 'stretch' | 'repeat' | 'round' | 'space' | ''; fill: boolean } // 9-slice: when media is set it replaces shape/fill/border
  animation: { kind: FrameAnimationKind | ''; speed: number; color: string }
  padding: number // content inset
}

export const noFrame = (): FrameStyle => ({
  shape: { kind: '', radius: [0, 0, 0, 0], slant: 0, notch: { edge: '', at: 50, width: 0, depth: 0 }, pointer: { edge: '', at: 50, size: 0 } },
  fill: { kind: '', color: '', angle: 90, stops: [], media: '', pattern: { kind: '', color: '', size: 0, angle: 45 } },
  border: { width: 0, style: '', color: '', angle: 90, stops: [], inset: 0 },
  rings: [],
  brackets: { length: 0, width: 0, color: '', inset: 0 },
  shadows: [],
  glow: { size: 0, strength: 0, color: '' },
  bevel: { size: 0, light: '', dark: '' },
  texture: { kind: '', opacity: 0 },
  image: { media: '', slice: [0, 0, 0, 0], width: [0, 0, 0, 0], repeat: '', fill: false },
  animation: { kind: '', speed: 0, color: '' },
  padding: 0,
})

export const THEME_PREFIX = 'theme:'
export const THEME_COLOR_KEYS = ['primary', 'secondary', 'accent', 'text', 'muted', 'panel', 'border', 'highlight'] as const
export const THEME_FONT_KEYS = ['heading', 'body'] as const
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

export interface Theme {
  colors: Partial<Record<ThemeColorKey, string>>
  fonts: Partial<Record<'heading' | 'body', string>>
}

// DEFAULT_THEME fills keys an overlay's theme leaves out (mirrors Go's
// DefaultTheme).
export const DEFAULT_THEME: { colors: Record<ThemeColorKey, string>; fonts: Record<'heading' | 'body', string> } = {
  colors: {
    primary: '#7c5cffff',
    secondary: '#2dd4bfff',
    accent: '#ff5cf0ff',
    text: '#ffffffff',
    muted: '#a3a9b8ff',
    panel: '#0b0d12cc',
    border: '#ffffff33',
    highlight: '#ffe14dff',
  },
  fonts: { heading: 'Segoe UI, Arial, sans-serif', body: 'Segoe UI, Arial, sans-serif' },
}

// icon — a single icon from the built-in set.
export type IconKind =
  | 'twitch' | 'youtube' | 'kick' | 'discord' | 'x' | 'tiktok' | 'instagram' | 'facebook' | 'threads' | 'bluesky'
  | 'github' | 'patreon' | 'kofi' | 'paypal' | 'spotify' | 'steam' | 'xbox' | 'playstation' | 'nintendo' | 'website'
  | 'heart' | 'star' | 'bolt' | 'crown' | 'trophy' | 'gift' | 'music' | 'mic' | 'camera' | 'gamepad' | 'chat' | 'fire'
