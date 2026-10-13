// theme.ts: how the renderer gets the overlay's theme: Stage (or a block)
// provides it through context, components read it with useTheme. The theme
// itself and the reference resolving are in themecore.ts (no Svelte).
import { getContext, setContext } from 'svelte'
import { DEFAULT_RESOLVED, type ResolvedTheme } from './themecore.js'

export * from './themecore.js'

const THEME = Symbol('overlay.theme')

// provideTheme makes the theme source visible to everything below (Stage).
export function provideTheme(source: () => ResolvedTheme): void {
  setContext(THEME, source)
}

// useTheme returns the theme source provided above, or one returning the
// default theme outside a Stage (editor previews).
export function useTheme(): () => ResolvedTheme {
  return getContext<(() => ResolvedTheme) | undefined>(THEME) ?? (() => DEFAULT_RESOLVED)
}
