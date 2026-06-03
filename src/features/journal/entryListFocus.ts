import { ENTRY_LIST_ROW_HEIGHT_PX } from './useVirtualRange'

/** Scroll the entries list so flat list index `index` is visible. */
export function scrollEntryIndexIntoView(
  listEl: HTMLElement,
  index: number,
  virtual: boolean,
): void {
  if (index < 0 || !virtual) return
  const rowTop = index * ENTRY_LIST_ROW_HEIGHT_PX
  const rowBottom = rowTop + ENTRY_LIST_ROW_HEIGHT_PX
  const { scrollTop, clientHeight } = listEl
  if (rowTop < scrollTop) listEl.scrollTop = rowTop
  else if (rowBottom > scrollTop + clientHeight) listEl.scrollTop = rowBottom - clientHeight
}

export function focusEntryRow(listEl: HTMLElement, entryId: string): boolean {
  const btn = listEl.querySelector<HTMLButtonElement>(
    `[data-entry-row][data-entry-id="${CSS.escape(entryId)}"]`,
  )
  if (!btn) return false
  btn.focus()
  btn.scrollIntoView({ block: 'nearest' })
  return true
}

/** Focus a row in the first visible entry list (opens nowhere — caller reveals the panel). */
export function focusEntryListRow(entryId: string | null): boolean {
  const listEl = document.querySelector<HTMLElement>('.entry-list')
  if (!listEl) return false
  const id =
    entryId ??
    listEl.querySelector<HTMLElement>('[data-entry-row]')?.getAttribute('data-entry-id')
  if (!id) return false
  return focusEntryRow(listEl, id)
}

/** The entry row that currently has keyboard focus within `listEl`. */
export function focusedEntryIdInList(listEl: HTMLElement): string | null {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !listEl.contains(active)) return null
  const row = active.closest('[data-entry-row]')
  return row?.getAttribute('data-entry-id') ?? null
}
