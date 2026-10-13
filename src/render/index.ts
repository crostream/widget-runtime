// render: the CroStream overlay renderer: the Svelte components that draw
// styled text, framed boxes and icons, and the pure functions behind them.
// The widget frame is built from this; an app that draws overlays imports it
// back (needs Svelte 5). Everything but the components is free of Svelte
// apart from the contexts in theme.ts and cue.svelte.ts.
export { default as FrameBox } from './FrameBox.svelte'
export { default as StyledText } from './StyledText.svelte'
export { default as Glyph } from './Glyph.svelte'
export * from './types.js'
export * from './themecore.js'
export { provideTheme, useTheme } from './theme.js'
export { BUILTIN_THEME_PROPS, type ThemeKind, type ThemeSchema } from './themeprops.js'
export * from './effects.js'
export * from './frame.js'
export { GLYPHS, ICON_KINDS, ICON_LABELS, BRAND_COLORS, isIconKind, iconColor, type Glyph as GlyphData } from './icons.js'
export { onCue, restart } from './cue.svelte.js'
