import { useCallback, useEffect, useRef, useState } from 'react'
import { asEntryMarkdown } from '@/lib/entryLabels'
import { addBreadcrumb } from '@/lib/crashReport'
import { createEntry, updateEntryBody } from '@/lib/repo'
import {
  decideSave,
  draftSession,
  observeText,
  persistedSession,
  savedSession,
  type SaveSession,
} from '@/lib/saveSession'
import type { Entry } from '@/lib/types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions {
  /** Persisted entry id, or null for a not-yet-saved new entry. */
  entryId: string | null
  /** Current editor content. */
  content: string
  /** Called once when a brand-new entry is first persisted (so the parent can adopt its id). */
  onCreated: (entry: Entry) => void
  /** Disable while no auth / not configured. */
  enabled: boolean
  /** Debounce window in ms. */
  delay?: number
  /** Called after a successful persist (create or update). */
  onAfterSave?: (content: string) => void
}

interface UseAutosaveResult {
  status: SaveStatus
  lastSavedAt: number | null
  error: string | null
  /** Force an immediate flush (e.g. before navigating away). */
  saveNow: () => Promise<void>
  /**
   * True when the editor holds text this session hasn't persisted yet. Sync uses
   * it to decide whether an entry open on screen may be refreshed from another
   * device: a clean editor can be, a dirty one must not be.
   */
  getIsDirty: () => boolean
  /**
   * Re-baseline after the caller has put text in the editor that came from
   * storage rather than the keyboard — a body loaded on open, or an update
   * pulled from another device. Without it that text reads as an unsaved local
   * edit: autosave pushes it straight back, and `getIsDirty` reports true for an
   * entry nobody has touched.
   *
   * `forEntryId` must be the row the text belongs to. It is checked against the
   * session's own id and ignored on mismatch, so this can never mark a draft
   * persisted against the wrong row — the failure mode behind the duplicate-entry
   * bugs this module exists to prevent.
   */
  adoptExternalText: (forEntryId: string | null, text: string) => void
  /**
   * Reset entry tracking so the next keystroke starts a fresh entry rather than
   * updating the one that was just saved. Call this after saveNow() whenever the
   * navigation entryId will stay null (handleNew while already on a blank entry),
   * because the [entryId] effect that normally resets the session only fires on
   * changes.
   */
  resetEntry: () => void
}

/**
 * Continuous autosave. Debounces edits, creates the entry on first non-empty
 * content, then updates it. Flushes synchronously-ish on tab hide / unload /
 * unmount so a keystroke is never lost. A single in-flight save at a time;
 * if edits land mid-save, a follow-up flush runs on completion.
 *
 * Identity and text are bound through a SaveSession (see lib/saveSession.ts):
 * a draft pre-allocates its row id (racing flushes converge on one row) and may
 * only CREATE if the editor was blank when the draft began — the invariant that
 * ended the recurring duplicate-entry bug. Do not reintroduce a bare
 * "id === null → create" path here.
 */
