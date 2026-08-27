import type { ReactNode } from 'react'

/**
 * The rail's own icons, copied from `src/features/journal/navIcons.tsx`.
 *
 * Copied rather than approximated on purpose: an integration mock argues about
 * WHERE something goes, and if the spine does not look like the real spine the
 * argument is about the drawing instead.
 */
function NavIcon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconNew = () => (
  <NavIcon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </NavIcon>
)

/**
 * Entries — a list of titles and dates.
 *
 * The open book moves to Pages with this split. A book spread is the wall's
 * glyph by every rights: it is the surface that literally shows two pages side
 * by side, and Entries is once again a list.
 */
export const IconEntries = () => (
  <NavIcon>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
  </NavIcon>
)

/** An open book — two pages spread from a centre spine. */
export const IconPages = () => (
  <NavIcon>
    <path d="M12 7v13" />
    <path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4a4 4 0 0 1 5 3 4 4 0 0 1 5-3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a3 3 0 0 0-4 1 3 3 0 0 0-4-1z" />
  </NavIcon>
)

export const IconAscent = () => (
  <NavIcon>
    <path d="M3 19h18" />
    <path d="M6 19l4-8.5 3 4.5 2.5-3.5L19 19" />
  </NavIcon>
)

export const IconLamp = () => (
  <NavIcon>
    <path d="M4 12.5a5.5 5.5 0 0 0 11 0z" />
    <path d="M15 12.5h4" />
    <path d="M9.5 18h3M9.5 18a2 2 0 0 1 1-2" />
    <path d="M19 12.5c1.4-1 1.4-2.6 0-3.8-1.4 1.2-1.4 2.8 0 3.8z" />
  </NavIcon>
)

export const IconAltar = () => (
  <NavIcon>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </NavIcon>
)

export const IconSettings = () => (
  <NavIcon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </NavIcon>
)

/**
 * The spine.
 *
 * ── Pages leaves the panel ──────────────────────────────────────────────────
 *
 * D-022 made List and Pages two reading modes of one panel, and kept the panel
 * open across the switch so they would read as siblings. They do not read as
 * siblings — they are two different acts, and holding a 17rem list of titles
 * beside a wall of pages is two indexes of the same archive on screen at once,
 * which is the clutter D-017 warned about arriving by the other door.
 *
 * So Pages takes the whole canvas and the panel closes behind it, exactly as
 * Ascent, Lamp and Altar do.
 *
 * ── Which makes it a Return surface, and that is the right answer ───────────
 *
 * Once it owns the canvas it behaves like one, so the only question is whether
 * it is labelled like one. It should be. SURFACES' own words: "Dayspring's
 * other Return surfaces all interpret — Ascent arranges seasons, Lamp gathers
 * verses, Altar follows prayers. Every one hands back a reading of the archive.
 * None of them hands back the archive. This does."
 *
 * Being the Return surface that does NOT interpret is its distinguishing
 * virtue, not a disqualification. And it already obeys the Return rule to the
 * letter: you go there to see, never to do.
 *
 * ── The cost, named ─────────────────────────────────────────────────────────
 *
 * Return goes from three to four, and the shortcuts renumber. ⌘1 stays
 * Entries; everything after it shifts by one. That is real muscle memory spent,
 * and the alternative — appending Pages at ⌘5 — keeps the keys and puts the
 * surface last in a list it should arguably lead. Worth a deliberate call
 * rather than a default.
 */
export function Rail({ active, onGo }: { active: string; onGo: (id: string) => void }) {
  return (
    <nav className="spine" aria-label="Surfaces">
      <div className="spine__mark" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="13.5" r="6.4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 2.6v3.2M4.2 5.4l2.1 2.2M19.8 5.4l-2.1 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="spine__group">
        <span className="spine__group-label">Write</span>
        {/*
          Write holds one thing, and that is the sharper statement of the
          thesis rather than a weaker one: writing is one act, and everything
          else in this product is returning. Entries is gone — the list it
          stood for is now the far end of the Pages zoom.
        */}
        <RailBtn label="Write" shortcut="⌘1" on={active === 'writing'} onClick={() => onGo('writing')}>
          <IconNew />
        </RailBtn>
      </div>

      <div className="spine__group">
        <span className="spine__group-label">Return</span>
        <RailBtn label="Pages" shortcut="⌘2" on={active === 'pages'} onClick={() => onGo('pages')}>
          <IconPages />
        </RailBtn>
        <RailBtn label="Ascent" shortcut="⌘3" on={active === 'ascent'} onClick={() => onGo('ascent')}>
          <IconAscent />
        </RailBtn>
        <RailBtn label="Lamp" shortcut="⌘4" on={active === 'lamp'} onClick={() => onGo('lamp')}>
          <IconLamp />
        </RailBtn>
        <RailBtn label="Altar" shortcut="⌘5" on={active === 'altar'} onClick={() => onGo('altar')}>
          <IconAltar />
        </RailBtn>
      </div>

      <div className="spine__foot">
        <RailBtn label="Settings" shortcut="⌘," onClick={() => onGo('settings')}>
          <IconSettings />
        </RailBtn>
      </div>
    </nav>
  )
}

function RailBtn({
  label,
  shortcut,
  on,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  on?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="spine-btn" data-on={on ? 'true' : undefined} onClick={onClick}>
      {children}
      <span className="spine-btn__label">{label}</span>
      {shortcut ? <span className="spine-btn__key">{shortcut}</span> : null}
    </button>
  )
}
