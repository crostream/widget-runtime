// The custom widget API as data, for the code editor's completions, hovers,
// lint and TypeScript checking: the `sl` runtime object, its events, the
// template language, the CSS hooks, snippets, and TypeScript declarations
// of it all. Everything here mirrors the runtime in src/widget-runtime
// (main.ts, template.ts, morph.ts, elements.svelte.ts) and the live data
// the Go side sends; nothing is invented. Checked by
// frontend/scripts/check-widget-api.mjs.

export type { ApiCssVar, ApiEvent, ApiMember, ApiParam, ApiSnippet, ApiTemplate, WidgetContext } from './types.js'
export { SL, EVENTS, flatMembers } from './sl.js'
export { TEMPLATE, TEMPLATE_ROOTS, TEMPLATE_PATH, ATTRS, ELEMENTS, CSS_VARS, CSS_HOOKS } from './markup.js'
export { SNIPPETS } from './snippets.js'
export { WIDGET_DTS, contextDts } from './dts.js'
export { scriptProblems, dataKeyKnown, unknownEventMessage, EVENT_NAMES, type ScriptProblem } from './checks.js'
export { DATA_FAMILIES, LATEST_TYPES, LEADER_METRICS, LEADER_PERIODS, FIELD_KINDS, SFX_NAMES, SL_EVENT_NAMES, WIDGET_ICONS, TYPE_VARS, USER_VARS, sampleVarsFor } from './catalog.js'
