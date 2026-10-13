// markup.ts: the HTML side of a widget: the template language
// (widget-runtime/template.ts), the re-render attributes (morph.ts), the
// building blocks (elements.svelte.ts) and the CSS hooks the runtime sets
// (main.ts cssVars, data-mode, #sl-root).
import { THEME_COLORS, THEME_FONTS } from './catalog.js'
import type { ApiCssVar, ApiTemplate } from './types.js'

export const TEMPLATE: ApiTemplate[] = [
  {
    syntax: '{{path}}',
    doc: 'Inserts the value, HTML-escaped. Objects and arrays are inserted as JSON (so `effects="{{fx}}"` passes an object to a building block); `null` and missing values as nothing.',
    example: '<h1>{{title}}</h1>',
  },
  {
    syntax: '{{{path}}}',
    doc: 'Inserts the value without escaping. Never use it for text viewers wrote.',
    example: '<div>{{{html}}}</div>',
  },
  {
    syntax: '{{! comment }}',
    doc: 'A comment; produces nothing.',
    example: '{{! the newest line is at the bottom }}',
  },
  {
    syntax: '{{#if path}} … {{/if}}',
    doc: 'Shows the block when the value is truthy. **Falsy** values are `false`, `0`, `""`, `null`, missing values and empty lists; everything else, including `"0"` and empty objects, is truthy. Takes exactly one path (no expressions).',
    example: '{{#if data.stream.live}}<span class="badge">LIVE</span>{{/if}}',
  },
  {
    syntax: '{{else if path}}',
    doc: 'Inside `{{#if}}` or `{{#unless}}`: shows its branch when the earlier ones were not shown and this value is truthy. `{{else unless path}}` is the negated form. Not allowed after `{{else}}`.',
    example: '{{#if data.stream.live}}Live{{else if data.stream.title}}Offline{{else}}…{{/if}}',
  },
  {
    syntax: '{{else}}',
    doc: 'Inside `{{#if}}` or `{{#unless}}`: shown when no branch was. Inside `{{#each}}`: shown when the list is empty (or missing).',
    example: '{{#if data.latest.twitch.follow}}{{data.latest.twitch.follow.vars.user}}{{else}}Be the first to follow!{{/if}}',
  },
  {
    syntax: '{{#unless path}} … {{/unless}}',
    doc: 'Shows the block when the value is falsy. Can have `{{else}}`.',
    example: '{{#unless data.stream.live}}<span>Offline</span>{{/unless}}',
  },
  {
    syntax: '{{#each path as item}} … {{/each}}',
    doc: 'Repeats for every entry of a list (or every property of an object), naming the entry `item`: `{{item}}`, `{{item.x}}`. `{{else}}` shows when it is empty. A loop renders at most 5,000 entries.',
    example: '{{#each data.chat as m}}\n  <li sl-key="{{m.id}}"><b>{{m.user}}</b> {{m.text}}</li>\n{{else}}\n  <li>No chat yet</li>\n{{/each}}',
  },
  {
    syntax: '{{#each path}} … {{this}} … {{/each}}',
    doc: 'Without `as name`, the entry is `{{this}}` (`{{this.x}}`). `this` is always the innermost entry; outside any loop it means the fields.',
    example: '{{#each data.credits.followers}}<span>{{this}}</span>{{/each}}',
  },
  {
    syntax: '{{@index}}',
    doc: "Inside `{{#each}}`: the innermost entry's position, from 0.",
    example: '{{#each data.leaders.bits.stream as r}}<li>{{@index}}. {{r.user}}</li>{{/each}}',
  },
  {
    syntax: '{{@key}}',
    doc: "Inside `{{#each}}`: the innermost entry's index, or its property name when looping over an object.",
    example: '{{#each data.stream as v}}<div>{{@key}}: {{v}}</div>{{/each}}',
  },
  {
    syntax: '{{@first}}',
    doc: 'Inside `{{#each}}`: `true` for the first entry. Use it in a condition: `{{#if @first}}`.',
    example: '<li class="{{#if @first}}gold{{/if}}">{{r.user}}</li>',
  },
  {
    syntax: '{{@last}}',
    doc: 'Inside `{{#each}}`: `true` for the last entry.',
    example: '{{#each items as i}}{{i.text}}{{#unless @last}}, {{/unless}}{{/each}}',
  },
  {
    syntax: '{{data.key}}',
    doc: "[Live data](#live-data) the widget declared, read exactly like `sl.data` in a script: keys nest by dots, so `{{data.counter.subs}}` is the key `counter.subs`, `{{data.counter}}` is every declared `counter.*` key as one object (loop over it with `{{#each data.counter as n}}`, `{{@key}}` is the name), and `data.latest.twitch.cheer.vars.user` reads `.vars.user` inside the key `latest.twitch.cheer`. Where nesting can't reach a key, the longest whole key wins. A key with a space can't be written as a path; read it in your script.",
    example: '{{data.latest.twitch.cheer.vars.user}} cheered {{data.latest.twitch.cheer.vars.bits}}. Subs: {{data.counter.subs}}',
  },
  {
    syntax: '{{fieldKey}}',
    doc: 'A field of that name: `{{title}}` reads the field `title`. `{{fields.title}}` reads it explicitly. A field named `size`, `theme`, `mode` or `visible` hides the environment value of that name.',
    example: '<div style="color: {{color}}; font-family: {{font}};">{{title}}</div>',
  },
  {
    syntax: '{{fields.key}}',
    doc: 'A field, explicitly (never the environment, even for a field named `size`).',
    example: '{{fields.title}}',
  },
  {
    syntax: '{{theme.colors.x}}',
    doc: "The overlay's theme: `theme.colors.primary`, `secondary`, `accent`, `text`, `muted`, `panel`, `border`, `highlight`; `theme.fonts.heading`, `theme.fonts.body`. `{{@theme.…}}` always means the theme, even with a field named `theme`.",
    example: '<span style="color: {{theme.colors.accent}}">{{title}}</span>',
  },
  {
    syntax: '{{size.w}}',
    doc: "The element's size in canvas pixels: `size.w`, `size.h`. `{{@size.w}}` always means the element's size, even with a field named `size`.",
    example: '<canvas width="{{@size.w}}" height="{{@size.h}}" sl-keep></canvas>',
  },
  {
    syntax: '{{mode}}',
    doc: "Where the widget is drawn: `output` (OBS, **On stream** preview), `editor` or `thumb`. `{{@mode}}` always means the mode.",
    example: '<div class="mode-{{@mode}}"></div>',
  },
  {
    syntax: '{{visible}}',
    doc: 'Whether the element is shown right now. `{{@visible}}` always means the visibility.',
    example: '{{#if @visible}}<div class="enter"></div>{{/if}}',
  },
  {
    syntax: '{{alert.vars.user}}',
    doc: 'The live alert while one plays: `alert.vars.user`, `alert.type`, `alert.leaving`, `alert.hold`. Empty when no alert has arrived. `{{@alert.…}}` always means the alert, even with a field named `alert`.',
    example: '{{#if alert}}<h1>{{alert.vars.user}} just followed!</h1>{{/if}}',
  },
]

