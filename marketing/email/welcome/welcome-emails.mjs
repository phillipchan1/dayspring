#!/usr/bin/env node
/**
 * THE WELCOME SERIES — the single source for every word and picture in it.
 *
 *   node marketing/email/welcome/welcome-emails.mjs     # rebuild templates/
 *   npm run email:welcome                               # same thing
 *
 * Renders one Resend Template per email into ./templates/ (<key>.html + .txt)
 * and ./templates/manifest.json (name, subject, preview, variables, send rule).
 * The generated files are committed so they can be pasted or uploaded into
 * Resend as-is; scripts/welcome-emails.test.ts fails if they drift from this file.
 *
 * Resend's rules this obeys (checked by the test, not trusted):
 *   • Variables are triple-brace: {{{NAME}}}. Fallbacks are NOT inline — a
 *     Template declares each variable with its own fallback_value, so the
 *     manifest carries them.
 *   • FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL, contact and this are
 *     reserved in Templates. The greeting is {{{NAME}}}, mapped to the
 *     contact's first name by the Automation step (docs/WELCOME_EMAILS.md).
 *   • {{{RESEND_UNSUBSCRIBE_URL}}} is never added for us in an Automation; it
 *     must be in the Template itself.
 *   • Subjects stay plain text — no variables in them.
 *
 * Copy rules (docs/product/BRANDSCRIPT.md, PRINCIPLES.md #2): teach one thing
 * per email, never mention how much someone has written, never quote their
 * journal, no journey / unlock / streak / insights / AI-powered.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const ASSET_BASE = 'https://www.usedayspring.app/email/welcome/'
export const APP_URL = 'https://dayspring-eosin.vercel.app'
export const MAC_DOWNLOAD =
  'https://github.com/phillipchan1/dayspring-releases/releases/latest/download/Dayspring-aarch64.dmg'
export const UNSUBSCRIBE = '{{{RESEND_UNSUBSCRIBE_URL}}}'

/** The one custom variable. Resend reserves FIRST_NAME inside Templates. */
export const VARIABLES = [{ key: 'NAME', type: 'string', fallback_value: 'there' }]

const appLink = (campaign) =>
  `${APP_URL}/?utm_source=email&utm_medium=welcome&utm_campaign=${campaign}`

/**
 * Block grammar — deliberately tiny, so the HTML stays email-safe:
 *   ['p', text]              inline **bold**, *italic*, `key`
 *   ['list', [text, …]]
 *   ['find', text]           the small italic "where to find it" line
 *   ['img', {src, alt}]      full-bleed 600px still
 *   ['gif', {src, alt}]      inset 560px, rounded, for a screen recording
 *   ['pair', [img, img]]     side by side; stacks under 620px
 *   ['cta', {label, href, also?: {label, href}}]
 *   ['sign']
 */
