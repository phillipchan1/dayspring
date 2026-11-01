import { useEffect, useState } from 'react'

/**
 * Has the Ascent already risen this session?
 *
 * The room arrives by rising — the masthead, the bands, the words, the stones
 * on the trail, each a beat after the last. That is a welcome the first time
 * and a wait every time after, on a surface people open daily
 * (DESIGN_PRINCIPLES N3: no staggers that hold content back, nothing that
 * replays on every visit). So it rises once per app session; afterwards the
 * room is simply there, settled (`data-settled` on `.ascent`, Ascent.css).
 *
 * Module state, not storage: a relaunch is a new session and gets the welcome
 * again. Tests reset it with `resetFirstRise`.
 */
let risen = false

/** True on the first Ascent of the session — play the rise. */
export function useFirstRise(): boolean {
  // Decided once per mount, before the effect below marks it spent, so a
  // StrictMode double render still sees the same answer.
  const [first] = useState(() => !risen)
  useEffect(() => {
    risen = true
  }, [])
  return first
}

export function resetFirstRise() {
  risen = false
}
