// catalog.ts: the live data a custom widget can declare and read, with the
// exact JSON shapes (Go: internal/overlay/live.go, live_data.go, timer.go;
// internal/core/live.go eventVars; internal/library/handler.go folderItem)
// and the docs' wording (crostream.io docs/development/overlay-data.md).
// dts.ts turns this into declarations; sl.ts into sl.data's members.

// Prop is one property of a declared interface.
export interface Prop {
  name: string
  type: string
  doc: string
  optional?: boolean
}

// Shape is one interface of WIDGET_DTS.
export interface Shape {
  name: string
  doc: string
  generic?: string // e.g. 'V extends SlLatestVars = SlLatestVars'
  props: Prop[]
  index?: { key: string; type: string; doc: string }
}

export const SHAPES: Shape[] = [
  {
    name: 'SlEmote',
    doc: 'A Twitch emote in a chat line. `name` is the word the emote replaces; `sl.emote(id)` is its image URL.',
    props: [
      { name: 'id', type: 'string', doc: "The emote's Twitch ID: pass it to `sl.emote(id)`." },
      { name: 'name', type: 'string', doc: 'The word the emote replaces in the text, such as `Kappa`.' },
    ],
  },
  {
    name: 'SlChatLine',
    doc: 'One chat message of the `chat` data key.',
    props: [
      { name: 'id', type: 'string', doc: "Twitch's message ID: stable and unique, good for `sl-key`." },
      { name: 'user', type: 'string', doc: "The chatter's display name." },
      { name: 'text', type: 'string', doc: 'The message as typed.' },
      { name: 'time', type: 'string', doc: 'When it arrived (RFC 3339, UTC).' },
      { name: 'emotes', type: 'SlEmote[]', optional: true, doc: "The message's Twitch emotes in order, repeats included. Left out when there are none." },
    ],
  },
  {
    name: 'SlEventRow',
    doc: 'One event of the `events` data key (follows, subs, gifts, cheers, raids, redemptions and more).',
    props: [
      { name: 'type', type: 'string', doc: 'The event type, such as `twitch.cheer` (the same names as `latest.<type>`).' },
      { name: 'user', type: 'string', doc: 'Who did it (display name), or `""`.' },
      { name: 'amount', type: 'number', optional: true, doc: 'Bits, gifted subs, raid viewers and the like. Left out when 0.' },
      { name: 'summary', type: 'string', doc: 'A short description, as in the activity feed.' },
      { name: 'time', type: 'string', doc: 'When it happened (RFC 3339, UTC).' },
    ],
  },
  {
    name: 'SlLatestVars',
    doc: "An event's variables: the same values a trigger for that event gets. All values are strings.",
    props: [
      { name: 'user', type: 'string', doc: 'Who did it (display name), or `""`.' },
      { name: 'summary', type: 'string', doc: 'A short description, as in the activity feed.' },
      { name: 'amount', type: 'string', optional: true, doc: 'The amount (bits, subs, viewers…), when the event has one.' },
    ],
    index: { key: 'name', type: 'string | undefined', doc: 'Any other variable of the event.' },
  },
  {
    name: 'SlLatestEvent',
    doc: 'The newest event of one type (`latest.<type>`): its variables and when it happened.',
    generic: 'V extends SlLatestVars = SlLatestVars',
    props: [
      { name: 'vars', type: 'V', doc: "The event's variables, all strings: `user`, `summary`, and per type `bits`, `tier`, `viewers`…" },
      { name: 'time', type: 'string', doc: 'When it happened (RFC 3339, UTC).' },
    ],
  },
  {
    name: 'SlTimer',
    doc: "A timer's state (`timer.<name>`), run by the **Control a timer** action. The server sends only state changes, never ticks: work out the time shown from this state.",
    props: [
      { name: 'mode', type: "'countdown' | 'stopwatch'", doc: '`"countdown"` or `"stopwatch"`.' },
      { name: 'running', type: 'boolean', doc: "Whether it's counting now." },
      { name: 'endsAt', type: 'string', optional: true, doc: 'A running countdown: when it reaches zero. Left out otherwise.' },
      { name: 'remainingMs', type: 'number', doc: 'A paused or stopped countdown: the time left, in ms.' },
      { name: 'startedAt', type: 'string', optional: true, doc: 'A running stopwatch: when it last started. Left out otherwise.' },
      { name: 'elapsedMs', type: 'number', doc: 'A stopwatch: the time counted before `startedAt`, in ms.' },
      { name: 'capMs', type: 'number', doc: "A countdown's longest allowed time left (for subathons), in ms; 0 is none." },
    ],
  },
  {
    name: 'SlStream',
    doc: "Your stream's state on Twitch (`stream`). Checked every minute, and at once when you go live or offline or change title or category.",
    props: [
      { name: 'live', type: 'boolean', doc: "Whether you're live." },
      { name: 'title', type: 'string', doc: 'The stream title.' },
      { name: 'category', type: 'string', doc: 'The category (game) name.' },
      { name: 'viewers', type: 'number', doc: 'Current viewers while live; 0 when offline.' },
      { name: 'startedAt', type: 'string', optional: true, doc: 'When the stream went live. Left out when offline.' },
    ],
  },
  {
    name: 'SlLeader',
    doc: 'One row of a leaderboard (`leaders.<metric>.<period>`), best first.',
    props: [
      { name: 'user', type: 'string', doc: 'The viewer (display name).' },
      { name: 'value', type: 'number', doc: 'Bits cheered, subs gifted, chat messages, points balance or minutes watched, by metric.' },
    ],
  },
  {
    name: 'SlCreditsGifter',
    doc: 'A gifter in the credits.',
    props: [
      { name: 'user', type: 'string', doc: 'The gifter.' },
      { name: 'count', type: 'number', doc: 'Subs gifted this stream.' },
    ],
  },
  {
    name: 'SlCreditsCheerer',
    doc: 'A cheerer in the credits.',
    props: [
      { name: 'user', type: 'string', doc: 'The cheerer.' },
      { name: 'bits', type: 'number', doc: 'Bits cheered this stream.' },
    ],
  },
  {
    name: 'SlCreditsRaider',
    doc: 'A raider in the credits.',
    props: [
      { name: 'user', type: 'string', doc: 'The raider.' },
      { name: 'viewers', type: 'number', doc: 'Viewers brought by the raid.' },
    ],
  },
  {
    name: 'SlCredits',
    doc: 'Everyone who took part in this stream (`credits`), for end-of-stream credits. Recomputed with the leaderboards.',
    props: [
      { name: 'since', type: 'string', doc: 'Where "this stream" starts: since you went live, or since CroStream started when offline.' },
      { name: 'followers', type: 'string[]', doc: 'Up to 500 new followers.' },
      { name: 'subs', type: 'string[]', doc: 'Up to 500 subscribers (gift recipients included).' },
      { name: 'gifters', type: 'SlCreditsGifter[]', doc: 'Up to 100 gifters, most subs first.' },
      { name: 'cheerers', type: 'SlCreditsCheerer[]', doc: 'Up to 100 cheerers, most bits first.' },
      { name: 'raiders', type: 'SlCreditsRaider[]', doc: 'Up to 100 raiders, biggest raid first.' },
      { name: 'chatters', type: 'string[]', doc: 'Up to 50 chatters, most active first.' },
    ],
  },
  {
    name: 'SlHypeTrain',
    doc: 'The current or last hype train (`hypetrain`). When it ends, `active` turns false, `progress` and `goal` go to 0, and `level` and `total` keep their last values.',
    props: [
      { name: 'active', type: 'boolean', doc: 'Whether a hype train is running.' },
      { name: 'level', type: 'number', doc: 'Its level.' },
      { name: 'progress', type: 'number', doc: 'Points toward the next level.' },
      { name: 'goal', type: 'number', doc: 'Points the level needs.' },
      { name: 'total', type: 'number', doc: 'Points in all.' },
      { name: 'endsAt', type: 'string', optional: true, doc: 'When it ends unless it gets more. Left out after it ended.' },
    ],
  },
  {
    name: 'SlPollChoice',
    doc: 'A choice of a poll, or an outcome of a prediction.',
    props: [
      { name: 'title', type: 'string', doc: 'The choice (poll) or outcome (prediction).' },
      { name: 'votes', type: 'number', doc: 'Votes (poll) or channel points on the outcome (prediction).' },
      { name: 'color', type: "'blue' | 'pink'", optional: true, doc: 'Predictions only: `blue` or `pink`.' },
      { name: 'winner', type: 'boolean', optional: true, doc: 'True on the choice(s) with most votes once a poll completed (ties mark every one), or on the winning outcome once a prediction resolved.' },
    ],
  },
  {
    name: 'SlPoll',
    doc: 'The current or last poll (`poll`) or prediction (`prediction`); both have this shape. Updates as votes come in.',
    props: [
      { name: 'active', type: 'boolean', doc: 'Poll: true while voting is open. Prediction: true while open or locked.' },
      { name: 'status', type: 'string', doc: 'Poll: `active`, then `completed`, `terminated` or `archived`. Prediction: `active`, `locked`, then `resolved` or `canceled`.' },
      { name: 'title', type: 'string', doc: 'The question.' },
      { name: 'choices', type: 'SlPollChoice[]', doc: 'The choices (poll) or outcomes (prediction).' },
      { name: 'endsAt', type: 'string', optional: true, doc: 'Poll: when voting closes. Prediction: when it locks. Left out once ended (or locked).' },
    ],
  },
  {
    name: 'SlFolderItem',
    doc: 'A file of a media library folder (`folders.<field>`, `folder.<id>`): the images and videos directly in the folder, by name.',
    props: [
      { name: 'id', type: 'string', doc: 'The media item ID: `<sl-media media="{{m.id}}">` or `sl.media(id)`.' },
      { name: 'kind', type: "'image' | 'video'", doc: 'The kind of file: pass it as `<sl-media type>`.' },
      { name: 'width', type: 'number', doc: 'Width in pixels.' },
      { name: 'height', type: 'number', doc: 'Height in pixels.' },
    ],
  },
]

