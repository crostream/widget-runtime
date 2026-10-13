// elements.svelte.ts: the building blocks as custom elements. Each element
// renders into its own shadow root by mounting a small Svelte component
// (blocks/*) around the built-in renderer (StyledText, FrameBox, Glyph), so a
// block looks exactly like the built-in element. The components' CSS is
// compiled as injected styles, which Svelte appends to the shadow root it
// mounts into.
//
// Attributes are parsed into one $state object the component reads, so an
// attribute change (the template re-render syncs attributes in place) updates
// the drawing without remounting. JSON attributes (effects, frame) that don't
// parse count as unset and are reported.
import { mount, unmount, type Component } from 'svelte'
import Frame from './blocks/Frame.svelte'
import Icon from './blocks/Icon.svelte'
import Media from './blocks/Media.svelte'
import Text from './blocks/Text.svelte'

type Parse = (v: string | null) => unknown

let report: (message: string) => void = (m) => console.error(m)

// setReporter routes attribute errors to the host.
export function setReporter(fn: (message: string) => void): void {
  report = fn
}

const str =
  (d = ''): Parse =>
  (v) =>
    v ?? d
const opt: Parse = (v) => (v === null || v === '' ? undefined : v)
const num =
  (d: number | undefined): Parse =>
  (v) => {
    if (v === null || v.trim() === '') return d
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
// Boolean attributes: present is true unless written "false" or "0".
const bool =
  (d: boolean): Parse =>
  (v) =>
    v === null ? d : v !== 'false' && v !== '0'
const json =
  (tag: string, name: string): Parse =>
  (v) => {
    if (v === null || v.trim() === '') return null
    try {
      const x = JSON.parse(v)
      return x && typeof x === 'object' ? x : null
    } catch {
      report(`<${tag}> ${name}: not valid JSON`)
      return null
    }
  }

interface Spec {
  tag: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<{ p: any }>
  attrs: Record<string, [prop: string, parse: Parse]>
  css: string
  // The element's text content stands in for this prop when its attribute
  // is missing: <sl-text>Hello</sl-text>.
  textProp?: string
  // Extra :host rules from the parsed props (sl-icon's size).
  hostCSS?: (p: Record<string, unknown>) => string
}

function define(spec: Spec): void {
  if (customElements.get(spec.tag)) return
  const names = Object.keys(spec.attrs)
  class Block extends HTMLElement {
    static observedAttributes = names
    p: Record<string, unknown>
    #app: Record<string, unknown> | null = null
    #style: HTMLStyleElement | null = null
    #mo: MutationObserver | null = null

    constructor() {
      super()
      const init: Record<string, unknown> = {}
      for (const n of names) init[spec.attrs[n][0]] = spec.attrs[n][1](null)
      this.p = $state(init)
    }

    connectedCallback() {
      if (spec.textProp && !this.#mo) {
        this.#mo = new MutationObserver(() => this.#syncText())
        this.#mo.observe(this, { childList: true, characterData: true, subtree: true })
        this.#syncText()
      }
      if (this.#app) return
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
      this.#style = document.createElement('style')
      this.#style.textContent = spec.css + (spec.hostCSS?.(this.p) ?? '')
      root.append(this.#style)
      this.#app = mount(spec.component, { target: root, props: { p: this.p } })
    }

    disconnectedCallback() {
      // A move (keyed re-render) disconnects and connects again at once.
      queueMicrotask(() => {
        if (this.isConnected || !this.#app) return
        void unmount(this.#app)
        this.#app = null
        this.#mo?.disconnect()
        this.#mo = null
        this.shadowRoot?.replaceChildren()
      })
    }

    attributeChangedCallback(name: string, _old: string | null, v: string | null) {
      const a = spec.attrs[name]
      if (!a) return
      this.p[a[0]] = a[1](v)
      if (name === spec.textProp) this.#syncText()
      if (spec.hostCSS && this.#style) this.#style.textContent = spec.css + spec.hostCSS(this.p)
    }

    #syncText() {
      const prop = spec.textProp
      if (!prop || this.hasAttribute(prop)) return
      const t = (this.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (this.p[prop] !== t) this.p[prop] = t
    }
  }
  customElements.define(spec.tag, Block)
}

export function defineBlocks(): void {
  define({
    tag: 'sl-text',
    component: Text,
    textProp: 'text',
    attrs: {
      text: ['text', str()],
      font: ['font', opt],
      size: ['size', num(32)],
      weight: ['weight', opt],
      italic: ['italic', bool(false)],
      color: ['color', str('#ffffff')],
      align: ['align', str('left')],
      valign: ['valign', str('top')],
      'line-height': ['lineHeight', opt],
      'letter-spacing': ['letterSpacing', num(undefined)],
      transform: ['transform', opt],
      layout: ['layout', (v) => (v === 'box' || v === 'inline' ? v : 'block')],
      'one-line': ['oneLine', bool(false)],
      effects: ['effects', json('sl-text', 'effects')],
    },
    css: ':host{display:block;position:relative;min-width:0}:host([layout=box]){width:100%;height:100%}:host([layout=inline]){display:inline-flex}:host([hidden]){display:none}',
  })
  define({
    tag: 'sl-frame',
    component: Frame,
    attrs: {
      frame: ['frame', json('sl-frame', 'frame')],
      layout: ['layout', (v) => (v === 'wrap' ? 'wrap' : 'fill')],
    },
    css: ':host{display:block;position:relative;width:100%;height:100%;box-sizing:border-box}:host([layout=wrap]){height:auto;min-width:0}:host([hidden]){display:none}',
  })
  define({
    tag: 'sl-icon',
    component: Icon,
    attrs: {
      icon: ['icon', str('heart')],
      color: ['color', str('')],
      size: ['size', num(undefined)],
    },
    css: ':host{display:inline-block;width:1em;height:1em;vertical-align:-0.125em}:host([hidden]){display:none}',
    hostCSS: (p) => (typeof p.size === 'number' && p.size > 0 ? `:host{width:${p.size}px;height:${p.size}px}` : ''),
  })
  define({
    tag: 'sl-media',
    component: Media,
    attrs: {
      media: ['media', str()],
      src: ['src', str()],
      asset: ['asset', str()],
      type: ['type', (v) => (v === 'image' || v === 'video' || v === 'audio' ? v : '')],
      fit: ['fit', str('contain')],
      radius: ['radius', num(0)],
      autoplay: ['autoplay', bool(false)],
      loop: ['loop', bool(false)],
      muted: ['muted', bool(false)],
      volume: ['volume', num(100)],
    },
    css: ':host{display:block;position:relative;width:100%;height:100%;overflow:hidden}:host([hidden]){display:none}',
  })
}
