import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSpiritualItem,
  fetchScriptureRefs,
  resolveScripturePassages,
  updateSpiritualItem,
} from '@/lib/spiritual'
import { recordScriptureCommandRef } from '@/lib/scripture/capture'
import { parseReferences } from '@/lib/scripture/parse'
import { formatScriptureInsert } from '@/lib/spiritualBlocks'
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

type SearchSource = 'auto' | 'manual'
/** `menu` = editing existing block; `search` = lookup panel (new or edit). */
type Mode = 'menu' | 'search'
/** `verse` = direct verse lookup; `seek` = thematic passage search. */
type LookupMode = 'verse' | 'seek'

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

const RESULTS_HINT = '↑↓ to choose · enter to insert'
const SEEK_IDLE_HINT = 'enter to seek · backspace for verse'
const VERSE_IDLE_HINT = 'e.g. rom 8:28 · space to seek'
const MENU_HINT = 'esc to close'

/**
 * Capitalize the first alphabetic character so lowercase input like "rom 8:28"
 * or "1 cor 13:4" is accepted by the reference parser (which requires a capital
 * book name to avoid false positives in prose).
 */
function prepareForParsing(text: string): string {
  return text.replace(/[a-z]/, (ch) => ch.toUpperCase())
}

/** Build a human-readable ESV-API-compatible reference from a ParsedRef. */
function buildRefString(ref: ReturnType<typeof parseReferences>[0]): { ref: string; chapterOnly: boolean } {
  const chapterOnly = ref.verse_start === null
  const verse = ref.verse_start ?? 1
  let refStr: string
  if (ref.verse_end != null && ref.verse_end !== verse) {
    refStr = `${ref.book_name} ${ref.chapter}:${verse}-${ref.verse_end}`
  } else {
    refStr = `${ref.book_name} ${ref.chapter}:${verse}`
  }
  return { ref: refStr, chapterOnly }
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
  // New inserts start in reference mode; editing an existing block starts in AI
  // mode so the user sees contextual alternatives without extra interaction.
  const [lookupMode, setLookupMode] = useState<LookupMode>(edit ? 'seek' : 'verse')

  // ── Reference mode state ─────────────────────────────────────────────────
  const [refInput, setRefInput] = useState('')
  const [refRow, setRefRow] = useState<Row | null>(null)
  const [refResolving, setRefResolving] = useState(false)
  const [refError, setRefError] = useState<string | null>(null)
  const [refChapterOnly, setRefChapterOnly] = useState(false)
  // Generation counter prevents stale resolves from clobbering newer results.
  const resolveGenRef = useRef(0)

  // ── AI mode state ────────────────────────────────────────────────────────
  const [aiQuery, setAiQuery] = useState('')
  const [passages, setPassages] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchSource, setSearchSource] = useState<SearchSource | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Shared state ─────────────────────────────────────────────────────────
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoFetchedRef = useRef(false)

  // Stable refs for the keyboard closure (avoids stale captures).
  const passagesRef = useRef(passages)
  const activeIdxRef = useRef(activeIdx)
  const lookupModeRef = useRef(lookupMode)
  const refInputRef = useRef(refInput)
  const aiQueryRef = useRef(aiQuery)
  const refRowRef = useRef(refRow)
  passagesRef.current = passages
  activeIdxRef.current = activeIdx
  lookupModeRef.current = lookupMode
  refInputRef.current = refInput
  aiQueryRef.current = aiQuery
  refRowRef.current = refRow

  // ── AI: auto-search from entry context on first AI-mode open ─────────────
  useEffect(() => {
    if (mode !== 'search' || lookupMode !== 'seek' || !hasContext || autoFetchedRef.current) return
    autoFetchedRef.current = true
    void runSearch(autoContext, 'auto')
  }, [mode, lookupMode, hasContext, autoContext])

  // ── Focus input whenever the search panel opens or the mode switches ──────
  useEffect(() => {
    if (mode !== 'search') return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [mode, lookupMode])

  // ── Reference mode: live resolve with 250 ms debounce ────────────────────
  useEffect(() => {
    if (mode !== 'search' || lookupMode !== 'verse') return
    const q = refInput.trim()

    if (!q) {
      setRefRow(null)
      setRefError(null)
      setRefResolving(false)
      setRefChapterOnly(false)
      return
    }

    const prepared = prepareForParsing(q)
    const refs = parseReferences(prepared)
    const parsed = refs[0]

    if (!parsed) {
      // Not yet a valid reference — clear silently while user types.
      setRefRow(null)
      setRefResolving(false)
      return
    }

    const { ref: refString, chapterOnly } = buildRefString(parsed)
    const gen = ++resolveGenRef.current

    const id = window.setTimeout(() => {
      setRefResolving(true)
      setRefError(null)
      setRefRow(null)
      resolveScripturePassages([refString])
        .then((resolved) => {
          if (resolveGenRef.current !== gen) return
          const r = resolved[0]
          if (r) {
            setRefRow({
              reference: r.reference,
              reason: chapterOnly ? `verse 1 · type ${parsed.book_name.slice(0, 3).toLowerCase()} ${parsed.chapter}:N for a specific verse` : '',
              translation: 'ESV',
              text: r.text,
            })
            setRefChapterOnly(chapterOnly)
          } else {
            setRefError('Reference not found — check spelling or verse number')
          }
        })
        .catch((e: unknown) => {
          if (resolveGenRef.current !== gen) return
          setRefError(e instanceof Error ? e.message : 'Could not load verse')
        })
        .finally(() => {
          if (resolveGenRef.current !== gen) return
          setRefResolving(false)
        })
    }, 250)

    return () => clearTimeout(id)
  }, [refInput, lookupMode, mode])

  // ── Switch between reference and AI modes ────────────────────────────────
  function switchLookupMode(to: LookupMode) {
    setLookupMode(to)
    setActiveIdx(null)
    if (to === 'verse') {
      setRefInput('')
      setRefRow(null)
      setRefError(null)
      setRefResolving(false)
      setRefChapterOnly(false)
    } else {
      setAiQuery('')
      // Keep any existing AI results — avoids re-fetching if user toggles back.
    }
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  // ── AI: run a search (phase 1 refs → phase 2 text) ───────────────────────
  async function runSearch(text: string, source: SearchSource) {
    setLoading(true)
    setError(null)
    setPassages(null)
    setSelectedIdx(null)
    setSearchSource(source)
    try {
      const candidates = await fetchScriptureRefs(text)
      if (candidates.length === 0) {
        setPassages([])
        return
      }
      setPassages(
        candidates.slice(0, 3).map((c) => ({
          reference: c.reference,
          reason: c.reason,
          translation: 'ESV',
          text: null,
        })),
      )
      setLoading(false)

      const resolved = await resolveScripturePassages(candidates.map((c) => c.reference))
      const filled: Row[] = candidates
        .map((c, i): Row | null => {
          const r = resolved[i]
          return r ? { reference: r.reference, reason: c.reason, translation: 'ESV', text: r.text } : null
        })
        .filter((r): r is Row => r !== null)
        .slice(0, 3)
      setPassages(filled)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach scripture search'
      setError(msg === 'Load failed' ? 'Network error reaching the API.' : msg)
      setPassages(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Insert a resolved passage ─────────────────────────────────────────────
  const handleSelect = useCallback(
    (p: Row) => {
      if (p.text === null) return
      const id = edit?.id ?? crypto.randomUUID()
      const refWithTranslation = p.translation ? `${p.reference} · ${p.translation}` : p.reference
      onInsert(formatScriptureInsert(id, p.text, refWithTranslation, entryContent, insertAt))
      const metadata = { reference: p.reference, reason: p.reason }
      const persist = edit
        ? updateSpiritualItem(id, { content: p.text, metadata })
        : createSpiritualItem({ id, entry_id: entryId, type: 'scripture', content: p.text, metadata })
      void persist.catch(() => {})
      void recordScriptureCommandRef(entryId, p.reference).catch(() => {})
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

  // Scroll active result into view while keyboard-navigating.
  useEffect(() => {
    if (activeIdx === null || isSearchFocused()) return
    document
      .querySelector('.command-popover__result[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, passages])

  // ── Keyboard handler ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const currentMode = lookupModeRef.current
      const inSearch = isSearchFocused()

      // ── Reference mode keyboard ──
      if (currentMode === 'verse') {
        // Space when input is empty → jump to AI search
        if (e.key === ' ' && inSearch && refInputRef.current === '') {
          e.preventDefault()
          e.stopPropagation()
          switchLookupMode('seek')
          return
        }

        // Enter → insert the resolved verse if ready
        if (e.key === 'Enter') {
          const row = refRowRef.current
          if (row && row.text !== null) {
            e.preventDefault()
            e.stopPropagation()
            handleSelect(row)
          }
          return
        }

        return
      }

      // ── AI mode keyboard ──
      const list = passagesRef.current
      const idx = activeIdxRef.current

      // Backspace when AI input is empty → back to reference mode
      if (e.key === 'Backspace' && inSearch && aiQueryRef.current === '') {
        e.preventDefault()
        e.stopPropagation()
        switchLookupMode('verse')
        return
      }

      if (!list?.length) {
        if (e.key === 'Enter' && inSearch && aiQueryRef.current.trim()) {
          e.preventDefault()
          e.stopPropagation()
          void runSearch(aiQueryRef.current.trim(), 'manual')
        }
        return
      }

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

      if (idx !== null && !inSearch) {
        e.preventDefault()
        e.stopPropagation()
        const p = list[idx]
        if (p) void handleSelect(p)
        return
      }

      if (inSearch && aiQueryRef.current.trim()) {
        e.preventDefault()
        e.stopPropagation()
        void runSearch(aiQueryRef.current.trim(), 'manual')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handleSelect])

  // ── Render: edit-block menu ───────────────────────────────────────────────
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

  // ── Shared: mode pill toggle (shown in both modes) ────────────────────────
  const modePills = (
    <div className="command-popover__mode-pills" role="group" aria-label="Lookup mode">
      <button
        type="button"
        className={`command-popover__mode-pill${lookupMode === 'verse' ? ' command-popover__mode-pill--active' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => switchLookupMode('verse')}
        aria-pressed={lookupMode === 'verse'}
      >
        Verse
      </button>
      <button
        type="button"
        className={`command-popover__mode-pill${lookupMode === 'seek' ? ' command-popover__mode-pill--active' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => switchLookupMode('seek')}
        aria-pressed={lookupMode === 'seek'}
      >
        Seek
      </button>
    </div>
  )

  // ── Render: verse mode ───────────────────────────────────────────────────
  if (lookupMode === 'verse') {
    const refFooterHint = refRow ? RESULTS_HINT : VERSE_IDLE_HINT
    return (
      <CommandPopover
        anchor={anchor}
        onDismiss={onClose}
        ariaLabel="Scripture verse lookup"
        role="listbox"
        variant="scripture"
        header={
          <CommandPopoverChrome label="scripture · verse">
            {modePills}
            <input
              ref={inputRef}
              className="command-popover__search"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="e.g. rom 8:28 or ps 23"
              aria-label="Verse reference"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </CommandPopoverChrome>
        }
        footer={
          <CommandPopoverFooter
            hint={refFooterHint}
            onRemove={edit ? onRemove : undefined}
          />
        }
      >
        {/* Empty state — instructions */}
        {!refInput && !refRow && !refResolving && (
          <div className="command-popover__ref-empty">
            <p className="command-popover__ref-guide">
              Type a verse like{' '}
              <span className="command-popover__ref-eg">Rom 8:28</span>
              {', '}
              <span className="command-popover__ref-eg">Ps 23</span>
              {', or '}
              <span className="command-popover__ref-eg">1 Cor 13:4-7</span>
            </p>
            <p className="command-popover__ref-guide command-popover__ref-guide--sub">
              Results appear as you type. Press{' '}
              <span className="command-popover__ref-key">space</span>{' '}
              to seek passages by theme instead.
            </p>
          </div>
        )}

        {/* Resolving shimmer */}
        {refResolving && !refRow && (
          <div className="command-popover__ref-resolving">
            <span className="command-popover__verse-shimmer" />
            <span className="command-popover__verse-shimmer command-popover__verse-shimmer--short" />
          </div>
        )}

        {/* Error */}
        {refError && !refResolving && (
          <p className="command-popover__error">{refError}</p>
        )}

        {/* Result */}
        {refRow && (
          <ul className="command-popover__results" role="presentation">
            <li role="option" aria-selected>
              <button
                type="button"
                className="command-popover__result command-popover__result--ref-active"
                data-active="true"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => refRow.text && handleSelect(refRow)}
              >
                <span className="command-popover__ref">
                  {refRow.reference}
                  {refRow.translation && (
                    <span className="command-popover__translation"> · {refRow.translation}</span>
                  )}
                </span>
                {refChapterOnly && refRow.reason && (
                  <span className="command-popover__ref-hint">{refRow.reason}</span>
                )}
                {refRow.text === null ? (
                  <span
                    className="command-popover__verse command-popover__verse--resolving"
                    aria-label="Loading verse text"
                  >
                    <span className="command-popover__verse-shimmer" />
                    <span className="command-popover__verse-shimmer command-popover__verse-shimmer--short" />
                  </span>
                ) : (
                  <span className="command-popover__verse">{refRow.text}</span>
                )}
              </button>
            </li>
          </ul>
        )}
      </CommandPopover>
    )
  }

  // ── Render: seek mode ────────────────────────────────────────────────────
  const showingResults = (passages?.length ?? 0) > 0
  const chromeLabel =
    searchSource === 'auto'
      ? 'scripture · from your writing'
      : 'scripture · seek'
  const seekPlaceholder =
    searchSource === 'auto' && showingResults
      ? 'Search a different theme…'
      : 'a theme, season, or feeling…'
  const seekFooterHint = showingResults || loading ? RESULTS_HINT : SEEK_IDLE_HINT

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
        ariaLabel="Scripture passage search"
        role="listbox"
        variant="scripture"
        header={
          <CommandPopoverChrome label={chromeLabel}>
            {modePills}
            <input
              ref={inputRef}
              className="command-popover__search"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder={seekPlaceholder}
              aria-label="Seek scripture passages"
              aria-controls="scripture-results"
            />
          </CommandPopoverChrome>
        }
        footer={
          <CommandPopoverFooter
            hint={seekFooterHint}
            onRemove={edit ? onRemove : undefined}
          />
        }
      >
        {loading && <ScriptureLoadingSkeleton />}
        {error && !loading && <p className="command-popover__error">{error}</p>}

        {passages && passages.length === 0 && !loading && (
          <p className="command-popover__status">No passages found.</p>
        )}

        {!loading && !passages && !error && (
          <div className="command-popover__ref-empty">
            <p className="command-popover__ref-guide">
              What season, theme, or feeling are you in?
            </p>
            <p className="command-popover__ref-guide command-popover__ref-guide--sub">
              Press{' '}
              <span className="command-popover__ref-key">backspace</span>{' '}
              to look up a verse directly.
            </p>
          </div>
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
                  {p.translation && (
                    <span className="command-popover__translation"> · {p.translation}</span>
                  )}
                </span>
                {p.reason && <span className="command-popover__reason">{p.reason}</span>}
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
