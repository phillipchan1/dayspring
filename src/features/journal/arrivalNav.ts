// Pure arrival-navigation decision, unit-tested and shared by JournalScreen's
// hydrate (cold start) and applySyncedList (every background sync).
//
// The editor auto-opens the newest entry only when it is genuinely
// uninitialized: pointed at no entry (`wantedId === null`) with a blank body.
// The critical guard is `isNewEntry`: when the user has deliberately opened a
// fresh entry (tapped New), a background sync — focus / visibility / heartbeat /
// realtime — must NOT repoint the editor into an existing entry. If it did, the
// user's next keystrokes would land at the end of that entry and be saved as an
// edit to it — the "my new post got swallowed into an old entry" data-loss bug
// (a New entry and a same-day existing entry share the null-id + blank-body
// state, so blankness alone can't tell them apart — intent can).
export function shouldAutoOpenLatest(opts: {
  /** Entry the editor is currently pointed at (null = none / new). */
  wantedId: string | null
  /** The synced list has at least one entry to open. */
  hasEntries: boolean
  /** The editor body is empty. */
  editorBlank: boolean
  /** The user deliberately opened a new entry (handleNew). */
  isNewEntry: boolean
}): boolean {
  return opts.wantedId === null && opts.hasEntries && opts.editorBlank && !opts.isNewEntry
}
