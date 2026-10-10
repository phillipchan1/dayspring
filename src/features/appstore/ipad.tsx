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

import { AscentView } from '@/features/ascent/AscentView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { PracticeLibrary } from '@/editor/practices/PracticeLibrary'
import { AtTheYear, ToTheThreads } from './climb'
import { editorSlot, journalProps } from './devices'
import { MOCK_DOC_FULL, SCREENSHOT_HOUR } from './mock'
import { ScriptureRitual } from './scriptureRitual'
import { LockShot } from './lockShot'
import type { Shot } from './shots'
import { PagesShot } from './surfaces'

/**
 * The app viewport inside the iPad, in CSS points. Comfortably past the 767px
 * breakpoint for the three-column shell; as tall as a 13" screen less its status
 * bar, near enough — the frame's foot cuts the device off well before it ends.
 */
export const IPAD_VIEWPORT = { width: 1024, height: 1300 }

const noop = () => {}

export function renderIpadShot(shot: Shot) {
  switch (shot.surface) {
    case 'ascent':
      return (
        <AtTheYear>
          <DesktopJournal {...journalProps(<AscentView />, { reflectionsActive: true })} />
        </AtTheYear>
      )

    case 'prayer':
      // On iPad the year already shows its first thread under the strip, so 05
      // goes further down it: the thread beside its lines, then the next one.
      return (
        <AtTheYear>
          <ToTheThreads>
            <DesktopJournal {...journalProps(<AscentView />, { reflectionsActive: true })} />
          </ToTheThreads>
        </AtTheYear>
      )

    case 'lock':
      // The lock stands in front of the journal on iPad as everywhere: alone.
      return <LockShot />

    case 'scripture':
      // The composer is full-screen over the shell, as it is when a ritual is
      // walked; on a tablet held wide the passage sits beside the writing.
      return (
        <>
          <DesktopJournal {...journalProps(editorSlot())} />
          <ScriptureRitual />
        </>
      )

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
          {/* Pinned to dawn, like the iPhone set — the sky follows the clock,
              so an unpinned capture changes with the hour it ran at. */}
          <PracticeLibrary
            onBegin={noop}
            onClose={noop}
            skipPreview={false}
            onToggleSkipPreview={noop}
            now={SCREENSHOT_HOUR}
          />
        </>
      )

    // The archive in the shell: the wall of pages beside the decade it spans.
    case 'history':
      return <DesktopJournal {...journalProps(<PagesShot />, { pagesActive: true })} />

    case 'capture':
    default:
      return <DesktopJournal {...journalProps(editorSlot(MOCK_DOC_FULL), {}, MOCK_DOC_FULL)} />
  }
}
