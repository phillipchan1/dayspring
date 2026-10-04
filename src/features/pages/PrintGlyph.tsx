/**
 * A photo's mark in the app's own controls: a print, drawn as a print.
 *
 * Not a camera. A camera is a stock glyph for a device; this is the same small
 * print the list draws in its margin for a page that carries a photo (D-034),
 * so the pill that finds those pages and the pages it finds wear one shape.
 */
export function PrintGlyph({ className }: { className?: string }) {
  return <span className={`pg-print-glyph${className ? ` ${className}` : ''}`} aria-hidden />
}
