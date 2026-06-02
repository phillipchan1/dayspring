/** Ghost result rows while scripture search is in flight. */
export function ScriptureLoadingSkeleton() {
  return (
    <div
      className="command-popover__loading"
      aria-live="polite"
      aria-busy="true"
      aria-label="Finding passages"
    >
      <p className="command-popover__loading-label">Finding passages…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="command-popover__loading-row" style={{ animationDelay: `${i * 0.12}s` }}>
          <span className="command-popover__loading-ref" />
          <span className="command-popover__loading-verse" />
          <span className="command-popover__loading-verse command-popover__loading-verse--short" />
        </div>
      ))}
    </div>
  )
}
