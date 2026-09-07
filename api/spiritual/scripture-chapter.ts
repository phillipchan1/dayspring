// POST /api/spiritual/scripture-chapter
// Authenticated via the user's Supabase JWT.
//
// One chapter of numbered ESV text for the in-journal reader. Fail-quiet: an
// unrecognized book still returns 200 with empty verses so the client can offer
// the ESV.org handoff without inventing text.

import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { resolveChapter, ESV_COPYRIGHT } from '../_lib/esv.js'
import { corsHeaders, preflight, withCors } from '../_lib/cors.js'

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

  let body: { book?: unknown; chapter?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const book = typeof body.book === 'string' ? body.book.trim() : ''
  const chapter = typeof body.chapter === 'number' ? body.chapter : Number(body.chapter)
  if (!book || !Number.isInteger(chapter) || chapter < 1) {
    return withCors(req, Response.json({ error: 'book and chapter are required' }, { status: 400 }))
  }

  try {
    const hit = await resolveChapter(book, chapter)
    return withCors(
      req,
      Response.json({
        book: hit?.book ?? book,
        chapter: hit?.chapter ?? chapter,
        verses: hit?.verses ?? [],
        copyright: ESV_COPYRIGHT,
      }),
    )
  } catch (e) {
    return withCors(req, Response.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 }))
  }
}