// VAR_DOCS: what each event variable means (docs/reference/variables.md).
export const VAR_DOCS: Record<string, string> = {
  user: 'The display name of the person who caused the event.',
  user_login: 'Their lowercase Twitch login name.',
  user_id: 'Their Twitch user ID, a number.',
  summary: 'A short description, as in the activity feed.',
  amount: 'The amount (bits, subs, viewers…), when the event has one.',
  tier: '`1`, `2` or `3`. A Prime sub is `1`.',
  months: 'Cumulative months subscribed.',
  streak: 'Consecutive months, if the viewer shared it.',
  message: 'The message, if any.',
  gifter: 'Who gifted the sub, for gifted subs.',
  count: 'Subs in this gift.',
  total: "The gifter's lifetime gifts in the channel, when Twitch shares it.",
  bits: 'Bits spent.',
  kind: '`cheer`, `power_up` or `custom_power_up`.',
  power_up: "The power-up's type or custom title.",
  viewers: 'Viewers brought by the raid.',
  input: 'Text the viewer entered, if the reward asks for it.',
  reward: 'The reward: its title, or for built-in rewards its type, such as `send_highlighted_message`.',
  reward_id: 'ID of the reward.',
  cost: 'Channel points spent.',
  emote: 'The unlocked emote, for emote rewards.',
  duration: 'Length of the break in seconds.',
  automatic: '`true` for a scheduled break, `false` for one started by hand.',
  game: "The game's name.",
  appid: "The game's Steam app ID.",
  playtime_hours: 'Your total hours in the game, with one decimal.',
  session_minutes: 'How long you played this time, in minutes.',
  screenshot_path: 'The screenshot file on this computer.',
}