export const EMAILS = [
  {
    key: 'welcome',
    name: 'Welcome series · 1 · Welcome',
    day: 0,
    sendTo: 'everyone',
    subject: 'Welcome to Dayspring',
    preview: 'One honest line is enough to begin.',
    blocks: [
      ['p', 'Welcome to Dayspring. We’re glad you’re here.'],
      ['p', 'You don’t need a system to begin. Open a page and write one honest line: what’s on your mind, what you’re carrying, what you’re thankful for. It saves as you go.'],
      ['img', { src: 'page.jpg', alt: 'The Dayspring app on a quiet first page, with the sidebar down its left edge' }],
      ['p', 'Over the next two weeks we’ll send a handful of short notes, one thing at a time, so you can find your way around without reading a manual.'],
      ['p', 'Dayspring works in your browser and as a Mac app, and both open the same journal.'],
      ['cta', { label: 'Open Dayspring →', href: appLink('welcome'), also: { label: 'download the Mac app', href: MAC_DOWNLOAD } }],
      ['p', 'If anything is confusing, or you can’t find something, just reply to this email. A real person reads every one.'],
      ['sign'],
    ],
  },
  {
    key: 'slash',
    name: 'Welcome series · 2 · Type /',
    day: 1,
    sendTo: 'everyone',
    subject: 'The one key worth knowing',
    preview: 'Type / on any line for a verse, a prayer, a highlight or a heading.',
    blocks: [
      ['p', 'If you learn one thing in Dayspring, make it this: type `/` on any line.'],
      ['gif', { src: 'slash.gif', alt: 'Typing / opens a menu of formatting and capture; typing pray narrows it to Prayer, and the prayer lands on the page' }],
      ['p', 'A menu opens with everything a page can hold. On one side is formatting: headings, bold, a highlighter. On the other are the things a journal for the Christian life needs:'],
      ['list', [
        '**Scripture:** find a passage and set it on the page',
        '**Prayer:** write it down so you can find it again',
        '**Sense:** a word or impression you don’t want to lose',
      ]],
      ['p', 'Keep typing to narrow it (`/pray`, `/scripture`, `/highlight`), then press Enter.'],
      ['p', 'Prefer the mouse? The **+** beside any line opens the same menu.'],
      ['p', 'Whatever you add this way is kept together, which is what lets Dayspring gather your prayers and verses later on. More about that next week.'],
      ['cta', { label: 'Write a page →', href: appLink('slash') }],
      ['sign'],
    ],
  },
  ...['journal', 'journal-import'].map((key) => ({
    key,
    name: key === 'journal' ? 'Welcome series · 3 · Journal' : 'Welcome series · 3 · Journal (with import)',
    day: 3,
    sendTo:
      key === 'journal'
        ? 'people who have already imported (contact.properties.imported = "yes")'
        : 'everyone else — the default branch',
    subject: 'Everything you’ve written, and a way back to it',
    preview: 'Every entry laid out as a page, and a way to find the one you’re thinking of.',
    blocks: [
      ['p', 'Most of what we write, we never read again. That isn’t because it didn’t matter. There was just no way back in.'],
      ['p', 'In Dayspring, **Journal** is that way back in. Every entry is laid out as a page, newest first. Step back to see months at a glance, or open any page to read it.'],
      ['img', { src: 'journal.gif', alt: 'Look for: typing Dad, and every page dims except the four that mention him' }],
      ['p', 'The part worth knowing is **Look for**. Type a name or a word you carry, like *Dad*, *work* or *Psalm 23*, and only the pages that mention it stay lit. Choose **prayer** and you’ll see every page where you prayed.'],
      ['p', 'On the Mac, `⌘K` finds any word from anywhere in the app.'],
      ['find', 'Find it: Journal, in the sidebar (⌘2).'],
      ...(key === 'journal-import'
        ? [
            ['p', '**Kept a journal somewhere else?** Bring it with you. Dayspring imports Day One and Diarly exports in about a minute. Your original dates are kept, and every Scripture reference you ever wrote is found along the way. Open **Settings → Import & backup**.'],
          ]
        : []),
      ['cta', { label: 'Open your Journal →', href: appLink('journal') }],
      ['sign'],
    ],
  })),
  {
    key: 'rituals',
    name: 'Welcome series · 4 · Rituals',
    day: 5,
    sendTo: 'people who have not walked a ritual (skip if contact.properties.walked_ritual = "yes")',
    subject: 'When you don’t know where to begin',
    preview: 'The Examen, Lectio Divina and other old forms of prayer, one question at a time.',
    blocks: [
      ['p', 'Some days the blank page is the hardest part.'],
      ['p', 'For those days there are **rituals**: old forms of prayer the church has used for centuries, like the Examen and Lectio Divina. Each is laid out one quiet question at a time. Answer as much or as little as you like, and it becomes its own page in your journal.'],
      ['img', { src: 'rituals.jpg', alt: 'The ritual library: The Morning Offering and New Every Morning, each with its tradition and first line' }],
      ['p', 'To begin one, open a blank page and look at the foot of it, or type `/ritual`.'],
      ['p', 'If you’ve never tried one, start with *New Every Morning*. It’s three short questions and takes about three minutes.'],
      ['cta', { label: 'Try a ritual →', href: appLink('rituals') }],
      ['sign'],
    ],
  },
  {
    key: 'told-back',
    name: 'Welcome series · 5 · Told back',
    day: 9,
    sendTo: 'everyone',
    subject: 'What you’ve written, told back to you',
    preview: 'Your own words, gathered in three places. Nothing is invented.',
    blocks: [
      ['p', 'Write for a while and patterns start to show that you’d never notice one page at a time. Dayspring gathers them in three places, and all of it is in your own words.'],
      ['img', { src: 'ascent.jpg', alt: 'The Ascent: a thread called Tom and the elders, told back line by line from January to September' }],
      ['p', '**The Ascent.** Your week, month, season and year, told back from what you actually wrote: what kept coming back and what went quiet. Every line is quoted exactly. If you didn’t write it, it isn’t there.'],
      ['pair', [
        { src: 'lamp.jpg', alt: 'The Lamp: the books of the Bible, lit where you’ve written about them' },
        { src: 'altar.jpg', alt: 'The Altar: prayers gathered around the names you keep bringing to God' },
      ]],
      ['p', '**The Lamp.** Every passage of Scripture you’ve written about, laid across the whole Bible, so you can see where your heart has been leaning.'],
      ['p', '**The Altar.** Your prayers, gathered by the people and things you keep bringing to God.'],
      ['p', 'All three fill in as you write, so if they look quiet right now, that’s expected. They’re made for the long view.'],
      ['find', 'Find them: Ascent, Lamp and Altar in the sidebar (⌘3, ⌘4, ⌘5).'],
      ['cta', { label: 'See your Ascent →', href: appLink('told-back') }],
      ['sign'],
    ],
  },
  {
    key: 'trial',
    name: 'Welcome series · 6 · Trial ends',
    day: 13,
    sendTo: 'only people still on the trial (contact.properties.plan = "trialing")',
    // "Tomorrow" is exact: the Automation sends this 13 days after the signup
    // event and the trial is 14 days from the same moment. No date variable, so
    // nothing in the subject can render wrong.
    subject: 'Your Dayspring trial ends tomorrow',
    preview: 'Nothing happens automatically. Here’s what to expect.',
    blocks: [
      ['p', 'A quick note: your Dayspring trial ends tomorrow.'],
      ['p', 'We never asked for a card, so nothing will be charged. When the trial ends, Dayspring will ask whether you’d like to subscribe:'],
      ['list', ['**$7 a month**, or', '**$64 a year**, about $5.33 a month']],
      ['p', 'Either way, every word you’ve written stays saved, and you can export all of it anytime, whether you subscribe or not.'],
      ['p', 'If Dayspring has been good for your writing, we’d love for you to stay. If it hasn’t, we’d honestly like to know why. Just reply.'],
      ['cta', { label: 'Keep writing →', href: appLink('trial') }],
      ['sign'],
    ],
  },
]

