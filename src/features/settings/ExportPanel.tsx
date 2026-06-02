import { useState } from 'react'
import { exportEntriesToZip } from '@/lib/export/exportEntries'

type ExportPhase = 'idle' | 'exporting' | 'building' | 'done' | 'error'

export function ExportPanel() {
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [progress, setProgress] = useState({ fetched: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  async function startExport() {
    setPhase('exporting')
    setError(null)
    setProgress({ fetched: 0, total: 0 })
    try {
      const blob = await exportEntriesToZip((fetched, total) => {
        setProgress({ fetched, total })
        if (total > 0 && fetched >= total) setPhase('building')
      })
      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dayspring-backup-${date}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
      setPhase('error')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.fetched / progress.total) * 100) : 0

  return (
    <div className="export-panel">
      <h3 className="export-panel__title">Export</h3>
      <p className="export-panel__intro">
        Download a complete backup of your journal as a zip. You can reimport it into Dayspring
        any time using the "Dayspring Backup" importer above.
      </p>

      {(phase === 'idle' || phase === 'error') && (
        <div>
          <button className="btn" onClick={() => void startExport()}>
            Export journal
          </button>
          {phase === 'error' && error && (
            <p className="import-error" style={{ marginTop: '0.6rem' }}>{error}</p>
          )}
        </div>
      )}

      {phase === 'exporting' && (
        <div>
          <p className="import-status">
            {progress.total === 0
              ? 'Preparing export…'
              : `Fetching entries… ${progress.fetched.toLocaleString()} / ${progress.total.toLocaleString()}`}
          </p>
          {progress.total > 0 && (
            <div className="import-progress">
              <div className="import-progress__bar" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {phase === 'building' && <p className="import-status">Building export…</p>}

      {phase === 'done' && (
        <div>
          <p className="import-success">✓ Download started — check your Downloads folder</p>
          <button
            className="btn btn--ghost"
            style={{ marginTop: '0.6rem' }}
            onClick={() => {
              setPhase('idle')
              setProgress({ fetched: 0, total: 0 })
            }}
          >
            Export again
          </button>
        </div>
      )}
    </div>
  )
}
