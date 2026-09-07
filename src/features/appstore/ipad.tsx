/**
 * THE IPAD SET.
 *
 * The build declares `TARGETED_DEVICE_FAMILY = "1,2"`, so App Store Connect
 * requires iPad screenshots before it will accept a submission.
 *
 * These are shaped differently from the iPhone shots on purpose. There, a whole
 * screen is unreadable at gallery-thumbnail size, so each frame is one component
 * with the chrome stripped. On iPad the chrome *is* the story: `useIsMobile()` is
 * `(max-width: 767px)` and the boundary is deliberately 767 rather than 768 so
 * that iPad portrait gets the three-column shell — rail, entries, canvas — which
 * is the fullest version of the app. So an iPad shot shows the real shell with
 * the surface live in the canvas.
 */

import { useEffect } from 'react'
import { AscentView } from '@/features/ascent/AscentView'
import { AltarView } from '@/features/altar/AltarView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { PracticeLibrary } from '@/editor/practices/PracticeLibrary'
import { useAppNavigation } from '@/context/AppNavigation'
import { editorSlot, journalProps } from './devices'
import type { Shot } from './shots'

/**
 * The app viewport inside an iPad card, in CSS points. Comfortably past the
 * 767px breakpoint, and close enough to the card's rendered size that the scale
 * factor stays near 1 and type holds its crispness.
 */
export const IPAD_VIEWPORT = { width: 1024, height: 1100 }

const noop = () => {}

/** Drives AscentView to the Summit — the provider forces altitude 0 on boot. */
function Seed({ children }: { children: React.ReactNode }) {
  const { go } = useAppNavigation()
  useEffect(() => {
    go({ ascentAltitude: 3 }, { replace: true })
  }, [go])
  return <>{children}</>
}

export function renderIpadShot(shot: Shot) {
  switch (shot.surface) {
    case 'ascent':
      return (
        <Seed>
          <DesktopJournal
            {...journalProps(<AscentView />, { reflectionsActive: true })}
          />
        </Seed>
      )

    case 'altar':
      return <DesktopJournal {...journalProps(<AltarView onOpenEntry={noop} />, { altarActive: true })} />

    case 'lamp':
      return (
        <DesktopJournal
          {...journalProps(<ScriptureView onOpenEntry={noop} />, { scriptureActive: true })}
        />
      )

    case 'rituals':
      // The library portals full-screen over the shell, exactly as it does in
      // the app when you reach for /ritual.
      return (
        <>
          <DesktopJournal {...journalProps(editorSlot())} />
          <PracticeLibrary
            onBegin={noop}
            onClose={noop}
            skipPreview={false}
            onToggleSkipPreview={noop}
          />
        </>
      )

    // `capture` and `history` are both the writing shell. On iPad the entries
    // panel is already open beside the canvas, so the year list — shot 06's
    // whole claim — is on screen without needing its own arrangement.
    case 'capture':
    case 'history':
    default:
      return <DesktopJournal {...journalProps(editorSlot())} />
  }
}
