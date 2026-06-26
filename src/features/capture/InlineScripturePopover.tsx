import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSpiritualItem,
  fetchScriptureRefs,
  resolveScripturePassages,
  updateSpiritualItem,
} from '@/lib/spiritual'
import { recordScriptureCommandRef } from '@/lib/scripture/capture'
import { formatScriptureInsert } from '@/lib/spiritualBlocks'
import { matchOfflinePassages } from '@/lib/scripture/offlinePassages'
import { parseReferences } from '@/lib/scripture/parse'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import {
  CommandPopover,
  CommandPopoverChrome,
  CommandPopoverFooter,
} from './CommandPopover'
import { hasScriptureSearchContext, scriptureSearchContext } from './scriptureContext'
import { ScriptureLoadingSkeleton } from './ScriptureLoadingSkeleton'
import './Capture.css'

interface Props {
  entryId: string | null
  entryContent: string
  insertAt: number
  anchor: InlinePanelAnchor
  /** When set, picking a passage replaces this existing scripture block. */
  edit?: { id: string; reference: string | null; content: string } | undefined
  onInsert: (text: string) => void
  onRemove?: (() => void) | undefined
  onClose: () => void
}

type SearchSource = 'auto' | 'manual' | 'offline'
/** Editing starts on a minimal menu so a click never spends an API call. */
type Mode = 'menu' | 'search'

/**
 * A result row. `text === null` means the reference is shown but its verbatim
 * ESV text is still resolving (progressive render — phase 2 fills it in).
 */
interface Row {
  reference: string
  reason: string
  translation: string
  text: string | null
}

const RESULTS_HINT = '↑↓ to choose · enter to set'
const SEARCH_HINT = 'enter to search'
const MENU_HINT = 'esc to close'

/** If `query` looks like a direct scripture reference ("deut 4:12", "psalm 23"),
 *  returns the canonical human-readable forms. Returns [] for topic searches. */
function detectDirectReference(query: string): string[] {
  const trimmed = query.trim()
  // Capitalize each word's first letter so "deut 4:12" passes the parser's
  // capitalization guard (which exists to avoid matching prose words like "is").
  const normalized = trimmed.replace(/\b([a-z])/g, (c) => c.toUpperCase())
  const refs = parseReferences(normalized)
  if (refs.length === 0) return []
  // Reject partial matches embedded in a longer phrase ("peace romans 8" should
  // still go to AI search; only queries that are *mostly* a reference go direct).
  const firstStart = refs[0]!.char_start
  const lastEnd = refs[refs.length - 1]!.char_end
  if ((lastEnd - firstStart) / trimmed.length < 0.7) return []
  return refs.map(({ book_name, chapter, verse_start, verse_end }) => {
    if (verse_start == null) return `${book_name} ${chapter}`
    if (verse_end == null) return `${book_name} ${chapter}:${verse_start}`
    return `${book_name} ${chapter}:${verse_start}-${verse_end}`
  })
}

