import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampEntriesPanelWidth,
  ENTRIES_PANEL_WIDTH_DEFAULT,
  loadEntriesPanelWidth,
  saveEntriesPanelWidth,
} from './entriesPanelWidth'

/** Drag the entries sidebar's trailing edge to resize; width persists per device. */
export function useEntriesPanelResize() {
  const [width, setWidth] = useState(loadEntriesPanelWidth)
  const [resizing, setResizing] = useState(false)
  const widthRef = useRef(width)
  widthRef.current = width

  const draggingRef = useRef(false)
  const startRef = useRef({ x: 0, width: ENTRIES_PANEL_WIDTH_DEFAULT })

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    draggingRef.current = true
    setResizing(true)
    startRef.current = { x: e.clientX, width: widthRef.current }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const delta = e.clientX - startRef.current.x
      setWidth(clampEntriesPanelWidth(startRef.current.width + delta))
    }

    const end = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      saveEntriesPanelWidth(widthRef.current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  return { width, resizing, onResizePointerDown }
}
