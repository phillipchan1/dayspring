import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ControlList } from './scenes/ControlList'
import { EchoView } from './scenes/EchoView'
import { Facilitator } from './scenes/Facilitator'
import { KeepBlank } from './scenes/KeepBlank'
import { KeepName } from './scenes/KeepName'
import { KeepOffer } from './scenes/KeepOffer'
import { LinesView } from './scenes/LinesView'
import { Quiet } from './scenes/Quiet'
import { StrandView } from './scenes/StrandView'

export const SCENES = [
  { id: 'quiet', key: '1', label: '1 quiet' },
  { id: 'keep-blank', key: '2', label: '2 blank' },
  { id: 'keep-offer', key: '3', label: '3 offer' },
  { id: 'keep-name', key: '4', label: '4 name' },
  { id: 'control', key: '5', label: '5 entries' },
  { id: 'lines', key: '6', label: '6 lines' },
  { id: 'strand', key: '7', label: '7 strand' },
  { id: 'echo', key: '8', label: '8 echo' },
  { id: 'notes', key: '?', label: '? notes' },
] as const

export type SceneId = (typeof SCENES)[number]['id']

function parseHash(): { scene: SceneId; rest: string } {
  const raw = window.location.hash.replace(/^#/, '')
  const [head, ...tail] = raw.split('/')
  const scene = SCENES.some((s) => s.id === head) ? (head as SceneId) : 'strand'
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
    if (!window.location.hash) setHash('strand')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: SceneId, extra = '') => setHash(id, extra), [])

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
    case 'keep-blank':
      view = <KeepBlank />
      break
    case 'keep-offer':
      view = <KeepOffer />
      break
    case 'keep-name':
      view = <KeepName />
      break
    case 'control':
      view = <ControlList />
      break
    case 'lines':
      view = <LinesView />
      break
    case 'strand':
      view = <StrandView key={rest || 'mom'} initialKey={rest || undefined} />
      break
    case 'echo':
      view = <EchoView />
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
