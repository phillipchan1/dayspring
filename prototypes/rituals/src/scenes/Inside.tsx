import { useState } from 'react'
import { Masthead } from '../components/Masthead'
import { byNewest, longDate } from '../data/model'
import { archiveFor, type Source } from '../lib/source'

/**
 * The riskier version — the return offered INSIDE the composer, on the movement
 * you are standing in.
 *
 * It is the strongest form of the idea, because the thread arrives at the
 * moment it is relevant rather than in a separate surface you have to remember
 * to visit. It is also the one that could quietly wreck the practice, and the
 * prototype says so on the screen rather than selling it.
 *
 * Three constraints if it is ever built, all visible here:
 *   1. CLOSED by default. It is a door, not a panel. Principle 3.
 *   2. It never appears until the movement already has words in it, so nobody
 *      writes their first answer while reading last month's.
 *   3. It is per-movement, never the whole practice — otherwise it is a
 *      transcript and the composer stops being a composer.
 */
export function Inside({
  source,
  onSource,
  onBack,
}: {
  source: Source
  onSource: (s: Source) => void
  onBack: () => void
}) {
  const archive = archiveFor(source)
  const [open, setOpen] = useState(false)

  // Same choice OneQuestion makes, for the same reason: a drawer holding four
  // brain dumps is unreadable, and unreadable is not a fair test of the idea.
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const best = archive.threads
    .flatMap((t) => t.movements.map((m) => ({ t, m })))
    .filter((x) => x.m.answers.length > 1)
    .sort(
      (a, b) =>
        b.m.answers.length - a.m.answers.length ||
        mean(a.m.answers.map((x) => x.text.length)) - mean(b.m.answers.map((x) => x.text.length)),
    )[0]
  const thread = best?.t
  const movement = best?.m
  const past = movement ? [...movement.answers].sort(byNewest).slice(0, 4) : []

  return (
    <div className="shell">
      <Masthead label="Back" source={source} onSource={onSource} onBack={onBack} />

      <h1 className="title">The same return, while you are writing</h1>
      <p className="lede lede--dim">
        A ritual composer, open on one movement. The only new thing is the line at the
        bottom — closed, quiet, and not there at all until you have written something of
        your own first.
      </p>

      {!movement ? (
        <div className="empty">
          <strong>This archive has no movement answered twice.</strong>
          <br />
          There is nothing for the drawer to hold, so it does not appear — which is what
          it would do in the real app too.
        </div>
      ) : (
        <div className="composer">
          <div className="composer__top">
            <div className="composer__label">
              {thread?.practice} · {movement.label}
            </div>
            <h2 className="composer__q">{movement.question || movement.label}</h2>
          </div>

          <div className="composer__field">
            Being present at lunch with Mum
            <span className="composer__caret" />
          </div>

          <div className="drawer">
            <button type="button" className="drawer__toggle" onClick={() => setOpen(!open)}>
              <span>You have answered this before</span>
              <span className="drawer__chev">{open ? '×' : '↓'}</span>
            </button>
            {open ? (
              <div className="drawer__body">
                {past.slice(1).map((a) => (
                  <div className="drawer__item" key={a.entryId}>
                    <div className="drawer__date">{longDate(a.at)}</div>
                    <p className="drawer__text">{a.text}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <p className="caution">
        <strong>The case against building this.</strong> A ritual works because you meet
        the question fresh. Put last month’s answer one tap away and some mornings you
        will edit it instead of answering — which is the difference between a practice and
        a form, and this product has spent a lot of care on that difference. The separate
        surface has none of that risk. If only one ships, it should be the separate one.
      </p>
    </div>
  )
}