// TEMPLATE_ROOTS: the first path segments that are always valid besides
// field keys, each variables in scope and data.
export const TEMPLATE_ROOTS: { name: string; doc: string }[] = [
  { name: 'data', doc: 'The declared live data.' },
  { name: 'fields', doc: 'The fields, explicitly.' },
  { name: 'theme', doc: "The overlay's theme (`theme.colors.*`, `theme.fonts.*`)." },
  { name: 'size', doc: "The element's size (`size.w`, `size.h`)." },
  { name: 'mode', doc: '`output`, `editor` or `thumb`.' },
  { name: 'visible', doc: 'Whether the element is shown.' },
  { name: 'alert', doc: 'The live alert (`alert.vars.user`, `alert.type`).' },
  { name: 'this', doc: 'The innermost each entry (the fields outside a loop).' },
  { name: '@theme', doc: 'Always the theme, even with a field named `theme`.' },
  { name: '@size', doc: "Always the element's size, even with a field named `size`." },
  { name: '@mode', doc: 'Always the mode.' },
  { name: '@visible', doc: 'Always the visibility.' },
  { name: '@alert', doc: 'Always the live alert, even with a field named `alert`.' },
  { name: '@index', doc: "Inside `{{#each}}`: the entry's position, from 0." },
  { name: '@key', doc: "Inside `{{#each}}`: the entry's index or property name." },
  { name: '@first', doc: 'Inside `{{#each}}`: true for the first entry.' },
  { name: '@last', doc: 'Inside `{{#each}}`: true for the last entry.' },
]