// LATEST_TYPES: the event types with a latest.<type> key and the variables
// each carries (beyond user, summary and amount, which every event has).
export const LATEST_TYPES: { type: string; label: string; vars: string[] }[] = [
  { type: 'twitch.follow', label: 'Follow', vars: ['user_login', 'user_id'] },
  { type: 'twitch.sub', label: 'Subscription (gifted subs included, with `gifter` set)', vars: ['user_login', 'user_id', 'tier', 'months', 'streak', 'message', 'gifter'] },
  { type: 'twitch.gift', label: 'Gifted subs', vars: ['user_login', 'user_id', 'count', 'tier', 'total'] },
  { type: 'twitch.cheer', label: 'Cheer or power-up', vars: ['user_login', 'user_id', 'bits', 'kind', 'message', 'power_up'] },
  { type: 'twitch.raid', label: 'Raid', vars: ['user_login', 'user_id', 'viewers'] },
  { type: 'twitch.redemption', label: 'Channel point redemption', vars: ['user_login', 'user_id', 'input', 'reward', 'reward_id', 'cost'] },
  { type: 'twitch.auto_reward', label: 'Built-in channel point reward', vars: ['user_login', 'user_id', 'reward', 'cost', 'message', 'emote'] },
  { type: 'twitch.channel.update', label: 'Title or category change', vars: [] },
  { type: 'twitch.ad_break', label: 'Ad break', vars: ['duration', 'automatic'] },
  { type: 'twitch.stream.online', label: 'Stream online', vars: [] },
  { type: 'twitch.stream.offline', label: 'Stream offline', vars: [] },
  { type: 'twitch.hype_train', label: 'Hype train', vars: ['level', 'total', 'goal', 'progress', 'train_type'] },
  { type: 'twitch.poll.end', label: 'Poll ended', vars: [] },
  { type: 'twitch.prediction.end', label: 'Prediction ended', vars: [] },
  { type: 'steam.game_started', label: 'A Steam game starts', vars: ['game', 'appid', 'playtime_hours'] },
  { type: 'steam.game_stopped', label: 'A Steam game stops', vars: ['game', 'appid', 'playtime_hours', 'session_minutes'] },
  { type: 'steam.screenshot', label: 'A Steam screenshot is taken', vars: ['game', 'appid', 'screenshot_path'] },
  { type: 'hotkey.press', label: 'Hotkey', vars: [] },
  { type: 'queue.release', label: 'Queue release', vars: [] },
  { type: 'tools.interval', label: 'On a timer', vars: [] },
]

