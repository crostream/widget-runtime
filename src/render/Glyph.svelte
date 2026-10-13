<script lang="ts">
  // Glyph draws one icon of the built-in set (icons.ts) in one color, filling
  // its box (square, centered). Cuts are punched out with a mask, so a cut
  // shows what is behind the icon.
  import { GLYPHS, isIconKind } from './icons.js'

  let { icon, color = '#ffffff', size, style = '' }: { icon: string; color?: string; size?: number; style?: string } = $props()

  const pid = $props.id()
  const g = $derived(isIconKind(icon) ? GLYPHS[icon] : null)
</script>

{#if g}
  <svg
    class="glyph"
    viewBox="0 0 24 24"
    width={size ?? '100%'}
    height={size ?? '100%'}
    fill={color}
    stroke={color}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    {style}
  >
    {#if g.cut?.length}
      <defs>
        <mask id="gm{pid}" maskUnits="userSpaceOnUse" x="-2" y="-2" width="28" height="28">
          <rect x="-2" y="-2" width="28" height="28" fill="#fff" stroke="none" />
          {#each g.cut as c, i (i)}
            {#if c.w}<path d={c.d} fill="none" stroke="#000" stroke-width={c.w} />{:else}<path d={c.d} fill="#000" stroke="none" />{/if}
          {/each}
        </mask>
      </defs>
    {/if}
    <g mask={g.cut?.length ? `url(#gm${pid})` : undefined}>
      {#each g.faint ?? [] as d, i (i)}<path {d} fill-rule="evenodd" stroke="none" opacity="0.55" />{/each}
      {#each g.fill ?? [] as d, i (i)}<path {d} fill-rule="evenodd" stroke="none" />{/each}
      {#each g.stroke ?? [] as s, i (i)}<path d={s.d} fill="none" stroke-width={s.w} />{/each}
    </g>
  </svg>
{/if}

<style>
  .glyph {
    display: block;
    flex: none;
    overflow: visible;
  }
</style>
