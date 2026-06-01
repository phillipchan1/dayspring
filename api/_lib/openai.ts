import OpenAI from 'openai'
import { env } from './env.js'

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
 * malformed/empty response. Callers MUST still validate quotes/excerpts verbatim
 * in code — structured output guarantees shape, not truthfulness.
 *
 * `schema` + `name` are per-horizon (see prompts.ts). The reflective prose needs
 * a little more room to reason than the old quote-picker, so effort is "medium".
 */
export async function callModel<T>(
  systemPrompt: string,
  input: unknown,
  schema: Record<string, unknown>,
  name: string,
  // Picking quotes + short prose (weekly/monthly) is cheap at "low"; the longer
  // multi-month synthesis (quarterly/yearly) gets "medium". Token-efficiency lever.
  effort: 'low' | 'medium' = 'low',
  // Nano models default to a small output window; callers can override.
  maxTokens = 2048,
): Promise<T> {
  const params: ChatParams = {
    model: env.model(),
    // This model family only accepts the default temperature (1); grounding is
    // enforced in code (verbatim validation), so sampling temp doesn't matter.
    reasoning_effort: effort,
    max_completion_tokens: maxTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict: true, schema },
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ],
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai().chat.completions.create(params)
    const choice = completion.choices[0]
    const msg = choice?.message

    // Newer SDK versions expose a pre-parsed object for json_schema responses.
    const maybeParsed = (msg as Record<string, unknown> | undefined)?.parsed
    if (maybeParsed !== null && maybeParsed !== undefined) {
      return maybeParsed as T
    }

    const raw = msg?.content
    console.error(`[callModel:${name}] attempt=${attempt} finish=${choice?.finish_reason} content_len=${raw?.length ?? 'null'} refusal=${msg?.refusal ?? 'none'}`)
    if (raw) {
      // Strip markdown code-block wrapping that some models add despite json_schema.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      console.error(`[callModel:${name}] raw_head=${cleaned.slice(0, 120)}`)
      try {
        return JSON.parse(cleaned) as T
      } catch (e) {
        console.error(`[callModel:${name}] JSON.parse failed: ${e}`)
      }
    }
  }
  throw new Error('Model returned malformed output after retry')
}
