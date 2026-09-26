/**
 * The glyph on every desktop Back — the reader's "All entries" and the
 * editor's "Pages". One drawing, so the two Backs you press in a row look like
 * one control rather than two lookalikes.
 */
export function BackChevron() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
      <path
        d="M10 3 5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
