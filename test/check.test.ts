// check.test.ts: the widget folder checks and the crostream-widget command,
// on small csw folders written to a temp dir.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { checkFolder, checkPaths, widgetFolders } from '../src/tooling/check.js'

const root = mkdtempSync(join(tmpdir(), 'widget-check-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

interface Opts {
  name: string
  manifest: Record<string, unknown>
  html?: string
  js?: string
}
function widget({ name, manifest, html = '<div>{{text}}</div>', js }: Opts): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  writeFileSync(join(dir, 'widget.html'), html)
  writeFileSync(join(dir, 'widget.css'), '')
  if (js !== undefined) writeFileSync(join(dir, 'widget.js'), js)
  return dir
}

const csw = (id: string, extra: Record<string, unknown> = {}) => ({
  csw: 1,
  id,
  version: '1.0.0',
  api: 1,
  name: 'Hello',
  icon: 'sparkle',
  fields: [{ key: 'text', label: 'Text', kind: 'text' }],
  data: [],
  ...extra,
})

describe('checkFolder', () => {
  it('passes a clean csw folder', () => {
    const d = widget({ name: 'test.hello', manifest: csw('test.hello'), js: "sl.on('fields', () => sl.render())\n" })
    expect(checkFolder(d)).toEqual({ name: 'test.hello', problems: [] })
  })
  it('type-checks sl.fields by the field kinds', () => {
    const d = widget({ name: 'test.typed', manifest: csw('test.typed'), js: 'const t = sl.fields.text\nvoid t\n' })
    expect(checkFolder(d)).toEqual({ name: 'test.typed', problems: [] })
  })
  it('reads csw identity: id, folder name, version, api', () => {
    expect(checkFolder(widget({ name: 'test.bad-id', manifest: csw('Test.Bad') })).problems.join('\n')).toMatch(/not a valid widget id/)
    expect(checkFolder(widget({ name: 'test.other', manifest: csw('test.name-mismatch') })).problems.join('\n')).toMatch(/is not the widget id/)
    expect(checkFolder(widget({ name: 'test.ver', manifest: csw('test.ver', { version: '1.0' }) })).problems.join('\n')).toMatch(/MAJOR\.MINOR\.PATCH/)
    expect(checkFolder(widget({ name: 'test.api', manifest: csw('test.api', { api: 4 }) })).problems.join('\n')).toMatch(/api 4 must be 1 to 3/)
  })
  it('reads name and icon', () => {
    expect(checkFolder(widget({ name: 'test.no-name', manifest: csw('test.no-name', { name: '' }) })).problems.join('\n')).toMatch(/no name/)
    expect(checkFolder(widget({ name: 'test.bad-icon', manifest: csw('test.bad-icon', { icon: 'nope-icon' }) })).problems.join('\n')).toMatch(/not a UI icon name/)
  })
  it('compiles the template with the runtime compiler and checks it like the editor', () => {
    expect(checkFolder(widget({ name: 'test.bad-tpl', manifest: csw('test.bad-tpl'), html: '{{#if text}}open' })).problems.join('\n')).toMatch(/widget\.html/)
    expect(checkFolder(widget({ name: 'test.unk-field', manifest: csw('test.unk-field'), html: '{{nope}}' })).problems.join('\n')).toMatch(/widget\.html:1/)
  })
  it('type-checks the script against the sl API and its own context', () => {
    expect(checkFolder(widget({ name: 'test.js-type', manifest: csw('test.js-type'), js: "sl.fields.nope\n" })).problems.join('\n')).toMatch(/widget\.js type errors/)
    expect(checkFolder(widget({ name: 'test.js-event', manifest: csw('test.js-event'), js: "sl.on('cue2', () => {})\n" })).problems.join('\n')).toMatch(/Unknown event "cue2"/)
  })
  it('reports an unreadable or unknown manifest', () => {
    const d = join(root, 'broken')
    mkdirSync(d)
    writeFileSync(join(d, 'manifest.json'), '{')
    expect(checkFolder(d).problems[0]).toMatch(/^manifest\.json:/)
    expect(checkFolder(widget({ name: 'test.no-csw', manifest: { name: 'x' } })).problems[0]).toMatch(/no `csw` key/)
  })
})

describe('folders of folders', () => {
  it('finds widget folders under a directory, sorted, and the folder itself', () => {
    const lib = join(root, 'lib')
    mkdirSync(lib)
    for (const n of ['test.b-two', 'test.a-one']) {
      mkdirSync(join(lib, n))
      writeFileSync(join(lib, n, 'manifest.json'), JSON.stringify(csw(n)))
      writeFileSync(join(lib, n, 'widget.html'), '<p></p>')
    }
    mkdirSync(join(lib, 'not-a-widget'))
    expect(widgetFolders(lib).map((p) => p.split('/').pop())).toEqual(['test.a-one', 'test.b-two'])
    expect(widgetFolders(join(lib, 'test.a-one'))).toEqual([join(lib, 'test.a-one')])
    expect(checkPaths([lib]).map((r) => r.name)).toEqual(['test.a-one', 'test.b-two'])
  })
})

describe('crostream-widget check', () => {
  const bin = join(import.meta.dirname, '..', 'bin', 'crostream-widget.mjs')
  const run = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' })
  it('prints ok and exits 0', () => {
    const r = run('check', join(root, 'test.hello'))
    expect(r.stdout).toContain('ok test.hello')
    expect(r.status).toBe(0)
  })
  it('prints FAIL and exits 1', () => {
    const r = run('check', join(root, 'test.bad-tpl'))
    expect(r.stdout).toMatch(/^FAIL test.bad-tpl: widget\.html/m)
    expect(r.status).toBe(1)
  })
  it('exits 2 with usage when called wrongly', () => {
    expect(run().status).toBe(2)
    expect(run('check').status).toBe(2)
  })
  it('fails for a folder that is not there', () => {
    expect(run('check', join(root, 'nowhere')).status).toBe(1)
  })
})
