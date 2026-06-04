import { useRef, useState } from 'react'
import { upsertImportedEntries, type ImportedEntry } from '@/lib/entries'
import type { ImportParseResult } from '@/lib/import/types'
import type { ImportSourceDef } from '@/lib/import/sources'
import type { EntrySource } from '@/lib/types'
import { requireSupabase } from '@/lib/supabase'
import { importDayOneImages, importDiarlyImages, type ImageImportProgress } from '@/lib/import/importImages'

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'uploading-images' | 'done' | 'error'

interface Summary {
  imported: number
  skipped: ImportParseResult['skipped']
  dateRange: ImportParseResult['dateRange']
  images?: { uploaded: number; skipped: number; failed: number; missing: number }
}

/** Calendar day from an ISO timestamp (created_at may carry a real time). */
function day(iso: string): string {
  return iso.slice(0, 10)
}

function range(r: ImportParseResult['dateRange']): string {
  if (!r) return '—'
  return day(r.earliest) === day(r.latest) ? day(r.earliest) : `${day(r.earliest)} → ${day(r.latest)}`
}

/**
 * Supabase throws a PostgrestError (a plain object). Surface its real
 * message/code, and recognise the two codes that mean the import migration
 * hasn't been applied so the writer knows exactly what to do.
 */
function describeWriteError(e: unknown): string {
  const pg = e as { message?: string; code?: string } | null
  const msg = pg?.message ?? (e instanceof Error ? e.message : '') ?? ''
  const text = msg ? `Import failed: ${msg}${pg?.code ? ` (code ${pg.code})` : ''}` : 'Import failed while saving.'
  const looksLikeMissingMigration =
    pg?.code === '42P10' || pg?.code === '23514' || /on conflict|check constraint/i.test(msg)
  return looksLikeMissingMigration
    ? `${text} — it looks like the import database migration hasn’t been applied. Run supabase/migrations/20260530_diarly_import.sql in the Supabase SQL editor, then retry.`
    : text
}

interface Props {
  source: ImportSourceDef
}

