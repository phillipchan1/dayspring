/**
 * The ritual thread — your own answers to the same movement, in order.
 *
 * Rituals were the one surface in the app that never came back. Every other
 * one is a return: the Ascent returns your year, the Altar your prayers, Pages
 * your archive, Lamp the verses that keep arriving. A ritual took what you
 * wrote and gave nothing back, which is strange for the most *structured*
 * writing in the product — every answer already carries a named practice, a
 * named movement and a date, in the entry itself.
 *
 * ── Why this file is pure, and has no data layer ────────────────────────────
 * Nothing new is stored and nothing is fetched. `parseRitualBlocks` already
 * reads a block out of plain markdown, and `JournalScreen` already holds every
 * entry in memory (Pages renders from the same array). So a thread is a parse
 * and a group-by over data the client has — no migration, no endpoint, no
 * model call.
 *
 * That last one matters beyond cost: this is the one reading surface in
 * Dayspring that CANNOT hallucinate, because there is nothing on it the writer
 * did not type. "Grounded, or silent" is satisfied by construction rather than
 * by a prompt instruction.
 *
 * ── The question is looked up live, never stored ────────────────────────────
 * An entry holds only `<!-- ritual:section:Gratitude -->`. The question above
 * it comes from `PRACTICE_BY_NAME` at render time, exactly as the composer and
 * the editor widget already do — which is why retiring a practice must never
 * delete it from `PRACTICES` (see the `retired` flag).
 *
 * ── What this file deliberately does not compute ────────────────────────────
 * No streak, no gap, no cadence, no "you keep saying the same thing". `walks`
 * is counted because the shelf needs to know a practice was walked at all, and
 * it is never rendered — see `RitualThreads.tsx`. A date on one answer is a
 * fact about a page; a number over a column is a verdict about a person, and
 * Principle 2 draws that line. MORNING_RITUALS_PLAN §5.3 wrote the same
 * constraint down before any of this existed.
 */
import { parseRitualBlocks } from '@/editor/practices/ritualPacing'
import { PRACTICE_BY_NAME } from '@/editor/practices/practicesData'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { Entry } from '@/lib/types'

export interface RitualAnswer {
  /** The entry this was written in — the thread links back to the page. */
  entryId: string
  /** ISO timestamp of that entry. */
  at: string
  text: string
}

export interface RitualMovementThread {
  /** The section label, as written into the entry's hidden token. */
  label: string
  /**
   * Looked up live from `PRACTICE_BY_NAME`. Empty for a movement whose practice
   * is gone from the table entirely, or for a dynamic ritual like The Round
   * whose movements are the writer's own Life Map domains — there the label IS
   * the subject and the question is the same for every movement.
   */
  question: string
  /** Newest first. */
  answers: RitualAnswer[]
}

export interface RitualThread {
  practice: string
  /** Blocks of this practice in the archive. Counted, never rendered. */
  walks: number
  /** ISO of the most recent walk — the shelf's only ordering. */
  lastAt: string
  movements: RitualMovementThread[]
}

/** Movements the writer left blank carry no thread, so they are dropped. */
function livingOnly(movements: RitualMovementThread[]): RitualMovementThread[] {
  return movements.filter((m) => m.answers.length > 0)
}

/**
 * The practice's own order, not the order the movements happened to be answered in.
 *
 * Collecting as we parse puts a movement in the list the first time it carries
 * words, so a Morning Offering whose most recent walk skipped "Not yours" listed
 * it last — after "Offering", which comes after it in the ritual. Every practice
 * in the library is sequential by design (see ritualPacing.ts: Ignatius hands you
 * four movements, not four questions), and a rail that reorders them contradicts
 * the one formal property the composer exists to protect.
 *
 * A dynamic ritual has no prompts in the table, and neither does a practice that
 * has been deleted outright; both keep first-seen order, which for The Round is
 * the Life Map's own chronological ordering and therefore already right.
 */
function inRitualOrder(
  practiceName: string,
  movements: RitualMovementThread[],
): RitualMovementThread[] {
  const prompts = PRACTICE_BY_NAME.get(practiceName)?.prompts
  if (!prompts || prompts.length === 0) return movements
  const rank = new Map(prompts.map((p, i) => [p.label, i]))
  // Anything the table does not know keeps its relative place at the end rather
  // than jumping to the front on an `undefined ?? -1`.
  const at = (m: RitualMovementThread) => rank.get(m.label) ?? Number.MAX_SAFE_INTEGER
  return [...movements].sort((a, b) => at(a) - at(b))
}

/**
 * Every ritual thread in an archive, practices ordered by last walked.
 *
 * `entries` is the same array Pages renders from; order does not matter, the
 * result is sorted here.
 */
