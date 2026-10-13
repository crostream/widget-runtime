# @crostream/widget-runtime

The CroStream widget runtime, as a package: the sandboxed frame that runs a
widget, the host library that embeds it in a page, the renderer behind the
`<sl-*>` building blocks, the model of the `sl` API, the `.csw` format types
and the `crostream-widget check` command.

CroStream widgets are small HTML + CSS + JS packages (`.csw` files) that draw
live overlays: alerts, goals, chat. This package is the part that runs them,
extracted from the CroStream app so the app, the public gallery and widget
authors' tools share one implementation.

```sh
npm install @crostream/widget-runtime
```

Node 20 or newer. Svelte 5 is an optional peer dependency: only `./render`
needs it. The host, the API model, the format types and the tooling work
without it.

## What is in it

| Export | What |
| --- | --- |
| `@crostream/widget-runtime` | The host: `mount`, its types, `defaultTheme`, `PROTOCOL`, `API_LEVEL`. No Svelte. |
| `./protocol` | `PROTOCOL`, `API_LEVEL`, `FRAME_PATH`, `ASSET_PREFIX`, `MEDIA_PREFIX`, `EMOTE_PREFIX`, `ROOT_ID`, `BLEED`, `assetPath`, and the host/frame message types. |
| `./format` | Types of a `.csw` package and the gallery index, the media type, and the id/version/asset-path rules (the same expressions as the Go library). |
| `./api` | The model of the `sl` API: members, events, template syntax, snippets, `WIDGET_DTS` and `contextDts()` (TypeScript declarations), `scriptProblems()`, `TYPE_VARS`/`sampleVarsFor`, `WIDGET_ICONS`. |
| `./tooling` | The editor's template checker (`checkTemplate`, `scan`, `scopeAt`, ...) and the runtime's `compileTemplate`. No Node, no Svelte. |
| `./tooling/check` | The widget folder checks behind the CLI (Node): `checkFolder`, `checkPaths`, `typeCheck`, `checkScript`. |
| `./render` | The renderer: `FrameBox`, `StyledText`, `Glyph` (Svelte 5) and the pure functions behind them (`normEffects`, `planEffects`, `normFrame`, `fullTheme`, `resolveProps`, ...), shipped as preprocessed Svelte with types. |
| `./widget-frame.html` | The frame page: the runtime inlined in one HTML file. |
| `./contract.json` | The constants an embedding app must agree on, generated from `protocol.ts`. |

## Running a widget in a page

```ts
import { mount, defaultTheme } from '@crostream/widget-runtime'

const pkg = await (await fetch('/widgets/crostream.alert.json')).json() // a decoded .csw
const widget = mount(document.getElementById('box')!, pkg, {
  frameUrl: '/widget-frame.html', // the file from this package, served by your server
  theme: defaultTheme,
  mediaBase: location.origin + '/',
  fontsUrl: '/fonts.css',         // optional
})

widget.on('ready', () => widget.play())     // run the alert timeline
widget.on('error', (e) => console.warn(e.message, e.line, e.source))
widget.setFields({ headline: 'Hello {user}!' })
widget.setData({ chat: [] })
widget.destroy()
```

