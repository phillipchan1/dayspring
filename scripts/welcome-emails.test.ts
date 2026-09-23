// marketing/email/welcome/ — guards the welcome series against the ways a Resend Template fails quietly:
// a variable Resend won't fill, a reserved name, a missing unsubscribe link, an
// image that 404s in the inbox, or templates/ drifting from the source.

import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  APP_URL,
  ASSET_BASE,
  EMAILS,
  MAC_DOWNLOAD,
  OPEN_APP,
  TEMPLATES_DIR,
  VARIABLES,
  manifest,
  renderHtml,
  renderText,
} from '../marketing/email/welcome/welcome-emails.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SYSTEM = new Set(['RESEND_UNSUBSCRIBE_URL'])
const RESERVED = ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'UNSUBSCRIBE_URL', 'contact', 'this']
const DECLARED = new Set(VARIABLES.map((v) => v.key))
// docs/product/BRANDSCRIPT.md — words we never use.
const BANNED = /\b(journey|unlock|unleash|supercharge|AI-powered|insights|optimi[sz]e|streaks?|scores?|mindfulness|wellness|hack)\b/i

const rendered = EMAILS.map((e) => ({ email: e, html: renderHtml(e), text: renderText(e) }))

describe('welcome series templates', () => {
  it('uses only triple-brace variables that are declared or Resend-provided', () => {
    for (const { email, html, text } of rendered) {
      for (const body of [html, text]) {
        const tokens = [...body.matchAll(/\{\{\{\s*([^}]*?)\s*\}\}\}/g)].map((m) => m[1])
        for (const t of tokens) {
          expect(t, `${email.key}: inline fallbacks are Broadcast-only syntax`).not.toContain('|')
          expect(DECLARED.has(t) || SYSTEM.has(t), `${email.key}: undeclared variable ${t}`).toBe(true)
        }
        // A double-brace token would be a second, escaped mustache form; keep one.
        const stripped = body.replace(/\{\{\{[^}]*\}\}\}/g, '')
        expect(stripped, `${email.key}: stray braces`).not.toMatch(/\{\{|\}\}/)
      }
    }
  })

  it('declares no Resend-reserved variable names and gives every variable a fallback', () => {
    for (const v of VARIABLES) {
      expect(RESERVED).not.toContain(v.key)
      expect(v.key).toMatch(/^[A-Z][A-Z0-9_]*$/)
      expect(v.fallback_value, `${v.key} needs a fallback`).toBeTruthy()
    }
  })

  it('puts the unsubscribe link in every template, HTML and text', () => {
    for (const { email, html, text } of rendered) {
      expect(html, email.key).toContain('href="{{{RESEND_UNSUBSCRIBE_URL}}}"')
      expect(text, email.key).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
    }
  })

  it('keeps subjects and previews plain', () => {
    for (const e of EMAILS) {
      expect(e.subject).not.toMatch(/\{|\}/)
      expect(e.preview).not.toMatch(/\{|\}/)
      expect(e.subject.length).toBeLessThanOrEqual(60)
    }
  })

  it('stays inside the brand vocabulary', () => {
    for (const { email, text } of rendered) {
      expect(`${email.subject} ${email.preview} ${text}`, email.key).not.toMatch(BANNED)
    }
  })

  it('points every image at a file the marketing site actually serves', async () => {
    for (const { email, html } of rendered) {
      for (const [, src] of html.matchAll(/<img src="([^"]+)"/g)) {
        expect(src.startsWith(ASSET_BASE), `${email.key}: ${src}`).toBe(true)
        const file = path.join(ROOT, 'site/public/email/welcome', src.slice(ASSET_BASE.length))
        await expect(access(file), `${email.key}: missing ${file}`).resolves.toBeUndefined()
      }
      expect(html, `${email.key}: every image needs alt text`).not.toMatch(/alt=""/)
    }
  })

  it('opens the installed app on Days 0–9 and leaves the trial on the web URL', () => {
    for (const { email, html, text } of rendered) {
      if (email.key === 'trial') {
        expect(html, email.key).toContain(
          `href="${APP_URL}/?utm_source=email&amp;utm_medium=welcome&amp;utm_campaign=trial"`,
        )
        expect(text, email.key).toContain(
          `${APP_URL}/?utm_source=email&utm_medium=welcome&utm_campaign=trial`,
        )
        expect(html, email.key).not.toContain(OPEN_APP)
        expect(text, email.key).not.toContain(OPEN_APP)
        expect(html, email.key).not.toContain('Don’t have the app?')
        continue
      }
      expect(html, email.key).toContain(`href="${OPEN_APP}"`)
      expect(text, email.key).toContain(OPEN_APP)
      expect(html, email.key).not.toContain(APP_URL)
      expect(text, email.key).not.toContain(APP_URL)
      expect(html, email.key).toContain(`Don’t have the app? <a href="${MAC_DOWNLOAD}"`)
      expect(html, email.key).toContain('>Download for Mac</a>')
      expect(text, email.key).toContain(`Don’t have the app? Download for Mac: ${MAC_DOWNLOAD}`)
    }
  })

  it('describes Dayspring as a Mac and iPhone app, not a browser product', () => {
    const welcome = rendered.find(({ email }) => email.key === 'welcome')
    expect(welcome.text).toContain('Dayspring is a Mac and iPhone app — open it to pick up where you left off.')
    expect(welcome.text).not.toMatch(/browser/i)
    expect(welcome.html).not.toMatch(/browser/i)
  })

  it('has committed templates/ that match the source (run npm run email:welcome)', async () => {
    for (const { email, html, text } of rendered) {
      expect(await readFile(path.join(TEMPLATES_DIR, `${email.key}.html`), 'utf8')).toBe(html)
      expect(await readFile(path.join(TEMPLATES_DIR, `${email.key}.txt`), 'utf8')).toBe(text)
    }
    const onDisk = JSON.parse(await readFile(path.join(TEMPLATES_DIR, 'manifest.json'), 'utf8'))
    expect(onDisk).toEqual(manifest())
  })
})
