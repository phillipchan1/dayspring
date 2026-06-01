interface Props {
  onClick: () => void
}

/** Sticky new-entry control — bottom-right, above focus-mode pills on desktop. */
export function FabNew({ onClick }: Props) {
  return (
    <button
      type="button"
      className="fab-new"
      onClick={onClick}
      aria-label="New entry"
      title="New entry (⌘N)"
    >
      +
    </button>
  )
}
