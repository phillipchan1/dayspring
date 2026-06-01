#!/usr/bin/env node
// Turn raw git commit subjects into a short, human-readable changelog.
//
// Reads commit lines from stdin (one "- subject" per line), asks the configured
// OpenAI model to rewrite them as friendly, user-facing release notes, and
// prints Markdown to stdout. This is BEST-EFFORT: on any problem (no API key,
// API error, empty input/output) it falls back to printing a lightly-cleaned
// version of the raw commit list, so the desktop release pipeline never fails
// over release notes. Used by .github/workflows/release.yml.

import process from 'node:process'

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-nano'
const KEY = process.env.OPENAI_API_KEY

async function readStdin(stream) {
  let data = ''
  for await (const chunk of stream) data += chunk
  return data
}

const raw = (await readStdin(process.stdin)).trim()

// Strip conventional-commit prefixes so even the fallback reads a bit friendlier.
function fallback() {
  const cleaned = raw
    .split('\n')
    .map((l) =>
      l.replace(/^-\s*(?:feat|fix|chore|docs|refactor|perf|test|build|ci|style)(\([^)]*\))?:\s*/i, '- '),
    )
    .join('\n')
  process.stdout.write(cleaned || '✨ A little polish and a few behind-the-scenes fixes.')
}

if (!raw || !KEY) {
  fallback()
  process.exit(0)
}

const system = `You write release notes for "Dayspring", a quiet daily journaling app.
Voice: warm, friendly, and a little playful — like a thoughtful friend telling you what's new, never corporate.
Rewrite the raw git commit messages below into a short changelog for end users.
Rules:
- A SINGLE FLAT LIST of bullets. No headings, no sections, no grouping of any kind. Each bullet starts with "- ".
- One short, friendly bullet per user-visible change, in plain language. No jargon, no commit prefixes (feat:/fix:), no file names, no SHAs.
- For a notable/major new feature, lead that bullet with a fitting emoji and celebrate a little (e.g. "🎉", "✨"). Keep small fixes calm and emoji-free.
- Silently drop internal-only commits (refactors, CI, build tooling, dependency bumps, version bumps) unless they clearly affect users.
- Keep it tight — at most ~5 bullets.
- The notes are shown as plain text, so output plain text bullets only (no Markdown headings, bold, or links).
- If nothing is user-facing, output exactly one friendly line: "✨ A little polish and a few behind-the-scenes fixes."
- No title, no preamble, no closing remarks — just the bullets.`

try {
  const body = {
    model: MODEL,
    max_completion_tokens: 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: raw },
    ],
  }
  // gpt-5/o-series/nano are reasoning models: cap hidden reasoning so the token
  // budget goes to the actual notes (matches api/_lib/openai.ts conventions).
  if (/nano|gpt-5|^o\d/i.test(MODEL)) body.reasoning_effort = 'low'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('empty completion')
  process.stdout.write(text)
} catch (err) {
  process.stderr.write(`[release-notes] falling back to raw commits: ${err}\n`)
  fallback()
}
