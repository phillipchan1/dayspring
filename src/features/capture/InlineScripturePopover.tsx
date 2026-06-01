import { useCallback, useEffect, useRef, useState } from 'react'
import { createSpiritualItem, fetchScripturePassages } from '@/lib/spiritual'
import { formatScriptureInsert } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { ScripturePassage } from '@/lib/types'
import { settingsStore } from '@/lib/settings'
import {
  CommandPopover,
  CommandPopoverChrome,
  CommandPopoverHint,
} from './CommandPopover'
import { hasScriptureSearchContext, scriptureSearchContext } from './scriptureContext'
import { ScriptureLoadingSkeleton } from './ScriptureLoadingSkeleton'
import './Capture.css'

interface Props {
  entryId: string | null
  entryContent: string
  insertAt: number
  anchor: InlinePanelAnchor
  onInsert: (text: string) => void
  onClose: () => void
}

type SearchSource = 'auto' | 'manual'

const RESULTS_HINT = '↑↓ to choose · enter to set'
const SEARCH_HINT = 'enter to search'

export function InlineScripturePopover({
  entryId,
  entryContent,
  insertAt,
  anchor,
  onInsert,
  onClose,
}: Props) {
  const autoContext = scriptureSearchContext(entryContent, insertAt)
  const hasContext = hasScriptureSearchContext(entryContent, insertAt)
  const translation = settingsStore.get().scriptureTranslation
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<ScripturePassage[] | null>(null)
  const [loading, setLoading] = useState(hasContext)
  const [searchSource, setSearchSource] = useState<SearchSource | null>(
    hasContext ? 'auto' : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoFetchedRef = useRef(false)
  const passagesRef = useRef(passages)
  const activeIdxRef = useRef(activeIdx)
  const queryRef = useRef(query)
  passagesRef.current = passages
  activeIdxRef.current = activeIdx
  queryRef.current = query

  const showingResults = (passages?.length ?? 0) > 0
  const chromeLabel =
    searchSource === 'auto'
      ? 'scripture · from what you wrote'
      : 'scripture · search by topic'
  const searchPlaceholder =
    searchSource === 'auto' && showingResults
      ? 'Search something else…'
      : 'Topic or phrase…'
  const footerHint = showingResults || loading ? RESULTS_HINT : SEARCH_HINT

  async function runSearch(text: string, source: SearchSource) {
    setLoading(true)
    setError(null)
    setPassages(null)
    setSelectedIdx(null)
    setSearchSource(source)
    try {
      const results = await fetchScripturePassages(text, translation)
      setPassages(results)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach scripture search'
      setError(msg === 'Load failed' ? 'Network error reaching the API.' : msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasContext || autoFetchedRef.current) return
    autoFetchedRef.current = true
    void runSearch(autoContext, 'auto')
  }, [hasContext, autoContext])

  // Always focus the search field when the panel opens (auto-search still runs in parallel).
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  const handleSelect = useCallback(
    (p: ScripturePassage) => {
      const id = crypto.randomUUID()
      const refWithTranslation = p.translation ? `${p.reference} · ${p.translation}` : p.reference
      onInsert(formatScriptureInsert(id, p.text, refWithTranslation, entryContent, insertAt))
      void createSpiritualItem({
        id,
        entry_id: entryId,
        type: 'scripture',
        content: p.text,
        metadata: { reference: p.reference, reason: p.reason },
      }).catch(() => {
        // Non-fatal — fence block is already in the entry
      })
    },
    [entryId, entryContent, insertAt, onInsert],
  )

  function setSelectedIdx(idx: number | null) {
    activeIdxRef.current = idx
    setActiveIdx(idx)
  }

  function isSearchFocused() {
    return (
      document.activeElement instanceof HTMLInputElement &&
      document.activeElement.classList.contains('command-popover__search')
    )
  }

  // Keep the highlighted result visible while keyboard-navigating.
  useEffect(() => {
    if (activeIdx === null || isSearchFocused()) return
    document
      .querySelector('.command-popover__result[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, passages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = passagesRef.current
      if (!list?.length) {
        if (e.key === 'Enter' && isSearchFocused() && queryRef.current.trim()) {
          e.preventDefault()
          e.stopPropagation()
          void runSearch(queryRef.current.trim(), 'manual')
        }
        return
      }

      const idx = activeIdxRef.current
      const inSearch = isSearchFocused()

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        if (inSearch) {
          setSelectedIdx(0)
          inputRef.current?.blur()
        } else if (idx === null) {
          setSelectedIdx(0)
        } else {
          setSelectedIdx(Math.min(idx + 1, list.length - 1))
        }
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        if (inSearch) return
        if (idx === null || idx === 0) {
          setSelectedIdx(null)
          inputRef.current?.focus()
        } else {
          setSelectedIdx(idx - 1)
        }
        return
      }

      if (e.key !== 'Enter') return

      // Selected a result — insert (even if the search field still has text).
      if (idx !== null && !inSearch) {
        e.preventDefault()
        e.stopPropagation()
        const p = list[idx]
        if (p) void handleSelect(p)
        return
      }

      // In the search field — run a new query.
      if (inSearch && queryRef.current.trim()) {
        e.preventDefault()
        e.stopPropagation()
        void runSearch(queryRef.current.trim(), 'manual')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handleSelect])

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Scripture results"
      role="listbox"
      variant="scripture"
      header={
        <CommandPopoverChrome label={chromeLabel}>
          <input
            ref={inputRef}
            className="command-popover__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Scripture search"
            aria-controls="scripture-results"
            aria-expanded={showingResults}
          />
        </CommandPopoverChrome>
      }
      footer={<CommandPopoverHint>{footerHint}</CommandPopoverHint>}
    >
      {loading && <ScriptureLoadingSkeleton />}
      {error && !loading && <p className="command-popover__error">{error}</p>}

      {passages && passages.length === 0 && !loading && (
        <p className="command-popover__status">No passages found.</p>
      )}

      {passages && passages.length > 0 && (
        <ul id="scripture-results" className="command-popover__results" role="presentation">
          {passages.map((p, i) => (
            <li key={p.reference} role="option" aria-selected={activeIdx !== null && i === activeIdx}>
              <button
                type="button"
                className="command-popover__result"
                data-active={activeIdx !== null && i === activeIdx ? 'true' : undefined}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleSelect(p)}
                onMouseEnter={() => {
                  setSelectedIdx(i)
                  inputRef.current?.blur()
                }}
              >
                <span className="command-popover__ref">
                  {p.reference}
                  {p.translation && <span className="command-popover__translation"> · {p.translation}</span>}
                </span>
                <span className="command-popover__verse">{p.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </CommandPopover>
  )
}
