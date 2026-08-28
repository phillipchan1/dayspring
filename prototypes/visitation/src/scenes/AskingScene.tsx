import { useState } from 'react'
import { unverifiedQuestions, QUESTIONS } from '../questions'
import { Dawn, Evidence, Movement, Rig } from '../parts'
import { read, spanById } from '../span'
import { Asking } from './Arrives'

/**
 * Where the question comes from — the argument this whole surface rests on.
 *
 * Three sources, at the same fidelity, so the difference is seen rather than
 * asserted:
 *
 *   hers        — her own questions, grouped by her own word
 *   the reading — a question from the tradition, verbatim and cited
 *   ours        — a question the model wrote, which is the forbidden one
 *
 * `ours` is the important screen. It is the version every product in this
 * category ships, it reads beautifully, and it is illegal — and unlike the
 * mood line, whose illegality is visible the moment you see the axis, this
 * one looks exactly like the legal version. That is what makes it worth a
 * screen of its own.
 */
const SOURCES = [
  { id: 'hers', label: 'hers' },
  { id: 'reading', label: 'from the reading' },
  { id: 'ours', label: 'one we wrote' },
] as const

type SourceId = (typeof SOURCES)[number]['id']

export function AskingScene() {
  const reading = read(spanById('year-2026'))
  const [source, setSource] = useState<SourceId>('reading')
  const [open, setOpen] = useState<{ id: string; word?: string } | null>(null)

  return (
    <div className="surface">
      <Dawn />

      <Rig label="where the question comes from">
        {SOURCES.map((s) => (
          <button key={s.id} type="button" data-on={source === s.id ? 'true' : undefined} onClick={() => setSource(s.id)}>
            {s.label}
          </button>
        ))}
      </Rig>

      <article className="sheet">
        {source === 'hers' ? <Hers reading={reading} onOpen={(id) => setOpen({ id })} /> : null}
        {source === 'reading' ? (
          <>
            <Asking reading={reading} onOpen={(id, word) => setOpen({ id, word })} />
            <p className="passage__unverified" style={{ marginBlockStart: 36 }}>
              {unverifiedQuestions()} of {QUESTIONS.length} questions in this fixture are unchecked against a
              printed source. Not one line here would ship.
            </p>
          </>
        ) : null}
        {source === 'ours' ? <Ours /> : null}
      </article>

      {open ? <Evidence id={open.id} word={open.word} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * Her questions alone, ungrouped and uncompanioned.
 *
 * Worth putting on screen because it might be the whole feature. It costs no
 * corpus, no lexicon, no rights budget and no doctrine change — every line is
 * something she typed, gathered by a rule a person could run by hand.
 *
 * The bet the rest of the surface makes is that this is not enough: that a
 * question you asked in May, handed back to you in August, is worth more with
 * something beside it than alone. **If a reader says this screen is already
 * the good part, the council does not get built**, and that is a genuinely
 * cheap and very good outcome.
 */
function Hers({ reading, onOpen }: { reading: ReturnType<typeof read>; onOpen: (id: string) => void }) {
  return (
    <Movement
      title="what you asked"
      gloss="Every line in these pages that ends in a question mark. No grouping, nothing beside them, in the order you asked them."
    >
      <div className="lines">
        {reading.questions.map((q, i) => (
          <button key={i} type="button" className="line" onClick={() => onOpen(q.entryId)}>
            <span className="line__date">
              {new Date(q.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
            <span className="line__text">{q.text}</span>
          </button>
        ))}
      </div>
    </Movement>
  )
}

/**
 * The question we may not write, written, with its assumptions marked.
 *
 * ── Why a question is the most dangerous form ───────────────────────────────
 *
 * A statement can be checked. A question smuggles its claims in as
 * PRESUPPOSITIONS — the things you must already have conceded for the question
 * to be answerable at all — and a reader accepts them without noticing,
 * because they arrive as grammar rather than as content.
 *
 * "Where might God be inviting you to be still?" cannot be answered by someone
 * who does not first accept that God is inviting, that stillness is the thing,
 * and that she is not yet doing it. Three assertions about a person's
 * relationship with God, none of them traceable to a row, all of them
 * delivered inside nine warm words.
 *
 * That is H1 (the divine voice, by implication), H4 (prescription), and
 * Principle 4 (no row) simultaneously — and it would sail through any review
 * that was checking for tone.
 *
 * ── And it is indistinguishable by looking ──────────────────────────────────
 *
 * The mood line announces itself: you see an axis and you know. This does not.
 * Set it beside Abba Lot's question in the same typeface and a reader cannot
 * tell which one came out of a book. THE ONLY DEFENCE IS PROVENANCE, which is
 * why every quoted question on this surface carries a citation, an edition,
 * and the person it was originally asked of.
 */
function Ours() {
  return (
    <Movement title="what you are still asking">
      <div className="forbidden">
        <p className="passage__text" style={{ marginBlockEnd: 0 }}>
          Where might <span className="assumed">God be inviting you</span> to{' '}
          <span className="assumed">be still</span>?
        </p>

        <ul className="assumes">
          <li>
            <b>that God is inviting</b> — H1. The app has attributed intent to God. She may draw that conclusion;
            it is not ours to hand her.
          </li>
          <li>
            <b>that stillness is what her season was about</b> — D-016. The app named the theme. She marked eleven
            things this year and none of them said “stillness”.
          </li>
          <li>
            <b>that she is not being still yet</b> — H4, and H2 underneath it. A prescription and a read on her
            interior state, in the word “might”.
          </li>
        </ul>

        <p className="floor" style={{ marginBlockStart: 20, color: '#7d5d5d' }}>
          None of the three can be traced to a row. All three arrive as grammar rather than as content, which is
          why a question smuggles a verdict better than a sentence does — you cannot answer it without first
          conceding them.
        </p>

        <p className="floor" style={{ marginBlockStart: 14, color: '#7d5d5d' }}>
          And unlike the mood line, this is <b>invisible by inspection</b>. Set it beside Abba Lot in the same
          typeface and nobody can tell which came out of a book. The only defence is provenance — which is why
          every question on the real page carries a citation, an edition, and the person it was asked of.
        </p>
      </div>
    </Movement>
  )
}
