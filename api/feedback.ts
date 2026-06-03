import { getAuthedUser, notAuthenticated } from './_lib/userAuth'
import { preflight, withCors } from './_lib/cors'
import { env } from './_lib/env'

const REPO = 'phillipchan1/dayspring'

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 405 })
}

export async function POST(req: Request): Promise<Response> {
  const flight = preflight(req)
  if (flight) return flight

  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let body: { message?: string; type?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return withCors(req, Response.json({ error: 'invalid JSON body' }, { status: 400 }))
  }

  const { message, type = 'general' } = body
  if (!message || typeof message !== 'string' || !message.trim()) {
    return withCors(req, Response.json({ error: 'message is required' }, { status: 400 }))
  }

  const trimmed = message.trim()
  const preview = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed
  const issueBody = [
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
      title: `[Beta Feedback] ${preview}`,
      body: issueBody,
      labels: ['beta-feedback'],
    }),
  })

  if (!res.ok) {
    console.error('GitHub issue creation failed:', await res.text())
    return withCors(req, Response.json({ error: 'failed to submit feedback' }, { status: 500 }))
  }

  const issue = (await res.json()) as { number: number }
  return withCors(req, Response.json({ ok: true, issue: issue.number }))
}
