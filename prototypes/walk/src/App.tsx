import { useCallback, useEffect, useState } from 'react'
import { GuideFooter } from './components/GuideFooter'
import { isSceneId, type SceneId } from './guide'
import { Intro } from './scenes/Intro'
import { Walk } from './scenes/Walk'
import { Record } from './scenes/Record'
import { PreferScene } from './scenes/PreferScene'

function parseHash(): SceneId {
  const raw = window.location.hash.replace(/^#/, '').split('/')[0] ?? ''
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
    setScene(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (scene === 'prefer') return <PreferScene />

  return (
    <>
      <main className="paper">
        {scene === 'intro' ? <Intro onNext={() => go('walk')} /> : null}
        {scene === 'walk' ? <Walk /> : null}
        {scene === 'record' ? <Record /> : null}
      </main>
      <GuideFooter scene={scene} onGo={go} />
    </>
  )
}

export type { SceneId }
