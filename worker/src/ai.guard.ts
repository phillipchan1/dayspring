// Source guard: Worker AI must not construct a raw OpenAI client or read
// OPENAI_API_KEY. Run from tests / check:worker — not imported by the Worker.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SKIP = /\.(check|test|guard)\.ts$/

const FORBIDDEN = [
  { re: /OPENAI_API_KEY/, why: 'OPENAI_API_KEY bypasses the AI Gateway ZDR client' },
  { re: /api\.openai\.com/, why: 'direct api.openai.com call bypasses the gateway' },
  { re: /new OpenAI\s*\(/, why: 'raw OpenAI() construction bypasses createAiClient' },
  { re: /from\s+['"]openai['"]/, why: 'importing openai in the Worker bypasses aiClient.ts' },
]

export function workerAiSourceFiles(): string[] {
  return readdirSync(ROOT)
    .filter((name) => name.endsWith('.ts') && !SKIP.test(name))
    .map((name) => join(ROOT, name))
}

function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

export function assertNoWorkerAiBypass(): void {
  const hits: string[] = []
  for (const file of workerAiSourceFiles()) {
    const text = withoutComments(readFileSync(file, 'utf8'))
    const base = file.slice(ROOT.length + 1)
    for (const rule of FORBIDDEN) {
      if (rule.re.test(text)) hits.push(`${base}: ${rule.why}`)
    }
  }
  const ai = readFileSync(join(ROOT, 'ai.ts'), 'utf8')
  if (!ai.includes('forceGateway: true')) {
    hits.push('ai.ts: Worker client must pass forceGateway: true')
  }
  if (!ai.includes('createAiClient(')) {
    hits.push('ai.ts: Worker client must call createAiClient')
  }
  const index = withoutComments(readFileSync(join(ROOT, 'index.ts'), 'utf8'))
  if (!index.includes('workerAiClient') || !index.includes('./ai.ts')) {
    hits.push('index.ts: AI routes must go through worker/src/ai.ts')
  }
  if (hits.length) {
    throw new Error(`Worker AI bypasses the gateway client:\n${hits.map((h) => `  - ${h}`).join('\n')}`)
  }
}
