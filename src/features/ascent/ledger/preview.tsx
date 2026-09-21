/**
 * `?__preview=ledger` — the Summit's year ledger, without a session.
 *
 * The Ascent lives behind OAuth, so this is the only way to see the threads
 * while building them. It runs the REAL `buildYearLedger` over a synthetic
 * writer's ENTRIES (the same year as prototypes/ledger), not over a fixture
 * ledger — the ranking is the part most likely to be wrong, so a harness that
 * skipped it would verify the half that cannot break.
 *
 *   ?__preview=ledger                 the whole year, night
 *   ?__preview=ledger&light=1         daybreak
 *   ?__preview=ledger&through=6       the open year, seen from the end of June
 *   ?__preview=ledger&open=<label>    a thread opened on arrival
 *
 * DEV-only — main.tsx gates it behind `import.meta.env.DEV`.
 */
import { createRoot } from 'react-dom/client'
import type { Subject } from '@/features/pages/subjects'
import { useState } from 'react'
import { buildYearLedger, type EncounterInput, type LedgerInput, type MatterInput, type RefInput } from './build'
import { YearThreads } from './YearThreads'
import { YearStory } from './YearStory'
import { MonthView, SeasonView } from './ClimbViews'
import { newIn, photosIn } from './extras'
import { setLedgerPreviewInput } from './load'
import '@/styles/themes.css'
import '../Ascent.css'

type Kind = 'prayer' | 'sense' | 'learned' | 'desire' | 'story'

/** [subject, month, day, text, kind] — the writer's verbatim lines. */
const LINES: [string, number, number, string, Kind][] = [
  ['church', 0, 9, "Still angry about how the elders handled Tom. I don't know what to do with it.", 'story'],
  ['church', 0, 18, "Lord, I don't want to carry Tom into another year. Show me what's mine in it.", 'prayer'],
  ['debt', 0, 20, 'Another month of the card. Asked God to help us get the card down by spring.', 'prayer'],
  ['maya', 0, 30, "Maya asked me why we pray before dinner. I didn't have a good answer.", 'story'],
  ['ps131', 1, 4, 'Psalm 131:2 — I have calmed and quieted my soul, like a weaned child. I want that more than answers.', 'desire'],
  ['church', 1, 11, 'I rehearsed the whole conversation with Tom in the shower again.', 'story'],
  ['church', 1, 23, "Ephesians 4 again. Be angry and do not sin. With Tom I'm doing the first half very well.", 'sense'],
  ['maya', 1, 27, 'Maya drew a picture of our family and put the dog in the middle.', 'story'],
  ['dad', 2, 6, 'Dad called. They found something on the scan. More tests next week.', 'story'],
  ['dad', 2, 12, "Pray for Dad's tests.", 'prayer'],
  ['dad', 2, 19, 'Isaiah 43:2 this morning over Dad. When you pass through the waters I will be with you.', 'sense'],
  ['sabbath', 2, 16, "First real Sabbath in years. Didn't open the laptop once.", 'story'],
  ['debt', 2, 28, 'Paid extra on the card. Slow.', 'story'],
  ['work', 3, 3, "I think I'm done at the firm. I don't know how to say that out loud yet.", 'desire'],
  ['dad', 3, 9, "Dad's biopsy is Thursday. Please.", 'prayer'],
  ['work', 3, 24, "Lord, if leaving the firm is you, make it plain. If it's me, make it hard.", 'prayer'],
  ['work', 4, 5, "Wrote a resignation letter to the firm and didn't send it.", 'story'],
  ['debt', 4, 13, 'Paid the card off. The whole thing. I cried in the parking lot.', 'story'],
  ['dad', 4, 18, 'Dad starts treatment Monday.', 'story'],
  ['work', 5, 10, 'Gave notice at the firm today. My hands were shaking and I felt more like myself than I have in two years.', 'story'],
  ['ps131', 5, 17, 'Back in Psalm 131 again. Quieted. Weaned. Not there, but closer than February.', 'sense'],
  ['dad', 5, 29, "Asked God for Dad to sleep through the night. That's all. Just that.", 'prayer'],
  ['sabbath', 5, 23, "Sabbath again. It's getting less strange.", 'story'],
  ['lisbon', 6, 8, "The light in Lisbon falls like it's been poured, gold on every wall, and for a week I forgot to be afraid.", 'story'],
  ['lisbon', 6, 11, 'Lisbon: sat in the cathedral and could not stop crying, and did not know why.', 'sense'],
  ['dad', 6, 22, "Dad says he feels peace about it. I'm trying to borrow his.", 'sense'],
  ['ruth', 7, 4, '## Grandma Ruth\nGrandma Ruth died this morning. She prayed for me every day of my life.', 'story'],
  ['ruth', 7, 11, "## Ruth's funeral\nHer Bible had my name written in the margin of Psalm 91. Ruth, always.", 'story'],
  ['work', 7, 19, 'What I learned leaving the firm: I had made the job the thing that told me I was okay.', 'learned'],
  ['dad', 7, 24, "Dad's scan in October. Waiting.", 'story'],
  ['group', 8, 7, "Went to the new small group. Six people, bad coffee, I think I'll go back.", 'story'],
  ['church', 8, 14, "Saw Tom at the grocery store. Didn't feel the heat I expected to.", 'sense'],
  ['dad', 8, 16, 'Pray for Dad.', 'prayer'],
  ['dad', 9, 9, "Dad's scan is clear. Clear. I said it out loud four times.", 'story'],
  ['group', 9, 12, "Small group prayed for Dad's scan and then we got to tell them.", 'story'],
  ['church', 9, 16, "I think I've forgiven Tom. Not decided to — noticed that I have.", 'learned'],
  ['maya', 9, 20, 'Maya prayed for Dad by herself tonight. Nobody asked her to.', 'story'],
  ['ps131', 10, 2, "Psalm 131 one more time. I think this was the verse of the year and I didn't notice.", 'learned'],
  ['group', 10, 13, "Small group again. Someone asked how Dad is and I didn't have to be brave about it.", 'story'],
  ['dad', 10, 27, 'Dad at Thanksgiving, eating everything. Thank you.', 'prayer'],
  ['group', 11, 10, "## Advent\nLast small group of the year. I'll miss it over Christmas, which surprised me.", 'story'],
  ['dad', 11, 15, "Dad's check-up fine. We just sat in the car afterward for a minute.", 'story'],
  ['sabbath', 11, 27, "Sabbath all day. The quietest Christmas week I've had.", 'story'],
  ['maya', 11, 22, "Maya wants to come to small group. I told her it's mostly adults and bad coffee.", 'story'],
]

