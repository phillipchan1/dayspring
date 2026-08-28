import { useState } from 'react'
import { KIND_META } from '../kinds'
import { Dawn, Evidence, Movement, Rig } from '../parts'
import { daysSince, read, spanById, type Chamber, type Reading } from '../span'
import { Heart } from './Arrives'

/**
 * Three readings of one idea: "a diagram of the things in your heart."
 *
 * The idea is right and the obvious build is illegal, so this scene puts the
 * legal readings and the illegal one on the same screen, at the same fidelity,
 * and lets the difference be seen instead of argued.
 *
 *   chambers — six declared acts, equal size, count printed
 *   shoji    — the same six as light through a screen
 *   mood     — what every competitor ships, and what we may not
 *
 * `mood` is drawn properly, not as a strawman. A strawman proves nothing on a
 * call, and Phil will meet the real version in somebody else's app anyway.
 */
const READINGS = [
  { id: 'chambers', label: 'chambers' },
  { id: 'shoji', label: 'shoji' },
  { id: 'mood', label: 'the one we cannot build' },
] as const

type ReadingId = (typeof READINGS)[number]['id']

export function HeartScene() {
  const reading = read(spanById('year-2026'))
  const [which, setWhich] = useState<ReadingId>('chambers')
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="surface">
      <Dawn />

      <Rig label="reading">
        {READINGS.map((r) => (
          <button
            key={r.id}
            type="button"
            data-on={which === r.id ? 'true' : undefined}
            onClick={() => setWhich(r.id)}
          >
            {r.label}
          </button>
        ))}
      </Rig>

      <article className="sheet sheet--narrow">
        {which === 'chambers' ? <Heart reading={reading} onOpen={setOpen} /> : null}
        {which === 'shoji' ? <Shoji reading={reading} onOpen={setOpen} /> : null}
        {which === 'mood' ? <Mood reading={reading} /> : null}
      </article>

      {open ? <Evidence id={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * The shoji reading — the same six facts as light through a screen.
 *
 * Phil's word, and it turns out to carry the better argument. A CHAMBER HAS AN
 * INSIDE. Rendering "what is inside your heart" implies the app has seen in
 * there, and that implication is doing damage even when every line in it is
 * verbatim. A screen has no interior at all: it has panels, and it has however
 * much light is coming through each one.
 *
 * So the identical data reads as *what you set down, and how lately* rather
 * than as *what you are made of*. Same rules hold — equal panels, printed
 * counts, brightness is recency, nothing rises.
 *
 * The cost, named: it is darker than the artifact around it, which means it
 * either forces a dark inset into a page that prints, or the page stops
 * printing well. That is a real conflict with the surface's own light-on-dark
 * argument and it is the reason this is a reading to choose between, not a
 * second movement to add.
 */
function Shoji({ reading, onOpen }: { reading: Reading; onOpen: (id: string) => void }) {
  return (
    <Movement
      title="what you set apart"
      gloss="The same six acts. How much light a panel carries is how lately you did it — nothing else."
    >
      <div className="shoji">
        {reading.chambers.map((c) => (
          <Panel key={c.kind} chamber={c} reading={reading} onOpen={onOpen} />
        ))}
      </div>
    </Movement>
  )
}

function Panel({
  chamber,
  reading,
  onOpen,
}: {
  chamber: Chamber
  reading: Reading
  onOpen: (id: string) => void
}) {
  const meta = KIND_META[chamber.kind]
  const latest = chamber.markings[chamber.markings.length - 1]
  const since = daysSince(reading.span, chamber.kind)
  const warmth = since === null ? 0.01 : Math.max(0.02, 0.2 - (since / 240) * 0.16)

  return (
    <button
      type="button"
      className="shoji__panel"
      style={{ '--warmth': warmth } as React.CSSProperties}
      onClick={() => latest && onOpen(latest.entryId)}
      disabled={!latest}
    >
      <span className="shoji__label">
        <span className="chamber__dot" style={{ background: `var(--k-${meta.tone})` }} />
        {meta.label}
      </span>
      {latest ? <p className="shoji__quote">{latest.quote}</p> : null}
      <span className="shoji__count">{chamber.markings.length || '—'}</span>
    </button>
  )
}

/**
 * The mood line. Forbidden, drawn properly, kept on the screen.
 *
 * ── Where these numbers came from ───────────────────────────────────────────
 *
 * They are INVENTED. Hand-typed for this scene, which is the honest way to
 * show it: a real build would have a model score each entry, and the scores
 * would be no more grounded than these — they would just have arrived with a
 * confidence interval attached.
 *
 * ── Why it cannot ship ──────────────────────────────────────────────────────
 *
 * Three independent rules, any one of which is enough:
 *
 *   H2 — never infer someone's interior state. A tone score is precisely that
 *        and there is no version of it that is not.
 *   Principle 1 — no vertical axis, because a vertical axis implies better and
 *        worse. This line falls through May, and what a falling line beside a
 *        span containing her mother says is *you are doing worse*.
 *   D-016 — the writer supplies the signal. She marked eleven things this
 *        year; not one of them was a number.
 *
 * `looking/README.md` already killed this and even killed the rescue attempt:
 * a DECLARED sentiment mark is still "Sense with a mood attached", and any
 * arrangement of it over time rebuilds the axis Principle 1 forbids.
 *
 * ── Why it is still worth putting on a screen ───────────────────────────────
 *
 * Because it is beautiful and immediately legible and Phil's instinct reached
 * for something in this neighbourhood, and a rule you have only read is weaker
 * than a rule you have seen the cost of. Show it, then show `chambers` again,
 * and the second one stops looking like a compromise.
 */
function Mood({ reading }: { reading: Reading }) {
  /* Invented. See the comment above. There is no honest source for these. */
  const series = [0.62, 0.7, 0.55, 0.48, 0.3, 0.44, 0.4, 0.52, 0.58, 0.66]
  /*
   * A real 600×150 viewBox scaled uniformly, rather than a 100×100 one
   * stretched with preserveAspectRatio="none". The stretched version squashed
   * every data point into an ellipse, which made the chart look like a mockup —
   * and a mockup is arguable. This has to be the thing itself.
   */
  const W = 600
  const H = 150
  const pts = reading.entries.map((e, i) => ({
    x: 4 + (i / Math.max(1, reading.entries.length - 1)) * (W - 8),
    y: H - 10 - (series[i] ?? 0.5) * (H - 20),
    date: e.date,
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

  return (
    <Movement title="how you felt">
      <div className="forbidden">
        <div className="forbidden__axis" style={{ marginBlockEnd: 10 }}>
          heavier ↑ · lighter ↓
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#e2d2d2" strokeWidth="1" strokeDasharray="4 4" />
          <path d={d} fill="none" stroke="#b5707a" strokeWidth="1.8" strokeLinejoin="round" />
          {pts.map((p) => (
            <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="#b5707a" />
          ))}
        </svg>
        <div className="forbidden__axis" style={{ marginBlockStart: 10 }}>
          january — august
        </div>

        <ul className="verboten">
          <li>
            <b>GUARDRAILS H2</b> — never infer someone's interior state. There is no version of a tone score that
            is not exactly this.
          </li>
          <li>
            <b>Principle 1</b> — no vertical axis, because a vertical axis implies better and worse. This line
            falls through the spring she spent with her mother.
          </li>
          <li>
            <b>D-016</b> — the writer supplies the signal. She marked eleven things this year and not one of them
            was a number.
          </li>
          <li>
            And the numbers above are <b>made up</b>. A shipped version would have a model produce them, which
            would not make them any more hers — only harder to notice.
          </li>
        </ul>
      </div>
    </Movement>
  )
}
