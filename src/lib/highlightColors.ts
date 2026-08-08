/**
 * The highlighter palette — one source of truth shared by the editor decoration,
 * the swatch pickers, the markdown parser's colour allowlist, and the print
 * stylesheet (which gets no theme variables and so needs the raw hues).
 *
 * `amber` is the default and serialises with NO colour spec: `==text==`. The
 * others carry one: `=={rose}text==`. That keeps the common case free of any
 * leakage when an entry is read in another markdown app, and it keeps the
 * colour token inside the opening marker — which is what lets the editor
 * conceal it with no special case (see concealMarkers.ts).
 */
export type HighlightColor = 'amber' | 'rose' | 'sage' | 'sky' | 'lilac'

/** Picker order. Amber leads because it is what a bare `==` means. */
export const HIGHLIGHT_ORDER: HighlightColor[] = ['amber', 'rose', 'sage', 'sky', 'lilac']

/** The named colours — i.e. every colour that serialises a `{spec}`. */
export const NAMED_HIGHLIGHT_COLORS = HIGHLIGHT_ORDER.filter((c) => c !== 'amber')

/**
 * `r, g, b` triples so alpha can vary per theme via `rgba(var(--hl-x), var(--hl-alpha))`.
 * Mirrored as `--hl-*` custom properties in styles/themes.css — keep the two in
 * step; CSS can't import TypeScript.
 */
export const HIGHLIGHT_HUES: Record<HighlightColor, string> = {
  // Dayspring's own amber (#c4913c) — see the note in themes.css for why this
  // rather than a brighter highlighter yellow.
  amber: '196, 145, 60',
  rose: '214, 100, 122',
  sage: '108, 160, 110',
  sky: '86, 148, 208',
  lilac: '155, 132, 224',
}

/** Human labels for tooltips and aria-labels. */
export const HIGHLIGHT_LABELS: Record<HighlightColor, string> = {
  amber: 'Amber',
  rose: 'Rose',
  sage: 'Sage',
  sky: 'Sky',
  lilac: 'Lilac',
}

/** `rose|sage|sky|lilac` — the literal alternation used by every parser here. */
export const NAMED_COLOR_PATTERN = NAMED_HIGHLIGHT_COLORS.join('|')

export function isHighlightColor(value: string): value is HighlightColor {
  return (HIGHLIGHT_ORDER as string[]).includes(value)
}