/** Extra, plain entries per [subject, month] — the unquotable bulk of a year. */
const BULK: [string, number, number, string][] = [
  ['dad', 3, 2, 'Dad again.'],
  ['dad', 5, 1, 'Dad, tired.'],
  ['dad', 9, 2, 'Dad, good day.'],
  ['work', 4, 5, 'The firm, again.'],
  ['work', 5, 3, 'Last weeks at the firm.'],
  ['sleep', 0, 3, 'No sleep again.'],
  ['sleep', 3, 2, 'Bad sleep.'],
  ['sleep', 6, 2, 'Sleep was short.'],
  ['sleep', 9, 2, 'Sleep, a little better.'],
  ['sleep', 11, 2, 'Slept badly.'],
  ['maya', 4, 1, 'Maya at the park.'],
  ['maya', 6, 1, 'Maya swam today.'],
  ['group', 9, 1, 'Small group tonight.'],
]

const MATTERS: Record<string, string> = {
  dad: "Dad's diagnosis",
  work: 'Leaving the firm',
  church: 'Tom and the elders',
  debt: 'The credit card',
  sleep: 'Sleep',
  sabbath: 'Sabbath',
  group: 'The small group',
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`
}

// The synthetic writer's year is THIS year, seen today — so the month and
// season views (which read the calendar) have a present to stand in.
const Y = new Date().getUTCFullYear()
const TODAY = new Date().toISOString().slice(0, 10)
const PHOTO = (seed: string) => `\n\n![](attachment:${seed.repeat(64).slice(0, 64)}.jpg?size=f)`

function synthetic(): LedgerInput {
  const entries: LedgerInput['entries'] = []
  const members = new Map<string, MatterInput['members']>()
  const refs: RefInput[] = []
  let n = 0
  const add = (subject: string, at: string, body: string, kind: Kind) => {
    const id = `e${++n}`
    entries.push({ id, created_at: at, body_markdown: body, word_count: body.split(/\s+/).length * 12 })
    if (MATTERS[subject]) {
      const text = body.replace(/^##[^\n]*\n/, '').replace(/\s*!\[[^\]]*\]\([^)]*\)/g, '')
      const list = members.get(subject) ?? []
      list.push({ itemId: `i${n}`, entryId: id, content: text, type: kind })
      members.set(subject, list)
    }
    const ps = body.indexOf('Psalm 131')
    if (ps >= 0) refs.push({ entryId: id, bookOsis: 'Ps', chapter: 131, osisRef: 'Ps.131', charStart: ps, charEnd: ps + 9 })
    const isa = body.indexOf('Isaiah 43')
    if (isa >= 0) refs.push({ entryId: id, bookOsis: 'Isa', chapter: 43, osisRef: 'Isa.43.2', charStart: isa, charEnd: isa + 11 })
    const eph = body.indexOf('Ephesians 4')
    if (eph >= 0) refs.push({ entryId: id, bookOsis: 'Eph', chapter: 4, osisRef: 'Eph.4', charStart: eph, charEnd: eph + 11 })
    return id
  }
  // Earlier years: sleep and Maya were always there; Dad never was.
  for (const y of [2022, 2023, 2024]) {
    add('sleep', iso(y, 4, 4), 'Sleep was bad again.', 'story')
    add('maya', iso(y, 5, 5), 'Maya grew an inch.', 'story')
  }
  const ids: Record<string, string> = {}
  const past = (m: number, d: number) => iso(Y, m, d).slice(0, 10) <= TODAY
  const withPhoto = new Set(['dad:2:19', 'work:5:10', 'lisbon:6:8', 'group:8:7', 'ps131:5:17'])
  for (const [s, m, d, text, kind] of LINES) {
    if (!past(m, d)) continue
    const k = `${s}:${m}:${d}`
    ids[k] = add(s, iso(Y, m, d), withPhoto.has(k) ? text + PHOTO(String(m % 10)) : text, kind)
  }
  for (const [s, m, d, text] of BULK) if (past(m, d)) add(s, iso(Y, m, d), text, 'story')
  if (past(2, 14)) add('alvarez', iso(Y, 2, 14), 'Met Dr. Alvarez. Kind eyes, talks fast, drew the whole thing on a napkin for Dad.', 'story')

  const matters: MatterInput[] = Object.entries(MATTERS).map(([id, label]) => ({
    id,
    label,
    members: members.get(id) ?? [],
  }))
  const names: Subject[] = [
    { key: 'c:maya', label: 'Maya', terms: ['Maya'], kind: 'person' },
    { key: 'c:ruth', label: 'Grandma Ruth', terms: ['Ruth', 'Grandma Ruth'], kind: 'person', firstSeen: iso(Y, 7, 4) },
    { key: 'c:alvarez', label: 'Dr. Alvarez', terms: ['Dr. Alvarez', 'Alvarez'], kind: 'person', firstSeen: iso(Y, 2, 14) },
    { key: 'c:group', label: 'The small group', terms: ['small group'], kind: 'org', firstSeen: iso(Y, 8, 7) },
    { key: 'c:lisbon', label: 'Lisbon', terms: ['Lisbon'], kind: 'place' },
    { key: 'c:dad', label: 'Dad', terms: ['Dad'], kind: 'person' },
    { key: 'c:tom', label: 'Tom', terms: ['Tom'], kind: 'person' },
    { key: 'c:god', label: 'God', terms: ['God'], kind: 'person' },
  ]
  const encounters: EncounterInput[] = [
    ...(ids['dad:9:9'] ? [{ threadId: 'dad', movement: 'answered', namedAt: iso(Y, 9, 9), sourceEntryId: ids['dad:9:9'], reflection: null }] : []),
    ...(ids['debt:4:13'] ? [{ threadId: 'debt', movement: 'answered', namedAt: iso(Y, 4, 13), sourceEntryId: ids['debt:4:13'], reflection: null }] : []),
  ]
  return { entries, matters, names, refs, markings: [], encounters }
}

function Harness({ light }: { light: boolean }) {
  const input = synthetic()
  setLedgerPreviewInput(input)
  const params = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState(params.get('tab') ?? 'year')
  const through = new Date().getUTCMonth() + 1
  const ledger = buildYearLedger(input, Y, through)
  ;(window as unknown as { __ledger: unknown }).__ledger = ledger
  const open = (id: string) => console.log('[preview] open entry', id)
  const extras = { photos: photosIn(input.entries, `${Y}-01-01`, `${Y}-12-31`), news: newIn(input.names, input.entries, `${Y}-01-01`, `${Y}-12-31`) }
  return (
    <div className={`ascent${light ? ' ascent--light' : ''}`} style={{ minHeight: '100vh', overflow: 'auto', background: light ? '#fbf6ee' : '#10141f' }}>
      <main className="ascent-main is-wide" style={{ padding: '28px 20px 80px' }}>
        <nav style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['month', 'season', 'year', 'dots'].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(128,128,128,.4)', background: tab === t ? 'rgba(232,184,115,.25)' : 'none', color: 'inherit', cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </nav>
        <div className="ascent-summit">
          <div className="ascent-stack ascent-stack--summit">
            {tab === 'month' ? <MonthView onOpenEntry={open} /> : null}
            {tab === 'season' ? <SeasonView onOpenEntry={open} /> : null}
            {tab === 'year' ? <YearStory ledger={ledger} extras={extras} open onOpenEntry={open} /> : null}
            {tab === 'dots' ? <YearThreads ledger={ledger} onOpenEntry={open} /> : null}
          </div>
        </div>
      </main>
    </div>
  )
}

export function renderLedgerPreview(): void {
  const host = document.getElementById('root')
  if (!host) return
  const params = new URLSearchParams(window.location.search)
  const light = params.get('light') === '1'
  document.documentElement.dataset.theme = light ? 'dawn' : 'ink'
  document.documentElement.dataset.appearance = light ? 'light' : 'dark'
  createRoot(host).render(<Harness light={light} />)
}
