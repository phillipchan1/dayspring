// POST /api/keeping/read
//
// Private, evaluative entry read. The client sends only an entry id; the server
// loads that authenticated owner's text and vocabulary, then returns one
// grounded read. Nothing is persisted HERE: this is the playground. The stored
// read is the gather engine's (api/_lib/entryRead.ts, GATHER_READ), against the
// same vocabulary (api/_lib/keepingVocabulary.ts).

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'
import { readEntryWithKeeping } from '../_lib/keepingRead.js'
import { candidatesForEntry, loadVocabulary } from '../_lib/keepingVocabulary.js'

// Kept here too: the endpoint's test, and anything that imported it from here.
export { candidatesForEntry }

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: { entryId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const entryId = body.entryId?.trim() ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) {
    return withCors(req, Response.json({ error: 'valid entryId is required' }, { status: 400 }))
  }

  const sb = supabaseAdmin()
  const [{ data: entry, error: entryError }, vocabulary] = await Promise.all([
    sb
      .from('entries')
      .select('id, created_at, body_markdown')
      .eq('owner', user.id)
      .eq('id', entryId)
      .maybeSingle(),
    // As before: a vocabulary that cannot be loaded reads the page with none.
    loadVocabulary(sb, user.id).catch(() => ({ concordance: [], kept: [] })),
  ])

  if (entryError) {
    return withCors(req, Response.json({ error: 'could not load entry' }, { status: 500 }))
  }
  if (!entry) return withCors(req, Response.json({ error: 'entry not found' }, { status: 404 }))

  try {
    const subjects = candidatesForEntry(
      String(entry.body_markdown ?? ''),
      vocabulary.concordance,
      vocabulary.kept,
    )
    const reading = await readEntryWithKeeping(
      {
        id: String(entry.id),
        created_at: String(entry.created_at),
        body_markdown: String(entry.body_markdown ?? ''),
      },
      subjects,
    )
    return withCors(req, Response.json(reading))
  } catch {
    // Never include model details or entry text in the response or logs.
    return withCors(req, Response.json({ error: 'entry read failed' }, { status: 500 }))
  }
}
