// themeprops.ts: which props of each built-in widget can hold a theme
// reference ("theme:accent"): the props of kind color, font, effects and
// frame, and the same kinds inside an items list. Every other prop (text,
// a ticker's messages, a socials handle, live set_text overrides) is
// content, shown exactly as typed even when it starts with "theme:".
//
// This mirrors the props the Go side declares for each built-in widget
// (internal/overlay builtin*.go). A widget without an entry resolves
// nothing; add its themed props here when it gets some. Library widgets
// take theirs from their own field list (schemaOfFields).

// A ThemeSchema maps a prop key to its kind, or an items prop to the kinds
// of the keys inside each item.
export type ThemeSchema = Record<string, ThemeKind | Record<string, ThemeKind>>
export type ThemeKind = 'color' | 'font' | 'effects' | 'frame'

export const BUILTIN_THEME_PROPS: Record<string, ThemeSchema> = {
  alert: { headlineFont: 'font', headlineColor: 'color', accent: 'color', headlineEffects: 'effects', messageFont: 'font', messageColor: 'color', messageEffects: 'effects', frame: 'frame' },
  chat: { font: 'font', nameColor: 'color', textColor: 'color', effects: 'effects', frame: 'frame', rowFrame: 'frame' },
  clock: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  counter: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  credits: { headingFont: 'font', headingColor: 'color', font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  events: { font: 'font', color: 'color', effects: 'effects', frame: 'frame', rowFrame: 'frame' },
  frame: { frame: 'frame' },
  goal: { font: 'font', textColor: 'color', effects: 'effects', trackFrame: 'frame', barFrame: 'frame' },
  hypetrain: { font: 'font', color: 'color', effects: 'effects', frame: 'frame', trackFrame: 'frame', barFrame: 'frame' },
  icon: { color: 'color', glowColor: 'color', frame: 'frame' },
  latest: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  leaderboard: { font: 'font', color: 'color', effects: 'effects', frame: 'frame', rowFrame: 'frame' },
  line: { color: 'color', color2: 'color', glowColor: 'color' },
  particles: { colors: { color: 'color' } },
  poll: { font: 'font', color: 'color', effects: 'effects', frame: 'frame', rowFrame: 'frame', barFrame: 'frame' },
  rect: { fill: 'color', borderColor: 'color' },
  slideshow: { frame: 'frame' },
  socials: { iconColor: 'color', font: 'font', color: 'color', effects: 'effects', frame: 'frame', rowFrame: 'frame' },
  stream: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  text: { font: 'font', color: 'color', effects: 'effects' },
  ticker: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  timer: { font: 'font', color: 'color', effects: 'effects', frame: 'frame' },
  wheel: { segments: { color: 'color' }, font: 'font', textColor: 'color', borderColor: 'color', effects: 'effects', frame: 'frame' },
}
