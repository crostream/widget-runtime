#!/usr/bin/env node
// crostream-widget: command line checks for CroStream widget sources.
//
//   crostream-widget check [--typed-fields] <dir…>
//
// Each dir is a widget folder or a folder of widget folders, in either
// source layout (see the package's README). Prints `ok <name>` or
// `FAIL <name>: reason` per widget and exits 1 if any failed. --typed-fields
// types sl.fields by field kind, as the app's editor does (stricter).
import { existsSync } from 'node:fs'
import { checkPaths } from '../dist/tooling/check.js'

const [cmd, ...rest] = process.argv.slice(2)
const typedFields = rest.includes('--typed-fields')
const args = rest.filter((a) => a !== '--typed-fields')

function usage(code) {
  const out = code ? console.error : console.log
  out('usage: crostream-widget check [--typed-fields] <dir…>\n\nEach dir is a widget folder (manifest.json, widget.html/css/js) or a folder of them.')
  process.exit(code)
}

if (cmd === '-h' || cmd === '--help' || cmd === 'help') usage(0)
if (cmd !== 'check' || args.length === 0) usage(2)

let failed = 0
let total = 0
for (const arg of args) {
  if (!existsSync(arg)) {
    console.error(`FAIL ${arg}: no such folder`)
    failed++
    continue
  }
  const results = checkPaths([arg], { typedFields })
  if (results.length === 0) {
    console.error(`FAIL ${arg}: no widget folders (a folder with a manifest.json) found`)
    failed++
    continue
  }
  for (const r of results) {
    total++
    if (r.problems.length === 0) console.log(`ok ${r.name}`)
    else {
      failed++
      for (const p of r.problems) console.log(`FAIL ${r.name}: ${p}`)
    }
  }
}
console.log(`\n${total - failed}/${total} widgets ok`)
process.exit(failed ? 1 : 0)
