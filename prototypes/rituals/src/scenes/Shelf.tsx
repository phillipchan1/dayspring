import { Masthead } from '../components/Masthead'
import { longDate, shelfOrder, totalAnswers } from '../data/model'
import { archiveFor, type Source } from '../lib/source'

/**
 * The door that does not exist today.
 *
 * You can open a ritual three ways in the live app — the topbar on a blank
 * page, the command bar, `/ritual` — and all three are doors INTO a practice
 * from inside the editor. There is no door back to one you have already walked.
 */
export function Shelf({
  source,
  onSource,
  onOpen,
}: {
  source: Source
  onSource: (s: Source) => void
  onOpen: (practice: string) => void
}) {
  const archive = archiveFor(source)
  const rows = shelfOrder(archive.threads).filter((t) => totalAnswers(t) > 0)

  return (
    <div className="shell">
      <Masthead label="Rituals" source={source} onSource={onSource} />

      <h1 className="title">Practices you have walked</h1>
      <p className="lede lede--dim">
        Ordered by when you last walked them. That is the only ordering, and there is
        deliberately nothing else on the row.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <strong>Nothing here yet.</strong>
          <br />
          This archive holds no answered ritual movements, so there is no shelf to show.
          The surface tells the truth about that rather than inventing a starter row.
        </div>
      ) : (
        <div className="shelf">
          {rows.map((t) => (
            <button
              key={t.practice}
              type="button"
              className="shelf__row"
              onClick={() => onOpen(t.practice)}
            >
              <span className="shelf__name">{t.practice}</span>
              <span className="shelf__when">{longDate(t.lastAt)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="shelf__note">
        No counts, no streaks, no gaps, no “you haven’t done this since June”. That
        constraint is not an aesthetic preference — MORNING_RITUALS_PLAN §5.3 wrote it
        down before anyone built this, because a row that reflects how often you practise
        is one design review away from a frequency, and a frequency here is a streak.
      </p>
    </div>
  )
}
