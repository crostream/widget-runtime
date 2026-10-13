// cookbook.ts: the widgets the self-checks type-check against the sl API: the
// docs' cookbook scripts (crostream.io docs/development/widgets.md) and a
// kitchen-sink context declaring every kind of field and data key.
import type { WidgetContext } from '../../src/api/index.js'

export interface Cook {
  name: string
  ctx: WidgetContext
  js: string
}

export const COOKBOOK: Cook[] = [
  {
    name: 'Chat box with emotes',
    ctx: {
      fields: [
        { key: 'count', label: 'Lines', type: 'number' },
        { key: 'size', label: 'Text size', type: 'number' },
        { key: 'name', label: 'Name color', type: 'color' },
      ],
      data: [{ key: 'chat' }],
    },
    js: `const box = sl.root.querySelector('.chat')
const shown = new Map() // message id -> row

function row(m) {
  const el = document.createElement('div')
  el.className = 'row'
  const who = document.createElement('b')
  who.textContent = m.user
  el.append(who)
  // Swap each word that is one of the message's emotes for its image.
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
  const lines = (sl.data.chat || []).slice(-Math.max(1, sl.fields.count || 1))
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
sl.on('fields', draw)
draw()
`,
  },
  {
    name: 'Emote rain',
    ctx: {
      fields: [
        { key: 'size', label: 'Emote size', type: 'number' },
        { key: 'fall', label: 'Fall time', type: 'number' },
      ],
      data: [{ key: 'chat' }],
    },
    js: `const sky = sl.root.querySelector('.sky')
let seen = null // ids already handled; null until the first list

function drop(id) {
  const s = sl.fields.size
  const img = document.createElement('img')
  img.src = sl.emote(id)
  img.style.width = img.style.height = s + 'px'
  sky.append(img)
  const x = Math.random() * Math.max(1, sl.size.w - s)
  const spin = (Math.random() - 0.5) * 360
  const fall = img.animate(
    [
      { transform: \`translate(\${x}px, \${-s}px) rotate(0deg)\` },
      { transform: \`translate(\${x}px, \${sl.size.h + s}px) rotate(\${spin}deg)\` },
    ],
    { duration: sl.fields.fall * 1000 * (0.8 + Math.random() * 0.4), easing: 'ease-in' },
  )
  fall.onfinish = () => img.remove()
  img.onerror = () => img.remove()
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
`,
  },
  {
    name: 'Countdown',
    ctx: {
      fields: [
        { key: 'timer', label: 'Timer', type: 'text' },
        { key: 'done', label: 'Done text', type: 'text' },
      ],
      data: [{ key: 'timer.*' }],
    },
    js: `const out = document.getElementById('time')

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
  const t = sl.data['timer.' + sl.fields.timer]
  const n = ms(t)
  const text = n === null ? '--:--' : n === 0 && t.mode !== 'stopwatch' ? sl.fields.done : fmt(n)
  if (out.textContent !== text) out.textContent = text
}

setInterval(tick, 250)
sl.on('data', tick)
sl.on('fields', tick)
tick()
`,
  },
]

// A context exercising every data family and field kind.
export const KITCHEN: WidgetContext = {
  fields: ['text', 'textarea', 'number', 'bool', 'color', 'enum', 'media', 'font', 'effects', 'frame', 'items', 'folder'].map((type, i) => ({
    key: `f_${type}`,
    label: `Field ${i}`,
    type,
    doc: 'A */ tricky doc',
  })),
  data: [
    { key: 'chat' },
    { key: 'events' },
    { key: 'stream' },
    { key: 'credits' },
    { key: 'hypetrain' },
    { key: 'poll' },
    { key: 'prediction' },
    { key: 'latest.*' },
    { key: 'counter.subs' },
    { key: 'counter.deaths' },
    { key: 'timer.*' },
    { key: 'leaders.bits.stream' },
    { key: 'folder.*' },
    { key: 'custom.thing', sample: { a: 1, b: ['x'], 'c-d': { e: true } } },
  ],
}
