import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import { createAiClient, gatewayBody, resolveModelId } from './aiClient.js'
import { env } from './env.js'

function openai(): OpenAI {
  // Generous retries so a transient connect blip during a long backfill doesn't
  // abort the run (the harvest/label passes make hundreds of calls).
  return createAiClient({ maxRetries: 8, timeout: 60_000 })
}

// Some nano reasoning models accept a reasoning-effort hint; it isn't in the
// base ChatCompletion params type, so we widen the params object here.
// providerOptions is a Vercel AI Gateway extension (see aiClient.ts).
type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh'
  providerOptions?: {
    gateway: {
      zeroDataRetention: true
      only: string[]
    }
  }
}

/**
 * Call the model with Structured Outputs and parse the JSON. Retries once on a
 * malformed/empty response. Callers MUST still validate quotes/excerpts verbatim
 * in code — structured output guarantees shape, not truthfulness.
 *
 * `schema` + `name` are per-horizon (see prompts.ts). The reflective prose needs
 * a little more room to reason than the old quote-picker, so effort is "medium".
 */
/**
 * One line per model call so spend is attributable to a FEATURE, not just to the
 * OpenAI dashboard's daily total. `reasoning` is the hidden thinking budget —
 * billed at the (much pricier) output rate, so it is the first thing to look at
 * when a nano bill is bigger than it should be. Counts only, never text (§8).
 *
 *   [tokens] name=weekly model=gpt-6-luna in=2431 cached=0 out=812 reasoning=640 attempt=0
 *
 * Grep Vercel logs for `[tokens]` to total a day by name.
 */
function logUsage(name: string, model: string, attempt: number, usage: unknown): void {
  const u = usage as
    | {
        prompt_tokens?: number
        completion_tokens?: number
        prompt_tokens_details?: { cached_tokens?: number }
        completion_tokens_details?: { reasoning_tokens?: number }
      }
    | undefined
  if (!u) return
  console.log(
    `[tokens] name=${name} model=${model} in=${u.prompt_tokens ?? 0} ` +
      `cached=${u.prompt_tokens_details?.cached_tokens ?? 0} out=${u.completion_tokens ?? 0} ` +
      `reasoning=${u.completion_tokens_details?.reasoning_tokens ?? 0} attempt=${attempt}`,
  )
}

function contentFingerprint(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

export async function callModel<T>(
  systemPrompt: string,
  input: unknown,
  schema: Record<string, unknown>,
  name: string,
  // Picking quotes + short prose (weekly/monthly) is cheap at "low"; the longer
  // multi-month synthesis (quarterly/yearly) gets "medium". Token-efficiency lever.
  effort: 'none' | 'low' | 'medium' | 'high' = 'low',
  // Nano models default to a small output window; callers can override.
  maxTokens = 2048,
): Promise<T> {
  // Heavier reasoning models (gpt-5.4/5.5) spend output budget on hidden reasoning
  // tokens and need far more headroom than nano. OPENAI_MAX_TOKENS lets you raise
  // the ceiling globally when running a bigger model (and for A/B testing).
  const cap = process.env.OPENAI_MAX_TOKENS ? Number(process.env.OPENAI_MAX_TOKENS) : maxTokens
  const baseParams: ChatParams = {
    model: resolveModelId(env.model()),
    // This model family only accepts the default temperature (1); grounding is
    // enforced in code (verbatim validation), so sampling temp doesn't matter.
    reasoning_effort: effort,
    max_completion_tokens: cap,
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict: true, schema },
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ],
    ...gatewayBody(),
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const params: ChatParams = {
      ...baseParams,
      // Reasoning models can exhaust the budget on hidden tokens; retry with headroom.
      max_completion_tokens: attempt === 0 ? cap : cap * 2,
    }
    const completion = await openai().chat.completions.create(params)
    logUsage(name, params.model, attempt, completion.usage)
    const choice = completion.choices[0]
    const msg = choice?.message
    const finish = choice?.finish_reason

    // Newer SDK versions expose a pre-parsed object for json_schema responses.
    const maybeParsed = (msg as unknown as Record<string, unknown> | undefined)?.parsed
    if (maybeParsed !== null && maybeParsed !== undefined) {
      return maybeParsed as T
    }

    const raw = msg?.content
    console.error(`[callModel:${name}] attempt=${attempt} finish=${finish} content_len=${raw?.length ?? 'null'} refusal=${msg?.refusal ?? 'none'}`)
    if (raw) {
      // Strip markdown code-block wrapping that some models add despite json_schema.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      // Counts + a short hash only — never journal-derived output (§8).
      console.error(
        `[callModel:${name}] parse_preview len=${cleaned.length} finish=${finish} hash=${contentFingerprint(cleaned)}`,
      )
      try {
        return JSON.parse(cleaned) as T
      } catch (e) {
        console.error(`[callModel:${name}] JSON.parse failed: ${e}`)
      }
    }

    // Truncated output (nano often reports content_filter when the budget runs out).
    if (finish === 'length' || finish === 'content_filter') continue
  }
  throw new Error('Model returned malformed output after retry')
}
