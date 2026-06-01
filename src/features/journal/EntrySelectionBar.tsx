interface Props {
  count: number
  onCopyText: () => void
  onCopyMarkdown: () => void
  onExportZip: () => void
  onDelete: () => void
  onClear: () => void
}

/** Shown when two or more entries are selected in the sidebar. */
export function EntrySelectionBar({
  count,
  onCopyText,
  onCopyMarkdown,
  onExportZip,
  onDelete,
  onClear,
}: Props) {
  return (
    <div className="entry-list__selection" role="toolbar" aria-label="Selected entries">
      <span className="entry-list__selection-count">
        {count} selected
      </span>
      <div className="entry-list__selection-actions">
        <button type="button" className="entry-list__selection-btn" onClick={onCopyText}>
          Copy text
        </button>
        <button type="button" className="entry-list__selection-btn" onClick={onCopyMarkdown}>
          Copy Markdown
        </button>
        <button type="button" className="entry-list__selection-btn" onClick={onExportZip}>
          Export .zip
        </button>
        <button type="button" className="entry-list__selection-btn entry-list__selection-btn--danger" onClick={onDelete}>
          Delete…
        </button>
        <button type="button" className="entry-list__selection-btn entry-list__selection-btn--ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  )
}
