import { useCallback, useEffect, useRef, useState } from 'react'
import { exitFocusPresentation } from '@/lib/nativeFullscreen'

export interface FocusMode {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

/**
 * Focus mode hides journal chrome so the writing canvas fills the window.
 * No OS/browser fullscreen — that broke the WebView and caused layout loops.
 *
 * Shortcuts: ⌘/Ctrl+Enter toggles, Esc exits (when no overlay is open).
 */
export function useFocusMode(blockExitOnEsc = false): FocusMode {
  const [active, setActive] = useState(false)
  const blockExitRef = useRef(blockExitOnEsc)
  blockExitRef.current = blockExitOnEsc

  const enter = useCallback(() => {
    setActive(true)
  }, [])

  const exit = useCallback(() => {
    setActive(false)
    void exitFocusPresentation()
  }, [])

  const toggle = useCallback(() => {
    setActive((on) => {
      if (on) void exitFocusPresentation()
      return !on
    })
  }, [])

  useEffect(() => {
    document.documentElement.toggleAttribute('data-focus-mode', active)
    return () => document.documentElement.removeAttribute('data-focus-mode')
  }, [active])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        toggle()
        return
      }
      if (e.key !== 'Escape' || !active) return
      if (blockExitRef.current) return
      e.preventDefault()
      exit()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, toggle, exit])

  return { active, enter, exit, toggle }
}