// sampleVarsFor are the sample variables of one event type for previews: only
// what that type really carries (a follow has no message), with example
// values; manifest samples go on top. Every event has user, summary, amount.
export const USER_VARS = { user: 'SampleUser', user_login: 'sampleuser', user_id: '123456' }
export const TYPE_VARS: Record<string, Record<string, string>> = {
  'twitch.follow': { ...USER_VARS, summary: 'followed', amount: '' },
  'twitch.sub': { ...USER_VARS, summary: 'subscribed', amount: '1', tier: '1', months: '6', streak: '6', message: 'Six months already!', gifter: '' },
  'twitch.gift': { ...USER_VARS, summary: 'gifted 5 subs', amount: '5', count: '5', tier: '1', total: '25' },
  'twitch.cheer': { ...USER_VARS, summary: 'cheered 500 bits', amount: '500', bits: '500', kind: 'cheer', message: 'Cheer500 take my bits!', power_up: '' },
  'twitch.raid': { ...USER_VARS, summary: 'raided with 42 viewers', amount: '42', viewers: '42' },
  'twitch.redemption': { ...USER_VARS, summary: 'redeemed Hydrate', amount: '1000', reward: 'Hydrate', reward_id: 'reward-1', cost: '1000', input: 'Drink some water!' },
  'twitch.auto_reward': { ...USER_VARS, summary: 'unlocked an emote', amount: '300', reward: 'Unlock a random emote', cost: '300', message: '', emote: 'Kappa' },
  'twitch.ad_break': { summary: 'ad break', amount: '90', duration: '90', automatic: 'true' },
  'steam.game_started': { summary: 'started a game', game: 'Hades II', appid: '1145350', playtime_hours: '12.5' },
  'steam.game_stopped': { summary: 'stopped a game', game: 'Hades II', appid: '1145350', playtime_hours: '14.0', session_minutes: '90' },
  'steam.screenshot': { summary: 'took a screenshot', game: 'Hades II', appid: '1145350', screenshot_path: 'C:/Users/streamer/Pictures/Steam/Hades II/screenshot.png' },
  'twitch.hype_train': { summary: 'hype train level 3', amount: '3', level: '3', total: '4250', goal: '6000', progress: '1250', train_type: 'regular' },
}
export const sampleVarsFor = (type: string, samples?: Record<string, string>): Record<string, string> => ({
  ...(TYPE_VARS[type] ?? { user: 'SampleUser', summary: 'did something', amount: '1' }),
  ...(samples ?? {}),
})

