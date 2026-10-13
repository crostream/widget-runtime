// contract.test.ts: the built artifacts (run `npm run build` first): the
// contract.json an embedding app reads matches protocol.ts, the host bundle
// carries no Svelte, and the frame page has what the embedding rules need.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALERT_CUE_FIELDS, API_LEVEL, ASSET_PREFIX, EMOTE_PREFIX, FRAME_PATH, MEDIA_PREFIX, PROTOCOL } from '../src/protocol.js'

const dist = join(import.meta.dirname, '..', 'dist')
const read = (f: string) => {
  const p = join(dist, f)
  if (!existsSync(p)) throw new Error(`dist/${f} is missing: run "npm run build" before the tests`)
  return readFileSync(p, 'utf8')
}

describe('dist/contract.json', () => {
  it('matches protocol.ts', () => {
    expect(JSON.parse(read('contract.json'))).toEqual({
      protocol: PROTOCOL,
      apiLevel: API_LEVEL,
      framePath: FRAME_PATH,
      assetPrefix: ASSET_PREFIX,
      mediaPrefix: MEDIA_PREFIX,
      emotePrefix: EMOTE_PREFIX,
      alertCueFields: [...ALERT_CUE_FIELDS],
    })
  })
  it('the paths are the ones the Go servers use', () => {
    const c = JSON.parse(read('contract.json'))
    expect(c.framePath).toBe('/widget-frame.html')
    expect(c.assetPrefix).toBe('/widget-assets/')
    expect(c.mediaPrefix).toBe('/media/')
    expect(c.emotePrefix).toBe('/emote/')
    expect(c.apiLevel).toBe(3)
  })
  it('lists the alert fields the frame consumes', () => {
    expect(JSON.parse(read('contract.json')).alertCueFields).toEqual(['id', 'type', 'vars', 'hold', 'in', 'out', 'test', 'leaving', 'age', 'sample'])
  })
})

describe('dist/host.js', () => {
  it('has no Svelte in it', () => {
    const js = read('host.js')
    expect(js).not.toContain('svelte/src/internal')
    expect(js).not.toMatch(/from\s*["']svelte/)
  })
  it('exports the host API', () => {
    const js = read('host.js')
    expect(js).toMatch(/export\s*\{[^}]*\bmount\b/)
  })
})

describe('dist/widget-frame.html', () => {
  const html = read('widget-frame.html')
  it('is one page with one inline classic script', () => {
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).not.toContain('src=')
    expect(html.startsWith('<!doctype html>')).toBe(true)
  })
  it('does not close its script early', () => {
    const body = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))
    expect(body).not.toMatch(/<\/script/i)
    expect(body).not.toContain('<!--')
  })
  it('carries the protocol it speaks', () => {
    expect(html).toContain('Content-Security-Policy')
  })
})
