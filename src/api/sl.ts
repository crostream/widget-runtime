// sl.ts: the `sl` runtime object a widget's script gets (widget-runtime/
// main.ts, "The sl API"), member by member, and the events of sl.on. Docs
// follow crostream.io docs/development/widgets.md.
import { DATA_FAMILIES, SFX_NAMES, THEME_COLORS, THEME_FONTS } from './catalog.js'
import type { ApiEvent, ApiMember } from './types.js'

const prop = (path: string, type: string, doc: string, example?: string, children?: ApiMember[]): ApiMember => ({
  name: path.slice(path.lastIndexOf('.') + 1),
  path,
  kind: children ? 'object' : 'property',
  signature: `${path}: ${type}`,
  doc,
  example,
  children,
})

const dataChildren: ApiMember[] = DATA_FAMILIES.map((f) => {
  const name = f.prefix ? f.prefix.slice(0, -1) : f.key
  const type = f.prefix ? (f.prefix === 'latest.' || f.prefix === 'leaders.' ? 'object' : `Record<string, ${f.type}>`) : `${f.type} | undefined`
  return prop(`sl.data.${name}`, type, f.prefix ? `Nested by dots: \`sl.data.${f.key.replace(/<(\w+)>/g, '$1')}\` is the key \`${f.key}\`. ${f.doc}` : f.doc, f.example.startsWith('sl.') ? f.example : undefined)
})

