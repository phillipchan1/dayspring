import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { validateDomains } from './lib'
import { AskedView } from './scenes/AskedView'
import { ContinueView } from './scenes/ContinueView'
import { DomainView } from './scenes/DomainView'
import { Facilitator } from './scenes/Facilitator'
import { HeadingView } from './scenes/HeadingView'
import { HouseView } from './scenes/HouseView'
import { RhymeView } from './scenes/RhymeView'
import { RoundsView } from './scenes/RoundsView'

export const SCENES = [
  { id: 'heading', key: '1', label: '1 heading' },
  { id: 'continue', key: '2', label: '2 continue' },
  { id: 'rounds', key: '3', label: '3 rounds' },
  { id: 'domain', key: '4', label: '4 domain' },
  { id: 'asked', key: '5', label: '5 asked' },
  { id: 'house', key: '6', label: '6 house' },
  { id: 'rhyme', key: '7', label: '7 rhyme' },
  { id: 'notes', key: '?', label: '? notes' },
] as const

export type SceneId = (typeof SCENES)[number]['id']

function parseHash(): { scene: SceneId; rest: string } {
  const raw = window.location.hash.replace(/^#/, '')
  const [head, ...tail] = raw.split('/')
  const scene = SCENES.some((s) => s.id === head) ? (head as SceneId) : 'house'
  return { scene, rest: tail.join('/') }
}

function setHash(scene: SceneId, rest = '') {
  const next = rest ? `#${scene}/${rest}` : `#${scene}`
  if (window.location.hash !== next) window.location.hash = next
}

export function App() {
  const [{ scene, rest }, setRoute] = useState(parseHash)
  const [bar, setBar] = useState(true)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) setHash('house')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: SceneId, extra = '') => setHash(id, extra), [])

  // The fixture has to obey the product's own rules. Loud, because a domain
  // nobody typed is the one failure this whole thing is about.
  useEffect(() => {
    const problems = validateDomains()
    if (problems.length) console.error('[domains] invariant broken:\n' + problems.join('\n'))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') (el as HTMLInputElement).blur()
        return
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setBar((v) => !v)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        go('notes')
        return
      }
      const hit = SCENES.find((s) => s.key === e.key)
      if (hit) {
        e.preventDefault()
        go(hit.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  let view: ReactNode
  switch (scene) {
    case 'heading':
      view = <HeadingView />
      break
    case 'continue':
      view = <ContinueView />
      break
    case 'rounds':
      view = <RoundsView onOpen={(d) => go('domain', d)} />
      break
    case 'domain':
      view = <DomainView key={rest || 'frontier'} domain={rest || 'frontier'} onAsked={() => go('asked', rest || 'frontier')} />
      break
    case 'asked':
      view = <AskedView domain={rest || 'frontier'} />
      break
    case 'house':
      view = <HouseView onOpen={(d) => go('domain', d)} />
      break
    case 'rhyme':
      view = <RhymeView />
      break
    case 'notes':
      view = <Facilitator />
      break
  }

  return (
    <>
      {view}
      <nav className="switcher" hidden={!bar} aria-hidden={!bar}>
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            data-on={s.id === scene ? 'true' : undefined}
            onClick={() => go(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </>
  )
}
