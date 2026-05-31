import { useRef, useState } from 'react'
import { parseDiarlyZip, type DiarlyParseResult } from '@/lib/diarlyImport'
import { upsertImportedEntries } from '@/lib/entries'

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

interface Summary {
  imported: number
  undated: string[]
  dateRange: DiarlyParseResult['dateRange']
}

/** A Diarly created_at is pinned to noon UTC, so the calendar day is the ISO date prefix. */
function day(iso: string): string {
  return iso.slice(0, 10)
}

function range(r: DiarlyParseResult['dateRange']): string {
  if (!r) return '—'
  return day(r.earliest) === day(r.latest) ? day(r.earliest) : `${day(r.earliest)} → ${day(r.latest)}`
}

export function DiarlyImport() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<DiarlyParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please choose a Diarly Markdown export (.zip).')
      setPhase('error')
      return
    }
    setPhase('parsing')
    setError(null)
    try {
      const parsed = await parseDiarlyZip(await file.arrayBuffer())
      if (parsed.dated.length === 0 && parsed.undated.length === 0) {
        setError('No Markdown (.md) files found in this zip. Is it a Diarly Markdown export?')
        setPhase('error')
        return
      }
      setResult(parsed)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the zip file.')
      setPhase('error')
    }
  }

  async function confirmImport() {
    if (!result) return
    setPhase('importing')
    setProgress({ done: 0, total: result.dated.length })
    try {
      await upsertImportedEntries(result.dated, 'diarly', (done, total) =>
        setProgress({ done, total }),
      )
      setSummary({
        imported: result.dated.length,
        undated: result.undated.map((u) => u.path),
        dateRange: result.dateRange,
      })
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed while writing to Supabase.')
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setError(null)
    setSummary(null)
    setProgress({ done: 0, total: 0 })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '1rem 0', paddingTop: '0.8rem' }}>
      <h3 style={{ margin: '0 0 0.2rem', color: 'var(--text-bright)', fontSize: '0.9rem' }}>
        Import from Diarly
      </h3>
      <p style={{ margin: '0 0 0.7rem', color: 'var(--text-faint)', fontSize: '0.72rem', lineHeight: 1.5 }}>
        Upload your Diarly Markdown export (.zip). Entries are parsed in your browser and written
        straight to your journal — nothing is sent to any other service.
      </p>

      {(phase === 'idle' || phase === 'error') && (
        <>
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
          <div
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
            style={{
              border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              background: dragging ? 'var(--accent-soft)' : 'var(--bg-input)',
              color: 'var(--text-dim)',
              padding: '1.4rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'background var(--transition), border-color var(--transition)',
            }}
          >
            Drop your <code>.zip</code> here, or click to choose a file
          </div>
          {phase === 'error' && error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.6rem' }}>{error}</p>
          )}
        </>
      )}

      {phase === 'parsing' && (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Reading and parsing the export…</p>
      )}

      {phase === 'preview' && result && (
        <div>
          <div style={statRow}>
            <Stat label="Importable" value={`${result.dated.length}`} />
            <Stat label="Undated (skipped)" value={`${result.undated.length}`} />
            <Stat label="Date range" value={range(result.dateRange)} />
          </div>

          {result.dated[0] && (
            <div style={{ marginTop: '0.8rem' }}>
              <div style={sampleLabel}>Sample parsed entry</div>
              <SampleRow entry={result.dated[0]} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              className="btn"
              style={{ borderColor: 'var(--accent)', color: 'var(--text-bright)' }}
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
            <p style={{ color: 'var(--text-faint)', fontSize: '0.72rem', marginTop: '0.5rem' }}>
              No dated entries to import — only undated notes were found.
            </p>
          )}
        </div>
      )}

      {phase === 'importing' && (
        <div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            Importing… {progress.done} / {progress.total}
          </p>
          <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: 'var(--accent)',
                transition: 'width var(--transition)',
              }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && summary && (
        <div>
          <p style={{ color: 'var(--success)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            ✓ {summary.imported} {summary.imported === 1 ? 'entry' : 'entries'} imported/updated
            {summary.undated.length > 0 && ` · ${summary.undated.length} undated skipped`}
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '0 0 0.3rem' }}>
            Date range: {range(summary.dateRange)}
          </p>
          {summary.undated.length > 0 && (
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ color: 'var(--text-dim)', fontSize: '0.78rem', cursor: 'pointer' }}>
                {summary.undated.length} undated file{summary.undated.length === 1 ? '' : 's'} to
                handle manually
              </summary>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                {summary.undated.map((p) => (
                  <li
                    key={p}
                    style={{
                      color: 'var(--text-faint)',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {p}
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

const statRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
}

const sampleLabel: React.CSSProperties = {
  color: 'var(--text-faint)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.3rem',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: '1 1 5rem',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.5rem 0.6rem',
      }}
    >
      <div style={{ color: 'var(--text-bright)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div style={{ color: 'var(--text-faint)', fontSize: '0.68rem' }}>{label}</div>
    </div>
  )
}

function SampleRow({ entry }: { entry: DiarlyParseResult['dated'][number] }) {
  const excerpt = entry.body_markdown.trim().slice(0, 200)
  return (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.6rem 0.7rem',
        fontSize: '0.74rem',
        color: 'var(--text-dim)',
        display: 'grid',
        gap: '0.25rem',
      }}
    >
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
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-faint)', minWidth: '5.5rem', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: 'var(--text)',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}
