import { useCallback, useEffect, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import type { ThreadsNav } from '@/lib/appHistory'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import type { Horizon, FieldItem, ThreadItem, ThreadDetail, EntryDetail } from './data/types'
import { loadField, loadRope, loadThread, loadEntry } from './data'
import { HorizonPill } from './HorizonPill'
import { StrandSvg } from './StrandSvg'
import './Threads.css'

interface Props {
  onOpenEntry?: ((entryId: string) => void) | undefined
}

// ── field view ────────────────────────────────────────────────────────────────

function FieldView({
  horizon, onHorizonChange, onNavigate,
}: {
  horizon: Horizon
  onHorizonChange: (h: Horizon) => void
  onNavigate: (frame: ThreadsNav) => void
}) {
  const [items, setItems] = useState<FieldItem[] | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setItems(undefined)
    loadField(horizon).then(
      (d) => { if (alive) setItems(d) },
      () => { if (alive) setItems(null) },
    )
    return () => { alive = false }
  }, [horizon])

  return (
    <div className="threads__view">
      <h1 className="threads__title">Threads &amp; Ropes</h1>
      <p className="threads__sub">what you keep returning to</p>
      <HorizonPill horizon={horizon} onChange={onHorizonChange} />

      {items === undefined ? (
        <SurfaceLoader label="Gathering threads…" />
      ) : items === null || items.length === 0 ? (
        <p className="threads__hint" style={{ marginTop: '20px' }}>
          No threads in this window yet — try a wider horizon, or run derive-threads.ts.
        </p>
      ) : (
        <div className="threads__field">
          {items.map((item) => (
            <div
              key={item.id}
              className={`field-row${item.private ? ' field-row--private' : ''}`}
              onClick={() => {
                if (item.private) return
                if (item.kind === 'rope') {
                  onNavigate({ level: 'rope', ropeId: item.id, ropeName: item.label })
                } else {
                  onNavigate({ level: 'thread', threadId: item.id, threadName: item.label, ropeId: null, ropeName: null })
                }
              }}
            >
              <div className="field-row__head">
                <div>
                  <span className="field-row__name">{item.label}</span>
                  <span className={`field-row__kind${item.kind === 'rope' ? ' field-row__kind--rope' : ''}`}>
                    {item.kind}
                  </span>
                </div>
                <span className="field-row__meta">
                  {[item.domain, item.lens].filter(Boolean).join(' · ') || item.lens || item.domain || ''}
                  {item.spanStart ? ` · ${item.spanStart.slice(0, 7)}→` : ''}
                </span>
              </div>
              {item.private
                ? <div className="field-row__lock">held privately — tap to tend, never shown ranked</div>
                : <StrandSvg count={item.kind === 'rope' ? item.threadCount : 1} />
              }
            </div>
          ))}
        </div>
      )}

      <p className="threads__foot">The app collects the threads. What the rope means is yours to name.</p>
    </div>
  )
}

// ── rope view ─────────────────────────────────────────────────────────────────

