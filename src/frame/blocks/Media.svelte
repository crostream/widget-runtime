<script lang="ts">
  // <sl-media>: an image, video or sound from the media library (or a src
  // URL the frame may load: the overlay's /media/, /emote/ and
  // /widget-assets/ paths, data: and blob:; or asset, a path of the widget's
  // own assets). Like the built-in Image and Video elements: the editor plays
  // video muted, thumbnails show a video's poster and no sound, and the live
  // play cue starts video and sound over. Without a type it tries an image
  // first and falls back to a video element (which also plays sound).
  import { onCue, restart } from '../../render/cue.svelte.js'
  import { mediaFileUrl, mediaThumbUrl } from '../../render/types.js'
  import { env } from '../env.svelte.js'
  import { assetPath } from '../../protocol.js'
  import type { MediaAttrs } from './types.js'

  let { p }: { p: MediaAttrs } = $props()

  const url = $derived(p.src || (p.asset ? assetPath(env.kind, p.asset) : '') || (p.media ? mediaFileUrl(p.media) : ''))
  let failed = $state('') // the url that did not load as an image
  const kind = $derived(p.type || (failed === url ? 'video' : 'image'))

  let el = $state<HTMLMediaElement>()
  $effect(() => {
    if (el) el.volume = Math.min(1, Math.max(0, p.volume / 100))
  })
  onCue(() => env.cue, () => env.mode !== 'thumb' && restart(el))
</script>

{#if url}
  {#if kind === 'image'}
    <img src={url} alt="" draggable="false" style:object-fit={p.fit} style:border-radius="{p.radius}px" onerror={() => (failed = url)} />
  {:else if env.mode === 'thumb'}
    {#if kind === 'video' && p.media}<img src={mediaThumbUrl(p.media)} alt="" draggable="false" style:object-fit={p.fit} style:border-radius="{p.radius}px" />{/if}
  {:else if kind === 'audio'}
    {#key url}<audio bind:this={el} src={url} autoplay={p.autoplay} loop={p.loop} muted={(env.mode === 'editor' && !env.audition) || p.muted || env.muted} preload="auto"></audio>{/key}
  {:else}
    {#key url}
      <video
        bind:this={el}
        src={url}
        autoplay={env.mode === 'editor' || p.autoplay}
        loop={p.loop}
        muted={(env.mode === 'editor' && !env.audition) || p.muted || env.muted}
        playsinline
        disablepictureinpicture
        preload="auto"
        style:object-fit={p.fit}
        style:border-radius="{p.radius}px"
      ></video>
    {/key}
  {/if}
{/if}

<style>
  img,
  video {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }
</style>
