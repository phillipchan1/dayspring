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
import { useState } from 'react'
import { buildYearLedger } from './build'
import { syntheticYear } from './fixtureYear'
import { YearThreads } from './YearThreads'
import { YearStory } from './YearStory'
import { MonthView, SeasonView, todayIso } from './ClimbViews'
import { NowStrip } from './NowStrip'
import { weekStart, weekStrip } from './strips'
import { ClimbMountain } from './ClimbMountain'
import { monthEnd } from './build'
import { seasonOf } from './seasons'
import { newIn, photosIn } from './extras'
import { setLedgerPreviewInput } from './load'
import { isLightTheme, type ThemeId } from '@/lib/resolveTheme'
import '@/styles/themes.css'
import '../Ascent.css'

function Harness({ light }: { light: boolean }) {
  const input = syntheticYear()
  setLedgerPreviewInput(input)
  const params = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState(params.get('tab') ?? 'year')
  const Y = new Date().getUTCFullYear()
  const through = new Date().getUTCMonth() + 1
  const ledger = buildYearLedger(input, Y, through)
  ;(window as unknown as { __ledger: unknown }).__ledger = ledger
  const open = (id: string) => console.log('[preview] open entry', id)
  const extras = { photos: photosIn(input.entries, `${Y}-01-01`, `${Y}-12-31`), news: newIn(input.names, input.entries, `${Y}-01-01`, `${Y}-12-31`) }
  return (
    /* The REAL shell, not an approximation of it: `.ascent` beside its rail,
       the scroller, and `.ascent-main` taking its padding from Ascent.css. A
       harness that set its own padding was ~26px wider than the surface it
       stood for, which is exactly the margin a phone-width layout fails in. */
    <div className={`ascent${light ? ' ascent--light' : ''}`} style={{ height: '100dvh', background: 'var(--a1)' }}>
      <nav className="ascent-rail" aria-hidden />
      <div className="ascent-scroll">
      <main className="ascent-main is-wide">
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {['week', 'month', 'season', 'year', 'dots'].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(128,128,128,.4)', background: tab === t ? 'rgba(232,184,115,.25)' : 'none', color: 'inherit', cursor: 'pointer' }}>
              {t}
            </button>
          ))}
        </nav>
        {tab !== 'dots' ? (
          <ClimbMountain
            level={tab as 'week' | 'month' | 'season' | 'year'}
            from={tab === 'week' ? weekStart(todayIso()) : tab === 'month' ? `${todayIso().slice(0, 7)}-01` : tab === 'season' ? seasonOf(todayIso()).from : `${Y}-01-01`}
            to={tab === 'week' ? weekStrip(todayIso()).cells[6]!.key : tab === 'month' ? monthEnd(todayIso().slice(0, 7)) : tab === 'season' ? seasonOf(todayIso()).to : `${Y}-12-31`}
            today={todayIso()}
            stones={ledger.stones}
            onOpenEntry={open}
          />
        ) : null}
        <div className="ascent-summit">
          <div className="ascent-stack ascent-stack--summit">
            {tab === 'week' ? <NowStrip strip={weekStrip(todayIso())} /> : null}
            {tab === 'month' ? <MonthView onOpenEntry={open} /> : null}
            {tab === 'season' ? <SeasonView onOpenEntry={open} /> : null}
            {tab === 'year' ? <YearStory ledger={ledger} extras={extras} open onOpenEntry={open} /> : null}
            {tab === 'dots' ? <YearThreads ledger={ledger} onOpenEntry={open} /> : null}
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}

export function renderLedgerPreview(): void {
  const host = document.getElementById('root')
  if (!host) return
  const params = new URLSearchParams(window.location.search)
  // &theme=<id> picks any palette; &light=1 is the old shorthand for Dawn.
  const theme = (params.get('theme') ?? (params.get('light') === '1' ? 'dawn' : 'ink')) as ThemeId
  const light = isLightTheme(theme)
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.appearance = light ? 'light' : 'dark'
  createRoot(host).render(<Harness light={light} />)
}
