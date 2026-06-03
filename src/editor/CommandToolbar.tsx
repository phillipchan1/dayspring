import type { SlashCommandId } from './slashDetect'

interface CommandToolbarProps {
  onCommand: (cmd: SlashCommandId) => void
  /** Dismiss the keyboard (blur the editor) — brings the nav bar back. */
  onDismissKeyboard?: () => void
  visible?: boolean
}

const COMMANDS: Array<{ id: SlashCommandId; icon: string; label: string; hint: string }> = [
  { id: 'scripture', icon: '✦', label: 'Scripture', hint: 'Find passages' },
  { id: 'pray', icon: '🙏', label: 'Pray', hint: 'Log prayer' },
  { id: 'sense', icon: '✨', label: 'Sense', hint: 'Record impression' },
  { id: 'remind', icon: '⏱', label: 'Remind', hint: 'Return later' },
]

/**
 * Mobile keyboard-accessory bar: the insert commands ride just above the
 * keyboard while you write, with a trailing "done" to drop the keyboard. The
 * global nav bar hides while this is up (one bar at a time), the way Notes /
 * Bear / iA Writer let the keyboard cover the tab bar.
 */
export function CommandToolbar({ onCommand, onDismissKeyboard, visible = true }: CommandToolbarProps) {
  if (!visible) return null

  return (
    <div className="command-toolbar">
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
  )
}
