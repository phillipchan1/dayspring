import { useMemo } from 'react'
import { SHELF, type Practice } from '@/editor/practices/practicesData'
import { skyFor } from '@/editor/practices/ritualSky'
import './RitualShelf.css'

/** The practice the Bible door opens: a passage and a page, no framework. */
export const BIBLE_DOOR_PRACTICE = 'Open Reading'

interface Props {
  /** Begin this practice on this page. */
  onPick: (practice: Practice) => void
  /** Open your Bible: the passage finder, straight away. */
  onBible?: () => void
  /** Where the last scripture ritual left off — "John 16" — and the way on to it. */
  resume?: { label: string; practice: string; onGo: () => void } | null
  /** Open the whole library. */
  onAll: () => void
  /** Only while the page is blank — it fades at the first keystroke. */
  visible: boolean
  /** Pinned clock, for previews. */
  now?: Date
}

/** How many names the shelf holds — a glimpse of the library, not a menu. */
const SHELF_SIZE = 3

/**
 * The shelf — the door into the rituals, at the foot of a blank page.
 *
 * One entry, one ritual: a ritual is a shape for the whole page, chosen before
 * there is a page. So the door lives exactly where a page is blank, and
 * nowhere else. The page itself stays empty — nothing sits where you write —
 * and three practices for the hour wait at its foot with the way into the
 * rest. The first keystroke lets them go; clearing the page brings them back.
 *
 * Picked by the clock alone, from each practice's own rhythm (`ritualSky.ts`):
 * never by anything about the writer, and never with a count, a streak or a
 * "you usually…". Anything not tied to an hour (The Round is weekly) is left
 * to the library.
 */
export function RitualShelf({ onPick, onBible, resume = null, onAll, visible, now }: Props) {
  const withBible = Boolean(onBible)
  const picks = useMemo(() => {
    const { filter } = skyFor(now ?? new Date())
    return SHELF.filter(
      (p) => !p.dynamic && p.rhythm.includes(filter) && !(withBible && p.name === BIBLE_DOOR_PRACTICE),
    ).slice(0, SHELF_SIZE)
  }, [now, withBible])

  return (
    <nav
      className="ritual-shelf"
      data-visible={visible ? 'true' : undefined}
      aria-label="Begin with a ritual"
      aria-hidden={!visible}
    >
      <span className="ritual-shelf__lead">Or begin with a ritual</span>
      {/* The one door that never rotates with the hour. Reading Scripture is
          how most people who journal as Christians already begin, and a
          passage is chosen more often than a method — so the passage comes
          first, and the method is picked beside it on the facing leaf. */}
      {onBible && (
        <span className="ritual-shelf__bible">
          <button
            type="button"
            className="ritual-shelf__pick ritual-shelf__open"
            tabIndex={visible ? 0 : -1}
            onClick={onBible}
          >
            Open your Bible
          </button>
          {resume && (
            <>
              <span className="ritual-shelf__dot" aria-hidden>
                ·
              </span>
              <button
                type="button"
                className="ritual-shelf__pick ritual-shelf__resume"
                tabIndex={visible ? 0 : -1}
                aria-label={`Go on to ${resume.label}, with ${resume.practice}`}
                title={`Go on to ${resume.label} · ${resume.practice}`}
                onClick={resume.onGo}
              >
                {resume.label}
              </button>
            </>
          )}
        </span>
      )}
      {picks.map((p) => (
        <button
          key={p.name}
          type="button"
          className="ritual-shelf__pick"
          tabIndex={visible ? 0 : -1}
          onClick={() => onPick(p)}
        >
          {p.name}
        </button>
      ))}
      <button
        type="button"
        className="ritual-shelf__all"
        tabIndex={visible ? 0 : -1}
        onClick={onAll}
      >
        All rituals →
      </button>
    </nav>
  )
}
