import { useEffect, useState } from 'react'
import {
  getImportedEntryCount,
  readScanWatermark,
  scanAllForRefs,
  writeScanWatermark,
  type ScanResult,
} from '@/lib/scripture/scan'

export interface ScriptureScan {
  /** Imported entries not yet scanned (or dismissed). 0 = nothing pending. */
  pending: number
  scanning: { done: number; total: number } | null
  result: ScanResult | null
  error: string | null
  run: () => Promise<void>
  /** Acknowledge the pending imports without scanning (advances the watermark). */
  dismiss: () => void
}

/**
 * Shared scan orchestration for the Scripture CTA and the Settings → Import
 * section. `onComplete` lets the caller relight the map after a scan.
 */
export function useScriptureScan(onComplete?: () => void): ScriptureScan {
  const [importedCount, setImportedCount] = useState(0)
  const [pending, setPending] = useState(0)
  const [scanning, setScanning] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getImportedEntryCount()
      .then((c) => {
        if (cancelled) return
        setImportedCount(c)
        setPending(Math.max(0, c - readScanWatermark()))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function run() {
    setError(null)
    setResult(null)
    setScanning({ done: 0, total: 0 })
    try {
      const r = await scanAllForRefs((done, total) => setScanning({ done, total }))
      const c = await getImportedEntryCount().catch(() => importedCount)
      writeScanWatermark(c)
      setImportedCount(c)
      setPending(0)
      setResult(r)
      onComplete?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(null)
    }
  }

  function dismiss() {
    writeScanWatermark(importedCount)
    setPending(0)
  }

  return { pending, scanning, result, error, run, dismiss }
}
