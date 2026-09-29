/** Shared canned TypeSafe fetch for network-free tests. */

export function systemOneResponse(
  answers: Record<string, unknown>,
  extra: { model?: string; input?: number; output?: number; status?: number } = {},
): Response {
  return new Response(
    JSON.stringify({
      model: extra.model ?? 'jev-1.13.0',
      answers,
      usage: { input_tokens: extra.input ?? 120, output_tokens: extra.output ?? 20 },
    }),
    { status: extra.status ?? 200, headers: { 'Content-Type': 'application/json' } },
  )
}

export function parseBody(init?: RequestInit): { questions: Record<string, { type: string }>; state: unknown } {
  const raw = typeof init?.body === 'string' ? init.body : '{}'
  return JSON.parse(raw) as { questions: Record<string, { type: string }>; state: unknown }
}

export function answersForQuestions(
  questions: Record<string, { type: string }>,
  pick: (id: string, type: string) => unknown,
): Record<string, unknown> {
  const answers: Record<string, unknown> = {}
  for (const [id, q] of Object.entries(questions)) {
    answers[id] = pick(id, q.type)
  }
  return answers
}

export function noulYes(n = 0.95): { type: 'noul'; noul: number } {
  return { type: 'noul', noul: n }
}

export function noulNo(n = 0.05): { type: 'noul'; noul: number } {
  return { type: 'noul', noul: n }
}

export function choiceOf(
  label: string,
  confidence = 0.9,
  extras: Record<string, number> = {},
): { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> } {
  return { type: 'choice', choice: label, confidence, probabilities: { [label]: confidence, ...extras } }
}

export function scoreOf(
  value: number,
  confidence = 0.85,
  probabilities?: Record<string, number>,
): {
  type: 'score'
  score: number
  confidence: number
  legend: Record<string, string>
  probabilities: Record<string, number>
} {
  return {
    type: 'score',
    score: value,
    confidence,
    legend: { '0': 'a', '1': 'b', '2': 'c' },
    probabilities: probabilities ?? { '0': 0.1, '1': 0.8, '2': 0.1 },
  }
}
