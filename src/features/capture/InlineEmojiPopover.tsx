import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { searchEmoji, type EmojiEntry } from '@/lib/emoji'
import { CommandPopover, CommandPopoverChrome, CommandPopoverFooter } from './CommandPopover'
import './Capture.css'

interface Props {
  anchor: InlinePanelAnchor
  onInsert: (char: string) => void
  onClose: () => void
}

const HINT = '↑↓←→ to choose · enter to insert · esc to close'

/**
 * Slash /emoji — search by keyword (or browse the defaults with an empty
 * query) and insert the glyph at the caret. Filtering is synchronous and
 * local (no network), so unlike scripture there's no separate "search" step:
 * every keystroke re-filters live, and the top match is always the Enter target.
 *
 * Arrow-key model follows macOS Character Viewer / Spotlight: the search
 * field keeps real focus and its caret the whole time (so typing never has to
 * re-target anything), while all four arrow keys are claimed to drive a
 * highlight through the results grid instead of moving the text caret. That's
 * deliberate — a query this short has nothing worth caret-editing with arrow
 * keys, and letting Left/Right fall through to text-caret movement while
 * Up/Down drove the grid was exactly the "can't decide" feel to avoid.
 */
export function InlineEmojiPopover({ anchor, onInsert, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const insertedRef = useRef(false)
  const activeIdxRef = useRef(activeIdx)
  activeIdxRef.current = activeIdx

  const results = searchEmoji(query)
  const resultsRef = useRef(results)
  resultsRef.current = results

  // Columns in the grid, measured from the actual layout (the CSS is
  // auto-fill, so the count depends on panel width) — driving 2D arrow nav
  // needs the real number, not a guess.
  const [columns, setColumns] = useState(8)
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const compute = () => {
      const items = Array.from(grid.querySelectorAll<HTMLElement>('.command-popover__emoji-btn'))
      const first = items[0]
      if (!first) return
      let count = 0
      for (const el of items) {
        if (el.offsetTop !== first.offsetTop) break
        count++
      }
      setColumns(count || 1)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [results.length])

  // Focus synchronously, before paint — a deferred (setTimeout) focus() can
  // land outside the click's user-activation window in WebKit and silently
  // no-op, which is what left the caret sitting back in the journal instead
  // of the search field after opening this popover.
  useLayoutEffect(() => {
    inputRef.current?.focus()
  }, [])

  // A new query invalidates the old highlight — land back on the top match.
  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    document
      .querySelector('.command-popover__emoji-btn[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, results])

  const handleSelect = useCallback(
    (entry: EmojiEntry) => {
      // Guard against key-repeat or rapid double-click double-inserting before
      // React unmounts this popover after the first selection.
      if (insertedRef.current) return
      insertedRef.current = true
      onInsert(entry.char)
    },
    [onInsert],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = resultsRef.current
      if (!list.length) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.min(i + 1, list.length - 1))
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.min(i + columnsRef.current, list.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.max(i - columnsRef.current, 0))
        return
      }
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        e.stopPropagation()
        const entry = list[activeIdxRef.current]
        if (entry) handleSelect(entry)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handleSelect])

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Insert an emoji"
      role="listbox"
      variant="emoji"
      header={
        <CommandPopoverChrome label="emoji">
          <input
            ref={inputRef}
            className="command-popover__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji…"
            aria-label="Emoji search"
            aria-controls="emoji-results"
            aria-expanded={results.length > 0}
          />
        </CommandPopoverChrome>
      }
      footer={<CommandPopoverFooter hint={HINT} />}
    >
      {results.length === 0 ? (
        <p className="command-popover__status">No emoji found.</p>
      ) : (
        <ul
          ref={gridRef}
          id="emoji-results"
          className="command-popover__emoji-grid"
          role="presentation"
        >
          {results.map((entry, i) => (
            <li key={entry.char} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                className="command-popover__emoji-btn"
                data-active={i === activeIdx ? 'true' : undefined}
                tabIndex={-1}
                title={entry.name}
                aria-label={entry.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(entry)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {entry.char}
              </button>
            </li>
          ))}
        </ul>
      )}
    </CommandPopover>
  )
}
