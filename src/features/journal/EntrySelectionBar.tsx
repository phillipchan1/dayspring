interface Props {
  count: number
  onCopyText: () => void
  onCopyMarkdown: () => void
  onExportZip: () => void
  onDelete: () => void
  onClear: () => void
  /**
   * Compact strip in the sidebar · centered panel in the main canvas ·
   * a bar floating over the Pages wall, where there is room for the count and
   * the actions to sit on one line.
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