export const SL: ApiMember = {
  name: 'sl',
  path: 'sl',
  kind: 'object',
  signature: 'sl: Sl',
  doc: "The widget runtime, passed to your script as `sl` (also `window.sl`). It's frozen and its properties are live getters, so read `sl.fields.x` and `sl.data.x` when you need them rather than copying them once.",
  example: "sl.on('data', () => console.log(sl.data))",
  children: [
    prop(
      'sl.fields',
      'Record<string, any>',
      "The element's field values, by key, with theme references resolved (a color set to `theme:accent` arrives as `#ff5cf0ff`). The same values the template reads as `{{key}}`.",
      'const goal = Math.max(1, Number(sl.fields.goal) || 1)',
    ),
    prop(
      'sl.data',
      'SlData',
      "The declared live data, both by full key (`sl.data['latest.twitch.cheer']`) and nested by dots (`sl.data.latest.twitch.cheer`). A key that hasn't been produced yet is missing, so always handle the empty case. A string key the widget doesn't declare (`sl.data['counter.sbus']`) is marked as an error in the editor: it is always `undefined`.",
      "const subs = Number(sl.data['counter.subs'] ?? 0)",
      dataChildren,
    ),
    prop('sl.size', 'SlSize', "`{w, h}`: the element's size in canvas pixels. Also `var(--sl-w)` and `var(--sl-h)` in CSS.", 'const x = Math.random() * sl.size.w', [
      prop('sl.size.w', 'number', "The element's width in canvas pixels."),
      prop('sl.size.h', 'number', "The element's height in canvas pixels."),
    ]),
    prop(
      'sl.theme',
      'SlTheme',
      "The overlay's theme: `{colors: {primary, secondary, accent, text, muted, panel, border, highlight}, fonts: {heading, body}}`. Also CSS variables: `var(--sl-accent)`, `var(--sl-font-heading)`…",
      'el.style.color = sl.theme.colors.accent',
      [
        prop(
          'sl.theme.colors',
          'SlThemeColors',
          'The theme colors, as `#rrggbbaa` strings.',
          undefined,
          THEME_COLORS.map((c) => prop(`sl.theme.colors.${c.name}`, 'string', `${c.doc} CSS: \`var(--sl-${c.name})\`.`)),
        ),
        prop(
          'sl.theme.fonts',
          'SlThemeFonts',
          'The theme fonts, as CSS `font-family` lists.',
          undefined,
          THEME_FONTS.map((f) => prop(`sl.theme.fonts.${f.name}`, 'string', `${f.doc} CSS: \`var(--sl-font-${f.name})\`.`)),
        ),
      ],
    ),
    prop(
      'sl.mode',
      "'output' | 'editor' | 'thumb'",
      "Where the widget is drawn: `'output'` on the overlay page (OBS) and in **On stream** preview; `'editor'` on the editor canvas and **Editor** preview; `'thumb'` in thumbnails. Play sounds only in `'output'`.",
      "if (sl.mode !== 'output') return",
    ),
    prop('sl.visible', 'boolean', 'Whether the element is shown right now (actions and alerts can hide it). The `show` and `hide` events fire when it changes.'),
    prop('sl.muted', 'boolean', "Whether the element's sound should stay silent (an alert plays it through the PC instead). The `muted` event fires when it changes.", 'if (sl.muted) return'),
    prop(
      'sl.alert',
      'SlAlert | null',
      "The live alert, or `null` until one arrives: `{id, type, vars, hold, in, out, age, test, sample, leaving}`. `vars` are the run's values (`vars.user`, `vars.amount`…), `hold` the milliseconds until the Out transition starts, `in`/`out` the `{kind, ms}` transitions, `age` the milliseconds already elapsed when it reached the frame, `sample` true for an editor preview. The object is frozen; `leaving` is true on the one the `leave` event gets. The template reads it as `{{alert.vars.user}}`.",
      "const who = sl.alert?.vars.user ?? 'someone'",
    ),
    prop(
      'sl.sfx',
      'SlSfx',
      "Built-in sound effects, synthesized in the frame (no files): `sl.sfx.play('coin')`, `sl.sfx.tone(440)`. They stay silent when `sl.muted`, in thumbnails, and in the editor except while you press **Play**. `sl.sfx.names` lists the presets, `sl.sfx.enabled` whether a sound would play right now.",
      "sl.on('alert', () => sl.sfx.play('levelup', { volume: 0.7 }))",
      [
        prop('sl.sfx.names', 'readonly SlSfxName[]', `The presets: ${SFX_NAMES.join(', ')}.`),
        prop('sl.sfx.enabled', 'boolean', 'Whether `play` and `tone` make sound right now: not muted, and either on the stream output or during an editor audition.'),
        {
          name: 'play',
          path: 'sl.sfx.play',
          kind: 'function',
          signature: 'sl.sfx.play(name: SlSfxName, options?: SlSfxOptions): void',
          doc: 'Plays a preset. `volume` is 0 to 1 (default 0.8), `pitch` a multiplier from 0.25 to 4, `pan` -1 (left) to 1 (right), `delay` milliseconds to wait. An unknown name is ignored.',
          params: [
            { name: 'name', type: 'SlSfxName', doc: 'A preset name.' },
            { name: 'options', type: 'SlSfxOptions', doc: '`{volume, pitch, delay, pan}`, all optional.', optional: true },
          ],
          returns: 'Nothing.',
          example: "sl.sfx.play('coin', { pitch: 1.2, pan: -0.3 })",
        },
        {
          name: 'stop',
          path: 'sl.sfx.stop',
          kind: 'function',
          signature: 'sl.sfx.stop(): void',
          doc: 'Cuts every sound this widget is playing or has scheduled with a `delay`, at once. Call it when an alert ends early or restarts.',
          returns: 'Nothing.',
          example: "sl.on('leave', () => sl.sfx.stop())",
        },
        {
          name: 'tone',
          path: 'sl.sfx.tone',
          kind: 'function',
          signature: 'sl.sfx.tone(freq: number, options?: { ms?, type?, volume?, delay?, glide? }): void',
          doc: 'Plays one note: `freq` in Hz, `ms` long (default 200), an oscillator `type` (`sine`, `square`, `sawtooth` or `triangle`; default `sine`), and `glide` to slide to another frequency over the note.',
          params: [
            { name: 'freq', type: 'number', doc: 'Frequency in Hz (20 to 20000).' },
            { name: 'options', type: '{ ms?: number; type?: OscillatorType; volume?: number; delay?: number; glide?: number }', doc: 'All optional.', optional: true },
          ],
          returns: 'Nothing.',
          example: "sl.sfx.tone(440, { ms: 300, type: 'triangle', glide: 880 })",
        },
      ],
    ),
    prop('sl.root', 'HTMLElement', 'The element the template renders into (`#sl-root`): the widget\'s box. Look up your elements from here.', "const box = sl.root.querySelector('.chat')"),
    prop('sl.manual', 'boolean', 'Set to `true` to stop the automatic re-renders, then call `sl.render()` when you want one. Use it when your script drives the page on its own (a canvas animation, a game). The only writable property.', 'sl.manual = true'),
    {
      name: 'on',
      path: 'sl.on',
      kind: 'function',
      signature: 'sl.on(event: SlEvent, handler: (...payload) => void): () => void',
      doc: "Listens for an event: `'data'`, `'fields'`, `'cue'`, `'size'`, `'theme'`, `'show'`, `'hide'`, `'muted'`, `'alert'` or `'leave'`. Returns a function that stops listening. Handlers run before the re-render the change causes; one that throws is reported and doesn't stop the others. Any other name never fires: the editor marks it as an error, and the preview's error list reports it once per name.",
      params: [
        { name: 'event', type: 'SlEvent', doc: 'The event name.' },
        { name: 'handler', type: '(...payload) => void', doc: 'Called with the event\'s payload (see each event).' },
      ],
      returns: '() => void: call it to stop listening.',
      example: "const off = sl.on('data', (keys) => {\n  if (keys.includes('chat')) draw()\n})",
    },
    {
      name: 'get',
      path: 'sl.get',
      kind: 'function',
      signature: 'sl.get(path: string): any',
      doc: "Reads a template path, exactly as `{{path}}` would: `sl.get('data.latest.twitch.cheer.vars.user')`. Returns `undefined` when it doesn't resolve. Like the template, `data.…` reads like `sl.data`: nested by dots (`sl.get('data.counter.subs')`, or `sl.get('data.counter')` for every counter), else by the longest whole key.",
      params: [{ name: 'path', type: 'string', doc: 'A template path: `data.…`, `fields.…`, a field key, `theme.…`, `size.…`, `mode`, `visible`, or `@size.w` and the like.' }],
      returns: 'The value, or `undefined`.',
      example: "const user = sl.get('data.latest.twitch.follow.vars.user')\nconst subs = sl.get('data.counter.subs')",
    },
    {
      name: 'render',
      path: 'sl.render',
      kind: 'function',
      signature: 'sl.render(): void',
      doc: 'Renders the template now, even when nothing changed. With `sl.manual = true` it is the only way the template renders.',
      returns: 'Nothing.',
      example: 'sl.manual = true\nsetInterval(() => sl.render(), 1000)',
    },
    {
      name: 'media',
      path: 'sl.media',
      kind: 'function',
      signature: 'sl.media(id: string): string',
      doc: 'The URL of a media library item (`/media/file/<id>`), for `<img>`, `<video>`, `<audio>` or `new Audio()`. Pass a **Media** field\'s value.',
      params: [{ name: 'id', type: 'string', doc: 'A media library item ID (`"media-…"`), usually `sl.fields.<media field>`.' }],
      returns: 'An absolute URL the sandbox may load.',
      example: 'new Audio(sl.media(sl.fields.sound)).play()',
    },
    {
      name: 'emote',
      path: 'sl.emote',
      kind: 'function',
      signature: 'sl.emote(id: string): string',
      doc: 'The URL of a Twitch emote image (`/emote/<id>`), by emote ID. Chat lines carry their emotes as `{id, name}`.',
      params: [{ name: 'id', type: 'string', doc: 'A Twitch emote ID, such as `chatLine.emotes[0].id`.' }],
      returns: 'An absolute URL the sandbox may load.',
      example: 'img.src = sl.emote(e.id)',
    },
    {
      name: 'asset',
      path: 'sl.asset',
      kind: 'function',
      signature: 'sl.asset(path: string): string',
      doc: "The URL of one of the widget's own assets: a file that ships inside its `.csw` package (an image, sound or font), such as `img/logo.png`. Needs API level 3. Throws when `path` is not a valid asset path; a path the widget doesn't declare loads nothing (404).",
      params: [{ name: 'path', type: 'string', doc: "The asset's path in the package, such as `img/logo.png` or `sfx/hit.ogg`." }],
      returns: 'An absolute URL the sandbox may load (images, sounds and fonts).',
      example: "img.src = sl.asset('img/logo.png')",
    },
  ],
}

