<script lang="ts">
  // <sl-frame>: the built-in frame renderer (FrameBox) with the element's
  // own children slotted into its content box (inset by the frame's padding
  // and the room a pointer, tab or pointed ends take). layout 'fill' (the
  // default) fills the element's box; 'wrap' is a block as tall as its
  // content, as the built-in chat and event rows are.
  import FrameBox from '../../render/FrameBox.svelte'
  import { provideTheme } from '../../render/theme.js'
  import { env } from '../env.svelte.js'
  import type { FrameAttrs } from './types.js'

  let { p }: { p: FrameAttrs } = $props()

  provideTheme(() => env.theme)
</script>

<FrameBox frame={p.frame} layout={p.layout} mode={env.mode}>{@html '<slot></slot>'}</FrameBox>
