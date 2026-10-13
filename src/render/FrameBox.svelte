<script lang="ts">
  // FrameBox draws a FrameStyle (types.ts) filling its box, with optional
  // content on top inset by the frame's padding (and by the room a bubble's
  // pointer, a tab or pointed ends take). Every frame of every widget goes
  // through it: the Frame widget, chat and event boxes and rows, alert
  // panels, goal bars and the plates behind latest/counter texts.
  //
  // layout 'fill' takes its parent's size (100% × 100%), 'wrap' is a block
  // as tall as its content (chat and event rows). The frame is drawn at
  // w × h canvas pixels when given, else at the measured size.
  //
  // One SVG per frame, bottom first: outer shadows (and a glow without a
  // border), clipped outside the shape as CSS box shadows are; the fill
  // (color, gradient or image clipped to the shape) and its pattern; noise
  // (blended as overlay), inner shadows, bevel and the shine band, clipped
  // inside the shape; the edge's glow; the edge: rings, border, brackets;
  // the running light. Each outline is the shape
  // offset in or out (frame.ts), so everything follows the shape. Filters
  // are only defined when something uses them. Animations are CSS only; a
  // thumbnail is static. An image frame (9-slice) is a CSS border-image
  // instead, and shape, fill and border don't apply.
  import type { Snippet } from 'svelte'
  import { contentInsets, cssGradientLine, frameColor, frameDraws, frameSpeed, geometry, gradientStops, normFrame, outline } from './frame.js'
  import { resolveRefs, useTheme } from './theme.js'
  import { mediaFileUrl, type FrameStyle, type Mode } from './types.js'

  let {
    frame,
    w,
    h,
    mode = 'output',
    layout = 'fill',
    style = '',
    part,
    children,
  }: {
    frame?: Partial<FrameStyle> | null
    w?: number
    h?: number
    mode?: Mode
    layout?: 'fill' | 'wrap'
    style?: string
    part?: string // data-part, for custom CSS
    children?: Snippet
  } = $props()

  const pid = $props.id()
  const uid = `fb${pid}`
  const theme = useTheme()
  // References are resolved already inside a Stage; this covers previews.
  const f = $derived(normFrame(resolveRefs(frame, theme())))

  // The drawn size: as given, or measured.
  let root = $state<HTMLDivElement>()
  let mw = $state(0)
  let mh = $state(0)
  const fixed = $derived(w !== undefined && h !== undefined)
  const shows = $derived(frameDraws(f))
  $effect(() => {
    const el = root
    if (fixed || !el || !shows) return
    const measure = () => {
      mw = el.offsetWidth
      mh = el.offsetHeight
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })
  const W = $derived(Math.max(0, fixed ? Number(w) || 0 : mw))
  const H = $derived(Math.max(0, fixed ? Number(h) || 0 : mh))

  const draws = $derived(shows && W > 0 && H > 0)
  const nine = $derived(!!f.image.media)
  const motion = $derived(mode !== 'thumb')
  const anim = $derived(f.animation.kind && f.animation.kind !== 'none' ? f.animation.kind : '')
  const sp = $derived(frameSpeed(f))
  const animColor = $derived(frameColor(f.animation.color, '#ffffff'))

  const g = $derived(geometry(f, Math.max(1, W), Math.max(1, H)))
  const shape = $derived(draws && !nine ? outline(g, 0) : '')

  // ---- 9-slice ----
  const sliceW = $derived.by(() => {
    const s = f.image.slice
    const any = s.some((v) => v > 0)
    const d = Math.round(Math.min(W, H) / 6)
    return f.image.width.map((v, i) => (v > 0 ? v : any ? s[i] : d))
  })
  const nineStyle = $derived.by(() => {
    if (!nine) return ''
    const s = f.image.slice
    const slice = s.some((v) => v > 0) ? s.join(' ') : '33%'
    const widths = sliceW.map((v) => `${v}px`).join(' ')
    const rep = ['stretch', 'repeat', 'round', 'space'].includes(f.image.repeat) ? f.image.repeat : 'stretch'
    const drops = f.shadows
      .filter((s) => !s.inset)
      .map((s) => `drop-shadow(${s.x}px ${s.y}px ${Math.max(0, s.blur) / 2}px ${frameColor(s.color, '#00000080')})`)
      .join(' ')
    return `border-style: solid; border-color: transparent; border-width: ${widths}; border-image-source: url("${mediaFileUrl(f.image.media)}"); border-image-slice: ${slice}${f.image.fill ? ' fill' : ''}; border-image-width: ${widths}; border-image-repeat: ${rep};${drops ? ` filter: ${drops};` : ''}`
  })

  // ---- Content inset ----
  const pad = $derived.by(() => {
    const p = f.padding
    if (nine) return [p + sliceW[0], p + sliceW[1], p + sliceW[2], p + sliceW[3]]
    const i = contentInsets(g, f, Math.max(1, W), Math.max(1, H))
    return [p + i.t, p + i.r, p + i.b, p + i.l]
  })
  const padCSS = $derived(pad.map((v) => `${Math.round(v * 100) / 100}px`).join(' '))

  // ---- Fill ----
  const fillStops = $derived(gradientStops(f.fill.stops))
  const fillKind = $derived.by(() => {
    const k = f.fill.kind
    if ((k === 'linear' || k === 'radial') && fillStops.length >= 2) return k
    if (k === 'media' && f.fill.media) return 'media'
    if (k && k !== 'none' && (f.fill.color || fillStops.length)) return 'solid'
    return ''
  })
  const fillPaint = $derived(
    fillKind === 'linear' || fillKind === 'radial' ? `url(#${uid}-fill)` : fillKind === 'solid' ? frameColor(f.fill.color || fillStops[0]?.color, '#00000000') : 'none',
  )
  const fillLine = $derived(cssGradientLine(f.fill.angle, W, H))

  // ---- Pattern ----
  const pat = $derived.by(() => {
    const p = f.fill.pattern
    if (!p.kind || p.kind === 'none') return null
    const s = Math.min(400, Math.max(2, Number(p.size) || 16))
    return { kind: p.kind, s, color: frameColor(p.color, '#ffffff22'), angle: Number(p.angle) || 0 }
  })

  // ---- Border, rings, brackets ----
  const bw = $derived(Math.max(0, Number(f.border.width) || 0))
  const bInset = $derived(Number(f.border.inset) || 0)
  const bStops = $derived(gradientStops(f.border.stops))
  const bGrad = $derived(bStops.length >= 2)
  const bLine = $derived(cssGradientLine(f.border.angle, W, H))
  const bPaint = $derived(bGrad ? `url(#${uid}-border)` : frameColor(f.border.color, '#ffffff'))
  const bStyle = $derived(f.border.style || 'solid')
  // Ants march a dashed border; a solid one gets dashes for them.
  const dash = $derived.by(() => {
    const st = bStyle === 'solid' && anim === 'ants' ? 'dashed' : bStyle
    const u = Math.max(bw, 2)
    if (st === 'dashed') return { array: `${r(u * 3)} ${r(u * 2)}`, period: u * 5, cap: 'butt' as const }
    if (st === 'dotted') return { array: `0 ${r(u * 2)}`, period: u * 2, cap: 'round' as const }
    return null
  })
  const borderPaths = $derived.by(() => {
    if (!draws || nine || bw <= 0) return []
    if (bStyle === 'double' && bw >= 3)
      return [
        { d: outline(g, bInset + bw / 6), w: bw / 3 },
        { d: outline(g, bInset + (bw * 5) / 6), w: bw / 3 },
      ]
    return [{ d: outline(g, bInset + bw / 2), w: bw }]
  })
  const rings = $derived.by(() => {
    if (!draws || nine) return []
    let edge = bw > 0 ? Math.min(bInset, 0) : 0
    return f.rings.map((ring) => {
      const rw = Math.max(0, Number(ring.width) || 0)
      const gap = Math.max(0, Number(ring.gap) || 0)
      const d = outline(g, edge - gap - rw / 2)
      edge -= gap + rw
      return { d, w: rw, color: frameColor(ring.color, bGrad ? bStops[0].color : frameColor(f.border.color, '#ffffff')) }
    })
  })
  const brackets = $derived.by(() => {
    const b = f.brackets
    const len = Number(b.length) || 0
    const bwid = Math.max(1, Number(b.width) || 2)
    if (!draws || nine || len <= 0) return null
    const o = (Number(b.inset) || 0) + bwid / 2
    const x0 = g.body.x0 + o
    const y0 = g.body.y0 + o
    const x1 = g.body.x1 - o
    const y1 = g.body.y1 - o
    const lx = Math.min(len, (x1 - x0) / 2)
    const ly = Math.min(len, (y1 - y0) / 2)
    const d =
      `M${r(x0)} ${r(y0 + ly)}V${r(y0)}H${r(x0 + lx)}` +
      `M${r(x1 - lx)} ${r(y0)}H${r(x1)}V${r(y0 + ly)}` +
      `M${r(x1)} ${r(y1 - ly)}V${r(y1)}H${r(x1 - lx)}` +
      `M${r(x0 + lx)} ${r(y1)}H${r(x0)}V${r(y1 - ly)}`
    return { d, w: bwid, color: frameColor(b.color, bGrad ? bStops[0].color : frameColor(f.border.color, '#ffffff')) }
  })
  const hasEdge = $derived(borderPaths.length > 0 || rings.length > 0 || brackets !== null)

  // ---- Shadows, glow, bevel ----
  // Blur filters, one per distinct radius (stdDeviation is half the CSS
  // blur radius).
  const outer = $derived(draws && !nine ? f.shadows.filter((s) => !s.inset) : [])
  const inner = $derived.by(() => {
    if (!draws || nine) return []
    const list = f.shadows.filter((s) => s.inset).map((s) => ({ ...s, color: frameColor(s.color, '#00000080') }))
    const bv = Number(f.bevel.size) || 0
    if (bv > 0) {
      list.push({ x: bv, y: bv, blur: bv, spread: 0, color: frameColor(f.bevel.light, '#ffffff59'), inset: true })
      list.push({ x: -bv, y: -bv, blur: bv, spread: 0, color: frameColor(f.bevel.dark, '#00000073'), inset: true })
    }
    return list
  })
  const glow = $derived.by(() => {
    if (!draws || nine) return null
    let size = Number(f.glow.size) || 0
    let n = Math.round(Math.min(5, Math.max(1, Number(f.glow.strength) || 1)))
    let color = f.glow.color
    if (size <= 0 && anim === 'pulse') {
      size = 14
      n = 2
      color = f.animation.color
    }
    if (size <= 0) return null
    const fallback = bGrad ? bStops[0].color : bw > 0 ? frameColor(f.border.color, '#ffffff') : fillKind === 'solid' ? fillPaint : '#ffffff'
    return { size, n, color: frameColor(color, fallback) }
  })
  // Glow layers, widening: stdDeviations.
  const glowLevels = $derived(glow ? Array.from({ length: glow.n }, (_, k) => (glow.size * (k + 1)) / glow.n / 2) : [])
  const blurs = $derived.by(() => {
    const set = new Set<number>()
    for (const s of outer) if (s.blur > 0) set.add(s.blur / 2)
    for (const s of inner) if (s.blur > 0) set.add(s.blur / 2)
    return [...set]
  })
  const blurId = (b: number) => `${uid}-b${blurs.indexOf(b / 2)}`

  // How far drawing reaches outside the box: filter regions and the area
  // outside the shape cover it.
  const reach = $derived.by(() => {
    let m = 8
    for (const s of f.shadows) m = Math.max(m, Math.max(Math.abs(s.x), Math.abs(s.y)) + Math.max(0, s.blur) * 1.5 + Math.abs(s.spread || 0) + 4)
    if (glow) m = Math.max(m, glow.size * 1.6 + 4)
    let ringOut = Math.max(0, -bInset)
    for (const ring of f.rings) ringOut += Math.max(0, ring.gap) + Math.max(0, ring.width)
    m += ringOut
    if (anim === 'running') m = Math.max(m, Math.max(bw, 2) * 4 + 4)
    if (f.bevel.size > 0) m = Math.max(m, f.bevel.size * 3)
    return Math.ceil(m)
  })
  const region = $derived({ x: -reach, y: -reach, width: W + 2 * reach, height: H + 2 * reach })
  const big = $derived(`M${-reach * 2} ${-reach * 2}H${W + reach * 2}V${H + reach * 2}H${-reach * 2}Z`)

  // ---- Texture, animations ----
  const tex = $derived(draws && !nine && f.texture.kind && f.texture.kind !== 'none' && f.texture.opacity > 0 ? f.texture : null)
  const running = $derived.by(() => {
    if (!draws || nine || anim !== 'running') return null
    const rw = Math.max(bw, 2)
    return { d: outline(g, bw > 0 ? bInset + bw / 2 : 1), w: rw, blur: rw * 1.5 + 1 }
  })
  // Ants without a border march a thin line of the animation color.
  const antsLine = $derived(draws && !nine && anim === 'ants' && bw <= 0 ? outline(g, 1) : '')
  const shineSweep = $derived(W + H * 0.5)

  function r(n: number) {
    return Math.round(n * 100) / 100
  }
</script>

<div bind:this={root} class="fb {layout}" data-part={part} {style}>
  {#if draws && nine}
    <div class="nine" style={nineStyle}></div>
  {:else if draws}
    <svg class="art" width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true" style:--sp="{sp}s">
      <defs>
        <clipPath id="{uid}-in"><path d={shape} /></clipPath>
        {#if outer.length || (glow && !hasEdge)}
          <clipPath id="{uid}-out"><path d={big + shape} clip-rule="evenodd" /></clipPath>
        {/if}
        {#each blurs as b, i (b)}
          <filter id="{uid}-b{i}" filterUnits="userSpaceOnUse" x={region.x} y={region.y} width={region.width} height={region.height}>
            <feGaussianBlur stdDeviation={b} />
          </filter>
        {/each}
        {#if glow}
          <filter id="{uid}-glow" filterUnits="userSpaceOnUse" x={region.x} y={region.y} width={region.width} height={region.height}>
            {#each glowLevels as sd, k (k)}
              <feGaussianBlur in="SourceAlpha" stdDeviation={sd} result="g{k}" />
            {/each}
            <feMerge result="m">
              {#each glowLevels as _, k (k)}<feMergeNode in="g{k}" />{/each}
            </feMerge>
            <feFlood flood-color={glow.color} />
            <feComposite operator="in" in2="m" />
          </filter>
        {/if}
        {#if fillKind === 'linear'}
          <linearGradient id="{uid}-fill" gradientUnits="userSpaceOnUse" x1={fillLine.x1} y1={fillLine.y1} x2={fillLine.x2} y2={fillLine.y2}>
            {#each fillStops as s, i (i)}<stop offset={s.offset} stop-color={s.color} />{/each}
          </linearGradient>
        {:else if fillKind === 'radial'}
          <radialGradient id="{uid}-fill" cx="0.5" cy="0.5" r="0.7071">
            {#each fillStops as s, i (i)}<stop offset={s.offset} stop-color={s.color} />{/each}
          </radialGradient>
        {/if}
        {#if bGrad && (borderPaths.length || rings.length || brackets)}
          <linearGradient id="{uid}-border" gradientUnits="userSpaceOnUse" x1={bLine.x1} y1={bLine.y1} x2={bLine.x2} y2={bLine.y2}>
            {#each bStops as s, i (i)}<stop offset={s.offset} stop-color={s.color} />{/each}
          </linearGradient>
        {/if}
        {#if pat}
          {@const s = pat.s}
          <pattern
            id="{uid}-pat"
            patternUnits="userSpaceOnUse"
            width={pat.kind === 'scanlines' ? W + 2 : s}
            height={pat.kind === 'scanlines' ? Math.max(2, s / 4) : s}
            patternTransform={pat.kind === 'stripes' && pat.angle ? `rotate(${pat.angle})` : undefined}
          >
            {#if pat.kind === 'stripes'}
              <rect width={s / 2} height={s} fill={pat.color} />
            {:else if pat.kind === 'dots'}
              <circle cx={s / 2} cy={s / 2} r={s * 0.18} fill={pat.color} />
            {:else if pat.kind === 'grid'}
              {@const lw = Math.max(1, s / 16)}
              <rect width={s} height={lw} fill={pat.color} /><rect width={lw} height={s} fill={pat.color} />
            {:else if pat.kind === 'checker'}
              <rect width={s / 2} height={s / 2} fill={pat.color} /><rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill={pat.color} />
            {:else if pat.kind === 'scanlines'}
              <rect width={W + 2} height={Math.max(1, s / 8)} fill={pat.color} />
            {:else if pat.kind === 'carbon'}
              <linearGradient id="{uid}-cv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color={pat.color} /><stop offset="1" stop-color={pat.color} stop-opacity="0" />
              </linearGradient>
              <linearGradient id="{uid}-ch" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color={pat.color} /><stop offset="1" stop-color={pat.color} stop-opacity="0" />
              </linearGradient>
              <rect width={s / 2} height={s / 2} fill="url(#{uid}-cv)" />
              <rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill="url(#{uid}-cv)" />
              <rect x={s / 2} width={s / 2} height={s / 2} fill="url(#{uid}-ch)" />
              <rect y={s / 2} width={s / 2} height={s / 2} fill="url(#{uid}-ch)" />
            {/if}
          </pattern>
        {/if}
        {#if tex}
          <filter id="{uid}-tex" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <feTurbulence type="fractalNoise" baseFrequency={tex.kind === 'grain' ? 1.3 : 0.75} numOctaves={tex.kind === 'grain' ? 2 : 3} seed="7" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0.9 0.9 0.9 0 -0.85  0.9 0.9 0.9 0 -0.85  0.9 0.9 0.9 0 -0.85  0 0 0 0 1" />
          </filter>
        {/if}
        {#if running}
          <filter id="{uid}-run" filterUnits="userSpaceOnUse" x={region.x} y={region.y} width={region.width} height={region.height}>
            <feGaussianBlur stdDeviation={running.blur} result="b" />
            <feGaussianBlur stdDeviation={running.blur / 3} result="c" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        {/if}
        {#if anim === 'shine' && motion}
          <linearGradient id="{uid}-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2={W * 0.35}>
            <stop offset="0.38" stop-color={animColor} stop-opacity="0" />
            <stop offset="0.5" stop-color={animColor} stop-opacity="0.5" />
            <stop offset="0.62" stop-color={animColor} stop-opacity="0" />
          </linearGradient>
        {/if}
      </defs>

      {#if outer.length || (glow && !hasEdge)}
        <g clip-path="url(#{uid}-out)">
          {#if glow && !hasEdge}
            <path d={shape} filter="url(#{uid}-glow)" class:pulse={anim === 'pulse' && motion} />
          {/if}
          {#each outer.slice().reverse() as s, i (i)}
            <path
              d={s.spread ? outline(g, -s.spread) : shape}
              fill={frameColor(s.color, '#00000080')}
              transform={s.x || s.y ? `translate(${s.x} ${s.y})` : undefined}
              filter={s.blur > 0 ? `url(#${blurId(s.blur)})` : undefined}
            />
          {/each}
        </g>
      {/if}

      {#if fillKind === 'media'}
        <image href={mediaFileUrl(f.fill.media)} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" clip-path="url(#{uid}-in)" />
      {:else if fillKind}
        <path d={shape} fill={fillPaint} />
      {/if}
      {#if pat}<path d={shape} fill="url(#{uid}-pat)" />{/if}

      {#if tex}
        <!-- Clipped on its own: a clipped group would isolate the blend. -->
        <rect class="tex" x="0" y="0" width={W} height={H} filter="url(#{uid}-tex)" clip-path="url(#{uid}-in)" opacity={Math.min(100, tex.opacity) / 100} />
      {/if}
      {#if inner.length || (anim === 'shine' && motion)}
        <g clip-path="url(#{uid}-in)">
          {#each inner.slice().reverse() as s, i (i)}
            <path
              d={big + outline(g, s.spread || 0)}
              fill-rule="evenodd"
              fill={s.color}
              transform={s.x || s.y ? `translate(${s.x} ${s.y})` : undefined}
              filter={s.blur > 0 ? `url(#${blurId(s.blur)})` : undefined}
            />
          {/each}
          {#if anim === 'shine' && motion}
            <rect class="shine" x="0" y="0" width={W} height={H} fill="url(#{uid}-shine)" style:--sx="{shineSweep}px" />
          {/if}
        </g>
      {/if}

      {#if glow && hasEdge}
        <use href="#{uid}-edge" filter="url(#{uid}-glow)" class:pulse={anim === 'pulse' && motion} />
      {/if}
      {#if hasEdge || antsLine}
        <g id="{uid}-edge" fill="none">
          {#each rings as ring, i (i)}
            <path d={ring.d} stroke={ring.color} stroke-width={ring.w} />
          {/each}
          {#each borderPaths as b, i (i)}
            <path
              d={b.d}
              stroke={bPaint}
              stroke-width={b.w}
              stroke-dasharray={dash?.array}
              stroke-linecap={dash?.cap}
              class:ants={anim === 'ants' && motion}
              style:--ap={dash ? `${-dash.period}px` : undefined}
            />
          {/each}
          {#if antsLine && dash}
            <path d={antsLine} stroke={animColor} stroke-width="2" stroke-dasharray={dash.array} class:ants={motion} style:--ap="{-dash.period}px" />
          {/if}
          {#if brackets}
            <path d={brackets.d} stroke={brackets.color} stroke-width={brackets.w} stroke-linejoin="miter" />
          {/if}
        </g>
      {/if}

      {#if running}
        <path
          class:run={motion}
          d={running.d}
          fill="none"
          pathLength="100"
          stroke={animColor}
          stroke-width={running.w}
          stroke-linecap="round"
          stroke-dasharray="16 84"
          stroke-dashoffset="100"
          filter="url(#{uid}-run)"
        />
      {/if}
    </svg>
  {/if}
  {#if children}
    <div class="content" style:padding={padCSS}>{@render children()}</div>
  {/if}
</div>

<style>
  .fb {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
  }
  .fb.fill {
    width: 100%;
    height: 100%;
  }
  .art {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
  }
  .nine {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    pointer-events: none;
  }
  .content {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
  }
  .fill > .content {
    position: absolute;
    inset: 0;
  }
  .tex {
    mix-blend-mode: overlay;
  }
  .pulse {
    animation: pulse var(--sp) ease-in-out infinite;
    will-change: opacity;
  }
  .run {
    animation: run var(--sp) linear infinite;
  }
  .ants {
    animation: ants var(--sp) linear infinite;
  }
  .shine {
    animation: shine var(--sp) ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
  @keyframes run {
    from {
      stroke-dashoffset: 100;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes ants {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: var(--ap);
    }
  }
  @keyframes shine {
    0% {
      transform: translateX(calc(var(--sx) * -1));
    }
    60%,
    100% {
      transform: translateX(var(--sx));
    }
  }
</style>