/** The shared parse → preview → import → done flow for any available source. */
export function ImportRunner({ source }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ImportParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [imgProgress, setImgProgress] = useState<ImageImportProgress | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileBufferRef = useRef<ArrayBuffer | null>(null)

  async function handleFile(file: File) {
    if (!source.parse) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError(`Please choose a ${source.fileLabel ?? 'export (.zip)'}.`)
      setPhase('error')
      return
    }
    setPhase('parsing')
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      fileBufferRef.current = buffer
      const parsed = await source.parse(buffer)
      if (parsed.dated.length === 0 && parsed.skipped.length === 0) {
        setError(`Nothing importable found in this file. Is it a ${source.name} export?`)
        setPhase('error')
        return
      }
      setResult(parsed)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.')
      setPhase('error')
    }
  }

  async function confirmImport() {
    if (!result) return
    setPhase('importing')
    setProgress({ done: 0, total: result.dated.length })
    try {
      await upsertImportedEntries(result.dated, source.id as EntrySource, (done, total) =>
        setProgress({ done, total }),
      )

      // Image import phase — Day One and Diarly only
      const buffer = fileBufferRef.current
      const hasImages = source.id === 'day_one' || source.id === 'diarly'
      let imageSummary: Summary['images'] | undefined

      if (buffer && hasImages) {
        setPhase('uploading-images')
        setImgProgress({ done: 0, total: 0, uploaded: 0, skipped: 0 })

        const sb = requireSupabase()
        const { data: { user } } = await sb.auth.getUser()

        if (user) {
          const importFn = source.id === 'day_one' ? importDayOneImages : importDiarlyImages
          const imgResult = await importFn(
            buffer,
            result.dated,
            sb,
            user.id,
            (p) => setImgProgress(p),
          )

          // Update entries whose body was rewritten with resolved attachment refs
          const changed = imgResult.entries.filter(
            (e, i) => e.body_markdown !== result.dated[i]?.body_markdown,
          )
          if (changed.length > 0) {
            await upsertImportedEntries(changed, source.id as EntrySource)
          }

          imageSummary = {
            uploaded: imgResult.uploaded,
            skipped: imgResult.skipped,
            failed: imgResult.failed,
            missing: imgResult.missing,
          }
        }
      }

      setSummary({
        imported: result.dated.length,
        skipped: result.skipped,
        dateRange: result.dateRange,
        images: imageSummary,
      })
      setPhase('done')
    } catch (e) {
      setError(describeWriteError(e))
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setError(null)
    setSummary(null)
    setProgress({ done: 0, total: 0 })
    setImgProgress(null)
    fileBufferRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="import-runner">
      {(phase === 'idle' || phase === 'error') && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={source.accept ?? '.zip,application/zip'}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          <button
            type="button"
            className={`dropzone${dragging ? ' dropzone--active' : ''}`}
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
            <span className="dropzone__icon" aria-hidden="true">↓</span>
            <span className="dropzone__text">
              Drop your <code>.zip</code> here, or click to choose
            </span>
          </button>
          {phase === 'error' && error && <p className="import-error">{error}</p>}
        </>
      )}

      {phase === 'parsing' && <p className="import-status">Reading and parsing the export…</p>}

      {phase === 'preview' && result && (
        <div>
          <div className="import-stats">
            <Stat label="Importable" value={`${result.dated.length}`} />
            <Stat label="Skipped" value={`${result.skipped.length}`} />
            <Stat label="Date range" value={range(result.dateRange)} />
            {countImageRefs(result.dated, source.id) > 0 && (
              <Stat label="Photos" value={`~${countImageRefs(result.dated, source.id)}`} />
            )}
          </div>

          {result.dated[0] && (
            <div className="import-sample">
              <div className="import-sample__label">Sample parsed entry</div>
              <SampleRow entry={result.dated[0]} />
            </div>
          )}

          <div className="import-actions">
            <button
              className="btn btn--accent"
              disabled={result.dated.length === 0}
              onClick={() => void confirmImport()}
            >
              Import {result.dated.length} {result.dated.length === 1 ? 'entry' : 'entries'}
            </button>
            <button className="btn btn--ghost" onClick={reset}>
              Choose a different file
            </button>
          </div>
          {result.dated.length === 0 && (
            <p className="import-hint">No dated entries to import — only skipped files were found.</p>
          )}
        </div>
      )}

      {phase === 'importing' && (
        <div>
          <p className="import-status">
            Importing entries… {progress.done} / {progress.total}
          </p>
          <div className="import-progress">
            <div
              className="import-progress__bar"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'uploading-images' && imgProgress && (
        <div>
          <p className="import-status">
            Uploading photos… {imgProgress.done} / {imgProgress.total}
            {imgProgress.uploaded > 0 && ` · ${imgProgress.uploaded} new`}
            {imgProgress.skipped > 0 && ` · ${imgProgress.skipped} already stored`}
          </p>
          <div className="import-progress">
            <div
              className="import-progress__bar"
              style={{
                width: `${imgProgress.total ? (imgProgress.done / imgProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && summary && (
        <div>
          <p className="import-success">
            ✓ {summary.imported} {summary.imported === 1 ? 'entry' : 'entries'} imported
            {summary.skipped.length > 0 && ` · ${summary.skipped.length} skipped`}
          </p>
          {summary.images && (summary.images.uploaded + summary.images.skipped) > 0 && (
            <p className="import-hint">
              Photos: {summary.images.uploaded} uploaded
              {summary.images.skipped > 0 && `, ${summary.images.skipped} already stored`}
              {summary.images.failed > 0 && `, ${summary.images.failed} failed`}
              {summary.images.missing > 0 && `, ${summary.images.missing} not found in export`}
            </p>
          )}
          {summary.images && summary.images.uploaded === 0 && summary.images.skipped === 0 && summary.images.failed > 0 && (
            <p className="import-hint">
              Photos: {summary.images.failed} failed — run the attachments migration in Supabase then re-import.
            </p>
          )}
          <p className="import-hint">Date range: {range(summary.dateRange)}</p>
          {summary.skipped.length > 0 && (
            <details className="import-skipped">
              <summary>
                {summary.skipped.length} skipped file{summary.skipped.length === 1 ? '' : 's'} to review
              </summary>
              <ul>
                {summary.skipped.map((s) => (
                  <li key={s.path}>
                    <span className="import-skipped__path">{s.path}</span>
                    <span className="import-skipped__reason">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button className="btn btn--ghost" style={{ marginTop: '0.8rem' }} onClick={reset}>
            Import another export
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="import-stat">
      <div className="import-stat__value">{value}</div>
      <div className="import-stat__label">{label}</div>
    </div>
  )
}

function SampleRow({ entry }: { entry: ImportedEntry }) {
  const excerpt = entry.body_markdown.trim().slice(0, 200)
  return (
    <div className="import-sample__card">
      <SampleField label="date" value={day(entry.created_at)} />
      <SampleField label="external_id" value={entry.external_id} mono />
      <SampleField label="title" value={entry.title ?? '— (null)'} />
      <SampleField label="tags" value={entry.tags.length ? entry.tags.join(', ') : '—'} />
      <SampleField label="words" value={`${entry.word_count}`} />
      <SampleField
        label="body"
        value={excerpt + (entry.body_markdown.trim().length > 200 ? '…' : '')}
      />
    </div>
  )
}

function SampleField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="import-sample__field">
      <span className="import-sample__key">{label}</span>
      <span className={`import-sample__val${mono ? ' import-sample__val--mono' : ''}`}>{value}</span>
    </div>
  )
}

function countImageRefs(entries: ImportedEntry[], sourceId: string): number {
  const re =
    sourceId === 'day_one'
      ? /attachment-pending:/g
      : /\]\(data\//g
  return entries.reduce((n, e) => n + (e.body_markdown.match(re)?.length ?? 0), 0)
}
