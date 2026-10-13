// build.mjs: builds dist/.
//
//   tsc          protocol, format, api, tooling and the host's types (JS and
//                .d.ts, one file per module)
//   svelte-package  ./render: the renderer as preprocessed Svelte + .d.ts
//   vite         dist/widget-frame.html (the runtime, inline) and
//                dist/host.js (the host as one ES module)
//   contract.json   the constants an embedding app must agree on, read from
//                the built protocol
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle, bundleFrame, framePage } from './bundle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const bin = (name) => join(root, 'node_modules', '.bin', name)

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`build: ${cmd} ${args.join(' ')} failed`)
    process.exit(r.status ?? 1)
  }
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

run(bin('tsc'), ['-p', 'tsconfig.build.json'])
// The host ships as one bundle (host.js); only its declarations stay.
rmSync(join(dist, 'host', 'index.js'))
rmSync(join(dist, 'host', 'helpers.js'))
// tsc also wrote the pure render modules; svelte-package writes all of them.
rmSync(join(dist, 'render'), { recursive: true, force: true })
run(bin('svelte-package'), ['-i', 'src/render', '-o', 'dist/render', '-t', 'tsconfig.json'])

const frame = await bundleFrame()
writeFileSync(join(dist, 'widget-frame.html'), framePage(frame))
const host = await bundle('src/host/index.ts', { formats: ['es'], fileName: () => 'host.js' }, [])
writeFileSync(join(dist, 'host.js'), host)

const p = await import(pathToFileURL(join(dist, 'protocol.js')).href)
const contract = {
  protocol: p.PROTOCOL,
  apiLevel: p.API_LEVEL,
  framePath: p.FRAME_PATH,
  assetPrefix: p.ASSET_PREFIX,
  mediaPrefix: p.MEDIA_PREFIX,
  emotePrefix: p.EMOTE_PREFIX,
  alertCueFields: [...p.ALERT_CUE_FIELDS],
}
writeFileSync(join(dist, 'contract.json'), JSON.stringify(contract, null, 2) + '\n')
console.log(`built dist/: widget-frame.html ${(frame.length / 1024).toFixed(0)} KB script, host.js ${(host.length / 1024).toFixed(1)} KB`)
