// format.ts: the .csw widget package and the gallery index as TypeScript
// types, with the identity rules the Go side enforces. Mirrors
// github.com/crostream/csw (csw.go, codec.go, index.go, prop.go, alert.go):
// keep the two in step; the regexes below are the same expressions.
//
// A .csw file is one JSON document (CSW_MEDIA_TYPE): a manifest, the
// widget's code and its assets, the assets' bytes base64-encoded.
// Types only, apart from the constants and the id/version/path checks.

/** The .csw format version (Go: csw.Format). */
export const FORMAT = 1
/** The gallery index format version (Go: csw.IndexFormat). */
export const INDEX_FORMAT = 1

export const CSW_MEDIA_TYPE = 'application/vnd.crostream.widget+json'
export const CSW_EXTENSION = '.csw'

// Limits (Go: the Max* constants).
export const MAX_FILE_BYTES = 12 << 20
export const MAX_ASSETS = 64
export const MAX_ASSET_BYTES = 2 << 20
export const MAX_ASSETS_BYTES = 8 << 20
export const MAX_ASSET_PATH = 128
export const MAX_ID_LENGTH = 64

/** IDs in this namespace belong to CroStream's own widgets. */
export const OFFICIAL_NAMESPACE = 'crostream.'

// The same expressions as Go's idRE, semverRE, categoryRE and assetPathRE.
export const ID_RE = /^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/
export const VERSION_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/
export const CATEGORY_RE = /^[a-z][a-z0-9-]*$/
export const ASSET_PATH_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/

/** A widget id: lowercase dotted words, at most MAX_ID_LENGTH characters. */
export const validId = (s: string): boolean => s.length <= MAX_ID_LENGTH && ID_RE.test(s)

/** A version: MAJOR.MINOR.PATCH, no prerelease, no leading zeros. */
export const validVersion = (s: string): boolean => s.length <= 32 && VERSION_RE.test(s)

/** An asset's path inside the package (also what sl.asset takes). */
export const validAssetPath = (s: string): boolean => s.length <= MAX_ASSET_PATH && ASSET_PATH_RE.test(s) && !s.includes('..')

/** The asset media types and their file extensions (Go: csw.AssetTypes). */
export const ASSET_TYPES: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'image/gif': ['.gif'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'audio/ogg': ['.ogg'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'font/woff2': ['.woff2'],
}

export type CswPropKind = 'text' | 'textarea' | 'number' | 'bool' | 'color' | 'enum' | 'media' | 'font' | 'effects' | 'frame' | 'items' | 'folder'

export interface CswChoice {
  value: string
  label: string
}

/** One field of a widget (Go: csw.Prop). */
export interface CswField {
  key: string
  label: string
  help?: string
  kind: CswPropKind
  section?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: CswChoice[]
  /** media: 'image' | 'video' | 'audio' */
  accept?: string[]
  maxLen?: number
  optional?: boolean
  /** items: the keys of each object */
  item?: CswField[]
}

/** The widget's alert declaration (Go: csw.WidgetAlert). */
export interface CswAlert {
  /** Event types it shows, or ['*']. */
  events: string[]
  /** Sample variables by event type, for previews. */
  samples?: Record<string, Record<string, string>>
  /** A Go duration, such as "6s". */
  hold?: string
  /** The key of a media field that accepts audio. */
  sound?: string
}

/** One asset of a package (Go: csw.Asset); data is base64. */
export interface CswAsset {
  type: string
  data: string
}

export interface CswAuthor {
  name: string
  url?: string
}

export interface CswCode {
  html: string
  css: string
  js?: string
}

/** A decoded .csw file (Go: csw.Package). */
export interface CswPackage {
  csw: number
  id: string
  version: string
  /** The platform API level the widget needs: 1 base, 2 sl.alert/leave/sfx, 3 sl.asset. */
  api: number
  name: string
  description: string
  author: CswAuthor
  /** An SPDX identifier or "proprietary". */
  license: string
  category: string
  tags: string[]
  /** A UI icon name (WIDGET_ICONS in ./api). */
  icon: string
  size: { w: number; h: number }
  keepAspect: boolean
  fields: CswField[]
  defaults: Record<string, unknown>
  /** Live data keys or prefixes ("chat", "counter.*") the widget reads. */
  data: string[]
  /** Preview data by data key. */
  sample: Record<string, unknown>
  alert?: CswAlert
  code: CswCode
  assets?: Record<string, CswAsset>
}

/** The gallery index (index.json, Go: csw.Index). */
export interface CswIndex {
  v: number
  /** RFC 3339, UTC */
  generated: string
  /** Sorted by id. */
  widgets: CswIndexWidget[]
}

export interface CswIndexAlert {
  events: string[]
}

export interface CswIndexVersion {
  version: string
  /** Relative to the index: w/<id>/<version>.csw */
  url: string
  sha256: string
  bytes: number
  /** RFC 3339, UTC */
  published: string
  api: number
}

export interface CswIndexWidget {
  id: string
  name: string
  description: string
  author: string
  category: string
  tags: string[]
  icon: string
  size: { w: number; h: number }
  /** The API level of the latest version. */
  api: number
  /** The highest version. */
  latest: string
  /** Newest first. */
  versions: CswIndexVersion[]
  featured: boolean
  /** null unless the widget shows alerts. */
  alert: CswIndexAlert | null
}
