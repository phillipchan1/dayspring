import { useCallback, useEffect, useRef, useState } from 'react'
import { enterNativeFullscreen, exitNativeFullscreen } from '@/lib/nativeFullscreen'

export interface FocusMode {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

/**
 * Focus mode = CSS chrome hidden + browser fullscreen when available.
 *
 * Uses Fullscreen API + keyboard lock (Safari 26.4+, recent Chrome) so Esc can
 * close a settings modal before exiting focus. Without keyboard lock, Esc is
 * reserved by the browser and overlays cannot win.
 *
 * macOS traffic-light fullscreen requires Tauri (planned); browser fullscreen
 * is the best option while developing in Vite.
 *
 * Shortcuts: ⌘/Ctrl+Enter toggles, Esc exits (when no overlay is open).
 */
export function useFocusMode(overlayOpen = false): FocusMode {
  const [active, setActive] = useState(false)
  const overlayOpenRef = useRef(overlayOpen)
  overlayOpenRef.current = overlayOpen

  const enter = useCallback(() => {
    setActive(true)
    void enterNativeFullscreen()
  }, [])

  const exit = useCallback(() => {
    setActive(false)
    void exitNativeFullscreen()
  }, [])

  const toggle = useCallback(() => {
    setActive((on) => {
      if (on) {
        void exitNativeFullscreen()
        return false
      }
      void enterNativeFullscreen()
      return true
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
      // Settings registers its own capture handler; don't exit focus underneath.
      if (overlayOpenRef.current) return
      e.preventDefault()
      exit()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, toggle, exit])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && !overlayOpenRef.current) setActive(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  return { active, enter, exit, toggle }
}
