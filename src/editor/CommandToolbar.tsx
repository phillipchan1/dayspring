import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { SlashCommandId } from './slashDetect'
import type { FormatCommandId } from './slashCommands'
import { ScanIcon, SpiritualBlockIcon, VoiceIcon } from './spiritualBlockIcons'
import { FormatBarIcon, type BarAction } from './formatBarIcons'
import { HIGHLIGHT_LABELS, HIGHLIGHT_ORDER, type HighlightColor } from '@/lib/highlightColors'

interface CommandToolbarProps {
  onCommand: (cmd: SlashCommandId) => void
  /** Apply a markdown format at the caret/selection. Absent hides the Aa row. */
  onFormat?: (id: FormatCommandId) => void
  /** Apply a highlighter colour at the caret/selection. */
  onHighlight?: (color: HighlightColor) => void
  /** Open voice dictation — speak your entry instead of typing it. */
  onVoice?: () => void
  /** Open page scan — photograph a handwritten entry and transcribe it. */
  onScan?: () => void
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

const COMMANDS: Array<{ id: SlashCommandId; label: string; hint: string }> = [
  { id: 'scripture', label: 'Scripture', hint: 'Find passages' },
  { id: 'pray', label: 'Pray', hint: 'Log prayer' },
  { id: 'sense', label: 'Sense', hint: 'Record impression' },
  { id: 'ritual', label: 'Ritual', hint: 'Rituals for the inner life' },
  { id: 'image', label: 'Image', hint: 'Add photo' },
  { id: 'emoji', label: 'Emoji', hint: 'Insert emoji' },
]

/**
 * The formatting row. Glyph-only and compact: a formatting mark is self-evident
 * from its shape, where a capture verb ("Scripture", "Ritual") is not — so these
 * drop the label the capture buttons carry, and many more fit.
 */
const FORMATS: Array<{
  id: FormatCommandId
  label: string
  icon?: BarAction
  glyph?: string
  sep?: true
}> = [
  { id: 'bold', label: 'Bold', icon: 'bold' },
  { id: 'italic', label: 'Italic', icon: 'italic' },
  { id: 'underline', label: 'Underline', icon: 'underline' },
  { id: 'strike', label: 'Strikethrough', icon: 'strike' },
  { id: 'h2', label: 'Heading', icon: 'heading', sep: true },
  { id: 'bullet', label: 'Bullet list', icon: 'list' },
  { id: 'numbered', label: 'Numbered list', glyph: '1.' },
  { id: 'todo', label: 'Checklist', glyph: '☐' },
  { id: 'quote', label: 'Quote', icon: 'quote' },
  { id: 'code', label: 'Code', icon: 'code' },
]

type Mode = 'capture' | 'format' | 'swatch'

/**
 * Keyboard-accessory bar for touch input: the insert commands ride just above
 * the on-screen keyboard while you write, with a trailing "done" to drop it.
 * It appears precisely when the on-screen keyboard does — so attaching a
 * hardware keyboard (iPad Magic Keyboard, etc.) makes it step aside and `/`
 * takes over. Mirrors the keyboard accessory in Notes / Bear / iA Writer.
 *
 * A leading "Aa" swaps the row over to formatting rather than adding a second
 * row. A permanent second row would cost ~44px of writing surface above the
 * keyboard forever, for controls used a fraction of the time — and the writing
 * surface is the one thing nothing here is allowed to charge.
 */
export function CommandToolbar({
  onCommand,
  onFormat,
  onHighlight,
  onVoice,
  onScan,
  onDismissKeyboard,
  visible = true,
  docked = false,
  keyboardInset = 0,
}: CommandToolbarProps) {
  const [mode, setMode] = useState<Mode>('capture')

  // Every time the bar comes back (new entry, keyboard reopened) it starts on
  // capture — the formatting row is a detour, never a resting state.
  useEffect(() => {
    if (!visible) setMode('capture')
  }, [visible])

  if (!visible) return null

  // Keeps the caret and the on-screen keyboard exactly where they are. Without
  // it every button steals focus, the keyboard drops, and the insertion point
  // is lost — the single most important line in this file.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  const modeButton = (label: string, aria: string, next: Mode) => (
    <button
      type="button"
      className="command-toolbar__btn command-toolbar__btn--mode"
      onMouseDown={keepFocus}
      onClick={() => setMode(next)}
      title={aria}
      aria-label={aria}
    >
      <span className="command-toolbar__icon">{label}</span>
    </button>
  )