// ── Rendering ────────────────────────────────────────────────────────────────

const INK = '#2b2520'
const MUTED = '#6f655a'
const RUST = '#b8612f'
const SERIF = "Georgia,'Times New Roman',serif"

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** **bold**, *italic*, `key` → inline-styled HTML. Escapes first. */
function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(
      /`(.+?)`/g,
      '<span style="font-family:Menlo,Consolas,monospace;font-size:14px;background:#efe6d8;border-radius:4px;padding:1px 6px;">$1</span>',
    )
}

function plain(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1')
}

const P = `margin:0 0 16px;font-size:17px;line-height:1.6;color:${INK};`
const TEXT_TD = `padding:0 36px;font-family:${SERIF};`

function img(src, alt, width) {
  return `<img src="${ASSET_BASE}${src}" width="${width}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;">`
}

function blockHtml([type, arg]) {
  switch (type) {
    case 'p':
      return `<tr><td class="px" style="${TEXT_TD}"><p style="${P}">${inline(arg)}</p></td></tr>`
    case 'find':
      return `<tr><td class="px" style="${TEXT_TD}"><p style="margin:0 0 20px;font-size:14px;line-height:1.5;font-style:italic;color:${MUTED};">${inline(arg)}</p></td></tr>`
    case 'list':
      return `<tr><td class="px" style="${TEXT_TD}"><ul style="margin:0 0 16px;padding:0 0 0 22px;">${arg
        .map((li) => `<li style="margin:0 0 6px;font-size:17px;line-height:1.55;color:${INK};">${inline(li)}</li>`)
        .join('')}</ul></td></tr>`
    case 'img':
      return `<tr><td style="padding:10px 0 26px;">${img(arg.src, arg.alt, 600)}</td></tr>`
    case 'gif':
      return `<tr><td class="px" style="padding:6px 20px 24px;"><div style="border:1px solid #eadfcd;border-radius:10px;overflow:hidden;">${img(arg.src, arg.alt, 560)}</div></td></tr>`
    case 'pair':
      return `<tr><td style="padding:0 0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${arg
        .map((i) => `<td class="stack" width="50%" valign="top" style="width:50%;">${img(i.src, i.alt, 300)}</td>`)
        .join('')}</tr></table></td></tr>`
    case 'cta': {
      // The secondary link gets its own line: a second table cell beside the
      // button can't be made to wrap reliably across mail clients.
      const also = arg.also
        ? `<p style="margin:14px 0 0;font-family:${SERIF};font-size:15px;line-height:1.5;color:${MUTED};">or <a href="${esc(arg.also.href)}" style="color:${RUST};">${esc(arg.also.label)}</a></p>`
        : ''
      return `<tr><td class="px" style="${TEXT_TD}padding-top:6px;padding-bottom:22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${RUST};border-radius:999px;"><a href="${esc(arg.href)}" style="display:inline-block;padding:13px 26px;font-family:${SERIF};font-size:16px;color:#fffaf2;text-decoration:none;white-space:nowrap;">${esc(arg.label)}</a></td></tr></table>${also}</td></tr>`
    }
    case 'sign':
      return `<tr><td class="px" style="${TEXT_TD}padding-bottom:30px;"><p style="margin:0;font-size:17px;line-height:1.6;color:${INK};">The Dayspring team</p></td></tr>`
    default:
      throw new Error(`Unknown block type "${type}"`)
  }
}

