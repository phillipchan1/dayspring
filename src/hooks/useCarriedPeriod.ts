import { useCallback, useEffect, useState } from 'react'
import { carryPeriod, onCarriedPeriod, readCarriedPeriod, type Span } from '@/lib/period'

/**
 * The period carried between Remember surfaces. Read it on arrival, write it
 * when the reader picks one, and stay in sync while two surfaces are mounted at
 * once (the rail keeps the previous surface alive during a cross-fade).
 *
 * `fallback` is what this surface opens on before anything has been picked —
 * the Altar opens on the year, the Lamp on the year, the Ascent on whatever
 * altitude the reader left it at.
 */
export function useCarriedPeriod(fallback: Span = 'year'): [Span, (span: Span) => void] {
  const [span, setSpan] = useState<Span>(() => readCarriedPeriod(fallback))

  useEffect(() => onCarriedPeriod(setSpan), [])

  const pick = useCallback((next: Span) => {
    setSpan(next)
    carryPeriod(next)
  }, [])

  return [span, pick]
}
