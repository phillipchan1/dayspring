import { useMemo, useState } from 'react'
import { formatDate } from '../corpus'
import { Glyph } from '../Glyph'
import { consolations, daysBetween } from '../lib'

/**
 * Where He seemed far, and the last thing she called a gift.
 *
 * Ignatius tells the person in desolation to remember that the consolation was
 * real and will come again. It is an instruction addressed to precisely the one
 * person who cannot carry it out: from inside a dry season you cannot find
 * where the gifts were, and paging back through a year to look for them is the
 * reread both interviews refuse outright. A machine can do it instantly.
 *
 * This is the clearest case in the whole surface of digitising taking manual
 * work out of a practice that already existed. It invents nothing. She marked
 * the absence. She marked the gift. Code found the nearest earlier one, and the
 * app writes nothing in between — no "but", no "remember that", no heading.
 *
 * DELIBERATELY ONE-WAY. Rule 10 runs the other direction too, telling the
 * consoled to store up against the dark coming. We are not building that. A
 * director raising a shadow while you are glad and an app doing it are not the
 * same act, and only one of them knows you.
 *
 * Two of the five absences have no gift before them — January 2025 and June
 * 2024 both fall before she had marked a single one. The honest render is the
 * absence on its own, rather than reaching further for something to show, and
 * it is also the answer to what this does in a dry year: nothing, plainly.
 *
 * Falsified if it reads as a consolation prize. That is counsel, and counsel is
 * the thing this product does not do.
 */
export function ConsolationView({ onOpen }: { onOpen?: (id: string) => void }) {
  const all = useMemo(() => consolations().slice().reverse(), [])
  const [at, setAt] = useState(0)
  const pair = all[at % all.length]!
  const { absence, gift } = pair

  return (
    <div className="desk desk--still">
      <div className="cons">
        <button type="button" className="cons__row" onClick={() => onOpen?.(absence.entryId)}>
          <Glyph kind={absence.kind} size={26} />
          <p className="said">{absence.quote}</p>
          <span className="stamp">{formatDate(absence.date)}</span>
        </button>

        {gift ? (
          <>
            <span className="cons__rule" aria-hidden />
            <button type="button" className="cons__row cons__row--gift" onClick={() => onOpen?.(gift.entryId)}>
              <Glyph kind={gift.kind} size={26} />
              <p className="said">{gift.quote}</p>
              <span className="stamp">
                {formatDate(gift.date)} · {daysBetween(gift.date, absence.date)} days before
              </span>
            </button>
          </>
        ) : (
          /*
           * Nothing. Not an empty state, not an apology, not a wider search
           * until something turns up — she had not marked a gift yet, and the
           * page says so by being the absence and only the absence.
           */
          null
        )}

        <div className="cons__foot">
          <button type="button" className="one__quiet" onClick={() => setAt((v) => v + 1)}>
            another
          </button>
        </div>
      </div>
    </div>
  )
}
