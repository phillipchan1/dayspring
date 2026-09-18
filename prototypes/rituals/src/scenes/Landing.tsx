import { useMemo } from 'react'
import { Masthead } from '../components/Masthead'
import { buildLanding } from '../data/landing'
import { byNewest, longDate, shelfOrder, totalAnswers } from '../data/model'
import { archiveFor, type Source } from '../lib/source'

/**
 * The landing — what you meet when you arrive, not knowing what you came for.
 *
 * The first version of this surface led with PRACTICES, and that was wrong. A
 * list of practices is a filing cabinet: it is about your habits, and it makes
 * you click twice before you reach a single word you wrote. The unit of value
 * here is the QUESTION — "what is today actually for?", answered eighteen
 * times, is a better door than "The Morning Offering".
 *
 * So the page opens with writing, not navigation.
 *
 * ── Depth without counting ──────────────────────────────────────────────────
 * A card needs to say "there is more here" or nobody clicks. The obvious way is
 * a number, and the number is exactly the thing Principle 2 forbids once it is
 * attached to a devotional practice. So depth is shown by showing a SECOND
 * answer, dimmer, underneath the first. More writing, rather than a count of
 * writing — which is also the more persuasive of the two.
 */
export function Landing({
  source,
  onSource,
  onOpenQuestion,
  onOpenPractice,
  onAllPractices,
}: {
  source: Source
  onSource: (s: Source) => void
  onOpenQuestion: (practice: string, label: string) => void
  onOpenPractice: (practice: string) => void
  onAllPractices: () => void
}) {
  const archive = archiveFor(source)
  const landing = useMemo(() => buildLanding(archive.threads), [archive])
  const shelf = useMemo(
    () => shelfOrder(archive.threads).filter((t) => totalAnswers(t) > 0),
    [archive],
  )

  return (
    <div className="shell">
      <Masthead label="Rituals" source={source} onSource={onSource} />

      <h1 className="title">Rituals</h1>

      {landing.line ? <p className="landing__line">{landing.line}</p> : null}

      {shelf.length === 0 ? (
        <div className="empty">
          <strong>Nothing to read back yet.</strong>
          <br />
          Once you have walked a ritual, your answers to each movement gather here.
        </div>
      ) : null}

      {/* The hero and the ones under it are the same component at two sizes —
          the first carries two answers, the rest carry one. */}
      {landing.lead.map((m, i) => {
        const practice = landing.leadPractice[i]!
        // Sort before slicing. The extractor writes answers in the order the
        // entries came back — ASCENDING — so slicing straight off the front
        // showed a card's OLDEST answers while implying its newest. The
        // invented fixture happens to be stored newest-first, which hid it
        // completely until the real archive was switched on.
        const shown = [...m.answers].sort(byNewest).slice(0, i === 0 ? 2 : 1)
        return (
          <button
            key={`${practice}-${m.label}`}
            type="button"
            className={`qcard${i === 0 ? ' qcard--hero' : ''}`}
            onClick={() => onOpenQuestion(practice, m.label)}
          >
            <span className="qcard__eyebrow">
              {practice} · {m.label}
            </span>
            <span className="qcard__q">{m.question || m.label}</span>
            {shown.map((a, n) => (
              <span
                key={a.entryId}
                className={`qcard__answer${n > 0 ? ' qcard__answer--under' : ''}`}
              >
                <span className="qcard__date">{longDate(a.at)}</span>
                {a.text}
              </span>
            ))}
            <span className="qcard__more">Read all →</span>
          </button>
        )
      })}

      {shelf.length > 0 ? (
        <section className="landing__practices">
          <h2 className="landing__h2">Practices</h2>
          <div className="shelf">
            {shelf.map((t) => (
              <button
                key={t.practice}
                type="button"
                className="shelf__row"
                onClick={() => onOpenPractice(t.practice)}
              >
                <span className="shelf__name">{t.practice}</span>
                {/* Last walked, and nothing else. No count, no gap. */}
                <span className="shelf__when">{longDate(t.lastAt)}</span>
              </button>
            ))}
          </div>
          <button type="button" className="landing__all" onClick={onAllPractices}>
            Every question you have answered →
          </button>
        </section>
      ) : null}

      <p className="caution">
        <strong>What is deliberately not on this page.</strong> No count of walks, no
        cadence, no gap, no “you haven’t done this since June”. Lamp is the precedent and
        Lamp is strict about it: every number it shows is about the material — which book,
        which verse, how often that verse appeared in your writing — and none is about how
        often you showed up. A practice is harder than a book, because a practice is a
        thing you do, so its frequency is one step from a streak.
      </p>
    </div>
  )
}
