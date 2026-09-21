import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { WelcomeFlow } from './WelcomeFlow'

/**
 * Dev-only: `?__preview=welcome` renders the first-run tour on its own, which
 * the real app only shows once, after sign-in. `&light=1` starts in the light
 * palette; the tour's own toggle flips it. Begin/Skip remount it at slide one.
 */
function Preview() {
  const [isLight, setIsLight] = useState(
    new URLSearchParams(window.location.search).get('light') === '1',
  )
  const [run, setRun] = useState(0)
  return (
    <WelcomeFlow
      key={run}
      isLight={isLight}
      onToggleTheme={() => setIsLight((v) => !v)}
      onBegin={() => setRun((n) => n + 1)}
      onClose={() => setRun((n) => n + 1)}
    />
  )
}

export function renderWelcomePreview(): void {
  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  createRoot(el).render(<Preview />)
}