export function InlineScripturePopover({
  entryId,
  entryContent,
  insertAt,
  anchor,
  edit,
  onInsert,
  onRemove,
  onClose,
}: Props) {
  const autoContext = scriptureSearchContext(entryContent, insertAt)
  const hasContext = hasScriptureSearchContext(entryContent, insertAt)
  const [mode, setMode] = useState<Mode>(edit ? 'menu' : 'search')
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(!edit && hasContext)
  const [searchSource, setSearchSource] = useState<SearchSource | null>(
    !edit && hasContext ? 'auto' : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoFetchedRef = useRef(false)
  const selectedRef = useRef(false)
  const passagesRef = useRef(passages)
  const activeIdxRef = useRef(activeIdx)
  const queryRef = useRef(query)
  passagesRef.current = passages
  activeIdxRef.current = activeIdx
  queryRef.current = query

  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const showingResults = (passages?.length ?? 0) > 0
  const chromeLabel =
    searchSource === 'offline'
      ? 'scripture · offline suggestions'
      : searchSource === 'auto'
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

    if (!navigator.onLine) {
      const matches = matchOfflinePassages(text)
      setPassages(
        matches.map((m) => ({ reference: m.reference, reason: m.reason, translation: 'ESV', text: m.text })),
      )
      setSearchSource('offline')
      setLoading(false)
      return
    }

    setSearchSource(source)
    try {
      // Direct reference (e.g. "deut 4:12", "psalm 23") — skip the AI entirely.
      const directRefs = detectDirectReference(text)
      if (directRefs.length > 0) {
        const shells: Row[] = directRefs.map((ref) => ({
          reference: ref,
          reason: '',
          translation: 'ESV',
          text: null,
        }))
        setPassages(shells)
        setLoading(false)
        const resolved = await resolveScripturePassages(directRefs)
        const filled: Row[] = shells
          .map((s, i): Row | null => {
            const r = resolved[i]
            return r ? { ...s, reference: r.reference, text: r.text } : null
          })
          .filter((r): r is Row => r !== null)
        setPassages(filled.length > 0 ? filled : [])
        return
      }

      // Phase 1 — the model picks references. These render immediately.
      const candidates = await fetchScriptureRefs(text)
      if (candidates.length === 0) {
        setPassages([])
        return
      }
      // Show all candidates right away with their text still resolving (shimmer).
      setPassages(
        candidates.map((c) => ({
          reference: c.reference,
          reason: c.reason,
          translation: 'ESV',
          text: null,
        })),
      )
      setLoading(false)

      // Phase 2 — resolve verbatim ESV text and fill it in behind the refs.
      // Drop any that fail to resolve; the rest show in order.
      const resolved = await resolveScripturePassages(candidates.map((c) => c.reference))
      const filled: Row[] = candidates
        .map((c, i): Row | null => {
          const r = resolved[i]
          return r ? { reference: r.reference, reason: c.reason, translation: 'ESV', text: r.text } : null
        })
        .filter((r): r is Row => r !== null)
      setPassages(filled)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach scripture search'
      setError(msg === 'Load failed' ? 'Network error reaching the API.' : msg)
      setPassages(null)
    } finally {
      setLoading(false)
    }
  }

  // Auto-search from surrounding text once we're in search mode — never while
  // the edit menu is still showing (that's the whole point: no surprise calls).
  useEffect(() => {
    if (mode !== 'search' || !hasContext || autoFetchedRef.current) return
    autoFetchedRef.current = true
    void runSearch(autoContext, 'auto')
  }, [mode, hasContext, autoContext])

  // Focus the search field when search mode opens (auto-search runs in parallel).
  useEffect(() => {
    if (mode !== 'search') return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [mode])

  const handleSelect = useCallback(
    (p: Row) => {
      // Ignore selection until the verbatim text has resolved.
      if (p.text === null) return
      // Guard against key-repeat or rapid double-click firing a second insertion
      // before React can unmount this popover after the first selection.
      if (selectedRef.current) return
      selectedRef.current = true
      const id = edit?.id ?? crypto.randomUUID()
      const refWithTranslation = p.translation ? `${p.reference} · ${p.translation}` : p.reference
      onInsert(formatScriptureInsert(id, p.text, refWithTranslation, entryContent, insertAt))
      const metadata = { reference: p.reference, reason: p.reason }
      const persist = edit
        ? updateSpiritualItem(id, { content: p.text, metadata })
        : createSpiritualItem({ id, entry_id: entryId, type: 'scripture', content: p.text, metadata })
      void persist.catch(() => {
        // Non-fatal — fence block is already in the entry
      })
      // Also light the Scripture map: persist a command-sourced ref for the passage.
      void recordScriptureCommandRef(entryId, p.reference).catch(() => {
        // Non-fatal — reconcile-on-save will still catch the reference in prose
      })
    },
    [edit, entryId, entryContent, insertAt, onInsert],
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
        if (e.key === 'Enter' && !e.repeat && isSearchFocused() && queryRef.current.trim()) {
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

      if (e.key !== 'Enter' || e.repeat) return

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

  if (mode === 'menu') {
    return (
      <CommandPopover
        anchor={anchor}
        onDismiss={onClose}
        ariaLabel="Edit scripture"
        variant="scripture"
      >
        <div className="command-popover__menu-bar">
          <div className="command-popover__menu-actions">
            <button
              type="button"
              className="command-popover__menu-link"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMode('search')}
            >
              Edit
            </button>
            {onRemove && (
              <button
                type="button"
                className="command-popover__menu-link command-popover__menu-link--danger"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onRemove}
              >
                Remove
              </button>
            )}
          </div>
          <span className="command-popover__hint">{MENU_HINT}</span>
        </div>
      </CommandPopover>
    )
  }

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
      footer={<CommandPopoverFooter hint={footerHint} onRemove={edit ? onRemove : undefined} />}
    >
      {loading && <ScriptureLoadingSkeleton />}
      {error && !loading && <p className="command-popover__error">{error}</p>}

      {isOffline && passages && passages.length > 0 && (
        <p className="command-popover__offline-notice">
          Offline — showing general suggestions, not personalized to your entry.
        </p>
      )}

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
                {p.text === null ? (
                  <span
                    className="command-popover__verse command-popover__verse--resolving"
                    aria-label="Loading verse text"
                  >
                    <span className="command-popover__verse-shimmer" />
                    <span className="command-popover__verse-shimmer command-popover__verse-shimmer--short" />
                  </span>
                ) : (
                  <span className="command-popover__verse">{p.text}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </CommandPopover>
  )
}
