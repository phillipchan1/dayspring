/**
 * Jev subject tagging — same seam as tagTexts in declared.ts.
 * Assigns a line to an existing vocabulary (Choice) rather than inventing labels.
 */

import { choice, noul } from '@typesafe-ai/sdk'
import { cleanTags, type SubjectKind, type SubjectTag } from '../declared.js'
import { askJev } from '../typesafe.js'

const NONE = 'none_of_these'
const MAX_CHOICE = 254

const KIND_CRITERIA = {
  person:
    'A specific named person or group prayed FOR (Naomi, the kids, my mom). NOT who is being prayed TO (God, Jesus, Father).',
  place: 'A place, work, or life context (Frontier, trading, our home, church).',
  theme:
    'A substantive recurring struggle or area of life — purity, anxiety, marriage, parenting, rest, identity. A real situation, not a quality being requested (wisdom, peace, grace).',
} as const

export interface JevTagResult {
  tags: Map<string, SubjectTag[]>
  /** Lines whose subject was none_of_these or below tau — cascade should escalate. */
  needsLlm: string[]
  failed: string[]
  assignments: Map<string, { keep: boolean; kind: SubjectKind | null; subject: string; confidence: number }>
}

/**
 * Vocabulary for the eval: gold labels + designed-thread forms + sibling/virtue
 * distractors. Documented in docs/lab/JEV_CLASSIFIER.md. Returning none_of_these
 * counts as "needs LLM" in cascade mode.
 */
export function evalSubjectVocabulary(goldLabels: string[]): string[] {
  const distractors = [
    'money',
    'finances',
    'purity',
    'porn',
    'sexual temptation',
    'Grace',
    'Joy',
    'Hope',
    'Faith',
    'Mercy',
    'wisdom',
    'peace',
    'strength',
    'the move',
    'Bristol',
    'Naomi',
    'Frontier',
    'anxiety',
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const label of [...goldLabels, ...distractors]) {
    const key = label.trim()
    if (!key) continue
    const norm = key.toLowerCase()
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(key)
    if (out.length >= MAX_CHOICE) break
  }
  return out
}

export async function jevTagTexts(
  lines: { id: string; content: string }[],
  vocabulary: string[],
  opts: { tau?: number } = {},
): Promise<JevTagResult> {
  const tau = opts.tau ?? 0.8
  const tags = new Map<string, SubjectTag[]>()
  const needsLlm: string[] = []
  const failed: string[] = []
  const assignments = new Map<
    string,
    { keep: boolean; kind: SubjectKind | null; subject: string; confidence: number }
  >()

  const vocab = vocabulary.slice(0, MAX_CHOICE)
  const criteria: Record<string, string> = { [NONE]: 'None of the listed subjects. The line is only a generic ask, or the matter is not in the list.' }
  for (const label of vocab) {
    criteria[label] = `The concrete matter of this prayer is "${label}".`
  }

  for (const line of lines) {
    try {
      const state = { line: line.content.slice(0, 600) }
      const questions = {
        keep: noul(
          'Is `line` about a specific person, place, or life situation, rather than only asking for a quality like wisdom, peace, grace, or strength, or addressing God with no concrete matter?',
          {
            true: 'A concrete person, place, or situation is present.',
            false: 'Generic ask, divine addressee only, or ordinary narration.',
          },
        ),
        kind: choice(
          'If `line` has a concrete subject, what kind is it? If it is only a generic ask, still pick the closest kind; `keep` is the gate.',
          KIND_CRITERIA,
        ),
        subject: choice(
          'Which canonical subject is `line` about? Pick none_of_these when the matter is not in the list, or when the line is only a generic ask (wisdom, peace, grace) with no concrete matter. Names that are also virtues (Grace, Joy, Hope) are people when they refer to a person.',
          criteria,
        ),
      }
      const { answers } = await askJev(`jev_tag:${line.id}`, state, questions)
      const keep = answers.keep.type === 'noul' && answers.keep.noul >= 0.5
      const kindAns = answers.kind
      const subjAns = answers.subject
      const kind = kindAns.type === 'choice' && (kindAns.choice === 'person' || kindAns.choice === 'place' || kindAns.choice === 'theme')
        ? kindAns.choice
        : null
      const subject = subjAns.type === 'choice' ? subjAns.choice : NONE
      const confidence = subjAns.type === 'choice' ? subjAns.confidence : 0

      assignments.set(line.id, { keep, kind, subject, confidence })

      const escalate = !keep || subject === NONE || confidence < tau
      if (escalate) needsLlm.push(line.id)

      if (!keep || subject === NONE || !kind) {
        tags.set(line.id, [])
        continue
      }
      tags.set(line.id, cleanTags([{ label: subject, kind }]))
    } catch {
      failed.push(line.id)
    }
  }

  return { tags, needsLlm, failed, assignments }
}
