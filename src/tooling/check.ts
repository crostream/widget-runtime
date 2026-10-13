// check.ts: checks a widget folder the way the editor and the runtime would
// (Node only; the crostream-widget command and the tests use it).
//
// Two source layouts are read, told apart by the manifest's keys:
//   csw  (crostream-gallery/widgets/<id>/): manifest.json with `csw`, `id`,
//        `version` (semver), `api`; widget.html, widget.css, widget.js;
//        assets/
//   app  (the app's internal/overlay/gallery/<slug>/): manifest.json with
//        `format`, `version` (an integer), …; the same three code files
//
// Every widget gets: its identity (name, icon, and for csw the id, version
// and API level), the runtime's template compiler on widget.html, the
// editor's template check, the script type-checked against WIDGET_DTS plus
// the widget's own context, and the widget API's own script checks.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { WIDGET_DTS, WIDGET_ICONS, contextDts, scriptProblems, type WidgetContext } from '../api/index.js'
import { compile } from '../frame/template.js'
import { API_LEVEL } from '../protocol.js'
import { FORMAT, validId, validVersion } from '../format.js'
import { checkTemplate } from './template.js'

// ---- A virtual-file TypeScript checker ----

const libDir = dirname(ts.getDefaultLibFilePath({}))
const base: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  allowJs: true,
  checkJs: true,
  noEmit: true,
  types: [],
  skipDefaultLibCheck: true,
  // The runtime runs a script inside a function, so its top-level names
  // are local: check it as a module so they don't clash with DOM globals.
  moduleDetection: ts.ModuleDetectionKind.Force,
}

// typeCheck compiles virtual files (path -> source) and returns their
// diagnostics as strings, as the editor checks a widget: checkJs, lib es2022 +
// dom + dom.iterable, each script its own module scope.
export function typeCheck(files: Record<string, string>, options: ts.CompilerOptions = {}): string[] {
  const opts = { ...base, ...options }
  const host = ts.createCompilerHost(opts)
  const read = host.readFile.bind(host)
  const exists = host.fileExists.bind(host)
  const getSF = host.getSourceFile.bind(host)
  host.getDefaultLibLocation = () => libDir
  host.readFile = (f) => (f in files ? files[f] : read(f))
  host.fileExists = (f) => f in files || exists(f)
  host.getSourceFile = (f, lang, ...rest) => (f in files ? ts.createSourceFile(f, files[f], lang, true) : getSF(f, lang, ...rest))
  host.writeFile = () => {}
  const program = ts.createProgram(Object.keys(files), opts, host)
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => !d.file || d.file.fileName in files)
    .map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
      if (!d.file) return `TS${d.code}: ${msg}`
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0)
      return `${d.file.fileName}:${line + 1}:${character + 1} TS${d.code}: ${msg}`
    })
}

// The virtual paths of the three files a widget script is checked with.
export const VIRTUAL_DTS = '/virtual/widget.d.ts'
export const VIRTUAL_CONTEXT = '/virtual/context.d.ts'
export const VIRTUAL_SCRIPT = '/virtual/widget.js'

// checkScript type-checks a widget script against the sl API; with a
// context, sl.fields and sl.data are narrowed to the widget's own.
export function checkScript(js: string, ctx?: WidgetContext): string[] {
  const files: Record<string, string> = { [VIRTUAL_DTS]: WIDGET_DTS, [VIRTUAL_SCRIPT]: js }
  if (ctx) files[VIRTUAL_CONTEXT] = contextDts(ctx)
  return typeCheck(files)
}

