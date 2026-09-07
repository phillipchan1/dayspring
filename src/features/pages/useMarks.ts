// Marks — the passages the writer set apart.
//
// This is what survived `useRemember` when the Remember surface was deleted.
// The half that read the whole corpus out of IndexedDB to derive passages went
// with the surface that needed it; marks stay, because two things still draw
// them: the editor's decoration, and the Pages wall (where "Marked" is a filter
// and a marked line glows inside its page).
//
// Deliberately cheap. It loads a small store and never touches the corpus, so
// it can run at boot without putting a multi-thousand-row read on the path to
// the editor — which Principle 3 doesn't allow.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMark, listMarks, pullMarks, removeMark, type Mark } from '@/lib/marks'

export interface UseMarks {
  /** Every mark, newest first. */
  marks: Mark[]
  /** Marks on one entry, for the editor decoration. */
  marksFor: (entryId: string) => Mark[]
  toggleMark: (entryId: string, quote: string, charStart: number, existing: Mark | null) => void
}

export function useMarks(): UseMarks {
  const [marks, setMarks] = useState<Mark[]>([])

  const reload = useCallback(async () => {
    setMarks(await listMarks())
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      // Local first so the editor can draw immediately; the network pull only
      // refines what is already on screen.
      const local = await listMarks()
      if (alive) setMarks(local)
      await pullMarks().catch(() => {})
      if (alive) await reload()
    })()
    return () => {
      alive = false
    }
  }, [reload])

  const byEntry = useMemo(() => {
    const m = new Map<string, Mark[]>()
    for (const mark of marks) {
      const list = m.get(mark.entryId)
      if (list) list.push(mark)
      else m.set(mark.entryId, [mark])
    }
    return m
  }, [marks])

  const marksFor = useCallback((entryId: string) => byEntry.get(entryId) ?? [], [byEntry])

  const toggleMark = useCallback(
    (entryId: string, quote: string, charStart: number, existing: Mark | null) => {
      void (async () => {
        if (existing) await removeMark(existing.id)
        else await addMark(entryId, quote, charStart)
        await reload()
      })()
    },
    [reload],
  )

  return { marks, marksFor, toggleMark }
}