export const EVENTS: ApiEvent[] = [
  {
    name: 'data',
    doc: "Declared live data changed. Gets the changed or removed keys (full keys, such as `'chat'` or `'counter.subs'`) and `sl.data`.",
    payload: '(keys: string[], data: SlData)',
    example: "sl.on('data', (keys) => {\n  if (keys.includes('chat')) draw()\n})",
  },
  {
    name: 'fields',
    doc: 'Field values changed: the inspector, **Try values**, or the **Set overlay text** action. Gets all current field values.',
    payload: '(fields: SlFields)',
    example: "sl.on('fields', (fields) => update())",
  },
  {
    name: 'cue',
    doc: 'The element was told to play: the **Play media or fire an effect** action, or an alert that includes it. Gets `{n, at}`: `n` counts cues since the page loaded, `at` is when it was seen (`performance.now()`).',
    payload: '(cue: SlCue)',
    example: "sl.on('cue', () => {\n  if (sl.mode !== 'output' || sl.muted) return\n  new Audio(sl.media(sl.fields.sound)).play()\n})",
  },
  {
    name: 'size',
    doc: 'The element was resized. Gets `{w, h}` in canvas pixels.',
    payload: '(size: SlSize)',
    example: "sl.on('size', ({ w, h }) => resize(w, h))",
  },
  {
    name: 'theme',
    doc: "The overlay's theme changed. Gets `{colors, fonts}`.",
    payload: '(theme: SlTheme)',
    example: "sl.on('theme', (theme) => (canvas.style.background = theme.colors.panel))",
  },
  {
    name: 'show',
    doc: "The element's live visibility changed to shown (`sl.visible` is now true). Gets nothing.",
    payload: '()',
    example: "sl.on('show', () => restart())",
  },
  {
    name: 'hide',
    doc: "The element's live visibility changed to hidden (`sl.visible` is now false). Gets nothing.",
    payload: '()',
    example: "sl.on('hide', () => pause())",
  },
  {
    name: 'muted',
    doc: '`sl.muted` changed. Gets the new value.',
    payload: '(muted: boolean)',
    example: "sl.on('muted', (muted) => (audio.muted = muted))",
  },
  {
    name: 'alert',
    doc: 'An alert was shown on this element: `sl.alert` is now set. Fires before the `cue` of the same show. Gets the alert.',
    payload: '(alert: SlAlert)',
    example: "sl.on('alert', (a) => {\n  title.textContent = a.vars.user\n  sl.sfx.play('coin')\n})",
  },
  {
    name: 'leave',
    doc: "The alert's Out transition started (`sl.alert.leaving` is now true): play your exit animation. Gets the alert.",
    payload: '(alert: SlAlert)',
    example: "sl.on('leave', () => card.classList.add('out'))",
  },
]

// flatMembers lists every member of the tree, depth first.
export function flatMembers(m: ApiMember = SL): ApiMember[] {
  return [m, ...(m.children ?? []).flatMap((c) => flatMembers(c))]
}
