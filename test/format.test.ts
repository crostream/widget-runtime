// format.test.ts: the id, version and asset path rules accept and reject what
// the Go side (github.com/crostream/csw) does. The cases are copied from its
// tests (csw_test.go TestValidate, assets_test.go TestCheckAssets).
import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, CSW_MEDIA_TYPE, FORMAT, MAX_ASSET_PATH, MAX_ID_LENGTH, validAssetPath, validId, validVersion } from '../src/format.js'
import { API_LEVEL } from '../src/protocol.js'

const rep = (c: string, n: number) => c.repeat(n)

describe('format', () => {
  it('constants', () => {
    expect(FORMAT).toBe(1)
    expect(CSW_MEDIA_TYPE).toBe('application/vnd.crostream.widget+json')
    expect(API_LEVEL).toBe(3)
    expect(Object.keys(ASSET_TYPES)).toHaveLength(9)
  })

  it.each([
    ['test.hello', true],
    ['crostream.alert-neon-burst', true],
    ['a.' + rep('b', MAX_ID_LENGTH - 2), true], // id max
    ['Test.Hello', false], // upper
    ['hello', false], // no dot
    ['a.b--c', false], // double hyphen
    ['a.' + rep('b', MAX_ID_LENGTH), false], // long
    ['', false],
    ['1a.b', false],
    ['a.-b', false],
    ['a.b-', false],
  ])('id %s -> %s', (id, ok) => expect(validId(id)).toBe(ok))

  it.each([
    ['1.0.0', true],
    ['0.0.1', true],
    ['10.20.30', true],
    ['1.0', false],
    ['01.0.0', false], // leading zero
    ['1.0.0-rc1', false], // prerelease
    ['1.0.0.0', false],
    ['', false],
    ['v1.0.0', false],
  ])('version %s -> %s', (v, ok) => expect(validVersion(v)).toBe(ok))

  it.each([
    ['a.png', true],
    ['a/b-c.d.png', true],
    ['img/logo.png', true],
    ['sfx/hit.ogg', true],
    ['A.png', false], // upper
    ['Img.png', false],
    ['a/../b.png', false], // dotdot
    ['a..b.png', false], // dotdot inside a name
    ['/a.png', false], // absolute
    ['a/.b.png', false], // hidden
    ['a/./b.png', false], // dot segment
    ['', false],
    [rep('a', MAX_ASSET_PATH - 3) + '.png', false], // 128 chars is over: .png makes it MAX_ASSET_PATH + 1
    [rep('a', MAX_ASSET_PATH - 4) + '.png', true],
  ])('asset path %s -> %s', (p, ok) => expect(validAssetPath(p)).toBe(ok))
})
