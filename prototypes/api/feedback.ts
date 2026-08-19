import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deliverFeedback, parseFeedback } from '../_shared/feedback/deliver.js'

const here = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(here, '..', 'prototypes.json'), 'utf8')) as {
  prototypes: { slug: string; hasFeedback?: boolean }[]
}

const SCRIPTURE_LABELS = {
  A: 'A — link out to ESV.org',
  B: 'B — chapter beside the journal',
  C: 'C — (unused)',
  other: 'Something else',
} as const

function labelsFor(slug: string) {
  if (slug === 'scripture') return SCRIPTURE_LABELS
  return {
    A: 'A',
    B: 'B',
    C: 'C',
    other: 'Something else',
  }
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseFeedback(raw)
  if (typeof parsed === 'string') {
    return Response.json({ error: parsed }, { status: 400 })
  }

  const entry = manifest.prototypes.find((p) => p.slug === parsed.prototype)
  if (!entry?.hasFeedback) {
    return Response.json({ error: 'Feedback is not enabled for this prototype' }, { status: 400 })
  }

  const result = await deliverFeedback(parsed, labelsFor(parsed.prototype))
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true })
}
