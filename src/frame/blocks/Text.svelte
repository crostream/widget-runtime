<script lang="ts">
  // <sl-text>: the built-in text renderer (StyledText) with the attributes
  // of the element. The theme comes from the frame's env, so "theme:…"
  // references in attributes resolve as they do on the stage.
  import StyledText from '../../render/StyledText.svelte'
  import { provideTheme } from '../../render/theme.js'
  import { env } from '../env.svelte.js'
  import type { TextAttrs } from './types.js'

  let { p }: { p: TextAttrs } = $props()

  provideTheme(() => env.theme)
</script>

<StyledText
  text={p.text}
  effects={p.effects}
  mode={env.mode}
  layout={p.layout}
  font={p.font}
  size={p.size}
  weight={p.weight}
  italic={p.italic}
  color={p.color}
  align={p.align}
  valign={p.valign}
  lineHeight={p.lineHeight}
  letterSpacing={p.letterSpacing}
  transform={p.transform}
  oneLine={p.oneLine}
/>
