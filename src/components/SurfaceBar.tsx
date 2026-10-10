import type { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * The frame's top bar, for a surface that has no bar of its own — Lamp, Altar
 * and the Ascent.
 *
 * The editor and Pages already share one bar (`--frame-*` in global.css): same
 * edges, same first row, same floor. These three used to open straight into a
 * title in a column of their own width, so "‹ Lamp" in the editor put you
 * somewhere with nothing where your cursor was. Now the name of where you are
 * sits exactly where the way back to it was, in the label the editor's Back
 * uses (`ENTRY_RETURN_LABEL`).
 *
 * ONE BAR GRAMMAR — what · how · when. Every room's controls live up here, and
 * in the same places in each:
 *
 *   left    where you are, then WHAT you are looking for (the Altar's prayer /
 *           sense)
 *   centre  HOW you are looking — the view (the Altar's Subjects · Over time)
 *   right   WHEN — the room's time control, always the last thing in the bar
 *
 * The centre is a true centre (`1fr auto 1fr`), so a view switch lands on the
 * same pixel whatever the room puts either side of it.
 *
 * Desktop only. On a phone these surfaces are tabs with their own top inset,
 * and the tab bar already says where you are; the room folds these controls
 * into its masthead instead (`RoomHead`).
 */
export function SurfaceBar({
  label,
  what,
  how,
  when,
  children,
}: {
  label: string
  what?: ReactNode
  how?: ReactNode
  when?: ReactNode
  children?: ReactNode
}) {
  const narrow = useIsMobile()
  if (narrow) return null
  return (
    // The Mac window's drag handle, as the editor's bar is — the native title
    // bar is transparent, so without it the window can only be dragged by the rail.
    <header className="frame-bar" data-tauri-drag-region>
      <div className="frame-bar__lead" data-tauri-drag-region>
        <span className="frame-bar__label">{label}</span>
        {what ? (
          <>
            <span className="frame-bar__sep" aria-hidden />
            {what}
          </>
        ) : null}
      </div>
      <div className="frame-bar__how" data-tauri-drag-region>
        {how}
      </div>
      <div className="frame-bar__actions" data-tauri-drag-region>
        {children}
        {when}
      </div>
    </header>
  )
}
