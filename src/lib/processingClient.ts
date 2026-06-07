import { requireSupabase } from './supabase'
import { apiPost } from './api'

/**
 * Catch-up trigger for accounts that have history but were never processed —
 * e.g. existing users from before the engine, or anyone who didn't come through
 * the import flow. Fires at most once per account: only when ZERO processing_jobs
 * rows exist for this owner. The server derives the date range from the owner's
 * entries (and no-ops for an empty journal), so this is safe and idempotent.
 */
export async function maybeBackfillOnLoad(): Promise<void> {
  try {
    const sb = requireSupabase()

    // Already has engine jobs (queued/running/done) → nothing to kick off.
    const jobs = await sb.from('processing_jobs').select('id').limit(1)
    if (jobs.error) return // table missing / offline — skip silently
    if (jobs.data && jobs.data.length > 0) return

    // Already has derived artifacts (rollups built by the cron or the earlier
    // hand-run scripts) → this account is NOT unprocessed; don't re-backfill.
    const insights = await sb.from('insights').select('id').limit(1)
    if (insights.error) return
    if (insights.data && insights.data.length > 0) return

    await apiPost('/api/processing/enqueue', {}) // no range → server derives it
  } catch {
    /* best-effort — never block the app on this */
  }
}
