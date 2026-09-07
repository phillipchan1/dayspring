interface Props {
  count: number
  onCopyText: () => void
  onCopyMarkdown: () => void
  onExportZip: () => void
  onDelete: () => void
  onClear: () => void
  /**
   * A bar floating over the Pages wall (`wall`), or a centered panel in the
   * main canvas (`canvas`). `compact` is the narrow-strip variant the entries
   * sidebar used; kept because the geometry may be wanted again.
   */
  layout?: 'compact' | 'canvas' | 'wall'
}

export function EntrySelectionBar({
  count,
  onCopyText,
  onCopyMarkdown,
  onExportZip,
  onDelete,
  onClear,
  layout = 'compact',
}: Props) {
  return (
    <div
      className={`entry-selection-bar entry-selection-bar--${layout}`}
      role="toolbar"
      aria-label="Selected entries"
    >
      {layout !== 'canvas' && (
        <span className="entry-selection-bar__count">{count} selected</span>
      )}
      <div className="entry-selection-bar__actions">
        <button type="button" className="entry-selection-bar__btn" onClick={onCopyText}>
          Copy text
        </button>
        <button type="button" className="entry-selection-bar__btn" onClick={onCopyMarkdown}>
          Copy Markdown
        </button>
        <button type="button" className="entry-selection-bar__btn" onClick={onExportZip}>
          Export .zip
        </button>
        <button type="button" className="entry-selection-bar__btn entry-selection-bar__btn--danger" onClick={onDelete}>
          Delete…
        </button>
        <button type="button" className="entry-selection-bar__btn entry-selection-bar__btn--ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  )
}
