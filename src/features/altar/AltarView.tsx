import { useEffect, useMemo, useRef, useState } from 'react'
import { getCache, windowCacheKey } from '@/lib/asyncCache'
import {
  getThread,
  invalidateAltarFieldCache,
  loadAltarField,
  pickAltarDefaultSeason,
  type AltarThread,
  type CarriedName,
  type DateWindow,
  type ThreadDetail,
} from '@/lib/altar/query'
import { clearEncounter, deleteThread, dismissCandidate, nameEncounter } from '@/lib/altar/encounters'
import { MOVEMENTS, MOVEMENT_LABEL, type Movement } from '@/lib/types'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import './Altar.css'

interface Props {
  onOpenEntry: (entryId: string) => void
}

type Tab = 'field' | 'time' | 'met'
type Lens = 'all' | 'prayer' | 'sense'

// ── small date helpers (browser-local; this surface is client-only) ──────────
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function weeksBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 6.048e8))
}
/** "3 mo on", "1.2 yrs on" — the span He carried it. Never a deadline. */
function span(a: string, b: string): string {
  const w = weeksBetween(a, b)
  if (w >= 52) return `${(w / 52).toFixed(1)} yrs on`
  if (w >= 8) return `${Math.round(w / 4.345)} mo on`
  return `${Math.max(1, w)} wks on`
}
function humanList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

// ── seasons (rolling windows; mirrors the Scripture surface) ──────────────────
interface Season {
  id: string
  label: string
  window: DateWindow
}
function buildSeasons(): Season[] {
  const now = new Date()
  const y = now.getFullYear()
  const season = new Date(now)
  season.setDate(season.getDate() - 90)
  return [
    { id: 'all', label: 'All time', window: {} },
    { id: 'season', label: 'This season', window: { from: season } },
    { id: 'year', label: 'This year', window: { from: new Date(y, 0, 1) } },
    {
      id: 'last',
      label: 'Last year',
      window: { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59) },
    },
  ]
}

// stable per-pebble horizontal jitter so a cairn looks heaped, not stacked.
const OFF = [0, -7, 6, -4, 8, -6, 3]

// ── a cairn: a heap that grew, crowned with light when He met you ─────────────
function Cairn({ t, i, onOpen }: { t: AltarThread; i: number; onOpen: (id: string) => void }) {
  const n = Math.min(t.touches, 7)
  const pebbles = []
  for (let k = 0; k < n; k++) {
    const cap = k === n - 1
    const w = 50 - k * 3
    pebbles.push(
      <span
        key={k}
        className={`altar-peb${cap ? ' altar-peb--cap' : ''}`}
        style={{
          width: w,
          height: w * 0.62,
          bottom: k * 17,
          left: `calc(50% - ${w / 2}px + ${OFF[k]}px)`,
          animationDelay: `${i * 50 + k * 40}ms`,
        }}
      />,
    )
  }
  return (
    <button
      className="altar-cairn"
      data-state={t.state}
      style={{ animationDelay: `${i * 60}ms` }}
      onClick={() => onOpen(t.id)}
    >
      <span className="altar-pile">
        {pebbles}
        <span className="altar-ground" />
      </span>
      <span className="altar-cairn__type">{t.type}</span>
      <span className="altar-cairn__title">{t.title}</span>
      {t.state === 'lit' && t.movement && t.named_at && (
        <span className="altar-cairn__mark">
          {MOVEMENT_LABEL[t.movement]} · {span(t.planted_at, t.named_at)}
        </span>
      )}
      {t.state === 'carrying' && (
        <span className="altar-cairn__mark altar-cairn__mark--ember">carried · {t.touches}×</span>
      )}
      {t.state === 'seed' && (
        <span className="altar-cairn__mark altar-cairn__mark--dim">planted {fmt(t.planted_at)}</span>
      )}
    </button>
  )
}

