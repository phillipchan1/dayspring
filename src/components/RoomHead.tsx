import type { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * THE MASTHEAD — the same four lines at the top of every Remember room.
 *
 *   EYEBROW     which period the room is lit for, in calendar words
 *   Title       the room's standing sentence (Fraunces, roman, one size)
 *   dek         one dim line on what the room is
 *   light line  one true thing about the chosen period, in gold — or nothing
 *
 * The rooms used to open three ways: the Altar on its own name (so the bar and
 * the title both said "Altar"), the Lamp on a sentence in a lighter weight, the
 * Ascent on an italic sentence under a mono eyebrow — three weights and two
 * slants of one face. And the gold line wandered: under the time control on
 * the Altar and the Lamp, grey and under the mountain on the Ascent.
 *
 * On a phone there is no bar, so the bar's controls fold in here, in the bar's
 * order: how you are looking on top, then the masthead, then the When — always
 * the first row under the title — then what you are looking for.
 *
 * The light line keeps its height when it is empty, so choosing a period never
 * makes the room jump.
 */
export function RoomHead({
  eyebrow,
  title,
  dek,
  light,
  phoneHow,
  phoneWhen,
  phoneWhat,
}: {
  eyebrow: string
  title: string
  dek?: string
  light?: ReactNode
  /** Phone only: the view switch, above the masthead. */
  phoneHow?: ReactNode
  /** Phone only: the When, full width, first row under the title. */
  phoneWhen?: ReactNode
  /** Phone only: what the room is filtered to, under the When. */
  phoneWhat?: ReactNode
}) {
  const narrow = useIsMobile()
  return (
    <header className="room-head">
      {narrow && phoneHow ? <div className="room-head__how">{phoneHow}</div> : null}
      <div className="room-head__eyebrow">{eyebrow}</div>
      <h1 className="room-head__title">{title}</h1>
      {dek ? <p className="room-head__dek">{dek}</p> : null}
      {narrow && phoneWhen ? <div className="room-head__when">{phoneWhen}</div> : null}
      {narrow && phoneWhat ? <div className="room-head__what">{phoneWhat}</div> : null}
      <p className="room-head__light">{light}</p>
    </header>
  )
}
