import { useState } from 'react'
import { KIND_META } from '../kinds'
import { Dawn, Evidence, Movement, Rig } from '../parts'
import { chambers, daysSince, read, spanById, type Chamber, type Reading } from '../span'

/**
 * The heart — built, argued, and cut. Kept because the argument is the value.
 *
 * ── What was proposed ───────────────────────────────────────────────────────
 *
 * "A diagram of a heart — the sentiments and emotions you felt." The inferred
 * version is forbidden three times over and `the one we cannot build` shows
 * why. The legal version replaced it: six chambers of what she DECLARED, equal
 * in size, counts printed, brightness meaning recency.
 *
 * ── Why the legal version came off the page anyway ──────────────────────────
 *
 * It was legal and grounded and it still had to go, for a reason that has
 * nothing to do with guardrails:
 *
 *   > IT IS A TIME-SLICED ALTAR BESIDE A TIME-SLICED LAMP.
 *
 * Prayers already have a surface. Scripture already has a surface. Slicing an
 * existing surface by date is a filter, not a surface — and the only part that
 * was genuinely new is that `/sense`, `/story`, `/learned` and `/desire` have
 * no home yet, which is an argument for giving them one, not for building a
 * page around them.
 *
 * That is a sharper kill than any principle fired here, and it is worth
 * keeping on a route: a feature can clear every guardrail in the product and
 * still not deserve to exist.
 *
 * ── Where the markings went ─────────────────────────────────────────────────
 *
 * Into the arithmetic. They corroborate her words rather than being listed —
 * see span.ts § wordsIn, including the stronger version that was built and
 * reverted for a reason `looking` had already written down.
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
  const cells = chambers(reading.span)

  return (
    <div className="surface">
      <Dawn />

      <Rig label="reading">
        {READINGS.map((r) => (
          <button key={r.id} type="button" data-on={which === r.id ? 'true' : undefined} onClick={() => setWhich(r.id)}>
            {r.label}
          </button>
        ))}
      </Rig>

      <article className="sheet sheet--narrow">
        {which === 'chambers' ? <Chambers cells={cells} reading={reading} onOpen={setOpen} /> : null}
        {which === 'shoji' ? <Shoji cells={cells} reading={reading} onOpen={setOpen} /> : null}
        {which === 'mood' ? <Mood reading={reading} /> : null}

        {which !== 'mood' ? (
          <p className="floor" style={{ marginBlockStart: 34 }}>
            Cut from the page — not because it breaks a rule, but because prayers already have the Altar and
            verses already have the Lamp. What survived is the markings as <b>input</b>: they corroborate her own
            words rather than being shown again.
          </p>
        ) : null}
      </article>

      {open ? <Evidence id={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/**
 * Six chambers, one per declared kind.
 *
 * Equal size — sizing by count would make the biggest cell the biggest thing
 * in her heart, which is a portrait, and a portrait is the most total verdict
 * a machine can render. The count is printed: a number you can read is
 * arithmetic, a shape you can only feel is a claim. Brightness is recency,
 * which is the Covenant sky's own encoding and the only reason a varying
 * visual is legal here.
 */
function Chambers({
  cells,
  reading,
  onOpen,
}: {
  cells: Chamber[]
  reading: Reading
  onOpen: (id: string) => void
}) {
  return (
    <Movement
      title="what you set apart"
      gloss="Every line here is one you marked while you were writing. Nothing was chosen for you. How lit a panel is means how lately — nothing more."
    >
      <div className="heart">
        {cells.map((c) => (
          <ChamberCell key={c.kind} chamber={c} reading={reading} onOpen={onOpen} />
        ))}
      </div>
    </Movement>
  )
}

/** The quote is the MOST RECENT of its kind. Recency is arithmetic; "the best one" is a verdict. */
function ChamberCell({
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
  const warmth = since === null ? 0.02 : Math.max(0.03, 0.16 - (since / 90) * 0.13)

  return (
    <button
      type="button"
      className="chamber"
      style={{ '--tone': `var(--k-${meta.tone})`, '--warmth': warmth } as React.CSSProperties}
      onClick={() => latest && onOpen(latest.entryId)}
      disabled={!latest}
    >
      <span className="chamber__label">
        <span className="chamber__dot" />
        {meta.label}
        <span className="chamber__count">{chamber.markings.length === 0 ? '—' : chamber.markings.length}</span>
      </span>
      {latest ? (
        <p className="chamber__quote">{latest.quote}</p>
      ) : (
        /* Nothing, said as nothing. Never "you didn't…". H2: absence is not ours to interpret. */
        <span className="chamber__empty">Nothing this season.</span>
      )}
    </button>
  )
}

/**
 * The shoji reading — the same six facts as light through a screen.
 *
 * Phil's word, and it carries the better argument: A CHAMBER HAS AN INSIDE.
 * Rendering "what is inside your heart" implies the app has seen in there, and
 * that implication does damage even when every line in it is verbatim. A
 * screen has no interior at all — only panels, and however much light comes
 * through each.
 *
 * Cost, named: it is dark, so it either forces a dark inset into a page that
 * prints or the page stops printing well.
 */
function Shoji({
  cells,
  reading,
  onOpen,
}: {
  cells: Chamber[]
  reading: Reading
  onOpen: (id: string) => void
}) {
  return (
    <Movement
      title="what you set apart"
      gloss="The same six acts. How much light a panel carries is how lately you did it — nothing else."
    >
      <div className="shoji">
        {cells.map((c) => (
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
 * The numbers are INVENTED — hand-typed for this scene, which is the honest
 * way to show it: a real build would have a model score each entry, and the
 * scores would be no more grounded than these, only harder to notice.
 *
 * Three independent rules, any one of which is fatal: H2 (never infer interior
 * state), Principle 1 (no vertical axis, because a vertical axis implies
 * better and worse), D-016 (the writer supplies the signal). `looking` already
 * killed the rescue too: a DECLARED sentiment mark is still "Sense with a mood
 * attached", and any arrangement of it over time rebuilds the axis.
 *
 * It stays on a route because a rule you have only read is weaker than a rule
 * you have seen the cost of.
 */
function Mood({ reading }: { reading: Reading }) {
  /* Invented. There is no honest source for these. */
  const series = [0.62, 0.7, 0.55, 0.48, 0.3, 0.44, 0.4, 0.52, 0.58, 0.66]
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
