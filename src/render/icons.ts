// icons.ts: the built-in icon set of the icon and socials elements (and the
// editor's pickers): simple monochrome glyphs on a 24 × 24 grid, drawn here
// (simplified shapes, not the platforms' artwork files), plus each brand's
// color. Glyph.svelte draws one. Kept free of api.ts like the rest of the
// renderer.
import type { IconKind } from './types.js'

// A glyph is filled paths (even-odd, so inner contours are holes), stroked
// lines, and cuts: shapes punched out of everything (strokes when w is set,
// else filled), for marks whose holes are lines or overlap.
export interface Glyph {
  fill?: string[]
  stroke?: { d: string; w: number }[]
  cut?: { d: string; w?: number }[]
  faint?: string[] // filled at reduced opacity, below the rest
}

// circle and ring path data: a closed circle as two arcs.
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`

function starPath(n: number, cx: number, cy: number, R: number, r: number): string {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const t = -Math.PI / 2 + (i * Math.PI) / n
    const k = i % 2 ? r : R
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(t) * k).toFixed(2)} ${(cy + Math.sin(t) * k).toFixed(2)}`
  }
  return d + 'Z'
}

export const GLYPHS: Record<IconKind, Glyph> = {
  twitch: {
    fill: ['M5 2L2.5 6V19.5H7.5V22.5H10.5L13.5 19.5H17L21.5 15V2ZM19.5 14L16.2 17.3H12.5L9.5 20.3V17.3H5V4H19.5Z', 'M11 7.2h2v5.3h-2Z', 'M15.7 7.2h2v5.3h-2Z'],
  },
  youtube: {
    fill: [rrect(1, 4.5, 22, 15, 4.5) + 'M9.7 8.6V15.4L15.7 12Z'],
  },
  kick: {
    fill: ['M3 3H9.5V8.5H11.5V6H14V3H21V9.5H18.5V11H16.5V13H18.5V14.5H21V21H14V18H11.5V15.5H9.5V21H3Z'],
  },
  discord: {
    fill: [
      'M19.6 5.3C18.1 4.6 16.5 4.1 14.9 3.8L14.4 4.8C12.8 4.6 11.2 4.6 9.6 4.8L9.1 3.8C7.5 4.1 5.9 4.6 4.4 5.3C1.6 9.5 0.9 13.6 1.2 17.6C3.1 19 5 19.8 6.8 20.4L8.1 18.5C7.4 18.2 6.8 17.9 6.2 17.6L6.6 17.2C10 18.8 14 18.8 17.4 17.2L17.8 17.6C17.2 17.9 16.6 18.2 15.9 18.5L17.2 20.4C19 19.8 20.9 19 22.8 17.6C23.2 13 22 9 19.6 5.3Z' +
        ellipse(8.6, 12.9, 1.75, 1.95) +
        ellipse(15.4, 12.9, 1.75, 1.95),
    ],
  },
  x: {
    fill: ['M2.8 3H8.6L21.2 21H15.4ZM5.6 4.4L16.2 19.6H18.4L7.8 4.4Z', 'M18.7 3H21L13.9 11.1L12.7 9.4Z', 'M10.3 12.9L11.5 14.6L5.3 21.6H3Z'],
  },
  tiktok: {
    fill: ['M12.6 2H16.1C16.3 4.6 18 6.4 20.8 6.6V10C19 10 17.5 9.4 16.1 8.5V15.3A6.1 6.1 0 1 1 10 9.2V12.8A2.6 2.6 0 1 0 12.6 15.3Z'],
  },
  instagram: {
    fill: [rrect(2, 2, 20, 20, 6) + rrect(4, 4, 16, 16, 4.3) + circle(12, 12, 4.6) + circle(12, 12, 2.8), circle(17.3, 6.7, 1.25)],
  },
  facebook: {
    fill: [
      'M10.4 21.89A10 10 0 1 1 13.6 21.88V14.6H16.1L16.5 11.6H13.6V9.8C13.6 9 13.9 8.4 15.1 8.4H16.6V5.8C16.3 5.75 15.4 5.7 14.4 5.7C12.1 5.7 10.4 7 10.4 9.5V11.6H7.9V14.6H10.4Z',
    ],
  },
  threads: {
    stroke: [
      {
        d: 'M17.2 7.6C16 5.4 14.2 4.3 12 4.3C7.9 4.3 5.2 7.4 5.2 12C5.2 16.6 7.9 19.7 12 19.7C15.6 19.7 18.4 17.7 18.4 14.4C18.4 11.4 15.9 10.2 12.9 10.2C10.6 10.2 9.2 11.4 9.2 13C9.2 14.6 10.5 15.5 12.1 15.5C14.6 15.5 15.7 13.6 15.7 10.6C15.7 8.9 15.2 7.9 14.4 7.3',
        w: 2.1,
      },
    ],
  },
  bluesky: {
    fill: [
      'M12 10.8C10.6 8 7.1 3.6 4.6 3C3 2.6 2 3.4 2 5.5C2 6.6 2.6 10.6 3 11.8C3.9 14.1 6.4 14.7 8.8 14.3C5.6 14.9 4.6 16.8 6.3 18.8C9.6 22.4 11.1 18.4 12 15.9C12.9 18.4 14.4 22.4 17.7 18.8C19.4 16.8 18.4 14.9 15.2 14.3C17.6 14.7 20.1 14.1 21 11.8C21.4 10.6 22 6.6 22 5.5C22 3.4 21 2.6 19.4 3C16.9 3.6 13.4 8 12 10.8Z',
    ],
  },
  github: {
    fill: [
      'M9.3 21.6A10 10 0 1 1 14.7 21.6V18.3C14.7 17.5 14.4 16.9 14 16.6C16.8 16.3 18.9 15.1 18.9 11.6C18.9 10.6 18.5 9.8 17.9 9.1C18.1 8.6 18.3 7.6 17.8 6.3C17.8 6.3 16.9 6 14.9 7.4C13 6.9 11 6.9 9.1 7.4C7.1 6 6.2 6.3 6.2 6.3C5.7 7.6 5.9 8.6 6.1 9.1C5.5 9.8 5.1 10.6 5.1 11.6C5.1 15.1 7.2 16.3 10 16.6C9.7 16.9 9.4 17.3 9.3 17.9C8.6 18.2 6.9 18.6 5.9 17C5.9 17 5.3 15.9 4.2 15.8C4.2 15.8 3.2 15.8 4.1 16.5C4.1 16.5 4.8 16.8 5.3 18.1C5.3 18.1 6 20.2 9.3 19.5Z',
    ],
  },
  patreon: {
    fill: [circle(14.6, 9.4, 6.6), 'M3 2.8H6.6V21.2H3Z'],
  },
  kofi: {
    fill: [
      'M2.5 6H18C20.9 6 22.6 7.8 22.6 10.3C22.6 12.9 20.9 14.6 18.2 14.6H17.6C17 17.6 14.9 19.8 11.9 19.8H8.4C5 19.8 2.5 17.3 2.5 14Z' +
        'M17.8 8.5V12.2C19.3 12.2 20.2 11.5 20.2 10.3C20.2 9.2 19.3 8.5 17.8 8.5Z' +
        'M10 16C8 14.3 6.6 13 6.6 11.3C6.6 10.1 7.5 9.2 8.6 9.2C9.2 9.2 9.7 9.5 10 10C10.3 9.5 10.8 9.2 11.4 9.2C12.5 9.2 13.4 10.1 13.4 11.3C13.4 13 12 14.3 10 16Z',
    ],
  },
  paypal: {
    faint: ['M10.4 6H15.4C18.5 6 20.2 7.7 19.7 10.6C19.2 13.9 17 15.5 13.8 15.5H12.4L11.5 21H7.6Z'],
    fill: ['M7.4 2.5H13.2C16.5 2.5 18.2 4.3 17.7 7.4C17.1 11 14.8 12.7 11.4 12.7H9.6L8.6 19H4.4ZM10.6 5.9L10 9.6H11.4C12.9 9.6 13.8 8.8 14 7.6C14.2 6.5 13.6 5.9 12.3 5.9Z'],
  },
  spotify: {
    fill: [circle(12, 12, 10.5)],
    cut: [
      { d: 'M6.3 9.2C10 8.1 14.6 8.5 17.9 10.4', w: 2 },
      { d: 'M6.9 12.6C10 11.8 13.6 12.1 16.4 13.7', w: 1.7 },
      { d: 'M7.5 15.8C10 15.2 12.7 15.5 14.9 16.8', w: 1.4 },
    ],
  },
  steam: {
    fill: [circle(12, 12, 10.5)],
    cut: [
      { d: circle(15.3, 8.9, 3.2), w: 1.7 },
      { d: 'M13 11.4L8.6 14.6', w: 2.6 },
      { d: circle(7.4, 15.6, 2), w: 1.4 },
    ],
  },
  xbox: {
    fill: [circle(12, 12, 10.5)],
    cut: [
      { d: 'M5.2 4.9C9.4 7.6 14.8 14 18.6 19.3', w: 2.3 },
      { d: 'M18.8 4.9C14.6 7.6 9.2 14 5.4 19.3', w: 2.3 },
    ],
  },
  playstation: {
    fill: [
      'M9.2 2.8L15.6 4.8C18.4 5.7 19.3 7.6 18.6 9.9C17.9 12.1 16 12.7 13.7 11.9V7.6C13.7 6.9 13.3 6.6 12.7 6.8V20.6L9.2 19.5Z',
      'M1.7 16.8C1.2 17.8 2.6 18.5 4.4 19.1L9.2 20.5V18.1L5.6 17C4.8 16.7 4.9 16.2 5.8 16.1C6.5 16 7.8 16.2 9.2 16.7V14.4C6.5 13.6 3.1 15 1.7 16.8Z',
      'M13.7 15.3V17.6L19.4 15.6C20.2 15.3 20.1 14.9 19.3 14.8C18.4 14.7 17.2 14.9 15.9 15.4L13.7 16.1V13.9L15.9 13.2C18.1 12.5 20.8 12.4 22.2 13.3C23.4 14.1 22.9 15.4 20.9 16.2Z',
    ],
  },
  nintendo: {
    fill: [
      'M10.6 2H7.2A5.2 5.2 0 0 0 2 7.2V16.8A5.2 5.2 0 0 0 7.2 22H10.6ZM8.6 4V20H7.2A3.2 3.2 0 0 1 4 16.8V7.2A3.2 3.2 0 0 1 7.2 4Z' + circle(6.6, 8, 1.8),
      'M13.4 2H16.8A5.2 5.2 0 0 1 22 7.2V16.8A5.2 5.2 0 0 1 16.8 22H13.4Z' + circle(17.2, 14.6, 2),
    ],
  },
  website: {
    stroke: [
      { d: circle(12, 12, 9.6), w: 1.8 },
      { d: ellipse(12, 12, 4.2, 9.6), w: 1.6 },
      { d: 'M2.6 12H21.4M4 7H20M4 17H20', w: 1.6 },
    ],
  },
  heart: {
    fill: ['M12 21.2C5 15.6 2 12.4 2 8.5C2 5.4 4.4 3 7.3 3C9.2 3 10.9 4 12 5.6C13.1 4 14.8 3 16.7 3C19.6 3 22 5.4 22 8.5C22 12.4 19 15.6 12 21.2Z'],
  },
  star: {
    fill: [starPath(5, 12, 12.9, 10.8, 4.6)],
  },
  bolt: {
    fill: ['M13.8 1.8L3.8 13.6H11L9.4 22.2L20.2 9.9H13Z'],
  },
  crown: {
    fill: ['M2.2 6.8L7.4 11.4L12 3.6L16.6 11.4L21.8 6.8L19.6 17.6H4.4Z', 'M4.4 19.2H19.6V21.4H4.4Z', circle(2.2, 6.3, 1.4), circle(12, 3.2, 1.4), circle(21.8, 6.3, 1.4)],
  },
  trophy: {
    fill: ['M6.2 2.8H17.8V9C17.8 12.6 15.4 15 12.9 15.4V18H16.4V21.2H7.6V18H11.1V15.4C8.6 15 6.2 12.6 6.2 9Z'],
    stroke: [
      { d: 'M6.4 5H3.4V7.4C3.4 9.8 5 11.2 7.2 11.3', w: 1.8 },
      { d: 'M17.6 5H20.6V7.4C20.6 9.8 19 11.2 16.8 11.3', w: 1.8 },
    ],
  },
  gift: {
    fill: ['M2.8 7.8H21.2V12H2.8Z', 'M4.3 13.3H19.7V21.6H4.3Z'],
    stroke: [{ d: 'M12 7.8C10.4 4.6 6.9 3.3 6.4 5.6C6 7.5 9.4 7.8 12 7.8C14.6 7.8 18 7.5 17.6 5.6C17.1 3.3 13.6 4.6 12 7.8Z', w: 1.8 }],
    cut: [{ d: 'M12 7.8V21.8', w: 2.2 }],
  },
  music: {
    fill: ['M8 6.2L20.2 3.2V16A3.1 3.1 0 1 1 18.1 13.1V7.7L10.1 9.6V18.2A3.1 3.1 0 1 1 8 15.3Z'],
  },
  mic: {
    fill: [rrect(8.4, 2, 7.2, 12.6, 3.6)],
    stroke: [
      { d: 'M5 10.8A7 7 0 0 0 19 10.8', w: 1.9 },
      { d: 'M12 17.8V21.4M8.4 21.4H15.6', w: 1.9 },
    ],
  },
  camera: {
    fill: [
      'M2 8.2A2.2 2.2 0 0 1 4.2 6H7.1L8.6 3.8H15.4L16.9 6H19.8A2.2 2.2 0 0 1 22 8.2V17.8A2.2 2.2 0 0 1 19.8 20H4.2A2.2 2.2 0 0 1 2 17.8Z' +
        circle(12, 13, 4.4) +
        circle(12, 13, 2.6),
    ],
  },
  gamepad: {
    fill: ['M7 6.4H17C20 6.4 21.6 8.9 22.3 12.4L23 16.4C23.4 18.6 21.4 19.8 19.8 18.4L16.8 15.8H7.2L4.2 18.4C2.6 19.8 0.6 18.6 1 16.4L1.7 12.4C2.4 8.9 4 6.4 7 6.4Z'],
    cut: [{ d: 'M5.2 11.3H9.4M7.3 9.2V13.4', w: 1.7 }, { d: circle(16, 10.1, 1.15) }, { d: circle(18.3, 12.4, 1.15) }],
  },
  chat: {
    fill: ['M4.2 3.4H19.8A2.2 2.2 0 0 1 22 5.6V15.4A2.2 2.2 0 0 1 19.8 17.6H10.4L5.6 21.6V17.6H4.2A2.2 2.2 0 0 1 2 15.4V5.6A2.2 2.2 0 0 1 4.2 3.4Z'],
    cut: [{ d: circle(7.6, 10.5, 1.35) }, { d: circle(12, 10.5, 1.35) }, { d: circle(16.4, 10.5, 1.35) }],
  },
  fire: {
    fill: [
      'M12 22.2C7.6 22.2 4.4 19.1 4.4 14.8C4.4 11 6.9 8.7 8.3 6.1C9 7.7 9.5 9 10.8 9.8C11 6.4 12.4 3.8 15.1 1.8C15.1 5.6 19.6 8.3 19.6 14.6C19.6 19.1 16.4 22.2 12 22.2Z',
    ],
    cut: [{ d: 'M12 20.2C10.3 20.2 9 18.9 9 17.1C9 15.3 10.4 14.2 11.2 12.6C11.8 14 13.4 14.6 13.4 12.8C14.6 14 15 15.6 15 17.1C15 18.9 13.7 20.2 12 20.2Z' }],
  },
}

