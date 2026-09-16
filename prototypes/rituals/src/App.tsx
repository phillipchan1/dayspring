import { useCallback, useEffect, useState } from 'react'
import { GuideFooter } from './components/GuideFooter'
import { isSceneId, type SceneId } from './guide'
import { Intro } from './scenes/Intro'
import { Shelf } from './scenes/Shelf'
import { Thread } from './scenes/Thread'
import { OneQuestion } from './scenes/OneQuestion'
import { Inside } from './scenes/Inside'
import { PreferScene } from './scenes/PreferScene'
import type { Source } from './lib/source'

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
  const [source, setSource] = useState<Source>('invented')
  const [practice, setPractice] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ practice: string; label: string } | null>(null)

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
      {scene === 'intro' ? <Intro onNext={() => go('shelf')} /> : null}

      {scene === 'shelf' ? (
        <Shelf
          source={source}
          onSource={setSource}
          onOpen={(p) => {
            setPractice(p)
            go('thread')
          }}
        />
      ) : null}

      {scene === 'thread' ? (
        <Thread
          source={source}
          onSource={setSource}
          practice={practice}
          onPractice={setPractice}
          onBack={() => go('shelf')}
          onFocus={(p, label) => {
            setFocus({ practice: p, label })
            go('one')
          }}
        />
      ) : null}

      {scene === 'one' ? (
        <OneQuestion
          source={source}
          onSource={setSource}
          focus={focus}
          onBack={() => go('thread')}
        />
      ) : null}

      {scene === 'inside' ? (
        <Inside source={source} onSource={setSource} onBack={() => go('one')} />
      ) : null}

      <GuideFooter scene={scene} onGo={go} />
    </>
  )
}

export type { SceneId }
