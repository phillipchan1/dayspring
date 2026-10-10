/**
 * The Ascent, opened at the year — what shots 02 and 05 photograph, on the
 * phone and on iPad alike.
 *
 * The real `AscentView`, not a rearrangement of its parts: since `yearLedger`
 * graduated, the year is the climb drawn as a mountain and then "what the year
 * kept returning to", and the shot should be exactly that. The ledger reads the
 * synthetic year through the capture seam in `ascent/ledger/load.ts`, so no
 * account is ever touched.
 */

import { useEffect } from 'react'
import { AscentView } from '@/features/ascent/AscentView'
import '@/features/ascent/Ascent.css'
import { useAppNavigation } from '@/context/AppNavigation'

/** The provider boots at altitude 0 (the week); the shots want the year. */
export function AtTheYear({ children }: { children: React.ReactNode }) {
  const { go } = useAppNavigation()
  useEffect(() => {
    go({ ascentAltitude: 3 }, { replace: true })
  }, [go])
  return <>{children}</>
}

/**
 * Scroll the climb down to the year's first thread once it has been told.
 *
 * For iPad, where the card shows the whole shell and `cropTop` does not apply:
 * the canvas is its own scroller, so the only way to put the thread at the top
 * of the frame is to scroll it there, the way a person would.
 */
export function ToTheThreads({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let tries = 0
    const timer = window.setInterval(() => {
      // "What the year kept returning to" — the first module after the strip.
      const thread = document.querySelector('.year-story .climb__mod')
      const scroller = document.querySelector('.ascent-scroll')
      if (thread && scroller) {
        const top = thread.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        scroller.scrollTop += top - 72
        window.clearInterval(timer)
      } else if (++tries > 60) window.clearInterval(timer)
    }, 100)
    return () => window.clearInterval(timer)
  }, [])
  return <>{children}</>
}

export function YearClimb() {
  return (
    <AtTheYear>
      <AscentView />
    </AtTheYear>
  )
}
