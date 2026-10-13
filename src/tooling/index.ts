// tooling: what an editor needs to check a widget's template as it is typed:
// the {{…}} scanner and checker (template.ts), and the runtime's own
// compiler for the structural errors. Free of Node and Svelte; the checks
// that run a whole widget folder through TypeScript are in ./check (Node).
export { scan, checkTemplate, scopeAt, pathsOf, tagAt, dataDeclared, closest, BUILTIN_ROOTS, AT_NAMES, type Tag, type Problem } from './template.js'
export { compile as compileTemplate, TemplateError } from '../frame/template.js'