// ── across time: each arc is the span He carried it ───────────────────────────
function TimeArcs({ items, onOpen }: { items: AltarThread[]; onOpen: (id: string) => void }) {
  const W = 920
  const H = 360
  const padX = 48
  const padY = 40
  const baseY = H - padY
  const { min, max } = useMemo(() => {
    const dates = items.flatMap((t) => [
      new Date(t.planted_at).getTime(),
      t.named_at ? new Date(t.named_at).getTime() : new Date(t.last_touch_at).getTime(),
    ])
    const lo = dates.length ? Math.min(...dates) : Date.now() - 3.156e10
    const hi = Math.max(Date.now(), dates.length ? Math.max(...dates) : Date.now())
    return { min: lo, max: hi }
  }, [items])
  const x = (iso: string) =>
    padX + ((new Date(iso).getTime() - min) / (max - min || 1)) * (W - padX * 2)

  // month ticks
  const ticks: Date[] = []
  const start = new Date(min)
  start.setDate(1)
  for (let d = new Date(start); d.getTime() <= max; d.setMonth(d.getMonth() + 1)) ticks.push(new Date(d))

  return (
    <div className="altar-time">
      <svg viewBox={`0 0 ${W} ${H}`} className="altar-time__svg">
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="var(--border)" />
        {ticks.map((mo, k) => (
          <g key={k}>
            <line x1={x(mo.toISOString())} y1={baseY} x2={x(mo.toISOString())} y2={baseY + 5} stroke="var(--border)" />
            {mo.getMonth() % 2 === 0 && (
              <text
                x={x(mo.toISOString())}
                y={baseY + 20}
                className="altar-time__tick"
                textAnchor="middle"
              >
                {mo.toLocaleDateString('en-US', { month: 'short' })}
                {mo.getMonth() === 0 ? ` '${String(mo.getFullYear()).slice(2)}` : ''}
              </text>
            )}
          </g>
        ))}
        {items.map((t, idx) => {
          const x1 = x(t.planted_at)
          if (t.state === 'lit' && t.named_at && t.movement) {
            const x2 = x(t.named_at)
            const midX = (x1 + x2) / 2
            const lift = baseY - 56 - Math.min(120, Math.abs(x2 - x1) * 0.7)
            return (
              <g
                key={t.id}
                className="altar-arc"
                style={{ animationDelay: `${idx * 90}ms` }}
                onClick={() => onOpen(t.id)}
              >
                <path d={`M ${x1} ${baseY} Q ${midX} ${lift} ${x2} ${baseY}`} fill="none" stroke="url(#altarGold)" strokeWidth="1.4" />
                <circle cx={x1} cy={baseY} r="3.2" className="altar-arc__seed" />
                <circle cx={x2} cy={baseY} r="5" className="altar-arc__lit" />
                <text x={midX} y={lift - 8} textAnchor="middle" className="altar-arc__lbl">
                  {MOVEMENT_LABEL[t.movement]}
                </text>
              </g>
            )
          }
          return (
            <circle
              key={t.id}
              cx={x1}
              cy={baseY}
              r={t.state === 'carrying' ? 4 : 3}
              className={t.state === 'carrying' ? 'altar-arc__carry' : 'altar-arc__rest'}
              onClick={() => onOpen(t.id)}
            />
          )
        })}
        <defs>
          <linearGradient id="altarGold" x1="0" x2="1">
            <stop offset="0" stopColor="var(--text-faint)" />
            <stop offset="1" stopColor="rgb(var(--scripture-gold))" />
          </linearGradient>
        </defs>
      </svg>
      <p className="altar-voice altar-voice--tight">
        Each thread is the span He carried it — from the day you planted it to the day He met you. The word
        above names how He moved, never whether you “won.”
      </p>
    </div>
  )
}

