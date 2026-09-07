import type { Plugin } from 'vite'
import { deliverFeedback, parseFeedback } from '../feedback/deliver.ts'

const LABELS = {
  A: 'A',
  B: 'B',
  C: 'C',
  other: 'Something else',
} as const

function readBody(req: { on: (ev: string, fn: (c?: Uint8Array) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (c) => {
      if (c) chunks.push(c)
    })
    req.on('end', () => {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0)
      const out = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.byteLength
      }
      resolve(new TextDecoder().decode(out))
    })
    req.on('error', reject)
  })
}

/** Local dev middleware — mirrors POST /api/feedback on Vercel. */
export function feedbackDevPlugin(extraLabels?: Record<'A' | 'B' | 'C' | 'other', string>): Plugin {
  const labels = { ...LABELS, ...extraLabels }
  return {
    name: 'prototype-feedback-api',
    configureServer(server) {
      server.middlewares.use('/api/feedback', (req, res, next) => {
        void (async () => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Use POST' }))
            return
          }
          let raw: unknown
          try {
            raw = JSON.parse(await readBody(req))
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON' }))
            return
          }
          const parsed = parseFeedback(raw)
          if (typeof parsed === 'string') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: parsed }))
            return
          }
          const result = await deliverFeedback(parsed, labels)
          res.statusCode = result.ok ? 200 : 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.ok ? { ok: true } : { error: result.error }))
        })().catch(next)
      })
    },
  }
}