// problemsOf runs the widget API's own script checks (unknown sl.on events,
// undeclared sl.data keys) and returns them with their line.
export function problemsOf(js: string, ctx?: WidgetContext): { line: number; message: string }[] {
  const sf = ts.createSourceFile('w.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
  return scriptProblems(ts, sf, ctx).map((p) => ({ line: sf.getLineAndCharacterOfPosition(p.from).line + 1, message: p.message }))
}

// ---- Widget folders ----

export type Layout = 'csw' | 'app'

interface Manifest {
  name?: string
  icon?: string
  fields?: { key: string; label?: string; kind?: string; type?: string }[]
  data?: string[]
  sample?: Record<string, unknown>
  [key: string]: unknown
}

// layoutOf tells the two source layouts apart by the manifest's keys: a csw
// folder has `csw`, an app gallery folder has `format`.
export function layoutOf(man: Record<string, unknown>): Layout | undefined {
  if ('csw' in man) return 'csw'
  if ('format' in man) return 'app'
  return undefined
}

// isWidgetFolder tells whether dir holds a widget (a manifest.json).
export const isWidgetFolder = (dir: string) => existsSync(join(dir, 'manifest.json'))

// widgetFolders lists the widget folders an argument names: the folder itself
// when it is one, else its subfolders that are, sorted.
export function widgetFolders(arg: string): string[] {
  const dir = resolve(arg)
  if (isWidgetFolder(dir)) return [dir]
  return readdirSync(dir)
    .sort()
    .map((f) => join(dir, f))
    .filter((d) => statSync(d).isDirectory() && isWidgetFolder(d))
}

export interface FolderResult {
  name: string
  problems: string[]
}

// checkFolder runs every check on one widget folder. The problems are one
// line each; an empty list is a clean widget.
export function checkFolder(dir: string): FolderResult {
  const slug = basename(resolve(dir))
  const problems: string[] = []
  const bad = (msg: string) => problems.push(msg.replace(/\n\s*/g, ' | '))
  const text = (f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8') : undefined)
  let man: Manifest
  try {
    man = JSON.parse(text('manifest.json') ?? '') as Manifest
  } catch (e) {
    return { name: slug, problems: [`manifest.json: ${(e as Error).message}`] }
  }
  const layout = layoutOf(man)
  if (!layout) return { name: slug, problems: ['manifest.json has neither `csw` (a .csw source folder) nor `format` (an app gallery folder)'] }
  const name = layout === 'csw' && typeof man.id === 'string' ? man.id : slug

  if (layout === 'csw') {
    if (man.csw !== FORMAT) bad(`manifest csw is ${JSON.stringify(man.csw)}, this checker reads format ${FORMAT}`)
    if (typeof man.id !== 'string' || !validId(man.id)) bad(`id ${JSON.stringify(man.id)} is not a valid widget id`)
    else if (man.id !== slug) bad(`folder name "${slug}" is not the widget id "${man.id}"`)
    if (typeof man.version !== 'string' || !validVersion(man.version)) bad(`version ${JSON.stringify(man.version)} must be MAJOR.MINOR.PATCH`)
    if (!Number.isInteger(man.api) || (man.api as number) < 1 || (man.api as number) > API_LEVEL) bad(`api ${JSON.stringify(man.api)} must be 1 to ${API_LEVEL}`)
  } else if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug) || slug.length > 48) bad('folder name is not a valid slug')

  const html = text('widget.html')
  if (html === undefined) bad('widget.html is missing')
  if (!man.name) bad('manifest has no name')
  if (!man.icon) bad('manifest has no icon')
  else if (!WIDGET_ICONS.includes(man.icon)) bad(`icon "${man.icon}" is not a UI icon name (WIDGET_ICONS)`)

  const ctx: WidgetContext = {
    fields: (man.fields ?? []).map((f) => ({ key: f.key, label: f.label, type: f.kind ?? f.type })),
    data: (man.data ?? []).map((key) => ({ key, sample: man.sample?.[key] })),
  }
  if (html !== undefined) {
    try {
      compile(html)
    } catch (e) {
      bad(`widget.html: ${(e as Error).message}`)
    }
    for (const p of checkTemplate(html, ctx)) bad(`widget.html:${html.slice(0, p.from).split('\n').length} ${p.severity}: ${p.message}`)
  }
  const js = text('widget.js')
  if (js && js.trim()) {
    const diags = checkScript(js, ctx)
    if (diags.length) bad(`widget.js type errors:\n${diags.join('\n')}`)
    for (const p of problemsOf(js, ctx)) bad(`widget.js:${p.line} ${p.message}`)
  }
  return { name, problems }
}

// checkPaths checks every widget folder the arguments name (a widget folder,
// or a folder of them) and returns one result per folder.
export function checkPaths(args: string[]): FolderResult[] {
  return args.flatMap(widgetFolders).map(checkFolder)
}
