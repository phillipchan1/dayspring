import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { preflight, withCors } from './_lib/cors.js'
import { env } from './_lib/env.js'

const REPO = 'phillipchan1/dayspring'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 405 })
}

export async function POST(req: Request): Promise<Response> {
  const flight = preflight(req)
  if (flight) return flight

  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let body: { message?: string; type?: string; metadata?: Record<string, unknown> }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const { message, type = 'general', metadata } = body
  if (!message || typeof message !== 'string' || !message.trim()) {
    return withCors(req, Response.json({ error: 'message is required' }, { status: 400 }))
  }

  const trimmed = message.trim()
  const isCrash = type === 'crash'

  // Build the issue title and body differently for crash reports vs. feedback.
  const preview = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed
  const issueTitle = isCrash ? `[Crash] ${preview}` : `[Beta Feedback] ${preview}`
  const issueLabels = isCrash ? ['crash-report'] : ['beta-feedback']

  const issueBody = isCrash
    ? formatCrashIssue(user.email ?? 'unknown', trimmed, metadata)
    : [
        `**From:** ${user.email ?? 'unknown'}`,
        `**Type:** ${type}`,
        `**Date:** ${new Date().toISOString()}`,
        '',
        '---',
        '',
        trimmed,
      ].join('\n')

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.githubToken()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody,
      labels: issueLabels,
    }),
  })

  if (!res.ok) {
    console.error('GitHub issue creation failed:', await res.text())
    return withCors(req, Response.json({ error: 'failed to submit feedback' }, { status: 500 }))
  }

  const issue = (await res.json()) as { number: number }
  return withCors(req, Response.json({ ok: true, issue: issue.number }))
}

// ---------------------------------------------------------------------------
// Crash report → GitHub Issue formatter
// ---------------------------------------------------------------------------

interface CrashMeta {
  error?: string
  componentStack?: string
  surface?: string
  breadcrumbs?: { category: string; label: string; ts: string }[]
  url?: string
  userAgent?: string
  platform?: string
  timestamp?: string
}

function formatCrashIssue(
  email: string,
  message: string,
  raw: Record<string, unknown> | undefined,
): string {
  const m = (raw ?? {}) as CrashMeta
  const lines: string[] = []

  lines.push(`**Error:** \`${m.error ?? message}\``)
  lines.push(`**Surface:** ${m.surface ?? 'unknown'}`)
  lines.push(`**Platform:** ${m.platform ?? 'unknown'}`)
  lines.push(`**User:** ${email}`)
  lines.push(`**Time:** ${m.timestamp ?? new Date().toISOString()}`)
  if (m.url) lines.push(`**URL:** ${m.url}`)
  if (m.userAgent) lines.push(`**UA:** ${m.userAgent}`)

  // Breadcrumbs — the last ~20 user actions before the crash.
  if (m.breadcrumbs?.length) {
    lines.push('')
    lines.push('### Breadcrumbs (recent → oldest)')
    lines.push('')
    for (const b of [...m.breadcrumbs].reverse()) {
      const t = b.ts.split('T')[1]?.slice(0, 8) ?? b.ts
      lines.push(`- \`${t}\` **${b.category}** — ${b.label}`)
    }
  }

  // Component stack — the React tree at the point of failure.
  if (m.componentStack) {
    lines.push('')
    lines.push('<details><summary>Component stack</summary>')
    lines.push('')
    lines.push('```')
    lines.push(m.componentStack.trim())
    lines.push('```')
    lines.push('</details>')
  }

  return lines.join('\n')
}
