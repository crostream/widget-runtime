// morph.ts: updates a live DOM subtree to match freshly rendered HTML while
// keeping every node it can. A matched element gets its attributes synced in
// place, which is how the building blocks (custom elements) see changes
// without being rebuilt. An element with the sl-keep attribute keeps its
// children and the attributes the template doesn't set: the widget's script
// owns them.
//
// Matching, for each new child in order (cur = the next unmatched old one):
//   - sl-key elements match the old element with the same tag and key,
//     wherever it is (a list that gains an item at the top keeps its rows
//     and their animations); unmatched keyed old elements are removed.
//   - Unkeyed nodes match an old node of the same type and tag with the same
//     sl-keep-ness (a kept element only ever matches a kept element):
//       1. cur itself;
//       2. else, unless cur matches the next new node (the new node looks
//          inserted: it is created before cur), the first matching old node
//          further on; the unkeyed old nodes skipped over are removed (they
//          were dropped from the template, e.g. a conditional before them);
//       3. else the new node is created before cur.
//   So toggling {{#if}} content before an element keeps that element (and an
//   sl-keep element's script-owned children) instead of rebuilding it.

const KEY = 'sl-key'
const KEEP = 'sl-keep'

const keyOf = (n: Node) => (n instanceof Element && n.hasAttribute(KEY) ? `${n.tagName}#${n.getAttribute(KEY)}` : null)
const isKeep = (n: Node) => n instanceof Element && n.hasAttribute(KEEP)

const same = (a: Node, b: Node) =>
  a.nodeType === b.nodeType &&
  (!(a instanceof Element) || (a as Element).tagName === (b as Element).tagName) &&
  !keyOf(a) &&
  !keyOf(b) &&
  isKeep(a) === isKeep(b)

export function morphChildren(from: Node, to: Node): void {
  const keyed = new Map<string, Node>()
  for (let c = from.firstChild; c; c = c.nextSibling) {
    const k = keyOf(c)
    if (k && !keyed.has(k)) keyed.set(k, c)
  }
  const news = Array.from(to.childNodes)
  let cur: Node | null = from.firstChild
  for (let i = 0; i < news.length; i++) {
    const n = news[i]
    const k = keyOf(n)
    let match: Node | null = null
    if (k) {
      match = keyed.get(k) ?? null
      keyed.delete(k)
    } else if (cur) {
      if (same(cur, n)) match = cur
      else if (!(i + 1 < news.length && same(cur, news[i + 1]))) {
        for (let c = cur.nextSibling; c; c = c.nextSibling) {
          if (same(c, n)) {
            match = c
            break
          }
        }
        if (match) {
          // Drop the unkeyed old nodes skipped over; keyed ones stay for
          // their keys (or the final sweep).
          let first: Node | null = null
          for (let c: Node | null = cur; c && c !== match; ) {
            const next: Node | null = c.nextSibling
            if (keyOf(c)) first ??= c
            else from.removeChild(c)
            c = next
          }
          cur = first ?? match
        }
      }
    }
    if (!match) {
      from.insertBefore(n, cur)
      continue
    }
    if (match === cur) cur = cur.nextSibling
    else from.insertBefore(match, cur)
    morphNode(match, n)
  }
  while (cur) {
    const next = cur.nextSibling
    from.removeChild(cur)
    cur = next
  }
}

function morphNode(a: Node, b: Node): void {
  if (!(a instanceof Element)) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue
    return
  }
  const be = b as Element
  const keep = be.hasAttribute(KEEP)
  if (!keep) for (const attr of Array.from(a.attributes)) if (!be.hasAttribute(attr.name)) a.removeAttribute(attr.name)
  for (const attr of Array.from(be.attributes)) if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value)
  if (keep) return
  const from = a instanceof HTMLTemplateElement ? a.content : a
  const to = be instanceof HTMLTemplateElement ? be.content : be
  morphChildren(from, to)
}
