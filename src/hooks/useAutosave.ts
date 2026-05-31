import { useCallback, useEffect, useRef, useState } from 'react'
import { createEntry, updateEntryBody } from '@/lib/repo'
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
}

interface UseAutosaveResult {
  status: SaveStatus
  lastSavedAt: number | null
  error: string | null
  /** Force an immediate flush (e.g. before navigating away). */
  saveNow: () => Promise<void>
}

/**
 * Continuous autosave. Debounces edits, creates the entry on first non-empty
 * content, then updates it. Flushes synchronously-ish on tab hide / unload /
 * unmount so a keystroke is never lost. A single in-flight save at a time;
 * if edits land mid-save, a follow-up flush runs on completion.
 */
export function useAutosave({
  entryId,
  content,
  onCreated,
  enabled,
  delay = 600,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mutable refs so the flush closure always sees the latest values.
  const idRef = useRef<string | null>(entryId)
  const contentRef = useRef(content)
  const savedContentRef = useRef(content) // last successfully persisted text
  const savingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCreatedRef = useRef(onCreated)
  onCreatedRef.current = onCreated

  // Adopt external id changes (e.g. switching entries).
  useEffect(() => {
    idRef.current = entryId
  }, [entryId])

  contentRef.current = content

  const flush = useCallback(async () => {
    if (!enabled) return
    if (savingRef.current) return
    const text = contentRef.current
    if (text === savedContentRef.current) return // nothing new
    // Don't create empty rows; but DO persist clearing an existing entry.
    if (idRef.current === null && text.trim() === '') return

    savingRef.current = true
    setStatus('saving')
    setError(null)
    try {
      if (idRef.current === null) {
        const created = await createEntry({ body_markdown: text })
        idRef.current = created.id
        savedContentRef.current = text
        onCreatedRef.current(created)
      } else {
        await updateEntryBody(idRef.current, text)
        savedContentRef.current = text
      }
      setStatus('saved')
      setLastSavedAt(Date.now())
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      savingRef.current = false
      // Edits arrived during the save — flush again.
      if (contentRef.current !== savedContentRef.current) {
        void flush()
      }
    }
  }, [enabled])

  // Debounced trigger on content change.
  useEffect(() => {
    if (!enabled) return
    if (content === savedContentRef.current) return
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

  return { status, lastSavedAt, error, saveNow }
}
