<script lang="ts">
  // StyledText draws one piece of overlay text: the widget's typography plus
  // its TextEffects. Every text of every widget goes through it, so an effect
  // works everywhere. The layering is described in effects.ts: copies of the
  // text stacked in one box, the fill layer in the flow and the others laid
  // over it at the same size, so they wrap the same way.
  //
  // layout: 'box' fills the parent (valign applies; fit 'shrink' measures
  // against it), 'block' takes the parent's width, 'inline' is a flex item
  // as wide as its text. oneLine cuts the text to one line with an ellipsis
  // (as the effects' ellipsis does). lite draws static effects only (no
  // animation, no fit): chat lines. Thumbnails never animate; typewriter
  // shows the whole text there.
  //
  // Animations are CSS only. Per-letter ones split the text into letter spans
  // (words kept together) with a staggered delay; inside a clipped fill
  // (gradient, media) a transformed letter drops out of the clip, so there
  // they move with top/left instead of translate.
  import { normEffects, planEffects, splitLetters, typeSeconds, type TextSegment } from './effects.js'
  import { resolveRefs, useTheme } from './theme.js'
  import type { Mode, TextEffects } from './types.js'

  let {
    text = '',
    segments,
    effects,
    mode = 'output',
    font,
    size,
    weight,
    italic = false,
    color,
    align = 'left',
    valign = 'top',
    lineHeight,
    letterSpacing,
    transform,
    layout = 'block',
    oneLine = false,
    lite = false,
    part,
  }: {
    text?: string
    segments?: TextSegment[] // runs with their own color or weight; replace text
    effects?: Partial<TextEffects> | null
    mode?: Mode
    font?: string
    size: number
    weight?: string | number
    italic?: boolean
    color: string
    align?: string
    valign?: string
    lineHeight?: number | string
    letterSpacing?: number
    transform?: string
    layout?: 'box' | 'block' | 'inline'
    oneLine?: boolean
    lite?: boolean
    part?: string // data-part, for custom CSS
  } = $props()

  // Theme references are resolved already inside a Stage; this covers
  // previews outside one.
  const theme = useTheme()
  const e = $derived(normEffects(resolveRefs(effects, theme())))
  const ink = $derived(resolveRefs(color, theme()))
  const face = $derived(resolveRefs(font, theme()))
  const one = $derived(oneLine || e.layout.ellipsis)
  const p = $derived(planEffects(e, { color: ink, size }, { motion: mode !== 'thumb' && !lite, oneLine: one }))
  const segs = $derived(segments ?? [{ text }])
  const plain = $derived(!segments)
  const full = $derived(segs.map((s) => s.text).join(''))
  const split = $derived(p.letters ? splitLetters(segs) : null)
  const stagger = $derived.by(() => {
    const n = Math.max(1, split?.count ?? 1)
    if (p.anim === 'a-typewriter') return typeSeconds(p.speed, n) / n
    if (p.anim === 'a-wave') return p.speed / Math.max(n, 8)
    return (p.speed * 0.5) / n
  })
  // Skew and stretch keep the aligned edge in place.
  const origin = { left: '0 50%', start: '0 50%', right: '100% 50%', end: '100% 50%' } as Record<string, string>
  const fxStyle = $derived(`${p.fx} --st: ${stagger.toFixed(4)}s; --reach: ${p.reach}px; transform-origin: ${origin[align] ?? '50% 50%'};`)
  // The typewriter types again whenever the text changes.
  const typeKey = $derived(p.anim === 'a-typewriter' ? full : '')

  const items = { start: 'flex-start', left: 'flex-start', center: 'center', right: 'flex-end', end: 'flex-end' } as Record<string, string>
  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as Record<string, string>

  // Fit 'shrink': the largest size (at most size, at least minSize) at which
  // the text fits the box, found by binary search on the box's font size.
  // Runs when anything that changes the text's extent does, when the box is
  // resized and when fonts finish loading.
  let box = $state<HTMLDivElement>()
  let inner = $state<HTMLDivElement>()
  let fillEl = $state<HTMLDivElement>()
  let fitted = $state<number | null>(null)
  const fitOn = $derived(!lite && layout === 'box' && e.layout.fit === 'shrink')
  const fitKey = $derived(fitOn ? JSON.stringify([full, size, face, weight, italic, lineHeight, letterSpacing, transform, one, e.layout, e.highlight]) : '')

  $effect(() => {
    void fitKey
    const el = box
    const it = inner
    const fl = fillEl
    if (!fitOn || !el || !it || !fl) {
      fitted = null
      return
    }
    const max = Math.max(1, size)
    const min = Math.min(max, e.layout.minSize > 0 ? e.layout.minSize : 12)
    const sx = (Number(e.layout.stretch) || 100) / 100
    const measure = () => {
      const W = el.clientWidth + 0.5
      const H = el.clientHeight + 0.5
      const fits = (s: number) => {
        el.style.fontSize = `${s}px`
        return Math.max(it.offsetWidth, fl.scrollWidth) * sx <= W && Math.max(it.offsetHeight, fl.scrollHeight) <= H
      }
      let best = max
      if (!fits(max)) {
        let lo = min
        let hi = max
        if (fits(lo)) {
          while (hi - lo > 0.5) {
            const mid = (lo + hi) / 2
            if (fits(mid)) lo = mid
            else hi = mid
          }
        }
        best = Math.floor(lo * 2) / 2
      }
      el.style.fontSize = `${best}px`
      fitted = best
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const fonts = document.fonts
    fonts?.addEventListener('loadingdone', measure)
    return () => {
      ro.disconnect()
      fonts?.removeEventListener('loadingdone', measure)
    }
  })
</script>

{#snippet runs(colored: boolean)}{#if split}{#each split.tokens as t, k (k)}{#if t.letters}<span class="w">{#each t.letters as c (c.i)}<span class="c" style:--i={c.i} style:--r={c.r.toFixed(3)} style:color={colored ? c.color : undefined} style:font-weight={c.weight}>{c.ch}</span>{/each}</span>{:else}{t.ws}{/if}{/each}{:else if plain}{full}{:else}{#each segs as s, k (k)}<span data-part={colored ? s.part : undefined} style:color={colored ? s.color : undefined} style:font-weight={s.weight}>{s.text}</span>{/each}{/if}{/snippet}
{#snippet body(colored: boolean, band: boolean)}{#if p.band}<span class="hl" style={band ? p.band.paint : p.band.layout}>{@render runs(colored)}</span>{:else}{@render runs(colored)}{/if}{/snippet}

<div
  bind:this={box}
  class="st {layout}"
  data-part={part}
  style:font-family={face}
  style:font-size="{fitted ?? size}px"
  style:font-weight={weight}
  style:font-style={italic ? 'italic' : undefined}
  style:text-align={align}
  style:line-height={lineHeight}
  style:letter-spacing={letterSpacing ? `${letterSpacing}px` : undefined}
  style:text-transform={transform}
  style:align-items={items[align] ?? 'flex-start'}
  style:justify-content={layout === 'box' ? (justify[valign] ?? 'flex-start') : undefined}
>
  <div bind:this={inner} class="fx {p.anim}" class:one class:pos={p.pos} class:fit={fitOn} style={fxStyle}>
    {#key typeKey}
      {#if p.back !== null}<div class="l abs" aria-hidden="true" style={p.back}>{@render body(false, p.bandOn === 'back')}</div>{/if}
      {#each p.outlines as o, k (k)}<div class="l abs" aria-hidden="true" style={o}>{@render body(false, false)}</div>{/each}
      <div bind:this={fillEl} class="l fill" class:clip={p.clip} class:hue={p.hue} style={p.fill}>{@render body(!p.clip, p.bandOn === 'fill')}</div>
      {#if p.shine !== null}<div class="l abs shine" aria-hidden="true" style={p.shine}>{@render body(false, false)}</div>{/if}
    {/key}
  </div>
</div>

<style>
  .st {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 100%;
  }
  .st.box {
    width: 100%;
    height: 100%;
  }
  .st.block {
    width: 100%;
  }
  .st.inline {
    flex: 0 1 auto;
  }
  .fx {
    position: relative;
    max-width: 100%;
    min-width: 0;
  }
  .l {
    position: relative;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .l.abs {
    position: absolute;
    inset: 0;
    pointer-events: none;
    user-select: none;
  }
  .fx.fit .l {
    overflow-wrap: normal;
  }
  .fx.one .l {
    white-space: pre;
    overflow: clip;
    overflow-clip-margin: var(--reach);
    text-overflow: ellipsis;
  }
  .fill {
    text-decoration: var(--deco, none);
  }
  .w {
    white-space: nowrap;
  }

  /* Whole-text animations: the individual transform properties, so they
     compose with the box's skew and stretch. */
  .fx.a-pulse {
    animation: pulse var(--sp) ease-in-out infinite;
  }
  .fx.a-float {
    animation: float var(--sp) ease-in-out infinite;
  }
  .fx.a-shake {
    animation: shake var(--sp) linear infinite;
  }
  .shine {
    animation: shine var(--sp) ease-in-out infinite;
  }
  .fx.a-rainbow .fill.clip:not(.hue) {
    animation: rainbow var(--sp) linear infinite;
  }
  .fx.a-rainbow .fill.hue {
    animation: hue var(--sp) linear infinite;
  }

  /* Per-letter animations. */
  .fx.a-wave .c,
  .fx.a-bounce .c,
  .fx.a-jitter .c {
    display: inline-block;
    animation-duration: var(--sp);
    animation-iteration-count: infinite;
    animation-fill-mode: both;
  }
  /* Inline blocks don't inherit the line: each letter draws its own and
     moves it along. */
  .fx.a-wave .fill,
  .fx.a-bounce .fill,
  .fx.a-jitter .fill {
    text-decoration: none;
  }
  .fx.a-wave .c,
  .fx.a-bounce .c,
  .fx.a-jitter .c {
    text-decoration: var(--deco, none);
  }
  .fx.pos .c {
    position: relative;
  }
  .fx.a-wave .c {
    animation-name: wave;
    animation-timing-function: ease-in-out;
    animation-delay: calc(var(--i) * var(--st));
  }
  .fx.a-bounce .c {
    animation-name: bounce;
    animation-timing-function: ease-in-out;
    animation-delay: calc(var(--i) * var(--st));
  }
  .fx.a-jitter .c {
    animation-name: jitter;
    animation-timing-function: steps(1, end);
    animation-delay: calc(var(--r) * var(--sp) * -1);
  }
  .fx.pos.a-wave .c {
    animation-name: wave-p;
  }
  .fx.pos.a-bounce .c {
    animation-name: bounce-p;
  }
  .fx.pos.a-jitter .c {
    animation-name: jitter-p;
  }
  .fx.a-typewriter .c {
    animation: type 1ms linear both;
    animation-delay: calc(var(--i) * var(--st));
  }

  @keyframes pulse {
    0%,
    100% {
      scale: 1;
    }
    50% {
      scale: calc(1 + 0.06 * var(--amp));
    }
  }
  @keyframes float {
    0%,
    100% {
      translate: 0 calc(0.05em * var(--amp));
    }
    50% {
      translate: 0 calc(-0.05em * var(--amp));
    }
  }
  @keyframes shake {
    0%,
    100% {
      translate: 0 0;
    }
    12.5% {
      translate: calc(-0.03em * var(--amp)) calc(0.01em * var(--amp));
    }
    25% {
      translate: calc(0.03em * var(--amp)) calc(-0.01em * var(--amp));
    }
    37.5% {
      translate: calc(-0.025em * var(--amp)) calc(-0.01em * var(--amp));
    }
    50% {
      translate: calc(0.025em * var(--amp)) calc(0.01em * var(--amp));
    }
    62.5% {
      translate: calc(-0.015em * var(--amp)) 0;
    }
    75% {
      translate: calc(0.015em * var(--amp)) 0;
    }
  }
  @keyframes shine {
    0% {
      background-position: 100% 0;
    }
    65%,
    100% {
      background-position: 0% 0;
    }
  }
  @keyframes rainbow {
    from {
      background-position: 0% 0;
    }
    to {
      background-position: 100% 0;
    }
  }
  @keyframes hue {
    from {
      filter: hue-rotate(0deg);
    }
    to {
      filter: hue-rotate(360deg);
    }
  }
  @keyframes wave {
    0%,
    100% {
      translate: 0 0;
    }
    25% {
      translate: 0 calc(-0.15em * var(--amp));
    }
    75% {
      translate: 0 calc(0.15em * var(--amp));
    }
  }
  @keyframes wave-p {
    0%,
    100% {
      top: 0;
    }
    25% {
      top: calc(-0.15em * var(--amp));
    }
    75% {
      top: calc(0.15em * var(--amp));
    }
  }
  @keyframes bounce {
    0%,
    45%,
    100% {
      translate: 0 0;
    }
    20% {
      translate: 0 calc(-0.3em * var(--amp));
    }
  }
  @keyframes bounce-p {
    0%,
    45%,
    100% {
      top: 0;
    }
    20% {
      top: calc(-0.3em * var(--amp));
    }
  }
  @keyframes jitter {
    0%,
    100% {
      translate: 0 0;
    }
    25% {
      translate: calc(0.03em * var(--amp)) calc(-0.04em * var(--amp));
    }
    50% {
      translate: calc(-0.04em * var(--amp)) calc(0.02em * var(--amp));
    }
    75% {
      translate: calc(0.02em * var(--amp)) calc(0.04em * var(--amp));
    }
  }
  @keyframes jitter-p {
    0%,
    100% {
      top: 0;
      left: 0;
    }
    25% {
      top: calc(-0.04em * var(--amp));
      left: calc(0.03em * var(--amp));
    }
    50% {
      top: calc(0.02em * var(--amp));
      left: calc(-0.04em * var(--amp));
    }
    75% {
      top: calc(0.04em * var(--amp));
      left: calc(0.02em * var(--amp));
    }
  }
  @keyframes type {
    from {
      visibility: hidden;
    }
    to {
      visibility: visible;
    }
  }
</style>