export const LEADER_METRICS: { name: string; doc: string }[] = [
  { name: 'bits', doc: 'Bits cheered (from the history).' },
  { name: 'gifts', doc: 'Subs gifted, anonymous gifts left out (from the history).' },
  { name: 'chat', doc: 'Chat messages sent (from the history).' },
  { name: 'points', doc: 'Points balance (from the viewer database); all three periods show the same board.' },
  { name: 'watch', doc: 'Minutes watched (from the viewer database).' },
]

export const LEADER_PERIODS: { name: string; doc: string }[] = [
  { name: 'stream', doc: "This stream: since you went live, or since CroStream started when you're offline." },
  { name: 'week', doc: 'The last 7 days.' },
  { name: 'all', doc: 'Everything stored.' },
]

// DataFamily is one kind of live data key. Exact families have one key;
// prefix families are `<prefix><name>` (declared one by one or as
// `<prefix>*`).
export interface DataFamily {
  key: string // as written in docs: 'chat', 'counter.<name>'
  prefix?: string // 'counter.' for prefix families
  type: string // TS type of one value
  doc: string
  example: string
}

export const DATA_FAMILIES: DataFamily[] = [
  {
    key: 'chat',
    type: 'SlChatLine[]',
    doc: 'The last 50 chat lines, **oldest first**: `[{id, user, text, time, emotes}]`. Updates with every chat message; starts empty when CroStream starts. Declare `chat`.',
    example: '{{#each data.chat as m}}<div sl-key="{{m.id}}"><b>{{m.user}}</b> {{m.text}}</div>{{/each}}',
  },
  {
    key: 'events',
    type: 'SlEventRow[] | null',
    doc: 'The last 30 events, **newest first**: `[{type, user, amount, summary, time}]`. Refilled from the history at start; can be `null` until the first event. Declare `events`.',
    example: '{{#each data.events as e}}<div>{{e.summary}}</div>{{/each}}',
  },
  {
    key: 'stream',
    type: 'SlStream',
    doc: "Your stream's state: `{live, title, category, viewers, startedAt}`. Checked every minute, and at once on stream or channel changes. Declare `stream`.",
    example: '{{#if data.stream.live}}LIVE: {{data.stream.title}}{{/if}}',
  },
  {
    key: 'credits',
    type: 'SlCredits',
    doc: 'Everyone who took part in this stream: followers, subs, gifters, cheerers, raiders and chatters. Declare `credits`.',
    example: '{{#each data.credits.followers as f}}<span>{{f}}</span>{{/each}}',
  },
  {
    key: 'hypetrain',
    type: 'SlHypeTrain',
    doc: 'The current or last hype train: `{active, level, progress, goal, total, endsAt}`. Declare `hypetrain`.',
    example: '{{#if data.hypetrain.active}}Level {{data.hypetrain.level}}{{/if}}',
  },
  {
    key: 'poll',
    type: 'SlPoll',
    doc: 'The current or last poll: `{active, status, title, choices, endsAt}`. Declare `poll`.',
    example: '{{#each data.poll.choices as c}}<div>{{c.title}}: {{c.votes}}</div>{{/each}}',
  },
  {
    key: 'prediction',
    type: 'SlPoll',
    doc: 'The current or last prediction, shaped like a poll; `choices[].votes` is channel points and `choices[].color` is `blue` or `pink`. Declare `prediction`.',
    example: '{{#each data.prediction.choices as c}}<div>{{c.title}}: {{c.votes}}</div>{{/each}}',
  },
  {
    key: 'latest.<type>',
    prefix: 'latest.',
    type: 'SlLatestEvent',
    doc: 'The newest event of a type, with its variables: `{vars: {user, …}, time}`. Survives restarts. Declare `latest.*` or exact keys such as `latest.twitch.follow`.',
    example: '{{data.latest.twitch.follow.vars.user}}',
  },
  {
    key: 'counter.<name>',
    prefix: 'counter.',
    type: 'number',
    doc: "A counter's value, a whole number, kept by the **Change a counter** action. Counter names are lowercase; a counter never changed doesn't exist yet. Declare `counter.*` or `counter.<name>`.",
    example: "sl.data['counter.subs'] ?? 0",
  },
  {
    key: 'timer.<name>',
    prefix: 'timer.',
    type: 'SlTimer',
    doc: "A timer's state: `{mode, running, endsAt, remainingMs, startedAt, elapsedMs, capMs}`. Timer names keep their capitals and may have spaces, so declare `timer.*` and pick the timer in your script.",
    example: "sl.data['timer.' + sl.fields.timer]",
  },
  {
    key: 'leaders.<metric>.<period>',
    prefix: 'leaders.',
    type: 'SlLeader[]',
    doc: 'A top-10 list, best first: `[{user, value}]`. Metrics: `bits`, `gifts`, `chat`, `points`, `watch`; periods: `stream`, `week`, `all`. Declare exact keys such as `leaders.bits.stream`.',
    example: '{{#each data.leaders.bits.stream as r}}<li>{{r.user}} {{r.value}}</li>{{/each}}',
  },
  {
    key: 'folders.<field>',
    prefix: 'folders.',
    type: 'SlFolderItem[]',
    doc: "The files of the folder chosen in a **Media folder** field, by the field's key: `[{id, kind, width, height}]`. Declare `folder.*`. Listed again every 3 minutes.",
    example: '{{#each data.folders.pics as m}}<sl-media media="{{m.id}}" type="{{m.kind}}" fit="cover"></sl-media>{{/each}}',
  },
  {
    key: 'folder.<id>',
    prefix: 'folder.',
    type: 'SlFolderItem[]',
    doc: "The same folder files, by folder ID: `sl.data['folder.' + sl.fields.pics]`. Declare `folder.*`.",
    example: "sl.data['folder.' + sl.fields.pics] || []",
  },
]