export const ICON_KINDS = Object.keys(GLYPHS) as IconKind[]

export const ICON_LABELS: Record<IconKind, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  discord: 'Discord',
  x: 'X',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  bluesky: 'Bluesky',
  github: 'GitHub',
  patreon: 'Patreon',
  kofi: 'Ko-fi',
  paypal: 'PayPal',
  spotify: 'Spotify',
  steam: 'Steam',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  nintendo: 'Nintendo',
  website: 'Website',
  heart: 'Heart',
  star: 'Star',
  bolt: 'Bolt',
  crown: 'Crown',
  trophy: 'Trophy',
  gift: 'Gift',
  music: 'Music',
  mic: 'Microphone',
  camera: 'Camera',
  gamepad: 'Gamepad',
  chat: 'Chat',
  fire: 'Fire',
}

// BRAND_COLORS are the platforms' colors, lightened where the brand is black
// (it would vanish on a dark stream).
export const BRAND_COLORS: Partial<Record<IconKind, string>> = {
  twitch: '#9146ff',
  youtube: '#ff0000',
  kick: '#53fc18',
  discord: '#5865f2',
  x: '#ffffff',
  tiktok: '#25f4ee',
  instagram: '#e4405f',
  facebook: '#1877f2',
  threads: '#ffffff',
  bluesky: '#1185fe',
  github: '#ffffff',
  patreon: '#ff424d',
  kofi: '#ff5e5b',
  paypal: '#0079c1',
  spotify: '#1db954',
  steam: '#66c0f4',
  xbox: '#107c10',
  playstation: '#0070d1',
  nintendo: '#e60012',
}

export const isIconKind = (v: unknown): v is IconKind => typeof v === 'string' && v in GLYPHS

// iconColor is the color an icon is drawn in: color when set, else the
// brand's, else white.
export const iconColor = (kind: unknown, color: unknown): string =>
  (typeof color === 'string' && color) || (isIconKind(kind) && BRAND_COLORS[kind]) || '#ffffff'
