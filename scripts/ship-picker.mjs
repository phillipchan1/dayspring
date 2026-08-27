#!/usr/bin/env node
// A visual picker for "what's on master that beta users don't have yet".
//
// Two modes:
//
//   npm run ship            → builds .ship/picker.html and opens it. Tick the
//                             features you want in stable, copy the command it
//                             gives you back.
//   npm run ship -- --apply <token…>
//                           → cherry-picks that selection onto stable, oldest
//                             commit first, and stops on the first conflict.
//
// Why grouping: master runs ~90 commits ahead of stable, and a raw `git log`
// is unreadable as a shipping decision. Commits are clustered into FEATURES by
// the files they share, so "the Pages rebuild" reads as one card instead of
// twenty lines. The grouping is a heuristic — every card expands to its own
// commits, and individual commits can be ticked, so a bad guess is never a
// dead end.
//
// Nothing here pushes, and nothing here touches master.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import process from 'node:process'

const FROM = process.env.SHIP_FROM || 'stable'
const TO = process.env.SHIP_TO || 'master'
const OUT_DIR = '.ship'
const HTML = `${OUT_DIR}/picker.html`
const PLAN = `${OUT_DIR}/plan.json`

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

// Commits already in stable are matched by PATCH, not by sha — a cherry-picked
// fix has a different sha on each branch, and counting it as unshipped is how
// you end up cherry-picking something twice.
function alreadyShipped() {
  const out = git('cherry', FROM, TO)
  const equivalent = new Set()
  for (const line of out.split('\n')) {
    if (line.startsWith('- ')) equivalent.add(line.slice(2).trim())
  }
  return equivalent
}

const US = '\x1f' // field separator
const RS = '\x1e' // record separator

function collectCommits(shipped) {
  const raw = git(
    'log',
    '--reverse',
    '--no-merges',
    '--numstat',
    `--format=${RS}%H${US}%at${US}%an${US}%s${US}%b${US}`,
    `${FROM}..${TO}`,
  )
  const commits = []
  for (const record of raw.split(RS)) {
    if (!record.trim()) continue
    const [sha, at, author, subject, body, rest = ''] = record.split(US)
    if (shipped.has(sha)) continue
    const files = []
    let added = 0
    let removed = 0
    for (const line of rest.split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (!m) continue
      const [, a, r, path] = m
      added += a === '-' ? 0 : Number(a)
      removed += r === '-' ? 0 : Number(r)
      // A rename reads "old => new"; keep the destination path.
      files.push(path.includes(' => ') ? path.replace(/^.*\{?.*=> ?/, '').replace(/\}/g, '') : path)
    }
    commits.push({
      sha,
      short: sha.slice(0, 7),
      date: new Date(Number(at) * 1000).toISOString().slice(0, 10),
      ts: Number(at),
      author,
      subject: subject || '',
      body: (body || '').trim(),
      files,
      added,
      removed,
      order: commits.length,
    })
  }
  return commits
}

// Release plumbing the beta user will never see. Kept out of the cards, but
// counted, so the numbers still add up against `git log`.
const isNoise = (c) =>
  /^chore: sync version to /.test(c.subject) ||
  (c.files.length > 0 && c.files.every((f) => f === 'package.json' || f === 'package-lock.json'))

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

const CODE_RE = /^(src\/|api\/|scripts\/|supabase\/|src-tauri\/|\.github\/|public\/|index\.html)/

const scopeOf = (subject) => {
  const m = subject.match(/^(feat|fix|chore|docs|refactor|perf|test|build|ci|style)\(([^)]+)\):/i)
  return m ? m[2].toLowerCase() : null
}

const DAY = 86400

// Each commit gets ONE bucket key: its conventional scope if it has one,
// otherwise the area its files mostly live in. Deliberately not transitive —
// an earlier version chained commits through shared files and 53 of 65 ended up
// in a single group, because everything eventually touches JournalScreen.tsx.
function keyOf(commit) {
  const scope = scopeOf(commit.subject)
  if (scope) return SCOPE_LABELS[scope] || titleCase(scope)
  return areaOf(commit.files)
}

