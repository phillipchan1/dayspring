import { createPortal } from 'react-dom'
import type { SlashCommandId } from './slashDetect'

interface CommandToolbarProps {
  onCommand: (cmd: SlashCommandId) => void
  /** Dismiss the keyboard (blur the editor) — brings the nav bar back. */
  onDismissKeyboard?: () => void
  visible?: boolean
  /**
   * Tablet/desktop with an on-screen keyboard: float the bar fixed above the
   * keyboard (portaled to body) instead of sitting in the editor's flex column.
   * `keyboardInset` is the keyboard height in px.
   */
  docked?: boolean
  keyboardInset?: number
}

// Scripture references are detected passively via inline parser — no slash command needed.
// /sense and /pray retired: discernment is engine-detected and prayer is planted inline.
const COMMANDS: Array<{ id: SlashCommandId; icon: string; label: string; hint: string }> = [
  { id: 'practice', icon: '✶', label: 'Practice', hint: 'Forms for the inner life' },
  { id: 'remind', icon: '⏱', label: 'Remind', hint: 'Return later' },
]

/**
 * Keyboard-accessory bar for touch input: the insert commands ride just above
 * the on-screen keyboard while you write, with a trailing "done" to drop it.
 * It appears precisely when the on-screen keyboard does — so attaching a
 * hardware keyboard (iPad Magic Keyboard, etc.) makes it step aside and `/`
 * takes over. Mirrors the keyboard accessory in Notes / Bear / iA Writer.
 */
export function CommandToolbar({
  onCommand,
  onDismissKeyboard,
  visible = true,
  docked = false,
  keyboardInset = 0,
}: CommandToolbarProps) {
  if (!visible) return null

  const bar = (
    <div className={`command-toolbar${docked ? ' command-toolbar--docked' : ''}`}>
      <div className="command-toolbar__row">
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.id}
            type="button"
            className="command-toolbar__btn"
            // Don't steal focus from the editor — keeps the keyboard up and the
            // caret where the block will be inserted.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCommand(cmd.id)}
            title={cmd.hint}
            aria-label={cmd.label}
          >
            <span className="command-toolbar__icon">{cmd.icon}</span>
            <span className="command-toolbar__label">{cmd.label}</span>
          </button>
        ))}
        {onDismissKeyboard && (
          <button
            type="button"
            className="command-toolbar__btn command-toolbar__btn--dismiss"
            onClick={onDismissKeyboard}
            aria-label="Dismiss keyboard"
            title="Done"
          >
            <span className="command-toolbar__icon">⌄</span>
            <span className="command-toolbar__label">Done</span>
          </button>
        )}
      </div>
    </div>
  )

  if (docked) {
    // Portal so a transformed ancestor can't break `position: fixed`.
    return createPortal(
      <div className="command-toolbar__dock" style={{ bottom: keyboardInset }}>
        {bar}
      </div>,
      document.body,
    )
  }
  return bar
}