export function useAutosave({
  entryId,
  content,
  onCreated,
  enabled,
  delay = 600,
  onAfterSave,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mutable refs so the flush closure always sees the latest values.
  const contentRef = useRef(content)
  const sessionRef = useRef<SaveSession>(
    entryId === null ? draftSession(asEntryMarkdown(content)) : persistedSession(entryId, content),
  )
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCreatedRef = useRef(onCreated)
  const onAfterSaveRef = useRef(onAfterSave)
  const enabledRef = useRef(enabled)
  onCreatedRef.current = onCreated
  onAfterSaveRef.current = onAfterSave
  enabledRef.current = enabled

  const wasEnabledRef = useRef(enabled)

  // Adopt external id changes (switching entries, or the parent adopting the id
  // we just created) and reset the save baseline.
  useEffect(() => {
    if (entryId === sessionRef.current.id) return // adopting our own create — keep progress
    sessionRef.current =
      entryId === null
        ? draftSession(asEntryMarkdown(contentRef.current))
        : persistedSession(entryId, contentRef.current)
  }, [entryId])

  // After initial hydration, don't treat pre-load empty editor as unsaved edits.
  useEffect(() => {
    if (enabled && !wasEnabledRef.current && entryId !== sessionRef.current.id) {
      sessionRef.current =
        entryId === null
          ? draftSession(asEntryMarkdown(contentRef.current))
          : persistedSession(entryId, contentRef.current)
    }
    wasEnabledRef.current = enabled
  }, [enabled, entryId])

  contentRef.current = content
  // A draft that reaches a blank editor earns create rights (e.g. handleNew
  // clears the editor one render after resetting the session).
  sessionRef.current = observeText(sessionRef.current, asEntryMarkdown(content))

  const flush = useCallback(async () => {
    if (!enabled) return

    // Loop so edits that land mid-save get a follow-up persist. Every exit path
    // is a `return`/`break`: the terminal decisions ('none', 'blocked') are
    // checked here — so a no-op never leaves the `while` spinning the microtask
    // queue (a frozen tab).
    while (true) {
      const decision = decideSave(sessionRef.current, asEntryMarkdown(contentRef.current))
      if (decision.action === 'none') return
      if (decision.action === 'blocked') {
        // A never-persisted session holds text it didn't start from — creating
        // a row would duplicate the entry that text came from. Refuse loudly.
        addBreadcrumb('autosave', 'blocked create of inherited draft text')
        setStatus('error')
        setError('Not saved — reopen the entry from the list to keep editing it')
        return
      }

      const run = async () => {
        // Re-decide inside the serialized chain with the LIVE (session, text)
        // pair: an earlier queued run may have already created the row
        // (create → update), or a navigation may have replaced the session.
        const text = asEntryMarkdown(contentRef.current)
        const d = decideSave(sessionRef.current, text)
        if (d.action === 'none' || d.action === 'blocked') return
        setStatus('saving')
        setError(null)
        try {
          if (d.action === 'create') {
            // Guard against stale flush closures: when enabled changes, the
            // useEffect([flush]) cleanup fires the OLD closure (which captured
            // enabled=true). This ref check prevents creating phantom entries
            // after the user navigated away from the journal surface.
            if (!enabledRef.current) return
            const created = await createEntry({ body_markdown: text }, d.id)
            sessionRef.current = savedSession(sessionRef.current, text)
            onCreatedRef.current(created)
          } else {
            await updateEntryBody(d.id, text)
            sessionRef.current = savedSession(sessionRef.current, text)
          }
          onAfterSaveRef.current?.(text)
          setStatus('saved')
          setLastSavedAt(Date.now())
        } catch (e) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Save failed')
          throw e
        }
      }

      const chained = saveChainRef.current.then(run, run)
      saveChainRef.current = chained
      try {
        await chained
      } catch {
        break
      }
    }
  }, [enabled])

  // Debounced trigger on content change.
  useEffect(() => {
    if (!enabled) return
    if (content === sessionRef.current.savedText) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content, enabled, delay, flush])

  // Flush on tab hide / page unload.
  useEffect(() => {
    if (!enabled) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onBeforeUnload = () => {
      void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [enabled, flush])

  // Flush any pending edits on unmount.
  useEffect(() => {
    return () => {
      void flush()
    }
  }, [flush])

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await flush()
  }, [flush])

  const resetEntry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Content may still hold the just-saved entry until the parent clears it,
    // so this draft starts without create rights; the blank-editor render that
    // follows (observeText above) grants them.
    sessionRef.current = draftSession(asEntryMarkdown(contentRef.current))
  }, [])

  const getIsDirty = useCallback(
    () => asEntryMarkdown(contentRef.current) !== sessionRef.current.savedText,
    [],
  )

  const adoptExternalText = useCallback((forEntryId: string | null, text: string) => {
    // Only ever re-baseline the session that already owns this row. A mismatch
    // means navigation moved on; the [entryId] effect re-baselines correctly.
    if (forEntryId === null || sessionRef.current.id !== forEntryId) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // The text IS what storage holds, so it is this session's saved baseline.
    // `savedSession` also marks the session persisted, which is right: the row
    // exists — we just read it.
    sessionRef.current = savedSession(sessionRef.current, asEntryMarkdown(text))
  }, [])

  return { status, lastSavedAt, error, saveNow, resetEntry, getIsDirty, adoptExternalText }
}
