import OpenAI from 'openai'
import { env } from './env'
import { ROLLUP_SCHEMA } from './prompts'
import type { ModelOutput } from './types'

let client: OpenAI | null = null
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey() })
  return client
}

// Some nano reasoning models accept a reasoning-effort hint; it isn't in the
// base ChatCompletion params type, so we widen the params object here.
type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high'
}

/**
 * Call the model with Structured Outputs and parse the JSON. Retries once on a
 * malformed/empty response. Callers MUST still validate quotes verbatim in code —
 * structured output guarantees shape, not truthfulness.
 */
export async function callRollupModel(
  systemPrompt: string,
  input: unknown,
): Promise<ModelOutput> {
  const params: ChatParams = {
    model: env.model(),
    // This model family only accepts the default temperature (1); grounding is
    // enforced in code (verbatim validation), so sampling temp doesn't matter.
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'rollup', strict: true, schema: ROLLUP_SCHEMA as Record<string, unknown> },
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ],
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai().chat.completions.create(params)
    const raw = completion.choices[0]?.message?.content
    if (raw) {
      try {
        return JSON.parse(raw) as ModelOutput
      } catch {
        /* fall through to retry */
      }
    }
  }
  throw new Error('Model returned malformed output after retry')
}
