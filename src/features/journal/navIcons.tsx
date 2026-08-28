import type { ReactNode } from 'react'

/**
 * Shared line-icons for the journal's navigation surfaces — the desktop Rail
 * and the mobile bottom bar draw from the same set so a destination reads the
 * same on every form factor. Sized via the `size` prop (desktop rail: 20,
 * mobile bar: 22) with a consistent stroke weight.
 */
export function NavIcon({
  children,
  size = 20,
  strokeWidth = 1.55,
}: {
  children: ReactNode
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconMenu(props: { size?: number }) {
  return (
    <NavIcon {...props}>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
    </NavIcon>
  )
}

export function IconNew(props: { size?: number }) {
  return (
    <NavIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </NavIcon>
  )
}

/**
 * The open book — Pages.
 *
 * It was the Entries panel's glyph, and it moves rather than being redrawn: the
 * thing it always meant was "your own pages, side by side", and that is what
 * Pages is. The panel is gone; the book is not.
 */
export function IconPages(props: { size?: number }) {
  // An open book — two pages spread from a centre spine.
  //
  // This was a bulleted list, which described the old entries panel exactly and
  // describes the Pages wall not at all. The glyph belonged to Lamp; Pages is
  // the surface that literally shows you two pages side by side, so it has the
  // better claim, and Lamp took the oil lamp it is named after.
  return (
    <NavIcon {...props}>
      <path d="M12 7v13" />
      <path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4a4 4 0 0 1 5 3 4 4 0 0 1 5-3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a3 3 0 0 0-4 1 3 3 0 0 0-4-1z" />
    </NavIcon>
  )
}

export function IconAscent(props: { size?: number }) {
  // A mountain range — the climb from valley to summit.
  return (
    <NavIcon {...props}>
      <path d="M3 19h18" />
      <path d="M6 19l4-8.5 3 4.5 2.5-3.5L19 19" />
    </NavIcon>
  )
}

export function IconScripture(props: { size?: number }) {
  // An oil lamp — the thing the surface is named after ("thy word is a lamp
  // unto my feet"). The bowl carries the silhouette, not the flame: Altar is
  // already a flame, and two flames in one rail is two of the same icon.
  return (
    <NavIcon {...props}>
      {/* the bowl — a half-disc, unmistakably a vessel even at 20px */}
      <path d="M4 12.5a5.5 5.5 0 0 0 11 0z" />
      {/* spout, and the foot it stands on */}
      <path d="M15 12.5h4" />
      <path d="M9.5 18h3M9.5 18a2 2 0 0 1 1-2" />
      {/* the wick's flame, clear of the bowl so it reads as its own shape */}
      <path d="M19 12.5c1.4-1 1.4-2.6 0-3.8-1.4 1.2-1.4 2.8 0 3.8z" />
    </NavIcon>
  )
}

export function IconAltar(props: { size?: number }) {
  return (
    <NavIcon {...props}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </NavIcon>
  )
}

export function IconSettings(props: { size?: number }) {
  return (
    <NavIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </NavIcon>
  )
}

export function IconRitual(props: { size?: number }) {
  // A kindled flame — the same shape the slash palette and the Altar rail use
  // for `/ritual` ("devotional practice, the kindled inner life"). One icon for
  // one idea, wherever it appears.
  return (
    <NavIcon {...props}>
      <path d="M12 3c.6 3 3.4 4.2 3.4 7.4A3.4 3.4 0 0 1 12 13.8a3.4 3.4 0 0 1-3.4-3.4C8.6 7.2 11.4 6 12 3Z" />
      <path d="M12 13.8c2.9 0 5 2 5 4.2 0 1.7-2.2 3-5 3s-5-1.3-5-3c0-2.2 2.1-4.2 5-4.2Z" />
    </NavIcon>
  )
}

export function IconFocus(props: { size?: number }) {
  // Expand-to-corners — entering focus mode opens the canvas to full screen.
  return (
    <NavIcon {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </NavIcon>
  )
}