// TEMPLATE_PATH is a valid path (template.ts PATH): segments of letters,
// digits, _, $ and -, the first optionally starting with @.
export const TEMPLATE_PATH = /^(@?[\w$-]+)(\.[\w$-]+)*$/

// ATTRS: attributes the runtime gives meaning to on any element.
export const ATTRS: { name: string; doc: string; example: string }[] = [
  {
    name: 'sl-key',
    doc: "Put it on the rows of a list, with a unique value per row (a chat message's `id`, a user name). A keyed row is matched by its key wherever it moves, so a list that gains a row at the top keeps its other rows, and their animations, instead of rebuilding them.",
    example: '<li sl-key="{{m.id}}">{{m.text}}</li>',
  },
  {
    name: 'sl-keep',
    doc: "Hands the element to your script. Renders leave its children alone, and any attributes the template doesn't set. Use it for any element your script fills or changes (a list it manages, a number it animates, a canvas). Without it, the next render resets your script's changes.",
    example: '<div id="meter" sl-keep></div>',
  },
]

// ELEMENTS: the building blocks, custom elements that draw exactly like the
// built-in elements. Boolean attributes count as on when present, unless
// written "false" or "0"; a frame or effects attribute that isn't valid
// JSON is reported and ignored.
export const ELEMENTS: { tag: string; doc: string; example: string; attrs: { name: string; doc: string; values?: string[] }[] }[] = [
  {
    tag: 'sl-text',
    doc: 'Text drawn by the built-in text renderer, with fonts and text effects (gradients, outlines, shadows, glow). The text is the `text` attribute, or the tag\'s content.',
    example: '<sl-text text="{{title}}" font="{{font}}" size="48" effects="{{fx}}" align="center"></sl-text>',
    attrs: [
      { name: 'text', doc: 'The text (or put it inside the tag).' },
      { name: 'font', doc: 'A CSS font-family list, usually a **Font** field.' },
      { name: 'size', doc: 'Font size in px (default 32).' },
      { name: 'weight', doc: 'Font weight, such as `700`.' },
      { name: 'italic', doc: 'Italic (boolean).' },
      { name: 'color', doc: 'Text color (default white). `theme:accent` references work.' },
      { name: 'align', doc: 'Horizontal alignment.', values: ['left', 'center', 'right'] },
      { name: 'valign', doc: 'Vertical alignment with `layout="box"` (default `top`).', values: ['top', 'middle', 'bottom'] },
      { name: 'line-height', doc: 'Line height.' },
      { name: 'letter-spacing', doc: 'Letter spacing in px.' },
      { name: 'transform', doc: 'CSS text-transform.', values: ['uppercase', 'lowercase', 'capitalize', 'none'] },
      { name: 'layout', doc: '`block` (default), `box` to fill its parent, or `inline`.', values: ['block', 'box', 'inline'] },
      { name: 'one-line', doc: 'Keep the text on one line (boolean).' },
      { name: 'effects', doc: 'The JSON of a **Text effects** field: `effects="{{fx}}"`.' },
    ],
  },
  {
    tag: 'sl-frame',
    doc: 'A frame (panel, border, badge shape, pattern, animated border) around its content, inset by the frame\'s padding.',
    example: '<sl-frame frame="{{panel}}" layout="fill">\n  <sl-text text="{{title}}"></sl-text>\n</sl-frame>',
    attrs: [
      { name: 'frame', doc: 'The JSON of a **Frame** field: `frame="{{panel}}"`.' },
      { name: 'layout', doc: '`fill` (default, fills its parent) or `wrap` (as tall as its content, for list rows).', values: ['fill', 'wrap'] },
    ],
  },
  {
    tag: 'sl-icon',
    doc: 'An icon from the built-in set, as the Icon element draws it, in its color or its brand color.',
    example: '<sl-icon icon="heart" size="32" color="{{theme.colors.accent}}"></sl-icon>',
    attrs: [
      { name: 'icon', doc: 'The icon name (default `heart`).' },
      { name: 'color', doc: 'Its color; empty for the brand color or white.' },
      { name: 'size', doc: 'Size in px (default 1em).' },
    ],
  },
  {
    tag: 'sl-media',
    doc: 'An image, video or sound from the media library. Video and sound start over on every play cue, like the built-in Image and Video elements; the editor plays video muted.',
    example: '<sl-media media="{{pic}}" fit="cover"></sl-media>',
    attrs: [
      { name: 'media', doc: 'A media library item ID, usually a **Media** field.' },
      { name: 'src', doc: 'Instead of media: a `/media/…` or `/emote/…` URL, or a `data:` or `blob:` URL.' },
      { name: 'asset', doc: "Instead of media: the path of one of the widget's own assets, such as `img/logo.png` (needs a `.csw` package with assets; see `sl.asset`)." },
      { name: 'type', doc: 'Without it, an image is tried first, then a video.', values: ['image', 'video', 'audio'] },
      { name: 'fit', doc: 'CSS object-fit (default `contain`).', values: ['contain', 'cover', 'fill', 'none', 'scale-down'] },
      { name: 'radius', doc: 'Corner radius in px.' },
      { name: 'autoplay', doc: 'Play video or sound at once (boolean).' },
      { name: 'loop', doc: 'Loop (boolean).' },
      { name: 'muted', doc: 'Muted (boolean). Always muted in the editor and when `sl.muted`.' },
      { name: 'volume', doc: 'Volume, 0 to 100 (default 100).' },
    ],
  },
]

