import { useMemo, useState } from 'react'
import { formatDate } from '../corpus'
import { Glyph } from '../Glyph'
import { comesToPick, daysBetween, TODAY } from '../lib'

/**
 * The same line, served a second time.
 *
 * The Spiritual Exercises do not advance to new material each session. The
 * second and third contemplations REPEAT the first, and the retreatant is told
 * to dwell on the points where they were most moved. Guigo's lectio is the same
 * instinct — ruminatio, chewing one line until it gives. Both traditions assume
 * you will meet the same sentence again on purpose.
 *
 * Nothing else in this prototype does that. `#comesto` computes a fresh
 * selection every time she arrives, which is software's instinct and the
 * opposite of the practice. So this scene takes what `#comesto` would have
 * chosen six weeks ago and hands it back unchanged.
 *
 * The line is DERIVED, not authored: `comesToPick` is `#comesto`'s own rule
 * written down, run at the day `#comesto` shows. It returns the same line, so
 * this is the app's actual earlier behaviour and not a story about it — which
 * is also why the two scenes must be walked back to back. A repeat only lands
 * on someone who has just seen the thing being repeated.
 *
 * Inverted against `#comesto` on purpose. There, the new entry is on top and
 * the old line sits under it: something arriving. Here the old line is on top
 * and the day it arrived is underneath: something returning.
 *
 * Falsified if "I have seen this" arrives as a complaint rather than as
 * recognition. That one sentence settles whether the tradition's central
 * practice survives contact with what people expect software to do.
 */
/** The day `#comesto` is set on. Same day, same rule, same line. */
const SHOWN = '2026-07-14'

export function AgainView({ onOpen }: { onOpen?: (id: string) => void }) {
  /*
   * Whether the app ADMITS it is repeating itself is the live argument, so it
   * is a control rather than a decision. Silent is the shape `#comesto`
   * already commits to — a hairline and their own sentence, nothing said.
   */
  const [owned, setOwned] = useState(false)
  const pick = useMemo(() => comesToPick(SHOWN), [])

  if (!pick) return <div className="desk" />

  const { marking, back } = pick

  return (
    <div className="desk desk--still">
      <div className="again">
        <div className="again__pair">
          {/* The line the app put in front of her. Unchanged, same size, again. */}
          <button type="button" className="again__row" onClick={() => onOpen?.(back.entryId)}>
            <Glyph kind={back.kind} hue={back.hue} size={24} />
            <p className="said">{back.quote}</p>
            <span className="stamp">{formatDate(back.date)}</span>
          </button>

          <span className="again__rule" aria-hidden />

          {/* And the day she was writing when it first came. Why, not what. */}
          <button
            type="button"
            className="again__row again__row--then"
            onClick={() => onOpen?.(marking.entryId)}
          >
            <Glyph kind={marking.kind} hue={marking.hue} size={20} />
            <p className="said">{marking.quote}</p>
            <span className="stamp">{formatDate(marking.date)}</span>
          </button>
        </div>

        {/*
          Two dates and no sentence. "Shown" is the plainest available word for
          what the app did, and it is a fact about the app rather than a claim
          about her — which is the only kind of sentence this page may carry.
        */}
        {owned ? (
          <p className="again__note">
            shown {formatDate(SHOWN)} · {daysBetween(SHOWN, TODAY)} days ago
          </p>
        ) : null}

        <div className="again__axis">
          <span>the app</span>
          <button type="button" data-on={!owned ? 'true' : undefined} onClick={() => setOwned(false)}>
            says nothing
          </button>
          <button type="button" data-on={owned ? 'true' : undefined} onClick={() => setOwned(true)}>
            says when
          </button>
        </div>
      </div>
    </div>
  )
}
