/**
 * THE YEAR'S NAMING — the one edge that runs the other way.
 *
 * Every other thing on the Summit flows upward: weeks into months, months into
 * the year. This flows back. Answering "what did he teach you this year" writes
 * an ORDINARY ENTRY, dated today, which re-enters the weekly and monthly loops
 * like any other page — and next year the Summit holds the writer's own naming
 * of the year beside the app's arrangement of it, so the app has one less thing
 * it needs to say.
 *
 * Deliberately no new column and no new table. The naming is a page in the
 * journal, findable in Pages, editable in the editor, searchable, exportable;
 * the only thing that marks it is an HTML comment, the same convention the
 * ritual and practice surfaces already use (`src/lib/practiceTokens.ts`). A
 * marker in the body means a writer who deletes the line still owns the page,
 * and an account that never opens the Summit again loses nothing.
 */

import { createEntry } from '@/lib/entries'
import { requireSupabase } from '@/lib/supabase'
import { SUMMIT_COPY } from './ascent.config'

/** The marker that makes a page the naming of a particular year. */
export function namingMarker(year: number): string {
  return `<!-- summit:year:${year} -->`
}

export interface YearNaming {
  entryId: string
  /** The writer's own words, marker and heading stripped. Empty while the page
   *  exists but hasn't been written in yet — a started page is not an answer. */
  text: string
  dateLabel: string
}

interface NamingRow {
  id: string
  created_at: string
  body_markdown: string
}

/** Everything but the writer's own prose: the marker, the question we seeded,
 *  and any leading blank lines left behind by stripping them. */
function namingText(body: string, year: number): string {
  return body
    .replace(namingMarker(year), '')
    .replace(/^\s*#{1,6}\s+.*$/m, '') // the seeded heading, if it's still there
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/**
 * The naming for a year, or null if the writer hasn't made one.
 *
 * Filtered server-side on the marker rather than by scanning the year's entries:
 * a decade-long archive holds thousands of pages a year, and the Summit must not
 * pull one of them down the wire to find one line.
 */
export async function loadNaming(year: number): Promise<YearNaming | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .select('id, created_at, body_markdown')
    .like('body_markdown', `%${namingMarker(year)}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = (data ?? [])[0] as NamingRow | undefined
  if (!row) return null
  return {
    entryId: row.id,
    text: namingText(row.body_markdown, year),
    dateLabel: new Date(row.created_at).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  }
}

/**
 * Open a page for the year's naming and return its id, so the caller can send
 * the writer straight into the editor with the cursor under the question.
 *
 * The page is created FIRST and then opened — never handed to the editor as an
 * unsaved draft with a null id. That shape is what produced five separate
 * rounds of duplicate entries (`src/lib/saveSession.ts` holds the invariants);
 * a pre-allocated row id is the only safe way to hand the editor a new page.
 */
export async function startNaming(year: number): Promise<string> {
  const body = `${namingMarker(year)}\n## ${SUMMIT_COPY.namingHeading(year)}\n\n`
  const entry = await createEntry({ body_markdown: body })
  return entry.id
}
