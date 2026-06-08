import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { upsertImportedEntries } from '@/lib/entries'
import { scanAllForRefs } from '@/lib/scripture/scan'
import type { ImportParseResult } from '@/lib/import/types'
import { IMPORT_SOURCES } from '@/lib/import/sources'
import type { EntrySource } from '@/lib/types'
import { getRollup, type Rollup } from '@/lib/insights'
import { backfillRecentMonth } from '@/lib/onboarding'
import { apiPost } from '@/lib/api'
import { onboardingCopy as copy } from './onboardingCopy'
import { MonthReveal } from './MonthReveal'

type Phase = 'upload' | 'parsing' | 'preview' | 'importing' | 'building' | 'reveal'

// Parsers we offer at onboarding, tried in order to auto-detect the export type
// (the user just drops a file — no need to pick the app first).
const PARSERS = IMPORT_SOURCES.filter((s) => s.status === 'available' && s.parse)

// How long we wait for the most-recent month before advancing to a graceful
// "still working" Reveal. The build continues regardless.
const REVEAL_TIMEOUT_MS = 30_000

function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

function rangeLabel(r: ImportParseResult['dateRange']): string {
  if (!r) return '—'
  const fmt = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  return dayOf(r.earliest) === dayOf(r.latest)
    ? fmt(r.earliest)
    : `${fmt(r.earliest)} – ${fmt(r.latest)}`
}

interface Props {
  /** Enter the journal — caller stamps onboarded_at. */
  onComplete: () => void
  /** Back to the Fork. */
  onBack: () => void
}

/**
 * The hero import experience. Reuses the existing importer end-to-end (parse →
 * preview → batched upsert), then triggers the one-time historical backfill and
 * lands on the Reveal: the user's real, freshly generated most-recent
 * month-in-review.
 */
