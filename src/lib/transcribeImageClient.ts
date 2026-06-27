import { apiPostForm } from './api'

export interface ScanResult {
  /** The transcribed entry as markdown — a faithful draft for the writer to review. */
  text: string
  /** Verbatim copy (mirrors `text` for now; kept for parity with audio dictation). */
  raw: string
  /** How many pages the server read. */
  pages: number
}

/**
 * Transcribe one or more photographed handwritten pages into a markdown draft via
 * the vision endpoint. Pages are sent in capture order and read as one continuous
 * entry. The server biases the read toward the writer's Concordance, so their own
 * names and spellings survive. Throws on a non-2xx response.
 */
export async function transcribePages(
  files: File[],
  opts: { vocab?: string } = {},
): Promise<ScanResult> {
  const form = new FormData()
  files.forEach((f, i) => form.append('page', f, f.name || `page-${i + 1}.jpg`))
  if (opts.vocab) form.append('vocab', opts.vocab)
  return apiPostForm<ScanResult>('/api/transcribe-image', form)
}
