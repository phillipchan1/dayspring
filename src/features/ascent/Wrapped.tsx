import { useMemo, useState } from 'react'
import { WRAPPED_COPY, YEAR_MONTHS } from './ascent.config'
import type { SummitData } from './summitData'

interface Props {
  data: SummitData
  onOpenEntry?: ((entryId: string) => void) | undefined
}

interface ReviewCard {
  kind: string
  header: string
  big: string
  sub?: string
  entryId?: string
}

/**
 * "Your Year, Unfolding" — a Spotify-Wrapped-style retrospective that GESTATES
 * rather than gates. While forming it shows "forming N%", peeks at what's already
 * assembled, and marks the throughline as arriving in December. When the year is
 * whole it becomes a paged, animated review — built only from the user's own
 * words and marks. Never an AI verdict on their spiritual state.
 */
export function Wrapped({ data, onOpenEntry }: Props) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const pct = Math.round((Math.min(data.monthsDone, YEAR_MONTHS) / YEAR_MONTHS) * 100)

  const cards = useMemo<ReviewCard[]>(() => {
    const out: ReviewCard[] = []
    if (data.verse) out.push({ kind: 'verse', header: WRAPPED_COPY.cards.versePeek, big: data.verse })
    out.push({
      kind: 'prayers',
      header: WRAPPED_COPY.cards.prayersPeek,
      big: String(data.prayersMet),
    })
    if (data.seasonWroteMost)
      out.push({ kind: 'season', header: WRAPPED_COPY.cards.seasonPeek, big: data.seasonWroteMost })
    if (data.refrain)
      out.push({
        kind: 'refrain',
        header: WRAPPED_COPY.cards.refrain,
        big: `“${data.refrain.text}”`,
        sub: String(data.year),
        entryId: data.refrain.entryId,
      })
    return out
  }, [data])

  if (open && cards.length > 0) {
    const card = cards[Math.min(page, cards.length - 1)]!
    const last = page >= cards.length - 1
    return (
      <div className="ascent-review" role="dialog" aria-label="Your year, unfolding">
        <div className="ascent-review__card" key={card.kind}>
          <span className="ascent-review__header">{card.header}</span>
          {card.entryId ? (
            <button
              type="button"
              className="ascent-review__big as-link"
              onClick={() => onOpenEntry?.(card.entryId!)}
            >
              {card.big}
            </button>
          ) : (
            <span className="ascent-review__big">{card.big}</span>
          )}
          {card.sub ? <span className="ascent-review__sub">{card.sub}</span> : null}
        </div>
        <div className="ascent-review__dots" aria-hidden>
          {cards.map((c, i) => (
            <span key={c.kind} className={`ascent-review__dot${i === page ? ' on' : ''}`} />
          ))}
        </div>
        <div className="ascent-review__nav">
          <button
            type="button"
            className="ascent-link dim"
            onClick={() => (page === 0 ? setOpen(false) : setPage((p) => p - 1))}
          >
            {page === 0 ? WRAPPED_COPY.done : WRAPPED_COPY.prev}
          </button>
          <button
            type="button"
            className="ascent-link"
            onClick={() => (last ? setOpen(false) : setPage((p) => p + 1))}
          >
            {last ? WRAPPED_COPY.done : WRAPPED_COPY.next}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ascent-wrapped">
      <span className="ascent-wrapped__kicker">
        {data.complete ? WRAPPED_COPY.kickerComplete : WRAPPED_COPY.kickerForming(pct)}
      </span>

      <div className="ascent-wrapped__peeks">
        {data.verse ? (
          <span className="ascent-wrapped__peek">
            <em>{data.verse}</em>
            {WRAPPED_COPY.versePeek}
          </span>
        ) : null}
        <span className="ascent-wrapped__peek">
          <em>{data.prayersMet}</em>
          {WRAPPED_COPY.prayersPeek}
        </span>
        {data.seasonWroteMost ? (
          <span className="ascent-wrapped__peek">
            <em>{data.seasonWroteMost}</em>
            {WRAPPED_COPY.seasonPeek}
          </span>
        ) : null}
      </div>

      {!data.complete ? (
        <div className="ascent-wrapped__throughline">
          <span className="ascent-wrapped__tl-label">{WRAPPED_COPY.throughlineLabel}</span>
          <span className="ascent-wrapped__tl-pending">{WRAPPED_COPY.arrivesInDecember}</span>
        </div>
      ) : null}

      <p className="ascent-wrapped__teaser">
        {data.complete ? WRAPPED_COPY.teaserComplete : WRAPPED_COPY.teaserForming}
      </p>

      {data.complete && cards.length > 0 ? (
        <button
          type="button"
          className="ascent-wrapped__open"
          onClick={() => {
            setPage(0)
            setOpen(true)
          }}
        >
          {WRAPPED_COPY.open}
        </button>
      ) : null}
    </div>
  )
}
