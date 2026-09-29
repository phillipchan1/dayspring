/**
 * Confidence-gated cascade: Jev first, existing OpenAI seams on low confidence,
 * none_of_these, or a Jev error. Lab only.
 */

import { harvestTexts, type HarvestedPassage } from '../altar.js'
import { tagTexts, type SubjectTag } from '../declared.js'
import { jevHarvestTexts, type JevHarvestResult } from './harvest.js'
import { jevTagTexts, type JevTagResult } from './subjects.js'
import { jevSentiment, sentimentNeedsLlm, type JevSentiment } from './sentiment.js'
import { openaiSentiment } from './openaiSentiment.js'

export type Route = 'jev' | 'llm'

export async function cascadeHarvest(
  entries: { id: string; body: string }[],
  opts: {
    tau?: number
    harvestWithOpenAI?: typeof harvestTexts
  } = {},
): Promise<JevHarvestResult & { route: Map<string, Route> }> {
  const tau = opts.tau ?? 0.8
  const openai = opts.harvestWithOpenAI ?? harvestTexts
  const jev = await jevHarvestTexts(entries, { tau })
  const route = new Map<string, Route>()
  for (const e of entries) {
    if (!jev.failed.includes(e.id) && !jev.lowConfidence.includes(e.id)) {
      route.set(e.id, 'jev')
    }
  }

  const escalate = entries.filter((e) => jev.failed.includes(e.id) || jev.lowConfidence.includes(e.id))
  if (escalate.length) {
    const fallback = await openai(escalate)
    for (const e of escalate) {
      route.set(e.id, 'llm')
      const passages = fallback.byEntry.get(e.id)
      if (passages) jev.byEntry.set(e.id, passages)
      if (!fallback.failed.includes(e.id)) {
        jev.failed = jev.failed.filter((id) => id !== e.id)
      }
    }
    for (const id of fallback.failed) {
      if (!jev.failed.includes(id)) jev.failed.push(id)
    }
  }

  return { ...jev, route }
}

export async function cascadeTag(
  lines: { id: string; content: string }[],
  vocabulary: string[],
  opts: {
    tau?: number
    tagWithOpenAI?: typeof tagTexts
  } = {},
): Promise<JevTagResult & { route: Map<string, Route> }> {
  const tau = opts.tau ?? 0.8
  const openai = opts.tagWithOpenAI ?? tagTexts
  const jev = await jevTagTexts(lines, vocabulary, { tau })
  const route = new Map<string, Route>()
  const escalateIds = new Set([...jev.needsLlm, ...jev.failed])
  for (const line of lines) {
    if (!escalateIds.has(line.id)) route.set(line.id, 'jev')
  }

  const escalate = lines.filter((l) => escalateIds.has(l.id))
  if (escalate.length) {
    const fallback = await openai(escalate)
    for (const line of escalate) {
      route.set(line.id, 'llm')
      if (fallback.has(line.id)) {
        jev.tags.set(line.id, fallback.get(line.id) ?? [])
        jev.failed = jev.failed.filter((id) => id !== line.id)
      }
    }
  }

  return { ...jev, route }
}

export async function cascadeSentiment(
  text: string,
  opts: {
    tau?: number
    sentimentWithOpenAI?: typeof openaiSentiment
  } = {},
): Promise<JevSentiment & { route: Route }> {
  const tau = opts.tau ?? 0.8
  const openai = opts.sentimentWithOpenAI ?? openaiSentiment
  try {
    const reading = await jevSentiment(text, { tau })
    if (!sentimentNeedsLlm(reading, tau)) return { ...reading, route: 'jev' }
    const fb = await openai(text)
    return { ...fb, route: 'llm' }
  } catch {
    const fb = await openai(text)
    return { ...fb, route: 'llm' }
  }
}

export type { HarvestedPassage, SubjectTag }
