import { useCallback, useEffect, useState } from 'react'

export interface FocusMode {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

/**
 * Focus mode = full-screen writing takeover with no app chrome.
 * Web: a CSS takeover (all panels/header hidden) plus a best-effort request to
 * the browser Fullscreen API. Tauri/Capacitor get real native fullscreen later.
 *
 * Shortcuts: ⌘/Ctrl+Enter toggles, Esc exits.
 */
export function useFocusMode(): FocusMode {
  const [active, setActive] = useState(false)

  const enter = useCallback(() => {
    setActive(true)
    // Best-effort true fullscreen (called from a user gesture). Ignore failures.
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {})
    }
  }, [])

  const exit = useCallback(() => {
    setActive(false)
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggle = useCallback(() => {
    setActive((a) => {
      if (a) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
        }
        return false
      }
      const el = document.documentElement
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {})
      }
      return true
    })
  }, [])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'Escape' && active) {
        e.preventDefault()
        exit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, toggle, exit])

  // If the user leaves browser fullscreen (Esc/F11), drop focus mode too.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setActive(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  return { active, enter, exit, toggle }
}
