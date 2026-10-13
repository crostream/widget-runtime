<script lang="ts">
  // <sl-icon>: one icon of the built-in set (Glyph), in color or its brand
  // color, as the Icon element draws it.
  import { frameColor } from '../../render/frame.js'
  import Glyph from '../../render/Glyph.svelte'
  import { iconColor } from '../../render/icons.js'
  import { resolveRefs } from '../../render/theme.js'
  import { env } from '../env.svelte.js'
  import type { IconAttrs } from './types.js'

  let { p }: { p: IconAttrs } = $props()

  const color = $derived(frameColor(iconColor(p.icon, resolveRefs(p.color, env.theme)), '#ffffff'))
</script>

<Glyph icon={p.icon || 'heart'} {color} />
