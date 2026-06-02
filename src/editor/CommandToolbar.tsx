import type { SlashCommandId } from './slashDetect'

interface CommandToolbarProps {
  onCommand: (cmd: SlashCommandId) => void
  visible?: boolean
}

const COMMANDS: Array<{ id: SlashCommandId; icon: string; label: string; hint: string }> = [
  { id: 'scripture', icon: '✦', label: 'Scripture', hint: 'Find passages' },
  { id: 'pray', icon: '🙏', label: 'Pray', hint: 'Log prayer' },
  { id: 'sense', icon: '✨', label: 'Sense', hint: 'Record impression' },
  { id: 'remind', icon: '⏱', label: 'Remind', hint: 'Return later' },
]

export function CommandToolbar({ onCommand, visible = true }: CommandToolbarProps) {
  if (!visible) return null

  return (
    <div className="command-toolbar">
      {COMMANDS.map((cmd) => (
        <button
          key={cmd.id}
          type="button"
          className="command-toolbar__btn"
          onClick={() => onCommand(cmd.id)}
          title={cmd.hint}
          aria-label={cmd.label}
        >
          <span className="command-toolbar__icon">{cmd.icon}</span>
          <span className="command-toolbar__label">{cmd.label}</span>
        </button>
      ))}
    </div>
  )
}
