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
 * Desktop only. On a phone these surfaces are tabs with their own top inset,
 * and the tab bar already says where you are.
 */
export function SurfaceBar({ label, children }: { label: string; children?: ReactNode }) {
  const narrow = useIsMobile()
  if (narrow) return null
  return (
    // The Mac window's drag handle, as the editor's bar is — the native title
    // bar is transparent, so without it the window can only be dragged by the rail.
    <header className="frame-bar" data-tauri-drag-region>
      <div className="frame-bar__lead" data-tauri-drag-region>
        <span className="frame-bar__label">{label}</span>
      </div>
      {children ? <div className="frame-bar__actions">{children}</div> : null}
    </header>
  )
}
