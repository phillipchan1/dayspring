// The "you" menu — where the things that are about the writer live, rather than
// about their journal.
//
// WHY IT EXISTS: Lamp, Altar and the Ascent are readings OF the archive. The
// Life Map is a list ABOUT you, and the Concordance is how the app spells your
// world. Neither belongs in a rail of Return destinations, and both were either
// homeless or buried — the Concordance behind Settings → About, the Life Map in
// a footer slot that never sat right.
//
// It also splits a job Settings had been doing twice. Settings mixes app
// preferences (appearance, writing, shortcuts) with account (billing, your
// email); a menu that CONTAINS Settings separates the two without adding a
// seventh tab.
//
// Deliberately an initial rather than a photograph. An avatar's real jobs —
// identity, account switching, "who am I signed in as" — barely apply to a
// single-user journal, and a profile-photo system would be scaffolding for a
// question nobody is asking. The initial gives the recognisable shape without
// pretending there is more behind it.

import { useEffect, useRef, useState } from 'react'
import { signOut } from '@/lib/auth'
import { ConcordanceDrawer } from '@/features/concordance/ConcordanceDrawer'
import './You.css'

interface Props {
  userEmail: string
  onLifeMap: () => void
  onOpenSettings: () => void
  /** The Concordance drawer is still flag-gated; hide the row when it is off. */
  concordanceEnabled: boolean
  labelsExpanded: boolean
  /** `rail` (default) opens above the footer; `bar` opens above the phone's tab bar. */
  placement?: 'rail' | 'bar'
}

/** First letter of the address. Nothing is derived from a name we do not have. */
const initialOf = (email: string) => (email.trim()[0] ?? '·').toUpperCase()

export function YouMenu({
  userEmail,
  onLifeMap,
  onOpenSettings,
  concordanceEnabled,
  labelsExpanded,
  placement = 'rail',
}: Props) {
  const [open, setOpen] = useState(false)
  const [concordance, setConcordance] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className={`you you--${placement}`} ref={wrap}>
      <button
        type="button"
        className="you__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="You"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="you__initial" aria-hidden>
          {initialOf(userEmail)}
        </span>
        {labelsExpanded && <span className="you__label">You</span>}
      </button>

      {open && (
        <div className="you__menu" role="menu">
          <button type="button" role="menuitem" className="you__item" onClick={pick(onLifeMap)}>
            Life Map
            <span className="you__gloss">the people and things you return to</span>
          </button>
          {concordanceEnabled && (
            <button
              type="button"
              role="menuitem"
              className="you__item"
              onClick={pick(() => setConcordance(true))}
            >
              Concordance
              <span className="you__gloss">how your world is spelled</span>
            </button>
          )}

          <hr className="you__rule" />

          <button
            type="button"
            role="menuitem"
            className="you__item"
            onClick={pick(onOpenSettings)}
          >
            Settings
            <kbd className="you__key">⌘,</kbd>
          </button>

          <hr className="you__rule" />

          <div className="you__who" title={userEmail}>
            {userEmail}
          </div>
          <button
            type="button"
            role="menuitem"
            className="you__item you__item--quiet"
            onClick={pick(() => void signOut())}
          >
            Sign out
          </button>
        </div>
      )}

      {concordance && <ConcordanceDrawer onClose={() => setConcordance(false)} />}
    </div>
  )
}
