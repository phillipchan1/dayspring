import { useEffect, useMemo, useRef, useState } from 'react'
import type { FacetChip, FacetGrouping } from './facets'
import { searchSubjects, wordSubject, type Subject } from './subjects'

interface Props {
  /** The writer's whole vocabulary, most-returned-to first. */
  vocabulary: Subject[]
  groups: FacetGrouping[]
  /** Everything currently on, in the order it was added. */
  chips: { key: string; label: string; color?: string; kind: 'ask' | 'word' | 'facet' }[]
  onAddSubject: (subject: Subject) => void
  onToggleFacet: (key: string) => void
  onRemove: (key: string) => void
  onAsk: (question: string) => void
  onClear: () => void
  asking: boolean
  /** Dim, or show only. Only offered once something is on. */
  onlyLit: boolean
  onOnlyLit: (v: boolean) => void
}

type Row =
  | { kind: 'word'; subject: Subject }
  | { kind: 'facet'; chip: FacetChip; group: string }
  | { kind: 'ask'; question: string }
  | { kind: 'literal'; text: string }

/**
 * One field for the whole filter.
 *
 * It was a row of four different kinds of control — an input, some lit chips,
 * two dropdowns, a labelled strip of suggestions, and two buttons — wrapping
 * onto itself. Each part was defensible and the row was a mess, which is the
 * usual way a filter turns into a hotel-search sidebar.
 *
 * So: one field, and everything you can filter by lives behind it. Your words
 * (all of them, searched as you type — not five picked for you), your markings,
 * what you wrote with a slash command, and asking a question. What's on sits
 * underneath as chips, which is the only place state lives.
 */
export function FilterBar({
  vocabulary,
  groups,
  chips,
  onAddSubject,
  onToggleFacet,
  onRemove,
  onAsk,
  onClear,
  asking,
  onlyLit,
  onOnlyLit,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeKeys = useMemo(() => new Set(chips.map((c) => c.key)), [chips])

  /**
   * What the field is offering right now.
   *
   * Ordered by how specific the answer is: a word you're clearly typing beats a
   * marking you might have meant, and asking a question comes last because it
   * costs a round trip and is what you fall back to when nothing above fits.
   */
  const rows: Row[] = useMemo(() => {
    const q = query.trim()
    const out: Row[] = []

    for (const subject of searchSubjects(vocabulary, q, q ? 6 : 8)) {
      if (!activeKeys.has(subject.key)) out.push({ kind: 'word', subject })
    }

    const ql = q.toLowerCase()
    for (const g of groups) {
      for (const chip of g.chips) {
        if (activeKeys.has(chip.key)) continue
        if (q && !chip.label.toLowerCase().includes(ql) && !g.label.toLowerCase().includes(ql)) {
          continue
        }
        out.push({ kind: 'facet', chip, group: g.label })
      }
    }

    if (q.length >= 2) {
      // A word nobody has in their vocabulary is still a word they can light.
      const known = vocabulary.some((s) => s.label.toLowerCase() === ql)
      if (!known) out.push({ kind: 'literal', text: q })
      // A sentence is a question; a single word is a word.
      if (/\s/.test(q)) out.push({ kind: 'ask', question: q })
    }

    return out
  }, [query, vocabulary, groups, activeKeys])

  useEffect(() => setSel(0), [query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function choose(row: Row) {
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
    if (row.kind === 'word') onAddSubject(row.subject)
    else if (row.kind === 'facet') onToggleFacet(row.chip.key)
    else if (row.kind === 'ask') onAsk(row.question)
    else {
      const w = wordSubject(row.text)
      if (w) onAddSubject(w)
    }
  }

  return (
    <div className="pg-filter" ref={wrapRef}>
      <div className="pg-filter__field" data-open={open && rows.length > 0 ? 'true' : undefined}>
        <svg className="pg-filter__icon" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          className="pg-filter__in"
          value={query}
          disabled={asking}
          placeholder={asking ? 'reading that…' : 'filter, or ask a question'}
          aria-label="Filter your pages, or ask a question"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setSel((i) => Math.min(rows.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSel((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const row = rows[sel]
              if (row) choose(row)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              if (query) setQuery('')
              else setOpen(false)
            } else if (e.key === 'Backspace' && !query && chips.length > 0) {
              // The usual token-field behaviour: backspace on an empty field
              // takes the last thing off rather than doing nothing.
              onRemove(chips[chips.length - 1]!.key)
            }
          }}
        />
      </div>

      {open && rows.length > 0 ? (
        <div className="pg-filter__menu" role="listbox">
          {rows.map((row, i) => (
            <Suggestion
              key={rowKey(row)}
              row={row}
              selected={i === sel}
              onHover={() => setSel(i)}
              onPick={() => choose(row)}
            />
          ))}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="pg-filter__chips">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="pg-filter__chip"
              data-kind={c.kind}
              onClick={() => onRemove(c.key)}
              aria-label={`Remove ${c.label}`}
            >
              {c.color ? (
                <span className="pg__facet-swatch" data-color={c.color} aria-hidden />
              ) : null}
              {c.kind === 'ask' ? `“${c.label}”` : c.label}
              <span className="pg-filter__x" aria-hidden>
                ✕
              </span>
            </button>
          ))}

          {/*
            Dim, or only. Off by default and staying that way — the pages that
            don't carry a word are what give the ones that do their shape.
          */}
          <button
            type="button"
            className="pg-filter__only"
            data-on={onlyLit ? 'true' : undefined}
            aria-pressed={onlyLit}
            onClick={() => onOnlyLit(!onlyLit)}
          >
            only these
          </button>
          <button type="button" className="pg-filter__reset" onClick={onClear}>
            clear
          </button>
        </div>
      ) : null}
    </div>
  )
}

function rowKey(row: Row): string {
  if (row.kind === 'word') return `w:${row.subject.key}`
  if (row.kind === 'facet') return `f:${row.chip.key}`
  if (row.kind === 'ask') return 'ask'
  return 'literal'
}

function Suggestion({
  row,
  selected,
  onHover,
  onPick,
}: {
  row: Row
  selected: boolean
  onHover: () => void
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className="pg-filter__opt"
      data-sel={selected ? 'true' : undefined}
      onPointerEnter={onHover}
      // Pointer-down would blur the input before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
    >
      {row.kind === 'word' ? (
        <>
          <span className="pg-filter__opt-kind">word</span>
          <span className="pg-filter__opt-label">{row.subject.label}</span>
          {row.subject.count ? (
            <span className="pg-filter__opt-n">{row.subject.count}</span>
          ) : null}
        </>
      ) : row.kind === 'facet' ? (
        <>
          <span className="pg-filter__opt-kind">{row.group.toLowerCase()}</span>
          {row.chip.color ? (
            <span className="pg__facet-swatch" data-color={row.chip.color} aria-hidden />
          ) : null}
          <span className="pg-filter__opt-label">{row.chip.label}</span>
          <span className="pg-filter__opt-n">{row.chip.count}</span>
        </>
      ) : row.kind === 'ask' ? (
        <>
          <span className="pg-filter__opt-kind">ask</span>
          <span className="pg-filter__opt-label">“{row.question}”</span>
        </>
      ) : (
        <>
          <span className="pg-filter__opt-kind">word</span>
          <span className="pg-filter__opt-label">{row.text}</span>
        </>
      )}
    </button>
  )
}
