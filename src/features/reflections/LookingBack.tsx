import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import {
  loadReflection,
  recordEbenezerMark,
  recordWin,
  type EbenezerMark,
  type EbenezerStone,
  type Excerpt,
  type Horizon,
  type MonthlyReflection,
  type Prose,
  type QuarterlyReflection,
  type Question,
  type Reflection,
  type WeeklyReflection,
  type Win,
  type YearlyReflection,
} from './reflectionData'

/* ════════════════════════════════════════════════════════════════════════ */
/* Looking Back — four time horizons, each with its own three-slot content.  */
/* No moving art, no dashboard metrics. Elegance through typography + words.  */
/* Content is LIVE — loaded from the rollup cascade (see reflectionData.ts).  */
/* ════════════════════════════════════════════════════════════════════════ */

interface HorizonMeta {
  key: Horizon
  label: string
  kicker: string
  title: string
}

const HORIZONS: HorizonMeta[] = [
  { key: 'week', label: 'Week', kicker: 'this week', title: 'The Sabbath stop.' },
  { key: 'month', label: 'Month', kicker: 'last month', title: 'A letter to yourself.' },
  { key: 'quarter', label: 'Quarter', kicker: 'this quarter', title: 'The arc you can’t see from inside a week.' },
  { key: 'year', label: 'Year', kicker: 'this year', title: 'Who you were — and who you are now.' },
]

const ORDER: Horizon[] = ['week', 'month', 'quarter', 'year']

/** "still gathering" copy when a horizon has no rollup yet. */
const EMPTY_HINT: Record<Horizon, string> = {
  week: 'Your first weekly reflection is still gathering — keep writing.',
  month: 'A month’s letter unlocks after a few weeks of writing.',
  quarter: 'A season’s view composes as the months add up.',
  year: 'Your year-in-review composes as the months add up.',
}

/** Gentle text crossfade on horizon change. Gated by prefers-reduced-motion. */
const FADE_MS = 280

interface Props {
  onOpenEntry?: (entryId: string) => void
  /** Fills the journal canvas column instead of a full-screen takeover. */
  embedded?: boolean
}

/** undefined = still loading; null = no rollup yet; else the live reflection. */
type Loaded = Reflection | null | undefined