`mount` fills the container with a scaled stage holding one sandboxed iframe.
`mode` is `'editor'` (the default: inert, shows the widget's sample alert),
`'thumb'` (the same, for small cards) or `'output'` (interactive, as in OBS).
`play(eventType?, { sound? })` runs the alert timeline: the alert, its cue,
after the hold `leave`, then hide, then the idle sample again.

## What an embedding app must provide

The frame is a real document, not a `srcdoc`: a `srcdoc` frame would inherit
your page's strict policy and never run. Serve:

- `FRAME_PATH` (`/widget-frame.html`): the file `dist/widget-frame.html` of this
  package, from the same origin as the page that embeds it. It is loaded as
  `FRAME_PATH#<nonce>` inside `<iframe sandbox="allow-scripts">`; the host
  does that for you.
- `ASSET_PREFIX` (`/widget-assets/`): a widget's own assets, as
  `/widget-assets/<kind>/<path>` (what `sl.asset(path)` resolves to; `kind` is
  `mount`'s option, `gallery-<id>` by default).
- `/media/` (`/media/file/<id>`, `/media/thumb/<id>`, `/media/folder/<id>`) and
  `/emote/<id>`: the media library and chat emotes, what `sl.media(id)` and
  `sl.emote(id)` resolve to (against `mediaBase`).
- Optionally a fonts URL: a `@font-face` stylesheet. The host reads the faces a
  widget uses and hands the bytes to the frame (the frame has no network).

Serve the frame page with a policy of its own, the same as the Go servers'
`FrameCSP(origin)` (the runtime also adds the same policy as a `<meta>`, but
`sandbox` and `frame-ancestors` only work as a header):

```
Content-Security-Policy:
  sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline';
  style-src 'unsafe-inline';
  img-src <origin>/media/ <origin>/emote/ <origin>/widget-assets/ data: blob:;
  media-src <origin>/media/ <origin>/widget-assets/ data: blob:;
  font-src <origin>/widget-assets/ data: blob:; connect-src 'none';
  form-action 'none'; base-uri 'none'; frame-ancestors <origin>
```

Spell the origin out: `'self'` means nothing to an opaque origin. Do not send
`X-Frame-Options: DENY`. The page that embeds the frame can keep a strict
policy of its own; add the frame's origin to its `frame-src` if it sets one.

Security model in short: the frame has an opaque origin and no network, can't
reach its parent beyond `postMessage`, and messages are accepted only from the
frame's window carrying the nonce the host put in the frame URL's fragment. A
load after `ready` counts as the widget navigating away and the host stops it.
An embedding app that exposes privileged HTTP endpoints on the frame's origin
must refuse requests a navigation can send (GET) there.

`contract.json` carries the paths and prefixes above, the protocol and API
level, and the alert fields the frame consumes, for hosts that are not written
in TypeScript.

## API levels

A widget declares the platform API level it needs (`api` in its manifest); a
host refuses a widget above the level it implements. `API_LEVEL` is the highest
this package's frame implements; it mirrors `MaxAPI` in
[`github.com/crostream/csw`](https://github.com/crostream/csw).

| Level | Adds |
| --- | --- |
| 1 | The base `sl` API, templates and the `<sl-*>` blocks |
| 2 | `sl.alert`, `sl.leave`, `sl.sfx` |
| 3 | `sl.asset` (assets shipped in the package) |

`PROTOCOL` (the host/frame message protocol, currently 1) is separate: a host
and a frame must agree on it exactly.

## The renderer

```svelte
<script>
  import { FrameBox, StyledText } from '@crostream/widget-runtime/render'
</script>
```

Needs Svelte 5 (`svelte` resolution condition). Theme references (`theme:accent`)
resolve through `provideTheme`/`useTheme`; without a provider the default theme
is used.

## The command

```sh
npx crostream-widget check <dir…>
```

Each argument is a widget folder or a folder of widget folders. Both source
layouts are read, told apart by the manifest's keys:

- **csw source folders** (`widgets/<id>/`): `manifest.json` with `csw`, `id`,
  `version` (semver), `api`, and `widget.html`, `widget.css`, `widget.js`,
  `assets/`.
- **app gallery folders** (`gallery/<slug>/`): `manifest.json` with `format` and
  an integer `version`, and the same code files.

For every widget it checks: the identity (name, an icon from `WIDGET_ICONS`;
for csw the id, version, API level and that the folder is named after the id),
the template (with the runtime's compiler and the editor's checker) and the
script (type-checked against `WIDGET_DTS` plus the widget's own fields and
data, then the API's own checks such as unknown `sl.on` events and undeclared
`sl.data['…']` keys; `sl.fields` is typed by each field's kind, as in the app's editor). It prints `ok <name>` or `FAIL <name>: reason` and exits 1
if any widget failed.

## Versioning

Semantic versioning. A change to `PROTOCOL` (the message protocol between host
and frame) is a major version, as is dropping an export or raising the minimum
Node or Svelte version. New API levels (`API_LEVEL`), new `sl` members and new
checks are minor; fixes are patch. Checks only get stricter in a minor
version when they find real bugs in widgets that used to pass; the CLI's
exit code is the contract for CI.

## Development

```sh
npm install
npm run build   # tsc, svelte-package, vite: dist/
npm run check   # svelte-check + tsc
npm test        # vitest (run the build first)
WIDGETS=/path/to/widgets npm run dev   # dev page on 127.0.0.1:5199, /?w=<id>,<id>
```

## License

Apache-2.0. See [LICENSE](LICENSE).
