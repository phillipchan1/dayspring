import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { getCache, setCache } from '@/lib/asyncCache'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { warmthSvg, hueFor } from '@/features/ascent/warmth'
import {
  loadAltarStrands,
  loadAltarStrand,
  type AltarStrand,
  type AltarStrandDetail,
  type AltarType,
  type SubjectKind,
} from './data'
import './Altar.css'

interface Props {
  onOpenEntry: (entryId: string) => void
}

type Tab = 'field' | 'time'
type Lens = 'all' | AltarType

const FIELD_CACHE = 'altar:strands:v2'
/** Per subject-kind section, surface the thickest; the long tail rests quietly. */
const VISIBLE_PER_GROUP = 10

// ── date / span language (browser-local; this surface is client-only) ─────────
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function spanText(a: string, b: string): string {
  const days = Math.max(0, (Date.parse(b) - Date.parse(a)) / 86_400_000)
  const years = days / 365
  if (years >= 1.5) return `across ${Math.round(years)} years`
  if (years >= 0.9) return 'across a year'
  const months = Math.round(days / 30)
  if (months >= 2) return `over ${months} months`
  return 'over a few weeks'
}
function recurrence(heft: number): string {
  if (heft <= 2) return 'brought twice'
  if (heft <= 4) return 'returned to more than once'
  if (heft <= 10) return 'returned to again and again'
  return 'kept before Him'
}

// ── subject-kind sections (the concentration that replaces the endless list) ──
const GROUPS: { kind: SubjectKind; label: string; note: string }[] = [
  { kind: 'person', label: 'Names you keep bringing to God', note: 'the people you carry' },
  { kind: 'place', label: 'Places & callings', note: 'where your prayers are spent' },
  { kind: 'theme', label: 'What He keeps tending in you', note: 'the matters that recur' },
]

// ── the abstract strand: warmth, not a rock ───────────────────────────────────
function StrandGlyph({ heft, lenses, pools }: { heft: number; lenses: string[]; pools: number[] }) {
  const id = useId().replace(/:/g, '')
  return (
    <div
      className="altar-strand__warmth"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: warmthSvg(heft, lenses, pools, id) }}
    />
  )
}

function StrandRow({ s, hero, onOpen }: { s: AltarStrand; hero: boolean; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="altar-strand" onClick={() => onOpen(s.id)}>
      <div className="altar-strand__head">
        <span className={`altar-strand__name${hero ? ' is-hero' : ''}`}>{s.label}</span>
        <span className="altar-strand__meta">
          {recurrence(s.heft)} · {spanText(s.spanStart, s.spanEnd)}
        </span>
      </div>
      <StrandGlyph heft={s.heft} lenses={s.lenses} pools={s.pools} />
      {s.repLine ? <p className="altar-strand__snip">“{s.repLine.excerpt}”</p> : null}
    </button>
  )
}

// ── across time: each strand is the span He carried it ────────────────────────
type Period = 'all' | 'season' | 'year' | '5y' | '10y'
const PERIODS: { key: Period; label: string; ms: number }[] = [
  { key: 'season', label: 'season', ms: 86_400_000 * 91 },
  { key: 'year', label: 'year', ms: 86_400_000 * 365 },
  { key: '5y', label: '5 years', ms: 86_400_000 * 365 * 5 },
  { key: '10y', label: '10 years', ms: 86_400_000 * 365 * 10 },
  { key: 'all', label: 'all', ms: 0 },
]

