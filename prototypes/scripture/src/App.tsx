import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { GuideFooter } from './components/GuideFooter'
import { isSceneId, type SceneId } from './guide'
import { AroundScene } from './scenes/AroundScene'
import { Intro } from './scenes/Intro'
import { LandScene } from './scenes/LandScene'
import { LinkScene } from './scenes/LinkScene'
import { PreferScene } from './scenes/PreferScene'
import { Today } from './scenes/Today'

export type { SceneId }

function parseHash(): SceneId {
  const raw = window.location.hash.replace(/^#/, '').split('/')[0]
  return isSceneId(raw) ? raw : 'intro'
}

function setHash(scene: SceneId) {
  const next = `#${scene}`
  if (window.location.hash !== next) window.location.hash = next
}

export function App() {
  const [scene, setScene] = useState(parseHash)

  useEffect(() => {
    const onHash = () => setScene(parseHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) setHash('intro')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: SceneId) => {
    setHash(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  let view: ReactNode
  switch (scene) {
    case 'intro':
      view = <Intro />
      break
    case 'today':
      view = <Today />
      break
    case 'link':
      view = <LinkScene />
      break
    case 'around':
      view = <AroundScene />
      break
    case 'land':
      view = <LandScene />
      break
    case 'prefer':
      view = <PreferScene />
      break
  }

  return (
    <div className="walkthrough">
      <div className="walkthrough__stage">{view}</div>
      {scene !== 'prefer' && <GuideFooter scene={scene} onGo={go} />}
    </div>
  )
}
