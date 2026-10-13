// env.svelte.ts: the frame-wide state the building blocks read reactively:
// the overlay's theme (theme references in block attributes resolve against
// it), where the widget is drawn, the live mute and the latest play cue.
import { DEFAULT_RESOLVED, type ResolvedTheme } from '../render/themecore.js'
import type { Cue, Mode } from '../render/types.js'

export const env = $state<{ theme: ResolvedTheme; mode: Mode; kind: string; muted: boolean; audition: boolean; cue: Cue | undefined }>({
  theme: DEFAULT_RESOLVED,
  mode: 'output',
  kind: '', // the widget's kind, for <sl-media asset>
  muted: false,
  audition: false, // the editor's preview is playing: sound is allowed in editor mode
  cue: undefined,
})
