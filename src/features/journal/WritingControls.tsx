import { useState } from 'react'
import { AppearanceToggle } from '@/components/AppearanceToggle'
import type { Settings } from '@/lib/settings'
import type { FocusMode } from './useFocusMode'
import { IconFocus } from './navIcons'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  focus: FocusMode
  /** When set (mobile), offer a way into focus mode from this floating cluster.
   *  Desktop enters focus from its top bar, so it leaves this undefined. */
  onEnterFocus?: (() => void) | undefined
}

/**
 * Subtle floating appearance on every surface; typewriter / dim / exit in
 * focus mode.
 *
 * **In focus mode it starts collapsed.** Four word-pills pinned to the corner of
 * a page someone is writing on is the busiest thing on that screen, and it sat
 * on top of the margin's own header besides. Collapsed it is one handle; it
 * opens on hover, on keyboard focus, or on a tap, which is all three input
 * kinds. Nothing here is in the editor's render or input path, so expanding
 * costs the writing nothing.
 *
 */
export function WritingControls({
  settings,
  update,
  focus,
  onEnterFocus,
}: Props) {
  const docked = !focus.active
  const [expanded, setExpanded] = useState(false)
  // Only focus mode collapses. Docked, the cluster is already one or two icons
  // in a corner nobody is writing near, and hiding those would be fussier than
  // showing them.
  const collapsed = !docked && !expanded

  return (
    <div
      className={`focus-controls${docked ? ' focus-controls--docked' : ''}`}
      data-collapsed={collapsed}
      onPointerEnter={() => setExpanded(true)}
      onPointerLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExpanded(false)
      }}
    >
      {!docked && (
        <button
          type="button"
          className="focus-controls__handle"
          tabIndex={-1}
          onClick={() => setExpanded((open) => !open)}
          title="Writing controls"
          aria-label="Writing controls"
          aria-expanded={expanded}
        >
          <span className="focus-controls__handle-glyph" aria-hidden>
            ⋯
          </span>
        </button>
      )}
      {docked && onEnterFocus && (
        <>
          <button
            type="button"
            className="appearance-icon-btn"
            tabIndex={-1}
            onClick={onEnterFocus}
            title="Focus mode"
            aria-label="Enter focus mode"
          >
            <IconFocus />
          </button>
          <span className="focus-controls__sep" aria-hidden />
        </>
      )}
      <AppearanceToggle
        icon
        tabFocus={false}
        appearance={settings.appearance}
        onChange={(appearance) => update({ appearance })}
      />
      {focus.active && (
        <>
          <span className="focus-controls__sep" aria-hidden />
          <button
            className="toggle-pill"
            data-on={settings.typewriter}
            tabIndex={-1}
            onClick={() => update({ typewriter: !settings.typewriter })}
            title="Keep the active line centered"
          >
            typewriter
          </button>
          <button
            className="toggle-pill"
            data-on={settings.dimming}
            tabIndex={-1}
            onClick={() => update({ dimming: !settings.dimming })}
            title="Fade everything but the current paragraph"
          >
            dim
          </button>
          <button className="toggle-pill" tabIndex={-1} onClick={focus.exit} title="Exit focus (Esc)">
            ✕ esc
          </button>
        </>
      )}
    </div>
  )
}
