/** True when the platform modifier (⌘ on macOS, Ctrl elsewhere) is held. */
export function hasMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

/**
 * Skip shortcuts while typing in form fields, except the CodeMirror surface
 * (contenteditable) where app shortcuts should still apply.
 */
export function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('.cm-editor')) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable && !target.closest('.cm-editor')) return true
  return false
}

export function focusEntrySearch(): void {
  const el = document.querySelector<HTMLInputElement>('[data-entry-search]')
  el?.focus()
  el?.select()
}
