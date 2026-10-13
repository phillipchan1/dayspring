import { useEffect, useRef, useState } from 'react'
import { AppearanceToggle } from '@/components/AppearanceToggle'
import type { Settings } from '@/lib/settings'
import type { FocusMode } from './useFocusMode'
import { IconAdjust, IconFocus } from './navIcons'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  focus: FocusMode
  /** When set (touch: the phone, and an iPad without a trackpad), offer a way
   *  into focus mode from this floating cluster. A pointer enters focus from
   *  the top bar (or ⌘⏎), so the Mac and the web leave this undefined. */
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
 * **A finger is not a hover.** A tap sends the whole hover sequence at once —
 * enter, down, up, LEAVE, then click — so with hover driving it, every tap on
 * `typewriter` or `dim` closed the cluster before its click landed: the click
 * fell through the folded pill and the toggle never flipped. Touch opens and
 * closes it with the handle, or with a tap anywhere else.
 */
export function WritingControls({
  settings,
  update,
  focus,
  onEnterFocus,
}: Props) {
  const docked = !focus.active
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Only focus mode collapses. Docked, the cluster is already one or two icons
  // in a corner nobody is writing near, and hiding those would be fussier than
  // showing them.
  const collapsed = !docked && !expanded

  // Every focus session starts folded, however the last one was left.
  useEffect(() => {
    if (docked) setExpanded(false)
  }, [docked])

  // Open, a press anywhere else folds it — the page, mostly, going back to the
  // words. Hover already does this for a pointer; this is the finger's version.
  useEffect(() => {
    if (!expanded) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node | null)) setExpanded(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [expanded])

  return (
    <div
      ref={rootRef}
      className={`focus-controls${docked ? ' focus-controls--docked' : ''}`}
      data-collapsed={collapsed}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') setExpanded(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch') setExpanded(false)
      }}
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
          <IconAdjust size={15} />
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
