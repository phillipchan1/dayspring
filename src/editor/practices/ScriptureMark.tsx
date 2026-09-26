/**
 * The open book that marks a ritual built on a passage — on its library card,
 * its filter chip, its preview and its About sheet. One glyph, drawn in the
 * current colour, so each surface decides how loud it is.
 */
export function ScriptureMark() {
  return (
    <svg
      className="scripture-mark"
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
      <path d="M22 4.5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