export function buildRitualThreads(entries: readonly Entry[]): RitualThread[] {
  const byPractice = new Map<string, RitualThread>()

  for (const entry of entries) {
    const md = entry.body_markdown ?? ''
    // Cheap reject before splitting — most pages have never held a ritual, and
    // this runs over the whole archive on open.
    if (!md.includes(':name:')) continue

    const lines = md.split('\n')
    for (const block of parseRitualBlocks(lines)) {
      let thread = byPractice.get(block.name)
      if (!thread) {
        thread = { practice: block.name, walks: 0, lastAt: entry.created_at, movements: [] }
        byPractice.set(block.name, thread)
      }
      thread.walks += 1
      if (entry.created_at > thread.lastAt) thread.lastAt = entry.created_at

      const practice = PRACTICE_BY_NAME.get(block.name)

      for (const movement of block.movements) {
        const text = lines
          .slice(movement.answerLine - 1, movement.contentEnd)
          .join('\n')
          .trim()
        if (!text) continue

        let mv = thread.movements.find((m) => m.label === movement.label)
        if (!mv) {
          const prompt = practice?.prompts.find((p) => p.label === movement.label)
          mv = {
            label: movement.label,
            // A dynamic ritual's movements are not in the table at all, so fall
            // back to its template — the same resolution both renderers do.
            question: prompt?.question ?? practice?.dynamic?.question(movement.label) ?? '',
            answers: [],
          }
          thread.movements.push(mv)
        }
        mv.answers.push({ entryId: entry.id, at: entry.created_at, text })
      }
    }
  }

  const threads: RitualThread[] = []
  for (const thread of byPractice.values()) {
    const movements = livingOnly(thread.movements)
    if (movements.length === 0) continue
    for (const m of movements) m.answers.sort((a, b) => b.at.localeCompare(a.at))
    threads.push({ ...thread, movements: inRitualOrder(thread.practice, movements) })
  }

  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/**
 * The movement to open a practice on.
 *
 * Most answers wins, and ties break toward the SHORTER ones. That second rule
 * is not a tidy-up: in a well-walked Morning Offering, "Everything" (a
 * deliberate brain dump) and "What matters" (one line) are answered the same
 * number of times, but a column of eighteen dumps is a wall and a column of
 * eighteen lines is a thread. Depth alone does not make a movement worth
 * reading back.
 */
export function openingMovement(thread: RitualThread): RitualMovementThread | null {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return (
    [...thread.movements].sort(
      (a, b) =>
        b.answers.length - a.answers.length ||
        mean(a.answers.map((x) => x.text.length)) - mean(b.answers.map((x) => x.text.length)),
    )[0] ?? null
  )
}

/** Total answers across a thread — used only to decide whether a shelf row exists. */
export function threadDepth(thread: RitualThread): number {
  return thread.movements.reduce((n, m) => n + m.answers.length, 0)
}

/**
 * One piece of an answer, as the thread shows it.
 *
 * - `text`    — what the writer wrote, line breaks kept.
 * - `quote`   — a `>` line, its marker taken off. In a scripture ritual this is
 *               a verse, the Bible's words, so it must never read as the
 *               writer's own (Guardrail H3; see writerWords) — it renders as a
 *               quotation, set apart.
 * - `passage` — a Scripture fence, shown only by its reference ("John 15:4–5"):
 *               the passage is not an answer, and the raw fence line and its
 *               translation are never shown as one.
 *
 * A prayer or sense fence in an answer is the writer's own words in a block, so
 * its content comes back as `text`.
 */
export interface AnswerPart {
  kind: 'text' | 'quote' | 'passage'
  text: string
}

/** An answer split for display — see `AnswerPart`. Pure; order preserved. */
export function answerParts(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  const add = (kind: AnswerPart['kind'], line: string) => {
    const last = parts[parts.length - 1]
    if (last && last.kind === kind && kind !== 'passage') last.text += `\n${line}`
    else parts.push({ kind, text: line })
  }
  const prose = (chunk: string) => {
    for (const line of chunk.split('\n')) {
      const quote = line.match(/^\s{0,3}>\s?(.*)$/)
      if (quote) add('quote', quote[1]!)
      // A blank line ends a quote but stays inside the writer's text.
      else if (line.trim() || parts[parts.length - 1]?.kind === 'text') add('text', line)
    }
  }

  let at = 0
  for (const block of parseSpiritualBlocks(answer)) {
    prose(answer.slice(at, block.from))
    if (block.type === 'scripture') {
      // "John 15:4–5 · ESV" — the citation, without the translation.
      const reference = (block.reference ?? '').split('·')[0]!.trim()
      if (reference) parts.push({ kind: 'passage', text: reference })
    } else {
      for (const line of block.content.split('\n')) add('text', line)
    }
    at = block.to
  }
  prose(answer.slice(at))

  return parts
    .map((p) => ({ ...p, text: p.text.trim() }))
    .filter((p) => p.text.length > 0)
}

