// cue.svelte.ts: how media starts over on a play cue. The frame's <sl-media>
// block uses it: a cue is one observed change of the host's play counter, and
// onCue starts the media again for each (and once at mount when fresh).
import { untrack } from 'svelte'
import type { Cue } from './types.js'

// A widget mounted this soon after its cue (e.g. an alert shown and started
// by the same frame) treats the cue as its own.
const FRESH_MS = 1000

// onCue calls start whenever cue() changes, and once at mount when the cue is
// fresh. Call it during component init; start runs untracked.
export function onCue(cue: () => Cue | undefined, start: () => void): void {
  let seen: Cue | undefined
  let first = true
  $effect(() => {
    const c = cue()
    if (first) {
      first = false
      seen = c
      if (c && performance.now() - c.at < FRESH_MS) untrack(start)
      return
    }
    if (c === seen) return
    seen = c
    if (c) untrack(start)
  })
}

// restart plays a media element from the start; autoplay refusals and
// missing files only log.
export function restart(el: HTMLMediaElement | undefined): void {
  if (!el) return
  try {
    el.currentTime = 0
  } catch {
    // not seekable yet: play() starts at 0 anyway
  }
  el.play().catch((e) => console.debug('overlay: play:', e))
}