// SFX_NAMES: the sl.sfx presets (frame/sfx.ts has one synth each).
export const SFX_NAMES = [
  'chime', 'coin', 'cash', 'whoosh', 'swoosh', 'pop', 'bubble', 'levelup', 'fanfare', 'powerup',
  'laser', 'zap', 'glitch', 'drumroll', 'cymbal', 'bell', 'kaching', 'boing', 'sparkle', 'thud',
] as const

export const THEME_COLORS: { name: string; doc: string; value: string }[] = [
  { name: 'primary', doc: "The theme's primary color.", value: '#7c5cffff' },
  { name: 'secondary', doc: "The theme's secondary color.", value: '#2dd4bfff' },
  { name: 'accent', doc: "The theme's accent color.", value: '#ff5cf0ff' },
  { name: 'text', doc: "The theme's text color.", value: '#ffffffff' },
  { name: 'muted', doc: "The theme's muted (secondary text) color.", value: '#a3a9b8ff' },
  { name: 'panel', doc: "The theme's panel (background) color.", value: '#0b0d12cc' },
  { name: 'border', doc: "The theme's border color.", value: '#ffffff33' },
  { name: 'highlight', doc: "The theme's highlight color.", value: '#ffe14dff' },
]

export const THEME_FONTS: { name: string; doc: string }[] = [
  { name: 'heading', doc: "The theme's heading font: a CSS `font-family` list." },
  { name: 'body', doc: "The theme's body font: a CSS `font-family` list." },
]

