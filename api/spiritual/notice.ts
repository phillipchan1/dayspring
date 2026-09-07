// POST /api/spiritual/notice
// Authenticated via the user's Supabase JWT (Authorization: Bearer <token>).
//
// The journal noticing: given the prose of an entry, point at up to three lines
// the writer already wrote and say which kind each one looks like.
//
// GROUNDING IS ENFORCED HERE, NOT PROMPTED FOR. The model only SELECTS — every
// quote it returns is checked in code to be an exact substring of the text that
// was sent, and anything that isn't is dropped on the floor. That is the whole
// contract: the margin contains the writer's own sentences and nothing else, so
// there is no path by which model-written words can reach it.
//
// Nothing this returns is a marking. It arrives in the margin in pencil, carries
// no weight, appears in no count, and reaches no other surface until the writer
// keeps it (see src/lib/noticing.ts).

import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { callModel } from '../_lib/openai.js'
import { corsHeaders, preflight, withCors } from '../_lib/cors.js'
import {
  MAX_PROPOSALS,
  MIN_TEXT,
  PROPOSABLE,
  stripFences,
  verbatimOnly,
  type ProposableKind,
} from '../_lib/notice.js'

/**
 * What may be proposed. Three of the eight are deliberately missing.
 *
 * **Absence** — where He seemed far — is declared only. Inferring that God felt
 * absent to someone is a verdict on their interior life, and no amount of
 * pencil makes a machine the right author of that sentence.
 *
 * **Scripture** is excluded for a duller reason: references are already captured
 * verbatim at save time by a pipeline that resolves real ESV text, and a second
 * guesser would only disagree with it.
 *
 * **Gift** is excluded because it is retired from the vocabulary — see
 * `_lib/notice.ts`, which holds the list itself.
 */
const SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string', maxLength: 400 },
          kind: { type: 'string', enum: [...PROPOSABLE] },
        },
        required: ['quote', 'kind'],
        additionalProperties: false,
      },
      maxItems: MAX_PROPOSALS,
    },
  },
  required: ['proposals'],
  additionalProperties: false,
}

const SYSTEM = `You read a page of someone's private spiritual journal and point at lines they already wrote.

You do not write anything. Every "quote" you return MUST be copied CHARACTER FOR CHARACTER from the text you are given — same words, same punctuation, same capitalisation. Do not tidy, trim, join, paraphrase, or correct anything. A quote that is not an exact substring of the input is discarded, so an approximate quote is worse than no quote.

Quote a whole sentence, or a whole line. Never a fragment that stops mid-clause.

For each one, say which kind it is:
- prayer — something they brought, or asked for.
- desire — something they want, or are reaching toward.
- sense — something they are holding without concluding. An impression, not a decision.
- learned — something they would tell themselves again.
- story — a thing that happened, worth keeping.

Return AT MOST 3, and return fewer — including none at all — when nothing on the page clearly is one of these. An ordinary day with nothing to point at is a normal result, not a failure. Never return more than one of the same kind.

Never judge, never grade, never characterise the writer, and never comment. You are only pointing.`

interface NoticeResult {
  proposals: Array<{ quote: string; kind: ProposableKind }>
}

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request): Promise<Response> {
  const header = req.headers.get('authorization') ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!jwt) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  const sb = supabaseAdmin()
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser(jwt)
  if (authError || !user) return withCors(req, Response.json({ error: 'unauthorized' }, { status: 401 }))

  let body: { text?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const text = stripFences(body.text ?? '').trim()
  if (text.length < MIN_TEXT) return withCors(req, Response.json({ proposals: [] }))

  try {
    const picked = await callModel<NoticeResult>(SYSTEM, { text }, SCHEMA, 'notice', 'low', 512)
    return withCors(req, Response.json({ proposals: verbatimOnly(picked.proposals, text) }))
  } catch (e) {
    return withCors(req, Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }))
  }
}