function group(commits) {
  // Files touched by lots of commits (JournalScreen.tsx, package.json) say
  // nothing about which feature a commit belongs to.
  const freq = new Map()
  for (const c of commits) for (const f of new Set(c.files)) freq.set(f, (freq.get(f) || 0) + 1)
  const hubCutoff = Math.max(4, Math.ceil(commits.length * 0.06))
  const distinctive = (c) => new Set(c.files.filter((f) => (freq.get(f) || 0) < hubCutoff))

  // 1. Bucket by key, then split a bucket wherever the work paused for a week —
  //    an August fix to the same area isn't part of a June feature.
  const byKey = new Map()
  for (const c of commits) {
    if (!byKey.has(keyOf(c))) byKey.set(keyOf(c), [])
    byKey.get(keyOf(c)).push(c)
  }
  let groups = []
  for (const bucket of byKey.values()) {
    let run = [bucket[0]]
    for (const c of bucket.slice(1)) {
      if (c.ts - run[run.length - 1].ts > 2 * DAY) {
        groups.push(run)
        run = []
      }
      run.push(c)
    }
    groups.push(run)
  }

  // 2. Rejoin groups that are plainly the same push of work: most of the smaller
  //    one's distinctive files are in the bigger one, and they happened together.
  //    High bar, and file-overlap only — this is what keeps a many-commit feature
  //    like the Pages rebuild from reading as five unrelated cards.
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const [a, b] = [groups[i], groups[j]]
        const span = Math.min(
          Math.abs(a[0].ts - b[b.length - 1].ts),
          Math.abs(b[0].ts - a[a.length - 1].ts),
        )
        if (span > 4 * DAY) continue
        const fa = new Set(a.flatMap((c) => [...distinctive(c)]))
        const fb = new Set(b.flatMap((c) => [...distinctive(c)]))
        if (!fa.size || !fb.size) continue
        const shared = [...fb].filter((f) => fa.has(f)).length
        if (shared / Math.min(fa.size, fb.size) < 0.5) continue
        groups[i] = [...a, ...b].sort((x, y) => x.order - y.order)
        groups.splice(j, 1)
        merged = true
        break outer
      }
    }
  }

  return groups.sort((a, b) => a[0].order - b[0].order)
}

// A conventional scope names the area better than the files do — feat(ios)
// touching api/ is still iOS work, not server work.
const SCOPE_LABELS = {
  ios: 'iOS',
  appstore: 'App Store',
  sync: 'Sync',
  billing: 'Billing',
  paywall: 'Billing',
  auth: 'Accounts',
  account: 'Accounts',
  onboarding: 'Onboarding',
  practices: 'Rituals',
  recognition: 'Import',
  images: 'Images',
  journal: 'Journal',
  scripture: 'Lamp',
  altar: 'Altar',
  build: 'Release pipeline',
  ci: 'Release pipeline',
  dnd: 'Editor',
}

const AREA_LABELS = {
  pages: 'Pages',
  journal: 'Journal',
  applock: 'App Lock',
  altar: 'Altar',
  ascent: 'Ascent',
  scripture: 'Lamp',
  settings: 'Settings',
  onboarding: 'Onboarding',
  paywall: 'Billing',
  account: 'Account',
  capture: 'Capture',
  find: 'Find',
  appstore: 'App Store',
  editor: 'Editor',
  practices: 'Rituals',
}

