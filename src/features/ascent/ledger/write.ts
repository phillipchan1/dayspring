/**
 * WRITE ABOUT THIS — where every telling-back ends.
 *
 * A thread, a month, a season, a year: each ends on the same gesture, a new
 * page with your own lines above one question. It is an ORDINARY ENTRY — dated
 * today, in the journal, editable, exportable. The quoted lines are verbatim
 * with their dates; the question is one you chose. The only new words on the
 * page after that are yours.
 *
 * Created through `repo.createEntry` (local-first: works offline, lands in the
 * cache the editor reads) and opened by id — never handed to the editor as an
 * unsaved draft (see src/lib/saveSession.ts for why that shape is banned).
 */

import { createEntry } from '@/lib/repo'
import { MONTH_SHORT } from './copy'

export interface QuoteGroup {
  /** "Dad's diagnosis", "The first page" — a small label above the lines. */
  label: string
  lines: { date: string; text: string }[]
}

export interface Seed {
  /** The page's heading: what it's about. */
  title: string
  groups: QuoteGroup[]
}

export const QUESTIONS = [
  { key: 'now', chip: 'What you see now', text: "Reading these back — what do you see now that you couldn't see then?" },
  { key: 'made', chip: 'What is being made', text: 'What is being made of you, in this?' },
  { key: 'taught', chip: 'What He taught you', text: 'What did He teach you in these pages?' },
  { key: 'then', chip: 'To yourself, back then', text: 'What would you say to yourself back at the start of it?' },
] as const

export type QuestionKey = (typeof QUESTIONS)[number]['key']

function day(date: string): string {
  return `${MONTH_SHORT[+date.slice(5, 7) - 1]} ${+date.slice(8, 10)}`
}

/** The markdown the new page opens with. Pure, so it can be pinned. */
export function seedMarkdown(seed: Seed, question: QuestionKey): string {
  const q = QUESTIONS.find((x) => x.key === question) ?? QUESTIONS[0]
  const out: string[] = [`## ${seed.title}`, '']
  for (const g of seed.groups) {
    if (g.lines.length === 0) continue
    if (seed.groups.length > 1) out.push(`**${g.label}**`, '')
    for (const l of g.lines) out.push(`> ${l.text.replace(/\n+/g, ' ')} — ${day(l.date)}`, '>')
    out.pop()
    out.push('')
  }
  out.push(`*${q.text}*`, '', '')
  return out.join('\n')
}

/** Create the page and return its id, for the caller to open. */
export async function startReflection(seed: Seed, question: QuestionKey): Promise<string> {
  const entry = await createEntry({ body_markdown: seedMarkdown(seed, question) })
  return entry.id
}
