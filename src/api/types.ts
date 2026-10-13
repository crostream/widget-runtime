// types.ts: the shapes of the widget API model (see index.ts).

export interface ApiParam {
  name: string
  type: string
  doc: string
  optional?: boolean
}

export interface ApiMember {
  name: string // e.g. 'on'
  path: string // e.g. 'sl.on'
  kind: 'function' | 'property' | 'object' | 'event' | 'constant'
  signature: string // e.g. "sl.on(event: WidgetEvent, handler: (payload) => void): () => void"
  doc: string // markdown, 1–4 sentences
  params?: ApiParam[]
  returns?: string
  example?: string // a short working snippet
  children?: ApiMember[]
}

export interface ApiEvent {
  name: string
  doc: string
  payload: string
  example?: string
}

export interface ApiTemplate {
  syntax: string
  doc: string
  example: string
}

export interface ApiCssVar {
  name: string
  doc: string
  example?: string
}

export interface ApiSnippet {
  label: string
  lang: 'html' | 'css' | 'js'
  detail: string
  body: string // CodeMirror snippet syntax: ${1:name}, ${0}; literal braces after $ are written $\{ \}
}

// WidgetContext is the widget being edited, supplied by the editor host.
export interface WidgetContext {
  fields: { key: string; label?: string; type?: string; doc?: string }[]
  data: { key: string; doc?: string; sample?: unknown }[]
}
