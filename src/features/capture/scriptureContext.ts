const MIN_ENTRY_CHARS = 20

/** Text near the slash position to seed scripture search (paragraph or full doc). */
export function scriptureSearchContext(doc: string, insertAt: number): string {
  const trimmed = doc.trim()
  if (trimmed.length >= MIN_ENTRY_CHARS) return trimmed

  const clamped = Math.max(0, Math.min(insertAt, doc.length))
  const before = doc.slice(0, clamped)
  const paraBreak = before.lastIndexOf('\n\n')
  const lineBreak = before.lastIndexOf('\n')
  const start = paraBreak >= 0 ? paraBreak + 2 : lineBreak >= 0 ? lineBreak + 1 : 0
  const after = doc.slice(clamped)
  const endPara = after.indexOf('\n\n')
  const endLine = after.indexOf('\n')
  const end =
    endPara >= 0
      ? clamped + endPara
      : endLine >= 0
        ? clamped + endLine
        : doc.length

  const slice = doc.slice(start, end).trim()
  if (slice.length >= MIN_ENTRY_CHARS) return slice

  const paras = trimmed.split(/\n{2,}/).filter(Boolean)
  const last = paras[paras.length - 1]?.trim() ?? ''
  if (last.length >= MIN_ENTRY_CHARS) return last

  return trimmed
}

export function hasScriptureSearchContext(doc: string, insertAt: number): boolean {
  return scriptureSearchContext(doc, insertAt).length >= MIN_ENTRY_CHARS
}