export function ImportFlow({ onComplete, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportParseResult | null>(null)
  const [sourceId, setSourceId] = useState<EntrySource>('other')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [reveal, setReveal] = useState<Rollup | null>(null)
  const [bgBuilding, setBgBuilding] = useState(false)
  const [bgDismissed, setBgDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please choose a .zip export.')
      return
    }
    setError(null)
    setPhase('parsing')
    try {
      const buffer = await file.arrayBuffer()
      // Auto-detect: try each available parser, keep the first that finds entries.
      let parsed: ImportParseResult | null = null
      let detected: EntrySource = 'other'
      for (const src of PARSERS) {
        try {
          const r = await src.parse!(buffer.slice(0))
          if (r.dated.length > 0 || r.skipped.length > 0) {
            parsed = r
            detected = src.id as EntrySource
            break
          }
        } catch {
          /* try the next parser */
        }
      }
      if (!parsed || (parsed.dated.length === 0 && parsed.skipped.length === 0)) {
        setError('We couldn’t read that file. Is it a Dayspring backup, Day One, or Diarly export (.zip)?')
        setPhase('upload')
        return
      }
      setResult(parsed)
      setSourceId(detected)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.')
      setPhase('upload')
    }
  }

  function resetToUpload() {
    setResult(null)
    setError(null)
    setPhase('upload')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function confirmImport() {
    if (!result) return
    setPhase('importing')
    setProgress({ done: 0, total: result.dated.length })
    try {
      await upsertImportedEntries(result.dated, sourceId, (done, total) =>
        setProgress({ done, total }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed while saving.')
      setPhase('preview')
      return
    }

    // Entries are in. Now build the reflection.
    setPhase('building')

    // Light the Lamp: imported entries skip the editor, so scan them for
    // scripture refs now (cheap on-device regex, runs in the background). Without
    // this the user lands on a "N entries haven't been scanned" CTA.
    void scanAllForRefs().catch((err) => console.warn('scripture scan failed', err))

    // Build the full archive through the SAME processing engine the rest of the
    // app reads — reflections AND altar — so the in-app banner + per-surface
    // forming states (with %) reflect real progress, and the Altar actually gets
    // built. The recent month is still built synchronously below for the Reveal.
    setBgBuilding(true)
    if (result.dateRange) {
      void apiPost('/api/processing/enqueue', {
        range: { start: dayOf(result.dateRange.earliest), end: dayOf(result.dateRange.latest) },
      }).catch((err) => console.warn('processing enqueue failed', err))
    }

    // Race the most-recent month against a graceful timeout.
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      // Timed out — advance to a graceful "still working" Reveal (reveal === null
      // shows the pending state); the build continues in the background.
      setPhase('reveal')
    }, REVEAL_TIMEOUT_MS)

    try {
      const recent = await backfillRecentMonth()
      if (recent.status === 'built') {
        const rollup = await getRollup('monthly', recent.period_start)
        if (rollup) setReveal(rollup)
      }
    } catch {
      /* fall through to the pending Reveal */
    } finally {
      window.clearTimeout(timer)
      if (!settled) {
        settled = true
        setPhase('reveal')
      }
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (phase === 'upload' || phase === 'parsing') {
    return (
      <div className="ob-screen">
        <h1 className="ob-title">{copy.importUpload.title}</h1>
        <p className="ob-body">{copy.importUpload.body}</p>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />

        {phase === 'parsing' ? (
          <div className="ob-dropzone ob-dropzone--busy" aria-live="polite">
            <span className="ob-pulse" aria-hidden />
            <span>{copy.importUpload.reading}</span>
          </div>
        ) : (
          <button
            type="button"
            className={`ob-dropzone${dragging ? ' ob-dropzone--active' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
          >
            <span className="ob-dropzone__icon" aria-hidden>↓</span>
            <span className="ob-dropzone__text">{copy.importUpload.dropzone}</span>
            <span className="ob-dropzone__hint">{copy.importUpload.sourceHint}</span>
          </button>
        )}

        {error && <p className="ob-error">{error}</p>}
        {phase === 'upload' && (
          <button type="button" className="ob-tertiary" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>
    )
  }

  if (phase === 'preview' && result) {
    const n = result.dated.length
    return (
      <div className="ob-screen ob-screen--wide">
        <div className="ob-preview__count">
          <span className="ob-preview__number">{n.toLocaleString()}</span>
          <span className="ob-preview__caption">{copy.importPreview.importableLabel}</span>
        </div>

        <div className="ob-preview__meta">
          <div>
            <span className="ob-preview__meta-label">{copy.importPreview.dateRangeLabel}</span>
            <span className="ob-preview__meta-value">{rangeLabel(result.dateRange)}</span>
          </div>
          {result.skipped.length > 0 && (
            <div>
              <span className="ob-preview__meta-label">{result.skipped.length}</span>
              <span className="ob-preview__meta-value">{copy.importPreview.skippedLabel}</span>
            </div>
          )}
        </div>

        {result.dated[0] && (
          <div className="ob-sample">
            <div className="ob-sample__label">{copy.importPreview.sampleLabel}</div>
            <div className="ob-sample__date">{dayOf(result.dated[0].created_at)}</div>
            <p className="ob-sample__body">
              {result.dated[0].body_markdown.trim().slice(0, 240)}
              {result.dated[0].body_markdown.trim().length > 240 ? '…' : ''}
            </p>
          </div>
        )}

        <p className="ob-reassure">{copy.importPreview.reassurance}</p>

        <button type="button" className="ob-primary" onClick={() => void confirmImport()}>
          {copy.importPreview.primaryPrefix} {n.toLocaleString()} {n === 1 ? 'entry' : 'entries'}
        </button>
        <button type="button" className="ob-tertiary" onClick={resetToUpload}>
          {copy.importPreview.chooseDifferent}
        </button>
      </div>
    )
  }

  if (phase === 'importing') {
    const pct = progress.total ? (progress.done / progress.total) * 100 : 0
    return (
      <div className="ob-screen">
        <h1 className="ob-title">Bringing in your journal…</h1>
        <p className="ob-body">
          {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
        </p>
        <div className="ob-progress" role="progressbar" aria-valuenow={Math.round(pct)}>
          <div className="ob-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (phase === 'building') {
    return (
      <div className="ob-screen ob-screen--center">
        <span className="ob-bigpulse" aria-hidden />
        <h1 className="ob-title">{copy.importBuilding.title}</h1>
        <p className="ob-body">{copy.importBuilding.body}</p>
        <p className="ob-hint">{copy.importBuilding.hint}</p>
        <button type="button" className="ob-tertiary" onClick={onComplete}>
          {copy.importBuilding.skip} →
        </button>
      </div>
    )
  }

  // phase === 'reveal'
  return (
    <div className="ob-screen ob-screen--wide ob-fade-in">
      {reveal ? (
        <>
          <h1 className="ob-title ob-title--reveal">{copy.reveal.title}</h1>
          <MonthReveal rollup={reveal} />
        </>
      ) : (
        <>
          <h1 className="ob-title">{copy.reveal.pendingTitle}</h1>
          <p className="ob-body">{copy.reveal.pendingBody}</p>
        </>
      )}

      <button type="button" className="ob-primary" onClick={onComplete}>
        {copy.reveal.primary}
      </button>

      {bgBuilding && !bgDismissed &&
        createPortal(
          <div className="ob-bg-indicator" role="status">
            <span className="ob-bg-indicator__dot" aria-hidden />
            <span>{copy.reveal.backgroundIndicator}</span>
            <button
              type="button"
              className="ob-bg-indicator__dismiss"
              aria-label="Dismiss"
              onClick={() => setBgDismissed(true)}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