export const CSS_VARS: ApiCssVar[] = [
  { name: '--sl-w', doc: "The element's width in canvas pixels (`sl.size.w`), such as `600px`.", example: 'width: calc(var(--sl-w) / 2);' },
  { name: '--sl-h', doc: "The element's height in canvas pixels (`sl.size.h`), such as `110px`.", example: 'font-size: calc(var(--sl-h) * 0.4);' },
  ...THEME_COLORS.map((c) => ({ name: `--sl-${c.name}`, doc: `${c.doc} Follows the overlay's theme (default \`${c.value}\`).`, example: `color: var(--sl-${c.name});` })),
  ...THEME_FONTS.map((f) => ({ name: `--sl-font-${f.name}`, doc: `${f.doc} Follows the overlay's theme.`, example: `font-family: var(--sl-font-${f.name});` })),
]

// CSS_HOOKS: selectors the runtime provides.
export const CSS_HOOKS: { selector: string; doc: string; example: string }[] = [
  {
    selector: '#sl-root',
    doc: "The element's box, which the template renders into. The frame reaches 96 px past it on every side so shadows and glows aren't cut off: size and position your layout with `#sl-root` (or a wrapper set to `width: 100%; height: 100%`), never with `body` or `html`.",
    example: '#sl-root { display: grid; place-items: center; }',
  },
  {
    selector: 'html[data-mode="editor"]',
    doc: 'Style per mode: `output` (OBS and **On stream** preview), `editor` or `thumb`.',
    example: 'html[data-mode="thumb"] .ticker { animation: none; }',
  },
]