  let content: ReactNode

  if (mode === 'swatch') {
    content = (
      <>
        {modeButton('‹', 'Back to formatting', 'format')}
        {HIGHLIGHT_ORDER.map((color) => (
          <button
            key={color}
            type="button"
            className="command-toolbar__swatch"
            data-color={color}
            onMouseDown={keepFocus}
            onClick={() => {
              onHighlight?.(color)
              setMode('format')
            }}
            title={HIGHLIGHT_LABELS[color]}
            aria-label={`${HIGHLIGHT_LABELS[color]} highlight`}
          />
        ))}
      </>
    )
  } else if (mode === 'format') {
    content = (
      <>
        {modeButton('‹', 'Back to capture', 'capture')}
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`command-toolbar__btn command-toolbar__btn--format${f.sep ? ' command-toolbar__btn--sep' : ''}`}
            onMouseDown={keepFocus}
            onClick={() => onFormat?.(f.id)}
            title={f.label}
            aria-label={f.label}
          >
            <span className="command-toolbar__icon">
              {f.icon ? <FormatBarIcon action={f.icon} /> : f.glyph}
            </span>
          </button>
        ))}
        {onHighlight && (
          <button
            type="button"
            className="command-toolbar__btn command-toolbar__btn--format"
            onMouseDown={keepFocus}
            onClick={() => setMode('swatch')}
            title="Highlight"
            aria-label="Highlight"
          >
            <span className="command-toolbar__icon">
              <FormatBarIcon action="highlight" />
            </span>
          </button>
        )}
      </>
    )
  } else {
    content = (
      <>
        {onFormat && modeButton('Aa', 'Formatting', 'format')}
        {COMMANDS.map((cmd) => (
          <button
            key={cmd.id}
            type="button"
            className="command-toolbar__btn"
            onMouseDown={keepFocus}
            onClick={() => onCommand(cmd.id)}
            title={cmd.hint}
            aria-label={cmd.label}
          >
            <span className="command-toolbar__icon">
              <SpiritualBlockIcon id={cmd.id} />
            </span>
            <span className="command-toolbar__label">{cmd.label}</span>
          </button>
        ))}
        {onVoice && (
          <button
            type="button"
            className="command-toolbar__btn"
            // Keep the caret put — the dictation lands where you left off.
            onMouseDown={keepFocus}
            onClick={onVoice}
            title="Dictate with your voice"
            aria-label="Voice"
          >
            <span className="command-toolbar__icon">
              <VoiceIcon />
            </span>
            <span className="command-toolbar__label">Voice</span>
          </button>
        )}
        {onScan && (
          <button
            type="button"
            className="command-toolbar__btn"
            // Keep the caret put — the transcription lands where you left off.
            onMouseDown={keepFocus}
            onClick={onScan}
            title="Scan a handwritten page"
            aria-label="Scan"
          >
            <span className="command-toolbar__icon">
              <ScanIcon />
            </span>
            <span className="command-toolbar__label">Scan</span>
          </button>
        )}
      </>
    )
  }

  const bar = (
    <div className={`command-toolbar${docked ? ' command-toolbar--docked' : ''}`}>
      <div className={`command-toolbar__row${mode === 'capture' ? '' : ' command-toolbar__row--scroll'}`}>
        {content}
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