// FIELD_KINDS: the value each field kind gives (widgets.md "Fields").
export const FIELD_KINDS: Record<string, { type: string; doc: string }> = {
  text: { type: 'string', doc: 'Text' },
  textarea: { type: 'string', doc: 'Long text: may contain line breaks' },
  number: { type: 'number', doc: 'Number' },
  bool: { type: 'boolean', doc: 'On / off' },
  color: { type: 'string', doc: 'Color: `"#rrggbb"` or `"#rrggbbaa"` (theme references resolved), or `""` when left empty' },
  enum: { type: 'string', doc: "Choice: the chosen option's value" },
  media: { type: 'string', doc: 'Media: a media library item ID (`"media-…"`) or `""`; use `sl.media(id)` or `<sl-media media>`' },
  font: { type: 'string', doc: 'Font: a CSS `font-family` list' },
  effects: { type: 'SlTextEffects', doc: 'Text effects: an object for `<sl-text effects="{{key}}">`' },
  frame: { type: 'SlFrameStyle', doc: 'Frame: an object for `<sl-frame frame="{{key}}">`' },
  items: { type: 'SlListItem[]', doc: 'List: an array of objects, one per item' },
  folder: { type: 'string', doc: 'Media folder: a folder ID (`"folder-…"`) or `""`; its files arrive as data `folders.<key>` (declare `folder.*`)' },
}

// SL_EVENT_NAMES: the events sl.on takes, in the order the docs list them.
// The frame (frame/main.ts) fires exactly these; sl.ts documents them.
export const SL_EVENT_NAMES = ['data', 'fields', 'cue', 'size', 'theme', 'show', 'hide', 'muted', 'alert', 'leave'] as const

// WIDGET_ICONS: the UI icon names a widget manifest's `icon` may be (the
// app's IconName set, names only).
export const WIDGET_ICONS: string[] = [
  'dashboard',
  'activity',
  'sequences',
  'queue',
  'actions',
  'integrations',
  'overlays',
  'settings',
  'plus',
  'minus',
  'play',
  'trash',
  'edit',
  'grip',
  'x',
  'check',
  'search',
  'clock',
  'user',
  'users',
  'alert',
  'info',
  'external',
  'copy',
  'filter',
  'webhook',
  'flask',
  'link',
  'power',
  'broadcast',
  'shield',
  'timer',
  'save',
  'refresh',
  'folder',
  'key',
  'logout',
  'login',
  'eye',
  'list',
  'message',
  'film',
  'monitor',
  'gift',
  'star',
  'goal',
  'heart',
  'hash',
  'pause',
  'wait',
  'sparkle',
  'dot',
  'menu',
  'volume',
  'record',
  'camera',
  'image',
  'globe',
  'file',
  'dice',
  'music',
  'type',
  'stop',
  'branch',
  'fork',
  'grid',
  'rows',
  'tag',
  'more',
  'upload',
  'fullscreen',
  'move',
  'undo',
  'panel',
  'zoom',
  'square',
  'layers',
  'lock',
  'unlock',
  'redo',
  'magnet',
  'palette',
  'unlink',
  'frame',
  'trophy',
  'bolt',
  'smile',
  'chart',
  'wheel',
  'share',
  'ticker',
  'coins',
  'code',
  'line',
]
