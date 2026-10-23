import { useSyncExternalStore } from 'react'
import { useIsMobile, useMediaQuery } from './useMediaQuery'

/**
 * A key a person pressed on a physical keyboard, as opposed to an on-screen
 * one. A hardware key reports its position in `code` ("KeyA"); the software
 * keyboard on iPadOS and iOS reports none. There is no web API for "is a
 * keyboard attached", so this is the tell.
 */
export function isPhysicalKey(e: Pick<KeyboardEvent, 'code' | 'isTrusted'>): boolean {
  return e.isTrusted && e.code !== '' && e.code !== 'Unidentified'
}

let physicalKeySeen = false
const listeners = new Set<() => void>()

function onKeyDown(e: KeyboardEvent) {
  if (!isPhysicalKey(e)) return
  physicalKeySeen = true
  window.removeEventListener('keydown', onKeyDown, true)
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!physicalKeySeen && listeners.size === 1) {
    window.addEventListener('keydown', onKeyDown, true)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('keydown', onKeyDown, true)
  }
}

/** True once a physical key has been pressed this session. Never persisted. */
export function usePhysicalKeyboardSeen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => physicalKeySeen,
    () => false,
  )
}

/**
 * Whether this device offers typewriter scrolling: a Mac or a browser on one,
 * and an iPad with a keyboard. Not a phone, and not an iPad that is only being
 * typed on glass.
 *
 * A choice about who the switch is for, not a limit of the editor — the
 * extension centres in whatever the on-screen keyboard leaves (see
 * editor/typewriter.ts), so it would work on glass. Typewriter is for sitting
 * down to write, and that means a keyboard; on a phone, or an iPad being
 * tapped at, the page is for jotting and reading. If that is wrong, this one
 * rule is the place to change it.
 *
 * The pointer is the first tell — a trackpad or mouse makes it fine, and that
 * is a Magic Keyboard, or a desktop. A keyboard without a trackpad (a Smart
 * Keyboard Folio) leaves the pointer coarse, so a physical key counts too, from
 * the first one pressed. Session-long and never saved: an iPad that was docked
 * yesterday and is on glass today should not keep offering it.
 */
export function useTypewriterAvailable(): boolean {
  const isMobile = useIsMobile()
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const physicalKey = usePhysicalKeyboardSeen()
  return canTypewrite({ isMobile, coarsePointer, physicalKey })
}

/** The rule on its own, so every device can be written down in a test. */
export function canTypewrite(device: {
  /** Phone-width viewport (< 768px). */
  isMobile: boolean
  /** The primary pointer is a finger. */
  coarsePointer: boolean
  /** A physical key has been pressed this session. */
  physicalKey: boolean
}): boolean {
  return !device.isMobile && (!device.coarsePointer || device.physicalKey)
}