function RopeView({ ropeId, ropeName, onNavigate }: {
  ropeId: string; ropeName: string
  onNavigate: (frame: ThreadsNav) => void
}) {
  const [threads, setThreads] = useState<ThreadItem[] | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setThreads(undefined)
    loadRope(ropeId).then(
      (d) => { if (alive) setThreads(d) },
      () => { if (alive) setThreads(null) },
    )
    return () => { alive = false }
  }, [ropeId])

  return (
    <div className="threads__view">
      <h1 className="rope-view__title">{ropeName}</h1>
      <p className="rope-view__sub">
        a rope — woven from {threads?.length ?? '…'} threads. Tap one to walk it.
      </p>

      {threads === undefined ? (
        <SurfaceLoader label="Loading threads…" />
      ) : !threads?.length ? (
        <p className="threads__hint">No threads found in this rope.</p>
      ) : (
        <div>
          {threads.map((t) => (
            <div
              key={t.id}
              className="thread-row"
              onClick={() => onNavigate({ level: 'thread', threadId: t.id, threadName: t.label, ropeId, ropeName })}
            >
              <div className="thread-row__head">
                <span className="thread-row__name">{t.label}</span>
                <span className="thread-row__meta">
                  {t.lens ?? ''}{t.spanStart ? ` · ${t.spanStart.slice(0, 7)}→` : ''}
                </span>
              </div>
              <StrandSvg count={1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── thread timeline ───────────────────────────────────────────────────────────

function ThreadTimelineView({ threadId, onOpenMoment }: {
  threadId: string
  onOpenMoment: (entryId: string) => void
}) {
  const [detail, setDetail] = useState<ThreadDetail | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setDetail(undefined)
    loadThread(threadId).then(
      (d) => { if (alive) setDetail(d ?? null) },
      () => { if (alive) setDetail(null) },
    )
    return () => { alive = false }
  }, [threadId])

  if (detail === undefined) return <div className="threads__view"><SurfaceLoader label="Walking the thread…" /></div>
  if (!detail) return <div className="threads__view"><p className="threads__hint">Thread not found.</p></div>

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) }
    catch { return iso.slice(0, 7) }
  }

  return (
    <div className="threads__view">
      <h1 className="timeline-view__title">{detail.label}</h1>
      <p className="timeline__reframe">{detail.reframe}</p>

      <div className="timeline">
        {detail.moments.map((m, i) => (
          <div
            key={i}
            className={`moment moment--${m.register}`}
            onClick={() => onOpenMoment(m.entryId)}
          >
            <span className="moment__when">{formatDate(m.date)}</span>
            <span className="moment__kind">
              {m.register === 'meeting' ? 'where He met you' : m.register === 'bringing' ? 'you brought it again' : ''}
            </span>
            <div className="moment__said">
              {m.excerpt}
              <span className="moment__openhint"> → open entry</span>
            </div>
          </div>
        ))}
      </div>

      <div className="timeline__actions">
        <span className="timeline__actlabel">tend (held lightly — still deciding):</span>
        <button type="button" className="timeline__act" onClick={() => {/* parked */}}>rename</button>
        <button type="button" className="timeline__act" onClick={() => {/* parked */}}>merge</button>
        <button type="button" className="timeline__act" onClick={() => {/* parked */}}>hold privately</button>
      </div>
    </div>
  )
}

// ── entry view ────────────────────────────────────────────────────────────────

function EntryView({ entryId }: { entryId: string }) {
  const [entry, setEntry] = useState<EntryDetail | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setEntry(undefined)
    loadEntry(entryId).then(
      (d) => { if (alive) setEntry(d ?? null) },
      () => { if (alive) setEntry(null) },
    )
    return () => { alive = false }
  }, [entryId])

  if (entry === undefined) return <div className="threads__view"><SurfaceLoader label="Opening entry…" /></div>
  if (!entry) return <div className="threads__view"><p className="threads__hint">Entry not found.</p></div>

  const dateLabel = (() => {
    try { return new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
    catch { return entry.date.slice(0, 10) }
  })()

  return (
    <div className="threads__view">
      <div className="entry-card">
        <div className="entry-card__date">{dateLabel}</div>
        <div className="entry-card__title">{entry.title}</div>
        <div className="entry-card__body">{entry.body}</div>
        <div className="entry-card__foot">
          the source entry · this is where the thread touched your life · ↑ back to keep writing
        </div>
      </div>
    </div>
  )
}

// ── root router ───────────────────────────────────────────────────────────────

/**
 * Threads & Ropes — 4-level walkable surface.
 * Navigation is routed through AppHistoryState.threadsNav so the browser/app
 * Back button works correctly at every level (no local nav stack).
 */
export function ThreadsView({ onOpenEntry: _onOpenEntry }: Props) {
  const { state, go, back } = useAppNavigation()
  const [horizon, setHorizon] = useState<Horizon>(4)

  // Derive current nav frame from app state (null = field).
  const nav: ThreadsNav = state.threadsNav ?? { level: 'field' }

  const navigate = useCallback((frame: ThreadsNav) => {
    go({ threadsNav: frame })
  }, [go])

  // Reset to field when the Threads surface is re-entered from elsewhere.
  useEffect(() => {
    if (state.surface === 'threads' && state.threadsNav !== null && state.threadsNav.level === 'field') {
      go({ threadsNav: null }, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.surface])

  // Breadcrumb derived from current nav state.
  const crumbs: { label: string; onClick: () => void }[] = [
    { label: 'Threads', onClick: () => go({ threadsNav: null }) },
  ]
  if (nav.level === 'rope') {
    crumbs.push({ label: nav.ropeName, onClick: () => {} })
  }
  if (nav.level === 'thread') {
    if (nav.ropeId) crumbs.push({ label: nav.ropeName ?? 'rope', onClick: () => go({ threadsNav: { level: 'rope', ropeId: nav.ropeId!, ropeName: nav.ropeName ?? '' } }) })
    crumbs.push({ label: nav.threadName, onClick: () => {} })
  }
  if (nav.level === 'entry') {
    if (nav.ropeId) crumbs.push({ label: nav.ropeName ?? 'rope', onClick: () => go({ threadsNav: { level: 'rope', ropeId: nav.ropeId!, ropeName: nav.ropeName ?? '' } }) })
    crumbs.push({ label: nav.threadName, onClick: () => go({ threadsNav: { level: 'thread', threadId: nav.threadId, threadName: nav.threadName, ropeId: nav.ropeId, ropeName: nav.ropeName } }) })
    crumbs.push({ label: 'entry', onClick: () => {} })
  }

  return (
    <div className="threads">
      <div className="threads__wrap">
        {/* breadcrumb */}
        <nav className="threads__crumb" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {i < crumbs.length - 1 ? (
                <>
                  <button className="threads__crumb-link" onClick={c.onClick}>{c.label}</button>
                  <span className="threads__crumb-sep">›</span>
                </>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* back button — uses app back() so browser Back works the same way */}
        {nav.level !== 'field' && (
          <button className="threads__back" type="button" onClick={back}>← back</button>
        )}

        {nav.level === 'field' && (
          <FieldView horizon={horizon} onHorizonChange={setHorizon} onNavigate={navigate} />
        )}
        {nav.level === 'rope' && (
          <RopeView ropeId={nav.ropeId} ropeName={nav.ropeName} onNavigate={navigate} />
        )}
        {nav.level === 'thread' && (
          <ThreadTimelineView
            threadId={nav.threadId}
            onOpenMoment={(entryId) => navigate({
              level: 'entry',
              entryId,
              threadId: nav.threadId,
              threadName: nav.threadName,
              ropeId: nav.ropeId,
              ropeName: nav.ropeName,
            })}
          />
        )}
        {nav.level === 'entry' && (
          <EntryView entryId={nav.entryId} />
        )}
      </div>
    </div>
  )
}
