import { EntrySelectionBar } from './EntrySelectionBar'

interface Props {
  count: number
  onCopyText: () => void
  onCopyMarkdown: () => void
  onExportZip: () => void
  onDelete: () => void
  onClear: () => void
}

/** Main canvas when two or more entries are selected in the sidebar. */
export function EntryBulkCanvas({
  count,
  onCopyText,
  onCopyMarkdown,
  onExportZip,
  onDelete,
  onClear,
}: Props) {
  return (
    <div className="entry-bulk-canvas">
      <p className="entry-bulk-canvas__eyebrow">Multiple selected</p>
      <h2 className="entry-bulk-canvas__title">
        {count} {count === 1 ? 'entry' : 'entries'}
      </h2>
      <p className="entry-bulk-canvas__hint">
        Press Esc to clear, or arrow without Shift to preview a single entry.
      </p>
      <EntrySelectionBar
        layout="canvas"
        count={count}
        onCopyText={onCopyText}
        onCopyMarkdown={onCopyMarkdown}
        onExportZip={onExportZip}
        onDelete={onDelete}
        onClear={onClear}
      />
    </div>
  )
}