export function LookingBack({ onOpenEntry, embedded = false }: Props) {
  const isMobile = useIsMobile()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [data, setData] = useState<Record<Horizon, Loaded>>({
    week: undefined,
    month: undefined,
    quarter: undefined,
    year: undefined,
  })

  // The user's local edits, applied over whatever the job produced.
  const [markOverrides, setMarkOverrides] = useState<Record<string, EbenezerMark>>({})
  const [winEdits, setWinEdits] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  // Load each horizon independently; a failure/empty leaves that one in its
  // "still gathering" state without blocking the others.
  useEffect(() => {
    let cancelled = false
    for (const h of ORDER) {
      loadReflection(h)
        .then((r) => {
          if (!cancelled) setData((prev) => ({ ...prev, [h]: r }))
        })
        .catch(() => {
          if (!cancelled) setData((prev) => ({ ...prev, [h]: null }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [])

  function markStone(id: string, next: EbenezerMark, fallback: EbenezerMark) {
    const current = markOverrides[id] ?? fallback
    const value = current === next ? 'unmarked' : next
    setMarkOverrides((prev) => ({ ...prev, [id]: value }))
    recordEbenezerMark(id, value)
  }
  function dismissQuestion(id: string) {
    setDismissed((prev) => new Set(prev).add(id))
  }
  function editWin(id: string, text: string) {
    setWinEdits((prev) => ({ ...prev, [id]: text }))
    recordWin(id, text)
  }

  const ctx: ViewCtx = {
    onOpenEntry,
    markFor: (s) => markOverrides[s.id] ?? s.mark,
    markStone,
    dismissed,
    dismissQuestion,
    winValue: (w) => ({
      text: winEdits[w.id] ?? w.text,
      suggested: w.suggested && !(w.id in winEdits),
    }),
    editWin,
  }

  // Active horizon + a light crossfade when it changes.
  const [activeIndex, setActiveIndex] = useState(0)
  const [shownIndex, setShownIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeIndex === shownIndex) return
    if (reduceMotion) {
      setShownIndex(activeIndex)
      scrollRef.current?.scrollTo({ top: 0 })
      return
    }
    setVisible(false)
    const t = setTimeout(() => {
      setShownIndex(activeIndex)
      scrollRef.current?.scrollTo({ top: 0 })
      setVisible(true)
    }, FADE_MS)
    return () => clearTimeout(t)
  }, [activeIndex, shownIndex, reduceMotion])

  const meta = HORIZONS[shownIndex]!
  const loaded = data[meta.key]

  return (
    <div
      className={embedded ? 'looking-back looking-back--embedded' : 'looking-back'}
      data-horizon={meta.key}
    >
      <div className="looking-back__bg" aria-hidden />

      <nav className="looking-back__pill" aria-label="Reflection horizon">
        {HORIZONS.map((h, i) => (
          <button
            key={h.key}
            className={`looking-back__seg${i === activeIndex ? ' is-active' : ''}`}
            aria-pressed={i === activeIndex}
            onClick={() => setActiveIndex(i)}
          >
            {h.label}
          </button>
        ))}
      </nav>

      <div className="looking-back__scroll" ref={scrollRef}>
        <article
          className={`looking-back__content${isMobile ? ' is-mobile' : ''}${visible ? ' is-visible' : ''}`}
          style={{ transition: reduceMotion ? 'none' : `opacity ${FADE_MS}ms ease` }}
        >
          <p className="looking-back__kicker">
            {meta.kicker}
            {loaded ? ` · ${loaded.periodLabel}` : ''}
          </p>
          <h1 className="looking-back__title">{meta.title}</h1>

          {loaded === undefined && (
            <p className="looking-back__hint">Gathering your reflection…</p>
          )}
          {loaded === null && <p className="looking-back__hint">{EMPTY_HINT[meta.key]}</p>}
          {loaded && <HorizonView reflection={loaded} ctx={ctx} />}
        </article>
      </div>
    </div>
  )
}

/* ── Shared view context + small building blocks ─────────────────────────── */

interface ViewCtx {
  onOpenEntry?: ((entryId: string) => void) | undefined
  markFor: (stone: EbenezerStone) => EbenezerMark
  markStone: (id: string, mark: EbenezerMark, fallback: EbenezerMark) => void
  dismissed: Set<string>
  dismissQuestion: (id: string) => void
  winValue: (win: Win) => { text: string; suggested: boolean }
  editWin: (id: string, text: string) => void
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="looking-back__section">
      <h2 className="looking-back__label">{label}</h2>
      {children}
    </section>
  )
}

function ProseBlock({ prose }: { prose: Prose }) {
  if (prose.paragraphs.length === 0) {
    return <p className="looking-back__hint">Still composing this — it fills in as you write.</p>
  }
  return (
    <>
      {prose.paragraphs.map((p, i) => (
        <p key={i} className="looking-back__prose">
          {p}
        </p>
      ))}
    </>
  )
}

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** The hero unit — the user's own words, tappable to open the source entry. */
function ExcerptLine({ excerpt, onOpen }: { excerpt: Excerpt; onOpen?: ((id: string) => void) | undefined }) {
  return (
    <blockquote className="looking-back__excerpt">
      <p className="looking-back__excerpt-text">“{excerpt.text}”</p>
      <footer className="looking-back__excerpt-meta">
        {fmtDay(excerpt.date)}
        {onOpen && (
          <button className="looking-back__open" onClick={() => onOpen(excerpt.entryId)}>
            → open entry
          </button>
        )}
      </footer>
    </blockquote>
  )
}

function Questions({ questions, ctx }: { questions: Question[]; ctx: ViewCtx }) {
  const live = questions.filter((q) => !ctx.dismissed.has(q.id))
  if (live.length === 0) return null
  return (
    <div className="looking-back__questions">
      {live.map((q) => (
        <div key={q.id} className="looking-back__question">
          <p className="looking-back__question-text">{q.text}</p>
          <button
            className="looking-back__question-dismiss"
            onClick={() => ctx.dismissQuestion(q.id)}
            aria-label="Dismiss this prompt"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

const MARKS: { value: EbenezerMark; label: string }[] = [
  { value: 'answered', label: 'Answered' },
  { value: 'not_yet', label: 'Not yet' },
  { value: 'no', label: 'No' },
]

/** Two stones side by side; the user — not the AI — decides if it's an Ebenezer. */
function Stone({ stone, ctx }: { stone: EbenezerStone; ctx: ViewCtx }) {
  const mark = ctx.markFor(stone)
  return (
    <div className={`looking-back__stone-pair is-${mark}`}>
      <div className="looking-back__stone">
        <span className="looking-back__stone-when">{fmtDay(stone.ask.date)} · you asked</span>
        <button className="looking-back__stone-text" onClick={() => ctx.onOpenEntry?.(stone.ask.entryId)}>
          “{stone.ask.text}”
        </button>
      </div>
      <div className="looking-back__stone">
        <span className="looking-back__stone-when">{fmtDay(stone.later.date)} · later</span>
        <button className="looking-back__stone-text" onClick={() => ctx.onOpenEntry?.(stone.later.entryId)}>
          “{stone.later.text}”
        </button>
      </div>
      <div className="looking-back__marks" role="group" aria-label="Mark this pairing">
        {MARKS.map((m) => (
          <button
            key={m.value}
            className={`looking-back__mark${mark === m.value ? ' is-on' : ''}`}
            aria-pressed={mark === m.value}
            onClick={() => ctx.markStone(stone.id, m.value, stone.mark)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Per-horizon views ───────────────────────────────────────────────────── */

function HorizonView({ reflection, ctx }: { reflection: Reflection; ctx: ViewCtx }) {
  switch (reflection.horizon) {
    case 'week':
      return <WeeklyView r={reflection} ctx={ctx} />
    case 'month':
      return <MonthlyView r={reflection} ctx={ctx} />
    case 'quarter':
      return <QuarterlyView r={reflection} ctx={ctx} />
    case 'year':
      return <YearlyView r={reflection} ctx={ctx} />
  }
}

function WeeklyView({ r, ctx }: { r: WeeklyReflection; ctx: ViewCtx }) {
  const hasWins = r.wins.thisWeek.length > 0 || r.wins.nextWeek.length > 0
  return (
    <>
      <Section label="Where the week landed">
        <ProseBlock prose={r.synthesis} />
        {r.citations.map((c, i) => (
          <ExcerptLine key={`${c.entryId}-${i}`} excerpt={c} onOpen={ctx.onOpenEntry} />
        ))}
      </Section>

      {hasWins && (
        <Section label="Wins — yours to keep or rewrite">
          <div className="looking-back__wins">
            <WinColumn heading="3 wins this week" wins={r.wins.thisWeek} ctx={ctx} />
            <WinColumn heading="3 wins I want next week" wins={r.wins.nextWeek} ctx={ctx} />
          </div>
        </Section>
      )}

      {r.jumpstart.length > 0 && (
        <Section label="A weekly jumpstart">
          <Questions questions={r.jumpstart} ctx={ctx} />
        </Section>
      )}
    </>
  )
}

function WinColumn({ heading, wins, ctx }: { heading: string; wins: Win[]; ctx: ViewCtx }) {
  return (
    <div className="looking-back__win-col">
      <p className="looking-back__win-head">{heading}</p>
      {wins.map((w) => (
        <WinInput key={w.id} win={w} ctx={ctx} />
      ))}
    </div>
  )
}

/** Inline-editable win — an auto-growing textarea so long wins wrap, not clip. */
function WinInput({ win, ctx }: { win: Win; ctx: ViewCtx }) {
  const { text, suggested } = ctx.winValue(win)
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`looking-back__win${suggested ? ' is-suggested' : ''}`}
      value={text}
      onChange={(e) => ctx.editWin(win.id, e.target.value)}
      spellCheck={false}
    />
  )
}

function MonthlyView({ r, ctx }: { r: MonthlyReflection; ctx: ViewCtx }) {
  return (
    <>
      <Section label="The letter">
        <div className="looking-back__letter">
          <ProseBlock prose={r.letter} />
        </div>
      </Section>

      <Section label="What you gained">
        <ProseBlock prose={r.gain} />
        {r.gainEvidence.map((c, i) => (
          <ExcerptLine key={`${c.entryId}-${i}`} excerpt={c} onOpen={ctx.onOpenEntry} />
        ))}
        {r.gapWatch && <p className="looking-back__aside">{r.gapWatch}</p>}
      </Section>

      <Section label="What kept recurring">
        <ProseBlock prose={r.themes} />
      </Section>
    </>
  )
}

function QuarterlyView({ r, ctx }: { r: QuarterlyReflection; ctx: ViewCtx }) {
  return (
    <>
      <Section label="From the retreat distance">
        <ProseBlock prose={r.synthesis} />
      </Section>

      <Section label="The Ebenezer thread">
        {r.ebenezer.length > 0 ? (
          <>
            <p className="looking-back__hint">
              Two moments, set side by side. Only you can say whether it’s a stone worth raising.
            </p>
            <div className="looking-back__ebenezer">
              {r.ebenezer.map((s) => (
                <Stone key={s.id} stone={s} ctx={ctx} />
              ))}
            </div>
          </>
        ) : (
          <p className="looking-back__hint">
            No clear pairings yet — when an earlier prayer and a later answer line up, they’ll
            surface here for you to weigh.
          </p>
        )}
      </Section>

      {r.jumpstart.length > 0 && (
        <Section label="A retreat jumpstart">
          <Questions questions={r.jumpstart} ctx={ctx} />
        </Section>
      )}
    </>
  )
}

function YearlyView({ r, ctx }: { r: YearlyReflection; ctx: ViewCtx }) {
  const answered = r.stones.filter((s) => ctx.markFor(s) === 'answered')
  return (
    <>
      <Section label="The throughline">
        <div className="looking-back__letter">
          <ProseBlock prose={r.throughline} />
        </div>
      </Section>

      <Section label="Stones in a row">
        {answered.length > 0 ? (
          <div className="looking-back__stones-row">
            {answered.map((s) => (
              <button
                key={s.id}
                className="looking-back__stone-chip"
                onClick={() => ctx.onOpenEntry?.(s.ask.entryId)}
              >
                <span className="looking-back__stone-chip-text">“{s.ask.text}”</span>
                <span className="looking-back__stone-chip-when">
                  {new Date(`${s.ask.date}T00:00:00Z`).getUTCFullYear()}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="looking-back__hint">
            The stones you mark “answered” across the quarters gather here — a year of evidence in
            your own handwriting.
          </p>
        )}
      </Section>

      <Section label="The year’s themes">
        <ProseBlock prose={r.themes} />
      </Section>
    </>
  )
}
