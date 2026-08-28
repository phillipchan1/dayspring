import { useState } from 'react'
import { Dawn, formatDay, Movement, Rig } from '../parts'
import { read, spanById } from '../span'

/**
 * The page this becomes — and the movement that decides whether any of this
 * was worth building.
 *
 * ── The whole argument in one line ──────────────────────────────────────────
 *
 * Phil: "the whole intent is not to be an oracle but to funnel and fuel prayer
 * towards God and further reflection." Intent does not survive contact with a
 * surface. STRUCTURE does. So the structural version of that sentence is:
 *
 *   THE LAST THING ON THE PAGE IS A BLANK PAGE.
 *
 * A report that ends in a conclusion has told her what her season was. A
 * report that ends in the editor has handed her back her own material and got
 * out of the way. It is the same move the Altar makes and the Ascent does not.
 *
 * It also closes a loop the product has never had. SURFACES splits Write and
 * Return and the arrow only ever points one way: you write, and later you
 * return. Nothing has ever pointed back. This does, and it is the only
 * Return-to-Write path in the app.
 *
 * ── What may be in the new entry, and what may not ──────────────────────────
 *
 * Pages.css rule 1: nothing on a page except the writer's words, their date,
 * and their markings. So the seed is HER OWN LINE, verbatim, as a blockquote,
 * with the date it came from — and then the cursor.
 *
 * Not a prompt. Not a question we wrote. Not "reflect on…". The instant the
 * app types a sentence into her journal it has co-authored her prayer life,
 * and there is no undo for that. `a prompt` shows the version that does, so
 * the difference is visible rather than asserted.
 *
 * ── Principle 3 ─────────────────────────────────────────────────────────────
 *
 * Nothing here touches the editor's render or input path. This is a new entry
 * opened with a blockquote already in the document — the same as pasting.
 * There is no chrome, no panel, no companion, no live suggestion. RECALL Act
 * four's constraint holds: it lands beneath the writing, never as editor
 * furniture.
 */
const SEEDS = [
  { id: 'hers', label: 'her line' },
  { id: 'prompt', label: 'a prompt we wrote' },
  { id: 'blank', label: 'nothing at all' },
] as const

type SeedId = (typeof SEEDS)[number]['id']

export function OnwardScene() {
  const reading = read(spanById('spring-2026'))
  const [seed, setSeed] = useState<SeedId>('hers')

  /*
   * The line carried forward is the one she asked most recently — arithmetic,
   * not selection. "The most important question" would be a verdict; "the last
   * one" is a date.
   */
  const last = reading.questions[reading.questions.length - 1]

  return (
    <div className="surface">
      <Dawn />

      <Rig label="what is in the new page">
        {SEEDS.map((s) => (
          <button key={s.id} type="button" data-on={seed === s.id ? 'true' : undefined} onClick={() => setSeed(s.id)}>
            {s.label}
          </button>
        ))}
      </Rig>

      <article className="sheet sheet--narrow">
        <Movement
          title="take this into a page"
          gloss="The last act on the page is writing. Everything above it was material for this."
        >
          <div className="onward__row">
            <button type="button" className="onward__act">
              Take this into a page
            </button>
            <button type="button" className="onward__act onward__act--quiet">
              Keep it as paper
            </button>
          </div>

          {/* The editor, as it opens. Dark, because this is the app again. */}
          <div className="draft">
            <div className="draft__date">{formatDay('2026-09-04')}</div>

            {seed === 'hers' ? (
              <>
                <p className="draft__quote">{last.text}</p>
                <p className="draft__src">{formatDay(last.date)}</p>
              </>
            ) : null}

            {seed === 'prompt' ? (
              <>
                {/*
                 * The version to reject. It reads well, which is the danger.
                 * It is H4 (prescribing how to pray), it is a sentence about
                 * her that traces to no row (P4), and it is now the first
                 * thing in her own journal that she did not write.
                 */}
                <p className="draft__quote" style={{ borderColor: '#a06a6a', color: '#c49a9a', fontStyle: 'italic' }}>
                  This summer you kept returning to your mother, and to staying. Where might God be inviting you
                  to be still?
                </p>
                <p className="draft__src" style={{ color: '#a06a6a' }}>
                  written by the app · H4, and the first line in her journal that is not hers
                </p>
              </>
            ) : null}

            <span className="draft__caret" />
          </div>

          <p className="floor" style={{ marginBlockStart: 20 }}>
            {seed === 'hers'
              ? 'Her own question, verbatim, with the date it came from. Then the cursor.'
              : null}
            {seed === 'prompt'
              ? 'Fluent, warm, and the moment the app co-authored her prayer life. There is no undo for this.'
              : null}
            {seed === 'blank'
              ? 'A blank page, dated. The safest version, and the one that throws away the only thing the report was for — she has to remember what she just read.'
              : null}
          </p>
        </Movement>
      </article>
    </div>
  )
}
