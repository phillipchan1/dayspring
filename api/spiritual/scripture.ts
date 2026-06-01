// POST /api/spiritual/scripture
// Authenticated via the user's Supabase JWT (Authorization: Bearer <token>).
// Returns 3 ESV passages relevant to the submitted journal content or topic.

import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { callModel } from '../_lib/openai.js'

const SCHEMA = {
  type: 'object',
  properties: {
    passages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reference: { type: 'string' },
          text: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['reference', 'text', 'reason'],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ['passages'],
  additionalProperties: false,
}

const SYSTEM = `You are a scripture companion for a private Christian journaling app.
Given the user's journal entry text or topic, return exactly 3 relevant Bible passages from the ESV translation.

For each passage provide:
- reference: book, chapter, and verse range (e.g. "Psalm 23:1-4" or "Romans 8:28")
- text: the ESV passage text verbatim (1–4 verses; keep it readable, not exhaustive)
- reason: one sentence explaining why this passage speaks to what the user wrote

Choose verses that feel like a gentle companion — comfort, perspective, or quiet truth — not a sermon. Match the specific tone and concerns of the user's words.`

interface ScriptureResult {
  passages: Array<{ reference: string; text: string; reason: string }>
}

export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!jwt) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const sb = supabaseAdmin()
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser(jwt)
  if (authError || !user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body: { content?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const content = (body.content ?? '').trim()
  if (!content) return Response.json({ error: 'content is required' }, { status: 400 })

  try {
    const result = await callModel<ScriptureResult>(
      SYSTEM,
      { content },
      SCHEMA,
      'scripture_passages',
      'low',
    )
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
