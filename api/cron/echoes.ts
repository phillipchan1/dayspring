// POST /api/cron/echoes  (Vercel Cron, weekly on Monday at 10:00 UTC)
//
// Compares recent entry themes against historical rollup excerpts.
// When genuine thematic resonance is found, stores ONE sentence as the
// current echo_candidate. No echo is stored on a weak or absent match.
//
// Cost discipline: reads only from rollup summaries, never raw entries.

import { isAuthorized, unauthorized } from '../_lib/auth'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
import { callModel } from '../_lib/openai'
import { env } from '../_lib/env'

// ── AI schema + prompt ──────────────────────────────────────────────────────

const SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    entry_id: { type: 'string' },
    entry_date: { type: 'string' },
    text: { type: 'string' },
  },
  required: ['found', 'entry_id', 'entry_date', 'text'],
  additionalProperties: false,
}

const SYSTEM = `You are finding a quiet resonance in someone's private journal.

Given:
- "current_themes": the user's recent writing themes, topics, and synthesis
- "pool": older sentences the user has written (each with an id, date, and text)
- "dismissed_ids": entry ids to skip

Find ONE sentence from the pool that resonates thematically with the current themes.

What resonance means here:
- The same underlying feeling, question, tension, or spiritual pattern — not the same surface topic
- Something that would feel quietly meaningful to encounter again, not obvious or redundant
- Not flattery, not advice — just a sentence that speaks

Rules:
- The text field MUST be copied VERBATIM from the pool (exact characters)
- If no sentence genuinely resonates, return found: false with empty strings for the other fields
- Better to return nothing than to surface a weak or forced match
- Skip any entry_id in dismissed_ids`

interface EchoResult {
  found: boolean
  entry_id: string
  entry_date: string
  text: string
}

// ── Rollup types (minimal subset we need) ──────────────────────────────────

interface Quote {
  entry_id: string
  date: string
  text: string
}

interface RollupRow {
  id: string
  type: string
  period_start: string
  structured_payload: {
    quotes?: Quote[]
    reflection?: { citations?: Quote[] }
    observation?: { text?: string } | null
    topics?: Array<{ label: string }>
    synthesis?: string[]
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized()

  const owner = env.appOwnerId()
  const sb = supabaseAdmin()

  // 1. Get the most recent weekly rollup for "current themes".
  const { data: weeklyRows, error: wErr } = await sb
    .from('insights')
    .select('id, type, period_start, structured_payload')
    .eq('owner', owner)
    .eq('type', 'weekly')
    .order('period_start', { ascending: false })
    .limit(1)

  if (wErr) return Response.json({ error: wErr.message }, { status: 500 })

  const weekly = weeklyRows?.[0] as RollupRow | undefined
  if (!weekly) return Response.json({ skipped: 'no weekly rollup yet' })

  // 2. Get historical monthly rollups (older than 4 weeks ago).
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 28)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: historicalRows, error: hErr } = await sb
    .from('insights')
    .select('id, type, period_start, structured_payload')
    .eq('owner', owner)
    .eq('type', 'monthly')
    .lt('period_start', cutoffStr)
    .order('period_start', { ascending: false })
    .limit(6)

  if (hErr) return Response.json({ error: hErr.message }, { status: 500 })

  const historical = (historicalRows ?? []) as RollupRow[]
  if (historical.length === 0) {
    return Response.json({ skipped: 'not enough history yet' })
  }

  // 3. Collect the pool: all quotes from historical rollups.
  const pool: Quote[] = []
  for (const row of historical) {
    const q = row.structured_payload?.quotes ?? []
    const c = row.structured_payload?.reflection?.citations ?? []
    pool.push(...q, ...c)
  }

  // Deduplicate pool by entry_id (keep first occurrence).
  const seen = new Set<string>()
  const dedupedPool = pool.filter((q) => {
    if (seen.has(q.entry_id)) return false
    seen.add(q.entry_id)
    return true
  })

  if (dedupedPool.length === 0) {
    return Response.json({ skipped: 'historical pool is empty' })
  }

  // 4. Get dismissed entry IDs so the AI can skip them.
  const { data: dismissals } = await sb
    .from('echo_dismissals')
    .select('entry_id')
    .eq('owner', owner)

  const dismissedIds = (dismissals ?? []).map((d: { entry_id: string }) => d.entry_id)

  // 5. Build the AI input.
  const currentThemes = {
    synthesis: weekly.structured_payload?.synthesis ?? [],
    observation: weekly.structured_payload?.observation?.text ?? '',
    topics: (weekly.structured_payload?.topics ?? []).map((t) => t.label),
  }

  const input = {
    current_themes: currentThemes,
    pool: dedupedPool.map((q) => ({
      id: q.entry_id,
      date: q.date,
      text: q.text,
    })),
    dismissed_ids: dismissedIds,
  }

  // 6. Ask the AI for a resonant sentence.
  let result: EchoResult
  try {
    result = await callModel<EchoResult>(SYSTEM, input, SCHEMA, 'echo_resonance', 'low')
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'model error' }, { status: 500 })
  }

  if (!result.found || !result.entry_id || !result.text) {
    return Response.json({ skipped: 'no resonance found' })
  }

  // 7. Validate: the text must match verbatim in our pool.
  const poolMatch = dedupedPool.find(
    (q) => q.entry_id === result.entry_id && q.text.includes(result.text),
  )
  if (!poolMatch) {
    console.warn('[echoes] text failed verbatim validation — skipping')
    return Response.json({ skipped: 'verbatim validation failed' })
  }

  // 8. Upsert the echo candidate (one row per user; replaces the prior echo).
  const { error: upsertErr } = await sb.from('echo_candidates').upsert(
    {
      owner,
      entry_id: result.entry_id,
      text: result.text,
      entry_date: result.entry_date || poolMatch.date,
    },
    { onConflict: 'owner' },
  )

  if (upsertErr) return Response.json({ error: upsertErr.message }, { status: 500 })

  return Response.json({ stored: true, entry_id: result.entry_id })
}
