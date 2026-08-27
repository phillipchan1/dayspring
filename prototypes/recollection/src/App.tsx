import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { validateMarkings } from './corpus'
import { AfterView } from './scenes/AfterView'
import { AgainView } from './scenes/AgainView'
import { AroundView } from './scenes/AroundView'
import { AskedView } from './scenes/AskedView'
import { ConsolationView } from './scenes/ConsolationView'
import { EdgeView } from './scenes/EdgeView'
import { EpisodesView } from './scenes/EpisodesView'
import { Facilitator } from './scenes/Facilitator'
import { MarginView } from './scenes/MarginView'
import { MarkingView } from './scenes/MarkingView'
import { PencilView } from './scenes/PencilView'
import { Quiet } from './scenes/Quiet'
import { RegisterView } from './scenes/RegisterView'
import { ComesToView } from './scenes/ComesToView'
import { LiturgyView } from './scenes/LiturgyView'
import { MomentView } from './scenes/MomentView'
import { ReturningView } from './scenes/ReturningView'
import { SettingsView } from './scenes/SettingsView'
import { SitDownView } from './scenes/SitDownView'
import { TenureView } from './scenes/TenureView'
import { WallView } from './scenes/WallView'
import { WordsView } from './scenes/WordsView'
import { WordView } from './scenes/WordView'

export const SCENES = [
  { id: 'quiet', key: '1', label: '1 quiet' },
  { id: 'marking', key: '2', label: '2 marking' },
  { id: 'pencil', key: '3', label: '3 pencil' },
  { id: 'margin', key: '4', label: '4 margin' },
  { id: 'edge', key: '5', label: '5 edge' },
  { id: 'wall', key: '6', label: '6 wall' },
  { id: 'register', key: '7', label: '7 register' },
  { id: 'after', key: '8', label: '8 after' },
  { id: 'episodes', key: '9', label: '9 episodes' },
  { id: 'sitdown', key: '0', label: '0 sit down' },
  { id: 'moment', key: 'm', label: 'm moment' },
  { id: 'returning', key: 'g', label: 'g returning' },
  { id: 'liturgy', key: 'l', label: 'l liturgy' },
  { id: 'comesto', key: 'c', label: 'c comes to you' },
  { id: 'word', key: 'w', label: 'w the word' },
  { id: 'again', key: 'a', label: 'a again' },
  { id: 'consolation', key: 'b', label: 'b consolation' },
  { id: 'around', key: 'o', label: 'o around now' },
  { id: 'words', key: 'v', label: 'v the words you use' },
  { id: 'asked', key: 'q', label: 'q what you asked' },
  { id: 'settings', key: ',', label: ', settings' },
  { id: 'tenure', key: 't', label: 't tenure' },
  { id: 'notes', key: '?', label: '? notes' },
] as const

export type SceneId = (typeof SCENES)[number]['id']

function parseHash(): { scene: SceneId; rest: string } {
  const raw = window.location.hash.replace(/^#/, '')
  const [head, ...tail] = raw.split('/')
  const scene = SCENES.some((s) => s.id === head) ? (head as SceneId) : 'margin'
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
    if (!window.location.hash) setHash('margin')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: SceneId, extra = '') => setHash(id, extra), [])

  // The fixture has to obey the product's own grounding rule. Loud in dev,
  // because a quote nobody wrote is the one failure this whole thing is about.
  useEffect(() => {
    const problems = validateMarkings()
    if (problems.length) console.error('[markings] not verbatim:\n' + problems.join('\n'))
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
    case 'quiet':
      view = <Quiet />
      break
    case 'marking':
      view = <MarkingView />
      break
    case 'pencil':
      view = <PencilView />
      break
    case 'margin':
      view = <MarginView key={rest || 'default'} initialId={rest || undefined} />
      break
    case 'edge':
      view = <EdgeView onOpen={(id) => go('margin', id)} />
      break
    case 'wall':
      view = <WallView onOpen={(id) => go('margin', id)} />
      break
    case 'register':
      view = <RegisterView onOpen={(id) => go('margin', id)} />
      break
    case 'after':
      view = <AfterView />
      break
    case 'episodes':
      view = <EpisodesView onOpen={(id) => go('margin', id)} />
      break
    case 'sitdown':
      view = <SitDownView />
      break
    case 'moment':
      view = <MomentView onOpen={(id) => go('margin', id)} />
      break
    case 'returning':
      view = <ReturningView onOpen={(id) => go('margin', id)} />
      break
    case 'liturgy':
      view = <LiturgyView />
      break
    case 'comesto':
      view = <ComesToView onOpen={(id) => go('margin', id)} />
      break
    case 'word':
      view = <WordView onOpen={(id) => go('margin', id)} />
      break
    case 'again':
      view = <AgainView onOpen={(id) => go('margin', id)} />
      break
    case 'consolation':
      view = <ConsolationView onOpen={(id) => go('margin', id)} />
      break
    case 'around':
      view = <AroundView onOpen={(id) => go('margin', id)} />
      break
    case 'words':
      view = <WordsView />
      break
    case 'asked':
      view = <AskedView onOpen={(id) => go('margin', id)} />
      break
    case 'settings':
      view = <SettingsView />
      break
    case 'tenure':
      view = <TenureView onGo={(id) => go(id)} />
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
