/** True when the platform modifier (⌘ on macOS, Ctrl elsewhere) is held. */
export function hasMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

/** True when focus is in the writing editor (CodeMirror). */
export function isInEditor(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.cm-editor') != null
}

/** True when focus is in the entries sidebar list. */
export function isInEntryList(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('.entry-list') != null
}

/** True when focus is in the entry search field. */
export function isInEntrySearch(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[data-entry-search]') != null
}

export function focusEntrySearch(): void {
  const el = document.querySelector<HTMLInputElement>('[data-entry-search]')
  el?.focus()
  el?.select()
}

/**
 * Skip shortcuts while typing in form fields, except the CodeMirror surface
 * (contenteditable) where mod-key shortcuts should still apply.
 */
export function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.cm-editor')) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable && !target.closest('.cm-editor')) return true
  return false
}

/** True when the user is typing in any field, including the writing editor. */
export function isTypingContext(target: EventTarget | null): boolean {
  return shouldIgnoreTarget(target) || isInEditor(target)
}

/**
 * True when the editor has a live text selection. ⌘K is overloaded — it inserts
 * a link when text is selected, and opens Find/Ask otherwise — so the selection
 * is what disambiguates. CodeMirror renders a contenteditable, so the DOM
 * selection tracks its cursor.
 */
export function hasEditorSelection(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false
  const node = sel.anchorNode
  const el = node instanceof HTMLElement ? node : node?.parentElement
  return el?.closest('.cm-editor') != null
}
