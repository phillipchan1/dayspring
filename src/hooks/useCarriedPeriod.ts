import { useCallback, useEffect, useState } from 'react'
import { carryPeriod, onCarriedPeriod, readCarriedOffset, readCarriedPeriod, type Span } from '@/lib/period'

/**
 * The period carried between Remember surfaces. Read it on arrival, write it
 * when the reader picks one, and stay in sync while two surfaces are mounted at
 * once (the rail keeps the previous surface alive during a cross-fade).
 *
 * `fallback` is what this surface opens on before anything has been picked —
 * the Altar opens on the year, the Lamp on the year, the Ascent on whatever
 * altitude the reader left it at.
 *
 * Returns the span and how far back the reader has stepped through it (the
 * When's ‹ ›). Picking a span returns to its current period; the offset is
 * carried for the session only (see `readCarriedOffset`).
 */
export function useCarriedPeriod(
  fallback: Span = 'year',
): [Span, (span: Span) => void, number, (offset: number) => void] {
  const [span, setSpan] = useState<Span>(() => readCarriedPeriod(fallback))
  const [offset, setOffset] = useState<number>(() => readCarriedOffset())

  useEffect(
    () =>
      onCarriedPeriod((nextSpan, nextOffset) => {
        setSpan(nextSpan)
        setOffset(nextOffset)
      }),
    [],
  )

  const pick = useCallback((next: Span) => {
    setSpan(next)
    setOffset(0)
    carryPeriod(next, 0)
  }, [])

  const step = useCallback(
    (next: number) => {
      const clamped = span === 'all' ? 0 : Math.max(0, Math.floor(next))
      setOffset(clamped)
      carryPeriod(span, clamped)
    },
    [span],
  )

  return [span, pick, span === 'all' ? 0 : offset, step]
}