function TimeArcs({ strands, onOpen }: { strands: AltarStrand[]; onOpen: (id: string) => void }) {
  const W = 920
  const H = 380
  const padX = 44
  const padY = 38
  const baseY = H - padY

  const clipId = useId().replace(/:/g, '')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')

  const fullRange = useMemo((): [number, number] => {
    const starts = strands.map((s) => Date.parse(s.spanStart)).filter(Number.isFinite)
    const lo = starts.length ? Math.min(...starts) : Date.now() - 3.156e10
    return [lo, Date.now()]
  }, [strands])

  const [viewMin, viewMax] = useMemo((): [number, number] => {
    if (period === 'all') return fullRange
    const p = PERIODS.find((p) => p.key === period)!
    return [Date.now() - p.ms, Date.now()]
  }, [period, fullRange])

  const xMain = (iso: string) => padX + ((Date.parse(iso) - viewMin) / (viewMax - viewMin || 1)) * (W - padX * 2)

  const shown = useMemo(() => {
    let filtered = strands
    if (period !== 'all') {
      filtered = strands.filter((s) => Date.parse(s.spanEnd) >= viewMin)
    }
    return filtered.slice(0, 28)
  }, [strands, period, viewMin])

  const ticks = useMemo(() => {
    const t: number[] = []
    const sy = new Date(viewMin).getFullYear()
    const ey = new Date(viewMax).getFullYear()
    for (let y = sy; y <= ey; y++) t.push(y)
    return t
  }, [viewMin, viewMax])

  const maxHeft = Math.max(1, ...shown.map((s) => s.heft))

  return (
    <div className="altar-time">
      <div className="altar-chips altar-chips--time" role="group" aria-label="Time range">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className="altar-pill"
            data-on={period === p.key ? 'true' : undefined}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="altar-time__svg">
        <defs>
          <clipPath id={`arc-clip-${clipId}`}>
            <rect x={padX - 2} y={0} width={W - (padX - 2) * 2} height={baseY + 4} />
          </clipPath>
        </defs>

        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="var(--border)" />

        {ticks.map((y) => {
          const tx = xMain(new Date(y, 0, 1).toISOString())
          if (tx < padX - 2 || tx > W - padX + 2) return null
          return (
            <g key={y}>
              <line x1={tx} y1={baseY} x2={tx} y2={baseY + 5} stroke="var(--border)" />
              {(y % 2 === 0 || ticks.length <= 8) && (
                <text x={tx} y={baseY + 19} className="altar-time__tick" textAnchor="middle">
                  '{String(y).slice(2)}
                </text>
              )}
            </g>
          )
        })}

        <g clipPath={`url(#arc-clip-${clipId})`}>
          {shown.map((s, idx) => {
            const rawX1 = xMain(s.spanStart)
            const rawX2 = xMain(s.spanEnd)
            const x1 = Math.max(padX, rawX1)
            const x2 = Math.min(W - padX, rawX2)
            if (x2 - x1 < 4) return null
            const midX = (x1 + x2) / 2
            const lift = baseY - 26 - (s.heft / maxHeft) * (H - padY - 70)
            const hue = hueFor(s.lenses[0] ?? 'gold')
            const isHovered = hoveredId === s.id
            const isDimmed = hoveredId !== null && !isHovered
            const baseOp = Math.min(0.85, 0.32 + (s.heft / maxHeft) * 0.5)
            const op = isDimmed ? 0.06 : isHovered ? Math.min(1, baseOp + 0.15) : baseOp
            const sw = isHovered ? 2.5 + (s.heft / maxHeft) * 2 : 1 + (s.heft / maxHeft) * 2.4
            const d = `M ${x1} ${baseY} Q ${midX} ${lift} ${x2} ${baseY}`
            const showStart = rawX1 >= padX - 2
            const showEnd = rawX2 <= W - padX + 2
            return (
              <g
                key={s.id}
                className="altar-arc"
                style={{ animationDelay: `${idx * 45}ms` }}
                onClick={() => onOpen(s.id)}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <path d={d} fill="none" stroke="transparent" strokeWidth="12" />
                <path
                  d={d}
                  fill="none"
                  stroke={hue}
                  strokeWidth={sw}
                  strokeOpacity={op}
                  className="altar-arc__path"
                  style={{ pointerEvents: 'none' }}
                />
                {showStart && <circle cx={x1} cy={baseY} r="2.6" fill={hue} className="altar-arc__dot" opacity={isDimmed ? 0.06 : 0.8} />}
                {showEnd && <circle cx={x2} cy={baseY} r="3" fill={hue} className="altar-arc__dot" opacity={isDimmed ? 0.06 : 1} />}
                {(isHovered || (!isDimmed && idx < 8)) && (
                  <text
                    x={midX}
                    y={lift - 6}
                    textAnchor="middle"
                    className={`altar-arc__lbl${isHovered ? ' altar-arc__lbl--focus' : ''}`}
                    opacity={isDimmed ? 0.06 : 1}
                  >
                    {s.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <p className="altar-voice altar-voice--tight">
        Each arc spans from the first time you brought it to the last — the longer the reach, the longer He's
        carried it with you. The tallest are the ones you've returned to most.
      </p>
    </div>
  )
}

// ── the click-in: a strand's whole tended life, line by line ──────────────────
function StrandPanel({
  detail,
  open,
  onClose,
  onOpenEntry,
}: {
  detail: AltarStrandDetail | null
  open: boolean
  onClose: () => void
  onOpenEntry: (entryId: string) => void
}) {
  const [shown, setShown] = useState<AltarStrandDetail | null>(detail)
  useEffect(() => {
    if (detail) setShown(detail)
  }, [detail])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const t = shown
  return (
    <>
      <div className={`altar-scrim${open ? ' altar-scrim--open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`altar-thread${open ? ' altar-thread--open' : ''}`} aria-hidden={!open}>
        <div className="altar-thread__inner">
          {t && (
            <>
              <button className="altar-thread__back" onClick={onClose}>
                ← the field
              </button>
              <span className="altar-lbl">{t.type.toUpperCase()}</span>
              <h2 className="altar-thread__title">{t.label}</h2>
              <p className="altar-thread__sub">
                {recurrence(t.heft)} · {spanText(t.spanStart, t.spanEnd)} · {fmt(t.spanStart)} → {fmt(t.spanEnd)}
              </p>

              <div className="altar-strand__warmth altar-strand__warmth--panel" aria-hidden>
                <PanelWarmth heft={t.heft} lenses={t.lenses} pools={t.pools} />
              </div>

              <p className="altar-reframe">{t.reframe}</p>

              <div className="altar-returns">
                <span className="altar-lbl">Each time you brought it</span>
                {t.moments.map((m) => (
                  <button
                    key={m.itemId}
                    className="altar-return"
                    onClick={() => m.entryId && onOpenEntry(m.entryId)}
                    disabled={!m.entryId}
                  >
                    <span className="altar-return__dot" />
                    <span className="altar-return__date">{fmt(m.date)}</span>
                    <span className="altar-return__text">{m.excerpt}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function PanelWarmth({ heft, lenses, pools }: { heft: number; lenses: string[]; pools: number[] }) {
  const id = useId().replace(/:/g, '')
  return <div aria-hidden dangerouslySetInnerHTML={{ __html: warmthSvg(heft, lenses, pools, id) }} />
}

export function AltarView({ onOpenEntry }: Props) {
  const cached = getCache<AltarStrand[]>(FIELD_CACHE)
  const [strands, setStrands] = useState<AltarStrand[] | null>(cached ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens>('all')
  const [tab, setTab] = useState<Tab>('field')

  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AltarStrandDetail | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    let cancelled = false
    loadAltarStrands()
      .then((data) => {
        if (cancelled || id !== reqId.current) return
        setStrands(data)
        setCache(FIELD_CACHE, data)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled && id === reqId.current) setLoadError(e instanceof Error ? e.message : 'Could not load')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!openId) return
    let cancelled = false
    void loadAltarStrand(openId).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => {
      cancelled = true
    }
  }, [openId])

  const openStrand = (id: string) => {
    setDetail(null)
    setOpenId(id)
  }
  const closeStrand = () => setOpenId(null)

  const visible = useMemo(() => {
    if (!strands) return []
    return lens === 'all' ? strands : strands.filter((s) => s.type === lens)
  }, [strands, lens])

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      strands: visible.filter((s) => (s.subjectKind ?? 'theme') === g.kind),
    })).filter((g) => g.strands.length > 0)
  }, [visible])

  if (loadError) return <p className="altar__error">{loadError}</p>
  if (strands === null)
    return (
      <div className="altar">
        <div className="altar__bg" aria-hidden />
        <SurfaceLoader label="Gathering what you've laid down…" />
      </div>
    )

  const topNames = visible.filter((s) => s.subjectKind === 'person').slice(0, 3).map((s) => s.label)
  const fieldVoice =
    topNames.length > 0
      ? `Lately your prayers have circled around ${topNames.join(', ')}.`
      : 'Seeds planted in time — each strand thickens every time you return.'

  return (
    <div className="altar">
      <div className="altar__bg" aria-hidden />
      <div className="altar__scroll" data-dim={openId ? 'true' : undefined}>
        <div className="altar__column">
          <header className="altar__header">
            <h1 className="altar__title">Altar</h1>
            <p className="altar__subtitle">A place of remembrance</p>
          </header>

          <div className="altar-tabs">
            {(
              [
                ['field', 'Field'],
                ['time', 'Across time'],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button key={k} className={`altar-tab${tab === k ? ' altar-tab--on' : ''}`} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          <div className="altar-controls">
            <div className="altar-chips" role="group" aria-label="Type">
              {(['all', 'prayer', 'sense'] as Lens[]).map((k) => (
                <button
                  key={k}
                  className="altar-pill"
                  data-on={lens === k ? 'true' : undefined}
                  onClick={() => setLens(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {tab === 'field' && (
            <>
              <p className="altar-voice">{fieldVoice}</p>
              {visible.length === 0 && (
                <p className="altar__quiet">
                  Nothing has gathered here yet. Type <code>/pray</code> or <code>/sense</code> in an entry to
                  lay something down — strands appear once you've returned to them over time.
                </p>
              )}
              {grouped.map((g) => {
                const shown = g.strands.slice(0, VISIBLE_PER_GROUP)
                const resting = g.strands.length - shown.length
                return (
                  <section key={g.kind} className="altar-group">
                    <header className="altar-group__head">
                      <h2 className="altar-group__label">{g.label}</h2>
                      <span className="altar-group__note">{g.note}</span>
                    </header>
                    <div className="altar-strands">
                      {shown.map((s, i) => (
                        <StrandRow key={s.id} s={s} hero={i === 0} onOpen={openStrand} />
                      ))}
                    </div>
                    {resting > 0 && (
                      <p className="altar-strands__rest">{resting} quieter ones rest below.</p>
                    )}
                  </section>
                )
              })}
            </>
          )}

          {tab === 'time' && <TimeArcs strands={visible} onOpen={openStrand} />}
        </div>
      </div>

      <StrandPanel detail={detail} open={openId !== null} onClose={closeStrand} onOpenEntry={onOpenEntry} />
    </div>
  )
}