// ── where He met me (the harvest) ─────────────────────────────────────────────
function Harvest({ items, onOpen }: { items: AltarThread[]; onOpen: (id: string) => void }) {
  return (
    <div className="altar-harvest">
      <p className="altar-harvest__head">Thus far the Lord has helped.</p>
      {items.length === 0 && (
        <p className="altar-voice">
          Nothing named yet — and that’s no lack. The threads you carry are still being carried.
        </p>
      )}
      {items.map((t, i) => (
        <button
          key={t.id}
          className="altar-harvest__card"
          style={{ animationDelay: `${i * 70}ms` }}
          onClick={() => onOpen(t.id)}
        >
          <div className="altar-harvest__meta">
            <span>{t.type}</span>
            <span>
              {t.movement && MOVEMENT_LABEL[t.movement]}
              {t.named_at ? ` · ${span(t.planted_at, t.named_at)}` : ''}
            </span>
          </div>
          <div className="altar-harvest__title">{t.title}</div>
          <div className="altar-harvest__seed">You planted this {fmt(t.planted_at)} —</div>
          {t.reflection && <div className="altar-harvest__answer">“{t.reflection}”</div>}
          <div className="altar-harvest__foot">
            {t.named_at ? `He met you ${fmt(t.named_at)}` : ''}
            <span className="altar-harvest__share">carry this into prayer →</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── the click-in thread: name how He moved ────────────────────────────────────
function ThreadPanel({
  detail,
  open,
  busy,
  onClose,
  onName,
  onStillCarrying,
  onRemove,
  onOpenEntry,
}: {
  detail: ThreadDetail | null
  open: boolean
  busy: boolean
  onClose: () => void
  onName: (movement: Movement) => void
  onStillCarrying: () => void
  onRemove: () => void
  onOpenEntry: (entryId: string) => void
}) {
  // Latch the last detail so the panel can slide out showing its content.
  const [shown, setShown] = useState<ThreadDetail | null>(detail)
  const [naming, setNaming] = useState(false)
  useEffect(() => {
    if (detail) setShown(detail)
  }, [detail])
  useEffect(() => {
    if (!open) setNaming(false)
  }, [open])

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
  const lit = t?.state === 'lit'

  const MovementChoices = (
    <div className="altar-ev__btns">
      {MOVEMENTS.map((m) => (
        <button key={m} className="altar-ev__yes" disabled={busy} onClick={() => onName(m)}>
          {MOVEMENT_LABEL[m]}
        </button>
      ))}
      <button className="altar-ev__no" disabled={busy} onClick={onStillCarrying}>
        still carrying
      </button>
    </div>
  )

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
              <h2 className="altar-thread__title">{t.title}</h2>
              <p className="altar-thread__sub">
                planted {fmt(t.planted_at)} · carried {t.touches}×
              </p>

              {t.seed && (
                <div className="altar-seed">
                  <span className="altar-lbl">The seed</span>
                  <p className="altar-seed__body">{t.seed.content}</p>
                  {t.seed.entry_id && (
                    <button className="altar-open-entry" onClick={() => onOpenEntry(t.seed!.entry_id!)}>
                      open the entry →
                    </button>
                  )}
                </div>
              )}

              {t.returns.length > 0 && (
                <div className="altar-returns">
                  <span className="altar-lbl">Each time you came back</span>
                  {t.returns.map((r) => (
                    <button
                      key={r.id}
                      className="altar-return"
                      onClick={() => r.entry_id && onOpenEntry(r.entry_id)}
                    >
                      <span className="altar-return__dot" />
                      <span className="altar-return__date">{fmt(r.date)}</span>
                      <span className="altar-return__text">{r.content}</span>
                    </button>
                  ))}
                </div>
              )}

              {lit && t.encounter ? (
                <div className="altar-bloom">
                  <span className="altar-lbl altar-lbl--gold">How He moved · {MOVEMENT_LABEL[t.encounter.movement]}</span>
                  {t.encounter.reflection_text && (
                    <p className="altar-bloom__answer">“{t.encounter.reflection_text}”</p>
                  )}
                  <p className="altar-mono altar-mono--gold">
                    He met you {fmt(t.encounter.named_at)} · {span(t.planted_at, t.encounter.named_at)}
                  </p>
                  <div className="altar-bloom__edit">
                    <span>carry it back into prayer — it isn’t closed.</span>
                    <button disabled={busy} onClick={onStillCarrying}>
                      still carrying
                    </button>
                  </div>
                </div>
              ) : t.candidate ? (
                <div className="altar-ev">
                  <span className="altar-lbl">Something surfaced</span>
                  <p className="altar-ev__quote">On {fmt(t.candidate.entry_date)} you wrote:</p>
                  <p className="altar-ev__body">“{t.candidate.quote}”</p>
                  <p className="altar-ev__reason">{t.candidate.one_line_reason}</p>
                  <p className="altar-ev__ask">{t.candidate.gentle_question}</p>
                  {MovementChoices}
                  <p className="altar-ev__note">
                    The app only asks and lays the evidence beside your words. You say what it means.
                  </p>
                </div>
              ) : (
                <div className="altar-ev altar-ev--quiet">
                  <span className="altar-lbl">Still a seed</span>
                  <p className="altar-ev__body altar-ev__body--muted">
                    Nothing has surfaced yet. It rests here, carried — the app will bring it back in time, never
                    to nag, only to remember with you.
                  </p>
                  {naming ? (
                    MovementChoices
                  ) : (
                    <button className="altar-ev__name" onClick={() => setNaming(true)}>
                      He met me here →
                    </button>
                  )}
                </div>
              )}
              <button className="altar-thread__remove" onClick={onRemove} disabled={busy}>
                not a prayer — remove from the altar
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function altarFieldFromCache(seasonId: string, seasons: { id: string; window: DateWindow }[]) {
  const sel = seasons.find((s) => s.id === seasonId)
  if (!sel) return null
  return getCache<Awaited<ReturnType<typeof loadAltarField>>>(`altar:field:${windowCacheKey(sel.window)}`)
}

export function AltarView({ onOpenEntry }: Props) {
  const seasons = useMemo(() => buildSeasons(), [])
  const rememberedSeason = getCache<string>('altar:defaultSeason') ?? ''
  const initialField = altarFieldFromCache(rememberedSeason, seasons)
  // '' until the adaptive default resolves on first visit (don't load all-time first).
  const [seasonId, setSeasonId] = useState(rememberedSeason)
  const [lens, setLens] = useState<Lens>('all')
  const [tab, setTab] = useState<Tab>('field')

  const [threads, setThreads] = useState<AltarThread[] | null>(initialField?.threads ?? null)
  const [carries, setCarries] = useState<CarriedName[]>(initialField?.carries ?? [])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reqId = useRef(0)

  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [busy, setBusy] = useState(false)

  // Adaptive default: open on the most recent season that actually has cairns.
  useEffect(() => {
    if (seasonId) return
    let cancelled = false
    void pickAltarDefaultSeason(seasons).then((id) => {
      if (!cancelled) setSeasonId(id)
    })
    return () => {
      cancelled = true
    }
  }, [seasonId, seasons])

  useEffect(() => {
    if (!seasonId) return
    const sel = seasons.find((s) => s.id === seasonId) ?? seasons[0]!
    const cached = getCache<Awaited<ReturnType<typeof loadAltarField>>>(
      `altar:field:${windowCacheKey(sel.window)}`,
    )
    if (cached) {
      setThreads(cached.threads)
      setCarries(cached.carries)
      setLoadError(null)
    } else {
      setThreads(null)
      setCarries([])
    }

    const id = ++reqId.current
    let cancelled = false
    loadAltarField(sel.window)
      .then((field) => {
        if (cancelled || id !== reqId.current) return
        setThreads(field.threads)
        setCarries(field.carries)
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled && id === reqId.current) setLoadError(e instanceof Error ? e.message : 'Could not load')
      })
    return () => {
      cancelled = true
    }
  }, [seasonId, seasons, reloadKey])

  // Load the open thread's detail.
  useEffect(() => {
    if (!openId) return
    let cancelled = false
    void getThread(openId).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => {
      cancelled = true
    }
  }, [openId, reloadKey])

  const openThread = (id: string) => {
    setDetail(null)
    setOpenId(id)
  }
  const closeThread = () => setOpenId(null)

  const refresh = () => {
    invalidateAltarFieldCache()
    setReloadKey((k) => k + 1)
  }

  const handleName = async (movement: Movement) => {
    if (!detail) return
    setBusy(true)
    try {
      const c = detail.candidate
      await nameEncounter(detail.id, movement, {
        ...(c ? { named_at: new Date(c.entry_date).toISOString() } : {}),
        source_entry_id: c?.source_entry_id ?? null,
        reflection_text: c?.quote ?? null,
      })
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!detail) return
    setBusy(true)
    try {
      await deleteThread(detail.id)
      refresh()
      closeThread()
    } finally {
      setBusy(false)
    }
  }

  const handleStillCarrying = async () => {
    if (!detail) return
    setBusy(true)
    try {
      if (detail.encounter) {
        await clearEncounter(detail.id)
      } else if (detail.candidate?.source_entry_id) {
        await dismissCandidate(detail.id, detail.candidate.source_entry_id)
      }
      refresh()
      closeThread()
    } finally {
      setBusy(false)
    }
  }

  const visible = useMemo(() => {
    if (!threads) return []
    return lens === 'all' ? threads : threads.filter((t) => t.type === lens)
  }, [threads, lens])

  const litSorted = useMemo(
    () =>
      (threads ?? [])
        .filter((t) => t.state === 'lit' && t.named_at)
        .sort((a, b) => a.named_at!.localeCompare(b.named_at!)),
    [threads],
  )

  // The Field, grouped by the year a prayer was planted (newest year first) so a
  // long archive reads as scannable seasons, not one endless grid. Within a year,
  // significance leads: lit "He met me" cairns first, then the tallest heaps, then
  // the rest — so what matters rises and the one-off seeds settle below.
  const fieldByYear = useMemo(() => {
    const m = new Map<number, AltarThread[]>()
    for (const t of visible) {
      const y = new Date(t.planted_at).getFullYear()
      ;(m.get(y) ?? m.set(y, []).get(y)!).push(t)
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const lit = (b.state === 'lit' ? 1 : 0) - (a.state === 'lit' ? 1 : 0)
        if (lit) return lit
        if (b.touches !== a.touches) return b.touches - a.touches
        return b.planted_at.localeCompare(a.planted_at)
      })
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [visible])

  if (loadError) return <p className="altar__error">{loadError}</p>
  if (threads === null)
    return (
      <div className="altar">
        <div className="altar__bg" aria-hidden />
        <SurfaceLoader label="Gathering what you’ve laid down…" />
      </div>
    )

  const fieldVoice =
    carries.length > 0
      ? `Lately your prayers have circled around ${humanList(carries.slice(0, 3).map((c) => c.name))}.`
      : 'Seeds planted in time — the heaps grow each time you return.'

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
                ['met', 'Where He met me'],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button key={k} className={`altar-tab${tab === k ? ' altar-tab--on' : ''}`} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab !== 'met' && (
            <div className="altar-controls">
              <div className="altar-chips" role="group" aria-label="Season">
                <span className="altar-chips__label">Season</span>
                {seasons.map((s) => (
                  <button
                    key={s.id}
                    className="altar-chip"
                    data-on={s.id === seasonId ? 'true' : undefined}
                    onClick={() => setSeasonId(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
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
          )}

          {tab === 'field' && (
            <>
              <p className="altar-voice">{fieldVoice}</p>
              {visible.length === 0 && (
                <p className="altar__quiet">
                  No heaps in this season yet — only quiet ground. Type <code>/pray</code> or{' '}
                  <code>/sense</code> in an entry to plant a seed.
                </p>
              )}
              {fieldByYear.map(([year, list]) => (
                <section key={year} className="altar-year">
                  <h2 className="altar-year__label">{year}</h2>
                  <div className="altar-field">
                    {list.map((t, i) => (
                      <Cairn key={t.id} t={t} i={i} onOpen={openThread} />
                    ))}
                  </div>
                </section>
              ))}
              {carries.length > 0 && (
                <div className="altar-carry">
                  <span className="altar-carry__label">The names you keep bringing to God</span>
                  <div className="altar-carry__row">
                    {carries.map((c) => (
                      <span key={c.name} className="altar-carry__chip">
                        {c.name}
                        <em>{c.count}</em>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'time' && <TimeArcs items={visible} onOpen={openThread} />}
          {tab === 'met' && <Harvest items={litSorted} onOpen={openThread} />}
        </div>
      </div>

      <ThreadPanel
        detail={detail}
        open={openId !== null}
        busy={busy}
        onClose={closeThread}
        onName={handleName}
        onStillCarrying={handleStillCarrying}
        onRemove={handleRemove}
        onOpenEntry={onOpenEntry}
      />
    </div>
  )
}
