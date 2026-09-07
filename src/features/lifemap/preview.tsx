// `?__preview=lifemap` — the Life Map against fixtures, without a session.
//
// The surface sits behind OAuth, and the same reason Pages has a preview applies
// here: you cannot design what you cannot look at. Dev-only; `import.meta.env.DEV`
// is statically false in a production build, so this is dead-code-eliminated.
//
// The fixtures are shaped like the real archive rather than a happy path: mostly
// `waiting`, a long `earlier` tail, and Matters carrying things nobody would type.

import { createRoot } from 'react-dom/client'
import type { ConcordanceItem } from '@/lib/concordance'
import type { KeptSubject } from '@/features/pages/keptSubjects'
import { buildLifeMap, floorFor } from './lifeMap'
import { LifeMapBody } from './LifeMapView'
import '@/styles/global.css'

const PAGES = 2969

const row = (
  canonical: string,
  kind: ConcordanceItem['kind'],
  n: number,
  over: Partial<ConcordanceItem> = {},
): ConcordanceItem => ({
  id: canonical,
  kind,
  canonical,
  surface_forms: [],
  descriptor: null,
  status: 'suggested',
  source: 'repetition',
  occurrence_count: n,
  first_seen: '2014-01-01T00:00:00Z',
  last_seen: '2026-08-01T00:00:00Z',
  ...over,
})

const old = (canonical: string, kind: ConcordanceItem['kind'], n: number): ConcordanceItem =>
  row(canonical, kind, n, { status: 'dormant', last_seen: '2017-04-02T00:00:00Z' })

const CONCORDANCE: ConcordanceItem[] = [
  row('Vera', 'person', 291, { source: 'explicit' }),
  row('Esther', 'person', 188, { source: 'explicit' }),
  row('Mom', 'person', 132, { status: 'confirmed' }),
  row('the boys', 'person', 57),
  row('Pastor Tim', 'person', 63),
  row('Marcus', 'person', 38),
  old('Grandma Ruth', 'person', 47),
  old('Coach Ellis', 'person', 31),

  row('home', 'place', 64, { status: 'confirmed' }),
  row('the sanctuary', 'place', 41),
  old('the old house', 'place', 38),

  row('Frontier', 'org', 284, { source: 'explicit' }),
  row('Dayspring', 'project', 214, { source: 'explicit' }),
  row('SCE', 'org', 141),
  old('seminary', 'org', 64),

  row('morning prayer', 'term', 118, { status: 'confirmed' }),
  row('burning out', 'term', 79),
  row('the dry season', 'term', 73),
  row('preaching', 'term', 40),
  row('sleep', 'term', 31),
  old('the thesis', 'term', 41),
  old('night shifts', 'term', 33),

  // Below the floor — must not be offered.
  row('the raise', 'term', 7),
]

const KEPT: KeptSubject[] = [
  {
    key: 'word:the move',
    label: 'the move',
    terms: ['the move'],
    kind: 'word',
    keptAt: '2026-09-01T00:00:00Z',
  } as KeptSubject,
]

export function renderLifeMapPreview(): void {
  const floor = floorFor(PAGES)
  const map = {
    sections: buildLifeMap(CONCORDANCE, KEPT, floor),
    floor,
    pages: PAGES,
  }
  const host = document.getElementById('root')
  if (!host) return
  document.documentElement.dataset['theme'] = 'dawn'
  document.documentElement.style.height = '100%'
  document.body.style.cssText = 'margin:0;height:100%;background:var(--bg)'
  host.style.cssText = 'height:100vh;display:flex;flex-direction:column'
  createRoot(host).render(<LifeMapBody map={map} onChanged={() => {}} />)
}
