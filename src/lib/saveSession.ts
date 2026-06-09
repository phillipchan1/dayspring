// Pure save-session state machine for autosave (used by useAutosave).
//
// History: the app shipped four separate "duplicate entry" fixes, each patching
// one navigation path that left the screen in a torn state — entryId nulled
// while `content` still held an existing entry's body — from which an autosave
// flush would CREATE a brand-new row with that body (an exact duplicate).
// This module ends the class of bug by making the torn state unsaveable:
//
//  1. A draft (never-persisted session) may only CREATE a row if the editor
//     has been observed BLANK since the session began. Inherited text from a
//     navigation tear can therefore never be re-minted as a new row — the save
//     is refused (`blocked`) instead.
//  2. A draft carries its row id from birth: every create for one session
//     targets the SAME id, so racing flushes (debounce + visibilitychange +
//     unmount, stale closures, etc.) upsert one row instead of inserting two.
//
// Keep this module pure (no React, no IO) — it is the unit-tested heart of
// the duplicate-entry guarantee.

export interface SaveSession {
  /** Row id this session writes to (pre-allocated for drafts). */
  readonly id: string
  /** False until the row exists — the next save creates it. */
  readonly persisted: boolean
  /** Last text successfully persisted by this session ('' for a fresh draft). */
  readonly savedText: string
  /** Drafts only: proven to have started from (or reached) a blank editor. */
  readonly createAllowed: boolean
}

export type SaveDecision =
  | { action: 'none' }
  | { action: 'create'; id: string }
  | { action: 'update'; id: string }
  /** Refused: a never-persisted session holds text it didn't start from —
   *  creating a row from it would duplicate an existing entry. */
  | { action: 'blocked' }

function isBlank(text: string): boolean {
  return text.trim() === ''
}

/** Session for an existing entry; `currentText` is its already-loaded body. */
export function persistedSession(id: string, currentText: string): SaveSession {
  return { id, persisted: true, savedText: currentText, createAllowed: true }
}

/**
 * Fresh draft. Earns create rights only if the editor is blank at this moment;
 * `observeText` upgrades it later the instant the editor becomes blank. A torn
 * navigation state (null id + leftover body) starts non-blank and stays
 * blocked until the stale text is cleared.
 */
export function draftSession(currentText: string, id: string = crypto.randomUUID()): SaveSession {
  return { id, persisted: false, savedText: '', createAllowed: isBlank(currentText) }
}

/** Track editor text between saves: a draft that reaches blank earns create rights. */
export function observeText(session: SaveSession, text: string): SaveSession {
  if (session.persisted || session.createAllowed || !isBlank(text)) return session
  return { ...session, createAllowed: true }
}

export function decideSave(session: SaveSession, text: string): SaveDecision {
  if (text === session.savedText) return { action: 'none' }
  if (session.persisted) return { action: 'update', id: session.id }
  if (isBlank(text)) return { action: 'none' } // never create empty rows
  if (!session.createAllowed) return { action: 'blocked' }
  return { action: 'create', id: session.id }
}

/** Advance after a successful create or update persisted `text`. */
export function savedSession(session: SaveSession, text: string): SaveSession {
  return { id: session.id, persisted: true, savedText: text, createAllowed: true }
}
