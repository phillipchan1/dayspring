import { useEffect, useState } from 'react'
import { resolveTheme, type ThemeId } from '@/lib/resolveTheme'
import type { Settings } from '@/lib/settings'

/** Reactive theme id, including live updates when appearance is auto + OS scheme changes. */
export function useResolvedTheme(settings: Settings): ThemeId {
  const [prefersDark, setPrefersDark] = useState(() =>
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = globalThis.matchMedia('(prefers-color-scheme: dark)')
    setPrefersDark(mq.matches)
    if (settings.appearance !== 'auto') return
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.appearance])

  return resolveTheme(settings, prefersDark)
}
