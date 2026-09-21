import { useMemo } from 'react'
import { SHELF, type Practice } from '@/editor/practices/practicesData'
import { skyFor } from '@/editor/practices/ritualSky'
import './RitualShelf.css'

interface Props {
  /** Begin this practice on this page. */
  onPick: (practice: Practice) => void
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
export function RitualShelf({ onPick, onAll, visible, now }: Props) {
  const picks = useMemo(() => {
    const { filter } = skyFor(now ?? new Date())
    return SHELF.filter((p) => !p.dynamic && p.rhythm.includes(filter)).slice(0, SHELF_SIZE)
  }, [now])

  return (
    <nav
      className="ritual-shelf"
      data-visible={visible ? 'true' : undefined}
      aria-label="Begin with a ritual"
      aria-hidden={!visible}
    >
      <span className="ritual-shelf__lead">Or begin with a ritual</span>
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
