// snippets.ts: insertable snippets per language, drawn from the docs'
// tutorial and cookbook (crostream.io docs/development/widgets.md).
//
// Bodies use CodeMirror's snippet syntax. They are written here with the
// #{1:name} form of a field (CodeMirror accepts #{…} and ${…} alike) so
// they can live in template literals; a literal "${" in the inserted code
// is written $\\{ … \\} (inserted as ${ … }). Two-space indents become tabs,
// which CodeMirror turns into the editor's indent unit.
import type { ApiSnippet } from './types.js'

const snip = (label: string, lang: ApiSnippet['lang'], detail: string, body: string): ApiSnippet => ({
  label,
  lang,
  detail,
  body: body
    .replace(/^\n/, '')
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => l.replace(/^((?: {2})+)/, (m) => '\t'.repeat(m.length / 2)))
    .join('\n'),
})

export const SNIPPETS: ApiSnippet[] = [
  // ---- HTML ----
  snip('each', 'html', 'Repeat for every entry of a list, keyed', `
{{#each #{1:data.chat} as #{2:m}}}
  <div class="row" sl-key="{{#{2:m}.#{3:id}}}">#{0}</div>
{{else}}
  <div class="empty">#{4:Nothing yet}</div>
{{/each}}
`),
  snip('if', 'html', 'Show a block when a value is truthy', `
{{#if #{1:data.stream.live}}}
  #{2}
{{else}}
  #{0}
{{/if}}
`),
  snip('unless', 'html', 'Show a block when a value is falsy', `
{{#unless #{1:data.stream.live}}}
  #{0}
{{/unless}}
`),
  snip('sl-text', 'html', 'Text drawn like the built-in text elements', `
<sl-text text="{{#{1:title}}}" font="{{#{2:font}}}" size="#{3:48}" effects="{{#{4:fx}}}" align="#{5:center}"></sl-text>
`),
  snip('sl-frame', 'html', 'A frame around content (from a Frame field)', `
<sl-frame frame="{{#{1:panel}}}" layout="#{2:fill}">
  #{0}
</sl-frame>
`),
  snip('sl-media', 'html', 'An image, video or sound from the media library', `
<sl-media media="{{#{1:pic}}}" fit="#{2:cover}"></sl-media>
`),
  snip('sl-icon', 'html', 'An icon from the built-in set', `
<sl-icon icon="#{1:heart}" size="#{2:32}" color="{{theme.colors.accent}}"></sl-icon>
`),
  snip('chat list', 'html', 'Chat lines from the template alone (declare chat)', `
<div class="chat">
  {{#each data.chat as m}}
    <div class="row" sl-key="{{m.id}}"><b>{{m.user}}</b> {{m.text}}</div>
  {{/each}}
</div>
`),
  snip('latest follower', 'html', 'The latest follower, with a fallback (declare latest.*)', `
{{#if data.latest.twitch.follow}}
  Latest follower: {{data.latest.twitch.follow.vars.user}}
{{else}}
  #{1:Be the first to follow!}
{{/if}}
`),
  snip('events ticker', 'html', 'A scrolling strip of the latest follower, sub, cheer and raid', `
<div class="ticker">
  <div class="track" style="animation-duration: {{#{1:speed}}}s;">
    <span class="lane">
      {{#if data.latest.twitch.follow}}<span><i>Follower</i> {{data.latest.twitch.follow.vars.user}}</span>{{/if}}
      {{#if data.latest.twitch.sub}}<span><i>Sub</i> {{data.latest.twitch.sub.vars.user}}</span>{{/if}}
      {{#if data.latest.twitch.cheer}}<span><i>Cheer</i> {{data.latest.twitch.cheer.vars.user}} ({{data.latest.twitch.cheer.vars.bits}})</span>{{/if}}
      {{#if data.latest.twitch.raid}}<span><i>Raid</i> {{data.latest.twitch.raid.vars.user}} ({{data.latest.twitch.raid.vars.viewers}})</span>{{/if}}
    </span>
  </div>
</div>
`),
  snip('sub goal', 'html', 'A goal bar whose count and fill the script owns', `
<div class="goal" style="--bar: {{#{1:bar}}}; --track: {{#{2:track}}};">
  <div class="head">
    <span class="title">{{#{3:title}}}</span>
    <span class="count"><span id="now" sl-keep>0</span> / {{#{4:goal}}}</span>
  </div>
  <div class="track">
    <div id="fill" class="fill" sl-keep></div>
  </div>
</div>
`),
  snip('leaderboard', 'html', 'Top viewers from a leaderboard key', `
<div class="board">
  <h2>{{#{1:title}}}</h2>
  <ol>
    {{#each data.leaders.#{2:points}.#{3:all} as r}}
      <li sl-key="{{r.user}}" class="{{#if @first}}gold{{/if}}">
        <span class="who">{{r.user}}</span>
        <span class="val">{{r.value}}</span>
      </li>
    {{else}}
      <li class="empty">#{4:No one yet}</li>
    {{/each}}
  </ol>
</div>
`),
  snip('stream card', 'html', 'Live badge, title, category and viewers (declare stream)', `
<div class="card {{#if data.stream.live}}live{{/if}}">
  <span class="badge">{{#if data.stream.live}}LIVE{{else}}OFFLINE{{/if}}</span>
  {{#if data.stream.live}}<span class="viewers">{{data.stream.viewers}} watching</span>{{/if}}
  <div class="title">{{data.stream.title}}</div>
  <div class="cat">{{data.stream.category}}</div>
</div>
`),
  snip('folder gallery', 'html', "A Media folder field's files (declare folder.*)", `
{{#each data.folders.#{1:pics} as m}}
  <sl-media media="{{m.id}}" type="{{m.kind}}" fit="cover"></sl-media>
{{/each}}
`),
  snip('script-owned', 'html', 'An element the script fills (renders leave it alone)', `
<div id="#{1:out}" sl-keep></div>
`),

  // ---- CSS ----
  snip('widget box', 'css', 'Fill the element box with the theme panel', `
.#{1:widget} {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 20px;
  border-radius: 14px;
  background: var(--sl-panel);
  color: var(--sl-text);
  font-family: var(--sl-font-body);
  overflow: hidden;
}
`),
  snip('theme heading', 'css', 'A heading in the theme font and accent', `
#{1:h2} {
  margin: 0 0 10px;
  font: 800 26px var(--sl-font-heading);
  color: var(--sl-accent);
}
`),
  snip('slide in', 'css', 'Slide new rows in (keep them with sl-key)', `
.#{1:row} {
  animation: in 0.3s ease-out both;
}
@keyframes in {
  from { opacity: 0; transform: translateX(-20px); }
}
`),
  snip('goal bar', 'css', 'A track and a fill that glides and glows when done', `
.track {
  height: 26px;
  border-radius: 13px;
  background: var(--track);
  overflow: hidden;
}
.fill {
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--bar);
  transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.fill.done {
  box-shadow: 0 0 18px var(--bar);
  animation: pulse 1.2s ease-in-out infinite alternate;
}
@keyframes pulse {
  to { filter: brightness(1.35); }
}
`),
  snip('ticker scroll', 'css', 'A seamless horizontal scroll (two identical lanes)', `
.ticker {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.track {
  display: flex;
  white-space: nowrap;
  animation: scroll linear infinite;
}
@keyframes scroll {
  to { transform: translateX(-50%); }
}
`),
  snip('per mode', 'css', 'Style for the editor or thumbnails only', `
html[data-mode="#{1:editor}"] .#{2:widget} {
  #{0}
}
`),
  snip('size from element', 'css', "Scale with the element's size", `
.#{1:widget} {
  font-size: calc(var(--sl-h) * #{2:0.4});
}
`),

  // ---- JS ----
  snip("sl.on('data')", 'js', 'React when a declared key changes', `
sl.on('data', (keys) => {
  if (!keys.includes('#{1:chat}')) return
  #{0}
})
`),
  snip("sl.on('fields')", 'js', 'React when field values change', `
function #{1:update}() {
  #{0}
}

sl.on('data', #{1:update})
sl.on('fields', #{1:update})
#{1:update}()
`),
  snip('cue sound', 'js', 'Play a library sound on every play cue', `
sl.on('cue', () => {
  if (sl.mode !== 'output' || sl.muted || !sl.fields.#{1:sound}) return
  const a = new Audio(sl.media(sl.fields.#{1:sound}))
  a.volume = Math.min(1, Math.max(0, sl.fields.#{2:volume} / 100))
  a.play().catch((e) => console.error('sound:', e.message))
})
`),
  snip('sub goal', 'js', 'Fill a goal bar from a counter', `
const now = document.getElementById('now')
const fill = document.getElementById('fill')

function update() {
  const count = Number(sl.data['counter.#{1:subs}'] ?? 0)
  const goal = Math.max(1, Number(sl.fields.#{2:goal}) || 1)
  now.textContent = String(count)
  fill.style.width = Math.min(100, (count / goal) * 100) + '%'
  fill.classList.toggle('done', count >= goal)
}

sl.on('data', update)
sl.on('fields', update)
update()
`),
  snip('countdown', 'js', 'Show a timer (declare timer.*)', `
const out = document.getElementById('#{1:time}')

// Milliseconds shown by a timer state right now; null without a usable
// time (no state yet, or no end to count down to).
function ms(t) {
  if (!t) return null
  let n
  if (t.mode === 'stopwatch') {
    n = t.elapsedMs + (t.running && t.startedAt ? Date.now() - Date.parse(t.startedAt) : 0)
  } else {
    n = t.running && t.endsAt ? Math.max(0, Date.parse(t.endsAt) - Date.now()) : t.remainingMs
  }
  return Number.isFinite(n) ? n : null
}

// m:ss, h:mm:ss, and from a day on "3d 04:12:09".
function fmt(n) {
  const s = Math.ceil(n / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor(s / 3600) % 24
  const two = (x) => String(x).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h || d ? 2 : 1, '0')
  const ss = two(s % 60)
  if (d) return d.toLocaleString('en-US') + 'd ' + two(h) + ':' + mm + ':' + ss
  return (h ? h + ':' : '') + mm + ':' + ss
}

function tick() {
  const t = sl.data['timer.' + sl.fields.#{2:timer}]
  const n = ms(t)
  const text = n === null ? '--:--' : n === 0 && t.mode !== 'stopwatch' ? sl.fields.#{3:done} : fmt(n)
  if (out.textContent !== text) out.textContent = text
}

setInterval(tick, 250)
sl.on('data', tick)
sl.on('fields', tick)
tick()
`),
  snip('new chat lines', 'js', 'Handle only chat lines that arrive after load', `
let seen = null // ids already handled; null until the first list

function onChat() {
  const lines = sl.data.chat || []
  const before = seen
  seen = new Set(lines.map((m) => m.id))
  if (before === null) return
  for (const m of lines) {
    if (before.has(m.id)) continue
    #{0}
  }
}

sl.on('data', (keys) => keys.includes('chat') && onChat())
onChat()
`),
  snip('chat with emotes', 'js', 'Build chat rows with emote images (declare chat)', `
const box = sl.root.querySelector('.#{1:chat}')
const shown = new Map() // message id -> row

function row(m) {
  const el = document.createElement('div')
  el.className = 'row'
  const who = document.createElement('b')
  who.textContent = m.user
  el.append(who)
  const emotes = new Map((m.emotes || []).map((e) => [e.name, e.id]))
  for (const word of String(m.text).split(/(\\s+)/)) {
    if (emotes.has(word)) {
      const img = document.createElement('img')
      img.src = sl.emote(emotes.get(word))
      img.alt = word
      el.append(img)
    } else {
      el.append(document.createTextNode(word))
    }
  }
  return el
}

function draw() {
  const lines = (sl.data.chat || []).slice(-#{2:8})
  const keep = new Set(lines.map((m) => m.id))
  for (const [id, el] of shown) if (!keep.has(id)) (el.remove(), shown.delete(id))
  for (const m of lines) {
    if (shown.has(m.id)) continue
    const el = row(m)
    box.append(el)
    shown.set(m.id, el)
  }
}

sl.on('data', (keys) => keys.includes('chat') && draw())
draw()
`),
  snip('emote rain', 'js', "Throw each new chat message's emotes down the screen", `
const sky = sl.root.querySelector('.#{1:sky}')
let seen = null

function drop(id) {
  const s = #{2:64}
  const img = document.createElement('img')
  img.src = sl.emote(id)
  img.style.width = img.style.height = s + 'px'
  img.style.position = 'absolute'
  sky.append(img)
  const x = Math.random() * Math.max(1, sl.size.w - s)
  const fall = img.animate(
    [{ transform: 'translate(' + x + 'px, ' + -s + 'px)' }, { transform: 'translate(' + x + 'px, ' + (sl.size.h + s) + 'px)' }],
    { duration: #{3:6000}, easing: 'ease-in' },
  )
  fall.onfinish = () => img.remove()
}

function onChat() {
  const lines = sl.data.chat || []
  const before = seen
  seen = new Set(lines.map((m) => m.id))
  if (before === null || sl.mode !== 'output') return
  for (const m of lines) {
    if (before.has(m.id)) continue
    ;(m.emotes || []).slice(0, 10).forEach((e, i) => setTimeout(() => drop(e.id), i * 120))
  }
}

sl.on('data', (keys) => keys.includes('chat') && onChat())
onChat()
`),
  snip('uptime', 'js', 'An uptime clock from the stream start (declare stream)', `
function tick() {
  const el = document.getElementById('#{1:uptime}')
  const since = sl.data.stream?.startedAt
  if (!el || !since) return
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 1000))
  const text = Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
  if (el.textContent !== text) el.textContent = text
}
setInterval(tick, 1000)
sl.on('data', tick)
tick()
`),
  snip('canvas loop', 'js', 'Draw on a canvas yourself (renders off)', `
sl.manual = true
const canvas = document.createElement('canvas')
sl.root.append(canvas)
const ctx = canvas.getContext('2d')

function frame(t) {
  canvas.width = sl.size.w
  canvas.height = sl.size.h
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = sl.theme.colors.accent
  #{0}
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
`),
  snip('show/hide', 'js', 'Restart an animation whenever the element is shown', `
sl.on('show', () => {
  #{0}
})
sl.on('hide', () => {})
`),
  snip('media url', 'js', 'A media library file as an image', `
const img = new Image()
img.src = sl.media(sl.fields.#{1:pic})
sl.root.append(img)
`),
  snip('asset url', 'js', "One of the widget's own assets (a .csw package with assets)", `
const img = new Image()
img.src = sl.asset('#{1:img/logo.png}')
sl.root.append(img)
`),
  snip('animated alert', 'js', 'Animate in on an alert, out when it leaves', `
const card = sl.root.querySelector('.#{1:card}')

sl.on('alert', () => {
  card.classList.remove('out')
  card.classList.add('in')
  sl.sfx.play('#{2:chime}')
})
sl.on('leave', () => {
  card.classList.remove('in')
  card.classList.add('out')
})
`),
  snip('play a sound', 'js', 'A built-in sound effect (silent when muted)', `
sl.on('#{1:alert}', () => {
  sl.sfx.play('#{2:coin}', { volume: #{3:0.8} })
})
`),
]