function areaOf(files) {
  const tally = new Map()
  const bump = (k, n = 1) => tally.set(k, (tally.get(k) || 0) + n)
  for (const f of files) {
    const feature = f.match(/^src\/features\/([^/]+)\//)
    if (feature) bump(AREA_LABELS[feature[1]] || titleCase(feature[1]))
    else if (f.startsWith('src/editor/')) bump('Editor')
    else if (f.startsWith('src-tauri/')) bump('Native app')
    else if (f.startsWith('api/')) bump('Server')
    else if (f.startsWith('supabase/')) bump('Database')
    else if (f.startsWith('.github/')) bump('Release pipeline')
    else if (f.startsWith('assets/appstore/')) bump('App Store')
    else if (f.startsWith('scripts/')) bump('Tooling')
    // Theme files outweigh the surfaces they happen to repaint.
    else if (f.startsWith('src/styles/')) bump('Look & feel', 1.5)
    else if (f.startsWith('docs/')) bump('Docs', 0.5)
    else if (/^src\/(lib|hooks|context)\//.test(f) || /^src\/(App|main)\./.test(f)) bump('Core', 0.5)
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : 'Other'
}

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// The card's headline. The commit that introduced the thing names it best
// ("Add Pages — a read surface for the archive"), so prefer the earliest feat;
// otherwise fall back to the biggest non-chore commit.
function headline(commits) {
  const strip = (s) =>
    s.replace(/^(feat|fix|chore|docs|refactor|perf|test|build|ci|style)(\([^)]*\))?:\s*/i, '')
  const introduces = commits.filter((c) => /^(feat\(|feat:|add\b)/i.test(c.subject))
  if (introduces.length) return strip(introduces[0].subject)
  const meaty = commits.filter((c) => !/^(chore|docs|test|build|ci)(\(|:)/i.test(c.subject))
  const pool = meaty.length ? meaty : commits
  return strip([...pool].sort((a, b) => b.added + b.removed - (a.added + a.removed))[0].subject)
}

function tagsFor(files) {
  const tags = []
  const has = (re) => files.some((f) => re.test(f))
  if (has(/^supabase\/migrations\//)) tags.push({ id: 'migration', label: 'DB migration' })
  if (has(/^src-tauri\//)) tags.push({ id: 'native', label: 'Native / rebuild' })
  if (has(/^api\//)) tags.push({ id: 'server', label: 'Server' })
  if (has(/^\.github\/workflows\//)) tags.push({ id: 'ci', label: 'CI' })
  if (has(/^src\/features\/flags\.tsx$/)) tags.push({ id: 'flag', label: 'Feature flag' })
  if (files.every((f) => /^(docs\/|assets\/|.*\.md$)/.test(f))) tags.push({ id: 'docs', label: 'Docs only' })
  if (has(/\.test\.(ts|tsx|sql)$/)) tags.push({ id: 'tests', label: 'Tested' })
  return tags
}

function slugify(text, taken) {
  let base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .split('-')
      .slice(0, 4)
      .join('-') || 'change'
  let slug = base
  let n = 2
  while (taken.has(slug)) slug = `${base}-${n++}`
  taken.add(slug)
  return slug
}

function buildPlan() {
  const shipped = alreadyShipped()
  const all = collectCommits(shipped)
  const noise = all.filter(isNoise)
  const commits = all.filter((c) => !isNoise(c))

  const taken = new Set()
  const groups = group(commits).map((cs) => {
    const files = [...new Set(cs.flatMap((c) => c.files))]
    const title = headline(cs)
    const keys = new Map()
    for (const c of cs) keys.set(keyOf(c), (keys.get(keyOf(c)) || 0) + 1)
    return {
      id: slugify(title, taken),
      title,
      area: [...keys.entries()].sort((a, b) => b[1] - a[1])[0][0],
      tags: tagsFor(files),
      files,
      added: cs.reduce((n, c) => n + c.added, 0),
      removed: cs.reduce((n, c) => n + c.removed, 0),
      first: cs[0].date,
      last: cs[cs.length - 1].date,
      order: cs[0].order,
      commits: cs.map(({ sha, short, subject, date, added, removed, files, body }) => ({
        sha,
        short,
        subject,
        date,
        added,
        removed,
        files,
        body,
      })),
    }
  })

  // Overlap = "these two edit the same files", which is where cherry-pick
  // conflicts come from. Lockfiles and product docs are excluded: everything
  // touches them, and flagging that made every card claim it needed every other.
  const IGNORE = /^(package(-lock)?\.json|src-tauri\/Cargo\.lock|docs\/|assets\/)/
  const freq = new Map()
  for (const c of commits) for (const f of new Set(c.files)) freq.set(f, (freq.get(f) || 0) + 1)
  const hubCutoff = Math.max(4, Math.ceil(commits.length * 0.06))
  for (const g of groups) {
    const mine = new Set(g.files.filter((f) => !IGNORE.test(f)))
    g.overlaps = groups
      .filter((o) => o.order < g.order)
      .map((o) => {
        const shared = o.files.filter((f) => !IGNORE.test(f) && mine.has(f))
        return { id: o.id, title: o.title, files: shared, n: shared.length }
      })
      // One shared file is meaningful only if it's a file few commits touch;
      // for the JournalScreen.tsx-style hubs, take three before it counts.
      .filter((o) => o.files.some((f) => (freq.get(f) || 0) < hubCutoff) || o.n >= 3)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map(({ id, title, files }) => ({ id, title, files: files.slice(0, 5) }))
  }

  return {
    from: FROM,
    to: TO,
    generated: new Date().toISOString(),
    fromHead: git('log', '-1', '--format=%h %s', FROM),
    fromDate: git('log', '-1', '--format=%ad', '--date=short', FROM),
    totalCommits: commits.length,
    noiseCount: noise.length,
    alreadyShipped: [...shipped].map((sha) => ({
      short: sha.slice(0, 7),
      subject: git('log', '-1', '--format=%s', sha),
    })),
    groups,
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function renderHtml(plan) {
  const data = JSON.stringify(plan).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ship to stable — Dayspring</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #faf7f2; --panel: #fffdfa; --ink: #211c15; --muted: #7a6f60;
    --line: #e6ddcf; --amber: #c4913c; --amber-soft: #f5e9d4;
    --warn: #9a5b2a; --warn-bg: #fbeee0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14110d; --panel: #1c1813; --ink: #ece4d7; --muted: #9a8e7c;
      --line: #2f2820; --amber: #d9a655; --amber-soft: #322619;
      --warn: #e0a86e; --warn-bg: #2e2113;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.5 ui-sans-serif, -apple-system, "SF Pro Text", system-ui, sans-serif;
    padding-bottom: 200px;
  }
  header { padding: 40px 28px 20px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.02em; }
  .sub { color: var(--muted); font-size: 14px; }
  .toolbar { max-width: 900px; margin: 0 auto; padding: 0 28px 14px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  button {
    font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer;
  }
  button:hover { border-color: var(--amber); }
  button.primary { background: var(--amber); border-color: var(--amber); color: #1b1408; font-weight: 600; }
  main { max-width: 900px; margin: 0 auto; padding: 0 28px; display: flex; flex-direction: column; gap: 10px; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; transition: border-color .15s, box-shadow .15s;
  }
  .card.on { border-color: var(--amber); box-shadow: 0 0 0 1px var(--amber) inset; }
  .row { display: flex; gap: 12px; align-items: flex-start; }
  input[type=checkbox] { width: 17px; height: 17px; margin-top: 3px; accent-color: var(--amber); cursor: pointer; flex: none; }
  .grow { flex: 1; min-width: 0; }
  .title { font-weight: 600; font-size: 15.5px; cursor: pointer; }
  .meta { color: var(--muted); font-size: 12.5px; margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .area {
    font-size: 11px; text-transform: uppercase; letter-spacing: .07em; font-weight: 700;
    color: var(--amber); background: var(--amber-soft); padding: 2px 7px; border-radius: 5px;
  }
  .tag { font-size: 11px; padding: 2px 7px; border-radius: 5px; border: 1px solid var(--line); color: var(--muted); }
  .tag.migration, .tag.native { color: var(--warn); background: var(--warn-bg); border-color: transparent; }
  .churn { font-variant-numeric: tabular-nums; }
  .warn {
    margin-top: 10px; font-size: 12.5px; color: var(--warn); background: var(--warn-bg);
    padding: 8px 10px; border-radius: 8px; display: none;
  }
  .card.needs .warn { display: block; }
  .warn button { margin-left: 8px; padding: 3px 9px; font-size: 12px; }
  .commits { display: none; margin: 12px 0 2px; border-top: 1px solid var(--line); padding-top: 10px; }
  .card.open .commits { display: block; }
  .commit { display: flex; gap: 10px; align-items: flex-start; padding: 5px 0; font-size: 13.5px; }
  .commit code { color: var(--muted); font: 12px ui-monospace, SFMono-Regular, monospace; padding-top: 2px; flex: none; }
  .files { color: var(--muted); font-size: 11.5px; font-family: ui-monospace, monospace; margin-top: 2px; word-break: break-all; }
  footer {
    position: fixed; bottom: 0; left: 0; right: 0; background: var(--panel);
    border-top: 1px solid var(--line); padding: 14px 28px;
  }
  .footwrap { max-width: 900px; margin: 0 auto; display: flex; gap: 14px; align-items: center; }
  .count { font-weight: 600; white-space: nowrap; }
  pre {
    flex: 1; margin: 0; overflow-x: auto; background: var(--bg); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px; font: 12.5px ui-monospace, SFMono-Regular, monospace;
  }
  details { max-width: 900px; margin: 22px auto 0; padding: 0 28px; color: var(--muted); font-size: 13px; }
  summary { cursor: pointer; }
</style>
</head>
<body>
<header>
  <h1>Ship to stable</h1>
  <div class="sub" id="sub"></div>
</header>
<div class="toolbar">
  <button onclick="setAll(true)">Select all</button>
  <button onclick="setAll(false)">Clear</button>
  <button onclick="selectTag('migration', false)">Skip DB migrations</button>
  <button onclick="selectTag('docs', false)">Skip docs-only</button>
  <button onclick="toggleAllOpen()">Expand / collapse</button>
</div>
<main id="cards"></main>
<details>
  <summary id="extras-summary"></summary>
  <div id="extras"></div>
</details>
<footer>
  <div class="footwrap">
    <div class="count" id="count">Nothing selected</div>
    <pre id="cmd">Tick a feature above</pre>
    <button class="primary" onclick="copyCmd()" id="copybtn">Copy</button>
  </div>
</footer>
<script>
const PLAN = ${data};
const picked = new Set();      // "sha" strings
const byId = new Map(PLAN.groups.map(g => [g.id, g]));

document.getElementById('sub').textContent =
  PLAN.totalCommits + ' commits waiting in ' + PLAN.groups.length + ' features · ' +
  PLAN.from + ' last moved ' + PLAN.fromDate + ' · ' + PLAN.noiseCount + ' version bumps hidden';

const cards = document.getElementById('cards');
for (const g of PLAN.groups) {
  const el = document.createElement('section');
  el.className = 'card';
  el.id = 'g-' + g.id;
  const dates = g.first === g.last ? g.first : g.first + ' → ' + g.last;
  el.innerHTML = \`
    <div class="row">
      <input type="checkbox" id="cb-\${g.id}">
      <div class="grow">
        <div class="title" data-toggle="\${g.id}">\${esc(g.title)}</div>
        <div class="meta">
          <span class="area">\${esc(g.area)}</span>
          \${g.tags.map(t => '<span class="tag ' + t.id + '">' + esc(t.label) + '</span>').join('')}
          <span>\${g.commits.length} commit\${g.commits.length > 1 ? 's' : ''}</span>
          <span class="churn">+\${g.added} −\${g.removed}</span>
          <span>\${dates}</span>
        </div>
        <div class="warn"></div>
        <div class="commits">\${g.commits.map(c => \`
          <div class="commit">
            <input type="checkbox" data-sha="\${c.sha}" data-group="\${g.id}">
            <code>\${c.short}</code>
            <div class="grow">
              <div>\${esc(c.subject)}</div>
              <div class="files">\${esc(c.files.slice(0, 5).join('  ·  '))}\${c.files.length > 5 ? '  ·  +' + (c.files.length - 5) + ' more' : ''}</div>
            </div>
          </div>\`).join('')}
        </div>
      </div>
    </div>\`;
  cards.appendChild(el);
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

cards.addEventListener('click', e => {
  const t = e.target.dataset.toggle;
  if (t) document.getElementById('g-' + t).classList.toggle('open');
});
cards.addEventListener('change', e => {
  const cb = e.target;
  if (cb.id?.startsWith('cb-')) {
    const g = byId.get(cb.id.slice(3));
    for (const c of g.commits) cb.checked ? picked.add(c.sha) : picked.delete(c.sha);
  } else if (cb.dataset.sha) {
    cb.checked ? picked.add(cb.dataset.sha) : picked.delete(cb.dataset.sha);
  }
  sync();
});

function sync() {
  for (const g of PLAN.groups) {
    const on = g.commits.filter(c => picked.has(c.sha));
    const el = document.getElementById('g-' + g.id);
    const cb = document.getElementById('cb-' + g.id);
    cb.checked = on.length === g.commits.length;
    cb.indeterminate = on.length > 0 && on.length < g.commits.length;
    el.classList.toggle('on', on.length > 0);
    for (const c of g.commits) {
      const b = el.querySelector('[data-sha="' + c.sha + '"]');
      if (b) b.checked = picked.has(c.sha);
    }
    // Warn when an earlier feature that touches the same files is being left behind.
    const missing = on.length
      ? g.overlaps.filter(o => !byId.get(o.id).commits.some(c => picked.has(c.sha)))
      : [];
    el.classList.toggle('needs', missing.length > 0);
    if (missing.length) {
      el.querySelector('.warn').innerHTML =
        'Touches the same files as ' +
        missing.map(m => '<b>' + esc(m.title) + '</b>').join(', ') +
        ' — cherry-picking without them may conflict.' +
        '<button onclick="addAll([' + missing.map(m => "'" + m.id + "'").join(',') + '])">Add them</button>';
    }
  }
  render();
}

function addAll(ids) {
  for (const id of ids) for (const c of byId.get(id).commits) picked.add(c.sha);
  sync();
}
function setAll(on) {
  picked.clear();
  if (on) for (const g of PLAN.groups) for (const c of g.commits) picked.add(c.sha);
  sync();
}
function selectTag(tag, on) {
  setAll(true);
  if (!on) for (const g of PLAN.groups) {
    if (g.tags.some(t => t.id === tag)) for (const c of g.commits) picked.delete(c.sha);
  }
  sync();
}
function toggleAllOpen() {
  const any = document.querySelector('.card.open');
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('open', !any));
}

function command() {
  const tokens = [];
  for (const g of PLAN.groups) {
    const on = g.commits.filter(c => picked.has(c.sha));
    if (!on.length) continue;
    tokens.push(on.length === g.commits.length ? g.id : g.id + ':' + on.map(c => c.short).join(','));
  }
  return tokens;
}

function render() {
  const n = picked.size;
  const tokens = command();
  document.getElementById('count').textContent =
    n ? n + ' commit' + (n > 1 ? 's' : '') + ' · ' + tokens.length + ' feature' + (tokens.length > 1 ? 's' : '') : 'Nothing selected';
  const cmd = document.getElementById('cmd');
  if (!n) { cmd.textContent = 'Tick a feature above'; return; }
  cmd.textContent = n === PLAN.totalCommits
    ? 'npm run ship -- --apply all'
    : 'npm run ship -- --apply ' + tokens.join(' ');
}

function copyCmd() {
  navigator.clipboard.writeText(document.getElementById('cmd').textContent).then(() => {
    const b = document.getElementById('copybtn');
    b.textContent = 'Copied';
    setTimeout(() => (b.textContent = 'Copy'), 1200);
  });
}

const extras = PLAN.alreadyShipped;
document.getElementById('extras-summary').textContent =
  extras.length + ' commits already in stable under a different sha (cherry-picked) — not listed above';
document.getElementById('extras').innerHTML =
  extras.map(c => '<div style="padding:3px 0"><code>' + c.short + '</code> ' + esc(c.subject) + '</div>').join('');

sync();
</script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function apply(tokens) {
  if (!existsSync(PLAN)) fail(`No ${PLAN}. Run \`npm run ship\` first.`)
  const plan = JSON.parse(readFileSync(PLAN, 'utf8'))
  const byId = new Map(plan.groups.map((g) => [g.id, g]))

  const wanted = new Set()
  const all = tokens.length === 1 && tokens[0] === 'all'
  if (all) {
    for (const g of plan.groups) for (const c of g.commits) wanted.add(c.sha)
  } else {
    for (const token of tokens) {
      const [id, subset] = token.split(':')
      const g = byId.get(id)
      if (!g) fail(`Unknown feature "${id}". Re-run \`npm run ship\` — the plan may be stale.`)
      const picks = subset ? subset.split(',') : null
      for (const c of g.commits) {
        if (!picks || picks.includes(c.short) || picks.includes(c.sha)) wanted.add(c.sha)
      }
    }
  }
  if (!wanted.size) fail('Nothing selected.')

  // Everything? A merge keeps history honest and skips 80 chances to conflict.
  const everything = wanted.size === plan.groups.reduce((n, g) => n + g.commits.length, 0)
  if (everything) {
    console.log(`\nThat's the whole branch — merge it instead of cherry-picking:\n`)
    console.log(`  git checkout ${plan.from} && git merge ${plan.to} && git push && git checkout ${plan.to}\n`)
    console.log('(A merge also carries the version bumps this picker hides.)\n')
    return
  }

  if (git('status', '--porcelain', '--untracked-files=no')) {
    fail('Working tree has uncommitted changes. Commit or stash them first.')
  }

  // Cherry-pick in the order the commits were written, never in click order —
  // git's own ordering, not the plan's, so a stale plan can't reorder history.
  const meta = new Map(
    plan.groups.flatMap((g) => g.commits.map((c) => [c.sha, { ...c, group: g.title }])),
  )
  const inOrder = git('rev-list', '--reverse', `${plan.from}..${plan.to}`)
    .split('\n')
    .filter((sha) => wanted.has(sha))
    .map((sha) => meta.get(sha))
    .filter(Boolean)

  const started = git('rev-parse', '--abbrev-ref', 'HEAD')
  const plural = inOrder.length === 1 ? 'commit' : 'commits'
  console.log(`\nCherry-picking ${inOrder.length} ${plural} onto ${plan.from}…\n`)
  execFileSync('git', ['checkout', plan.from], { stdio: 'pipe' })

  for (const [i, c] of inOrder.entries()) {
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${inOrder.length}  ${c.short}  ${c.subject.slice(0, 62)}`)
    try {
      execFileSync('git', ['cherry-pick', '-x', c.sha], { stdio: 'pipe' })
      console.log('  ✓')
    } catch (err) {
      console.log('  ✗ conflict\n')
      console.log(`Stopped on ${c.short} (${c.group}). Resolve, then:\n`)
      console.log('  git add -A && git cherry-pick --continue     # keep going')
      console.log('  git cherry-pick --skip                       # drop this one')
      console.log(`  git cherry-pick --abort && git checkout ${started}   # back out entirely\n`)
      const left = inOrder.length - i - 1
      if (left) console.log(`${left} more queued behind it — --continue picks them up.\n`)
      process.exit(1)
    }
  }

  const files = new Set(inOrder.flatMap((c) => c.files))
  console.log(`\nDone. You are on ${plan.from}. Nothing has been pushed.\n`)
  console.log('  git push        # triggers the stable build (~20 min, universal binary)')
  console.log(`  git checkout ${started}\n`)
  if ([...files].some((f) => f.startsWith('supabase/migrations/'))) {
    console.log('  ⚠ Includes DB migrations — apply them in the Supabase SQL editor')
    console.log('    (the CLI migration history is out of sync; do not use `db push`):')
    for (const f of [...files].filter((f) => f.startsWith('supabase/migrations/'))) console.log(`      ${f}`)
    console.log('')
  }
  if ([...files].some((f) => f.startsWith('src-tauri/'))) {
    console.log('  ⚠ Touches src-tauri/ — beta users only get this after the stable desktop build.\n')
  }
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const applyAt = argv.indexOf('--apply')

if (applyAt !== -1) {
  apply(argv.slice(applyAt + 1))
} else {
  const plan = buildPlan()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(PLAN, JSON.stringify(plan, null, 2))
  writeFileSync(HTML, renderHtml(plan))
  console.log(
    `\n${plan.totalCommits} commits in ${plan.groups.length} features waiting on ${plan.to} ` +
      `(${plan.noiseCount} version bumps hidden).\n\n  open ${HTML}\n`,
  )
  if (!argv.includes('--no-open')) {
    try {
      execFileSync('open', [HTML])
    } catch {
      /* not macOS, or no default browser — the path is printed above */
    }
  }
}