function blockText([type, arg]) {
  switch (type) {
    case 'p':
    case 'find':
      return plain(arg)
    case 'list':
      return arg.map((li) => `- ${plain(li)}`).join('\n')
    case 'img':
    case 'gif':
    case 'pair':
      return null
    case 'cta':
      return [`${arg.label.replace(/ →$/, '')}: ${arg.href}`, arg.also && `Or ${arg.also.label}: ${arg.also.href}`]
        .filter(Boolean)
        .join('\n')
    case 'sign':
      return 'The Dayspring team'
    default:
      throw new Error(`Unknown block type "${type}"`)
  }
}

export function renderHtml(email) {
  // Zero-width padding after the preview text so the inbox preview doesn't run
  // on into the body copy.
  const pad = '&#8199;&#65279;&#847; '.repeat(40)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(email.subject)}</title>
<style>
@media (max-width:620px){
  .px{padding-left:20px !important;padding-right:20px !important;}
  .stack{display:block !important;width:100% !important;}
  .stack img{max-width:100% !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:#f4eee4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(email.preview)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4eee4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fbf6ee;border-radius:14px;overflow:hidden;">
<tr><td class="px" style="${TEXT_TD}padding-top:32px;"><p style="${P}">Hi {{{NAME}}},</p></td></tr>
${email.blocks.map(blockHtml).join('\n')}
<tr><td class="px" style="padding:18px 36px 26px;border-top:1px solid #ece3d6;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a7f72;">You’re getting this because you started a Dayspring account. <a href="${UNSUBSCRIBE}" style="color:#8a7f72;">Stop these emails</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`
}

export function renderText(email) {
  const body = email.blocks.map(blockText).filter(Boolean).join('\n\n')
  return `Hi {{{NAME}}},\n\n${body}\n\n--\nYou're getting this because you started a Dayspring account.\nStop these emails: ${UNSUBSCRIBE}\n`
}

export function manifest() {
  return EMAILS.map((e) => ({
    key: e.key,
    name: e.name,
    day: e.day,
    sendTo: e.sendTo,
    subject: e.subject,
    preview: e.preview,
    html: `${e.key}.html`,
    text: `${e.key}.txt`,
    variables: VARIABLES,
  }))
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const TEMPLATES_DIR = path.join(HERE, 'templates')

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(TEMPLATES_DIR, { recursive: true })
  for (const email of EMAILS) {
    await writeFile(path.join(TEMPLATES_DIR, `${email.key}.html`), renderHtml(email))
    await writeFile(path.join(TEMPLATES_DIR, `${email.key}.txt`), renderText(email))
  }
  await writeFile(path.join(TEMPLATES_DIR, 'manifest.json'), `${JSON.stringify(manifest(), null, 2)}\n`)
  console.log(`Wrote ${EMAILS.length} templates to ${path.relative(process.cwd(), TEMPLATES_DIR)}/`)
}
