// types.ts: the parsed attributes each building block component gets as p.
import type { FrameStyle, TextEffects } from '../../render/types.js'

export interface TextAttrs {
  text: string
  font?: string
  size: number
  weight?: string
  italic: boolean
  color: string
  align: string
  valign: string
  lineHeight?: number | string
  letterSpacing?: number
  transform?: string
  layout: 'box' | 'block' | 'inline'
  oneLine: boolean
  effects: Partial<TextEffects> | null
}

export interface FrameAttrs {
  frame: Partial<FrameStyle> | null
  layout: 'fill' | 'wrap'
}

export interface IconAttrs {
  icon: string
  color: string
}

export interface MediaAttrs {
  media: string
  src: string
  asset: string
  type: '' | 'image' | 'video' | 'audio'
  fit: string
  radius: number
  autoplay: boolean
  loop: boolean
  muted: boolean
  volume: number
}
