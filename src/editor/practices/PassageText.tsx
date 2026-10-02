import { Fragment, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { findPhrase, spanText, type Verse } from './passage'
import { divineName, flatText, layoutPassage, type Fragment as Frag } from './passageLayout'
import './Passage.css'

/**
 * How the passage is being used right now. The movement kinds, plus `choose`
 * (the finder: verses are picked), `quote` (any writing movement of a
 * scripture ritual: select a phrase to bring it in) and `plain` (on view).
 */
export type PassageMode = 'choose' | 'read' | 'mark' | 'carry' | 'dwell' | 'cite' | 'quote' | 'plain'

/** A phrase some answer quoted, lit in the passage — one entry per verse it touches. */
export interface Highlight {
  /** Stable per quote — what the lines and the hover card find it by. */
  key: string
  n: number
  start: number
  end: number
  /** From the movement being written (or everything, at the close). */
  here: boolean
}

/** Words chosen in the passage, snapped to whole words; may run across verses. */
export interface WordSpan {
  text: string
  v: number
  vEnd: number
  from: { n: number; offset: number }
  to: { n: number; offset: number }
}

interface Props {
  verses: readonly Verse[]
  mode: PassageMode
  /** The word that caught the writer — lit wherever it appears. */
  caught?: string | null
  /** The finder's chosen span. */
  selected?: { from: number; to: number } | null
  /** Verses already quoted into the answer. */
  cited?: readonly number[]
  /** Phrases quoted into the ritual's answers. */
  highlights?: readonly Highlight[]
  /** The quote whose line is being followed, if any. */
  lit?: string | null
  /** Words being chosen, not yet brought in. */
  pending?: WordSpan | null
  /** `mark`: a word or phrase was caught. */
  onCatch?: (phrase: string) => void
  /** `choose`: a verse was clicked (shift extends). */
  onVerse?: (n: number, extend: boolean) => void
  /** `cite` / `quote`: a verse number was touched. */
  onCite?: (n: number) => void
  /** `quote`: the words being chosen, live while selecting, and null when let go. */
  onChoosing?: (span: WordSpan | null) => void
  /** `quote`: the choice settled (the pointer came up). */
  onChosen?: (span: WordSpan) => void
  /** Resting on a word (so the margin can show where a line would leave from). */
  onRest?: (at: { n: number; offset: number } | null) => void
  /** Over a phrase already quoted — its keys, and the element under the pointer. */
  onHoverHighlight?: (keys: string[] | null, el: HTMLElement | null) => void
  /** Re-read slowly: the verses arrive one after another. */
  slow?: boolean
}

interface Word {
  text: string
  start: number
  end: number
}

/** What lights one word: caught, chosen but not yet brought in, or quoted. */
interface Light {
  on: boolean
  hl: 'here' | 'deep' | 'past' | undefined
  lit: boolean
  pending: boolean
  /** The quotes that cover it. */
  keys: string[]
}

/**
 * Two neighbouring words are one band when they are lit the same way by the
 * same quotes. Two different quotes that meet at a space stay two bands, so
 * where one ends and the next begins can still be seen.
 */
function joined(a: Light | null | undefined, b: Light | null | undefined): boolean {
  if (!a || !b) return false
  if (!(a.on || a.pending || a.hl) || !(b.on || b.pending || b.hl)) return false
  return (
    a.on === b.on &&
    a.pending === b.pending &&
    a.hl === b.hl &&
    a.lit === b.lit &&
    a.keys.join(' ') === b.keys.join(' ')
  )
}

function wordsOf(text: string): Word[] {
  const out: Word[] = []
  let at = 0
  for (const w of text.split(' ')) {
    out.push({ text: w, start: at, end: at + w.length })
    at += w.length + 1
  }
  return out
}

/**
 * Where a DOM point sits in the passage, as (verse, character). A point inside
 * a word is exact; a point between words (a space, a verse number) moves to the
 * start of the next word, or the end of the previous one when it is an end.
 */
function pointOf(root: HTMLElement, node: Node, offset: number, isEnd: boolean): { n: number; offset: number } | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  const word = el?.closest<HTMLElement>('.psg__w')
  if (word && root.contains(word)) {
    const start = Number(word.dataset.start)
    // Measured, not read off the text node: the divine name splits a word
    // into more than one node (L + ORD in small capitals).
    let inside = 0
    if (node.nodeType === Node.TEXT_NODE) {
      const r = document.createRange()
      r.setStart(word, 0)
      r.setEnd(node, offset)
      inside = r.toString().length
    }
    return { n: Number(word.dataset.v), offset: start + inside }
  }
  // Not in a word: walk to the nearest one in document order.
  const words = [...root.querySelectorAll<HTMLElement>('.psg__w')]
  const probe = document.createRange()
  probe.setStart(node, offset)
  const after = words.find((w) => probe.comparePoint(w, 0) >= 0)
  const pick = isEnd ? (after ? words[words.indexOf(after) - 1] : words[words.length - 1]) : after
  if (!pick) return null
  return {
    n: Number(pick.dataset.v),
    offset: isEnd ? Number(pick.dataset.start) + (pick.textContent?.length ?? 0) : Number(pick.dataset.start),
  }
}

/**
 * The passage as text you can act on.
 *
 * Choosing words is the browser's own text selection — drag across lines and
 * verses, shift-click to extend, long-press on a phone — snapped out to whole
 * words when it settles. An earlier version tracked the drag word by word and
 * stopped at the end of a verse; it stuttered on anything longer than a line.
 * A click on a single word takes that word.
 */
export function PassageText({
  verses,
  mode,
  caught = null,
  selected = null,
  cited = [],
  highlights = [],
  lit = null,
  pending = null,
  onCatch,
  onVerse,
  onCite,
  onChoosing,
  onChosen,
  onRest,
  onHoverHighlight,
  slow = false,
}: Props) {
  const clean = verses.map((v) => ({ ...v, text: flatText(v) }))
  const rows = layoutPassage(verses)
  const caughtAt = findPhrase(clean, caught)
  const rootRef = useRef<HTMLDivElement>(null)
  const selecting = (mode === 'mark' && Boolean(onCatch)) || (mode === 'quote' && Boolean(onChosen))
  const down = useRef(false)

  /** The live selection, as a span of whole words — or null if it isn't ours. */
  const readSelection = (): WordSpan | null => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null
    const r = sel.getRangeAt(0)
    if (!root.contains(r.commonAncestorContainer)) return null
    const from = pointOf(root, r.startContainer, r.startOffset, false)
    const to = pointOf(root, r.endContainer, r.endOffset, true)
    if (!from || !to || to.n < from.n || (to.n === from.n && to.offset <= from.offset)) return null
    const t = spanText(clean, from, to)
    return t ? { ...t, from, to } : null
  }

  const settle = (span: WordSpan) => {
    window.getSelection()?.removeAllRanges()
    if (mode === 'mark') onCatch?.(span.text)
    else onChosen?.(span)
  }

  // While selecting, report the words live so the answer can show where they
  // will land.
  useEffect(() => {
    if (!selecting || !onChoosing) return
    const onChange = () => {
      if (!down.current) return
      onChoosing(readSelection())
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
    // readSelection reads refs and the current verses; re-bound when they change.
  }, [selecting, onChoosing, verses])

  const wordSpan = (n: number, w: Word): WordSpan => ({
    text: w.text.replace(/^[“”‘’"'(\[—–-]+/, '').replace(/[“”‘’"',.;:)\]—–-]+$/, ''),
    v: n,
    vEnd: n,
    from: { n, offset: w.start },
    to: { n, offset: w.end },
  })

  const pendingCovers = (n: number, w: Word) => {
    if (!pending) return false
    const after = n > pending.from.n || (n === pending.from.n && w.end > pending.from.offset)
    const before = n < pending.to.n || (n === pending.to.n && w.start < pending.to.offset)
    return after && before
  }

  /** One verse's words within one row — a line of a poem, or a run of prose. */
  const fragment = (f: Frag, hang: boolean) => {
    const words = wordsOf(f.text).map((w) => ({ ...w, start: w.start + f.char, end: w.end + f.char }))
    const inSel = selected != null && f.n >= selected.from && f.n <= selected.to
    const hl = highlights.filter((h) => h.n === f.n)
    const verseCite = (mode === 'cite' || mode === 'quote') && onCite
    // What lights each word, worked out first so a word can see its neighbours.
    const lights: (Light | null)[] = words.map((w, i) => {
      if (f.selah && i === words.length - 1) return null
      const cover = hl.filter((h) => w.end > h.start && w.start < h.end)
      const keys = cover.map((h) => h.key)
      return {
        on: caughtAt != null && caughtAt.n === f.n && w.end > caughtAt.start && w.start < caughtAt.end,
        hl: cover.length ? (cover.some((h) => h.here) ? (cover.length > 1 ? 'deep' : 'here') : 'past') : undefined,
        lit: Boolean(lit && keys.includes(lit)),
        pending: pendingCovers(f.n, w),
        keys,
      }
    })
    return (
      <span
        key={`${f.n}:${f.word}`}
        className="psg__v"
        data-sel={inSel ? 'true' : undefined}
        data-cited={cited.includes(f.n) ? 'true' : undefined}
        style={slow ? { animationDelay: `${f.vi * 1.6}s` } : undefined}
        onClick={mode === 'choose' && onVerse ? (e) => onVerse(f.n, e.shiftKey) : undefined}
      >
        {f.lead &&
          (verseCite ? (
            <button
              type="button"
              className="psg__n psg__n--cite"
              data-hang={hang ? 'true' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onCite(f.n)}
              aria-label={`Bring verse ${f.n} into your answer`}
              title="Bring this whole verse in"
            >
              {f.n}
            </button>
          ) : (
            <sup className="psg__n" data-hang={hang ? 'true' : undefined}>
              {f.n}
            </sup>
          ))}
        {words.map((w, i) => {
          if (f.selah && i === words.length - 1) {
            return (
              <span key={i} className="psg__selah">
                {w.text}
              </span>
            )
          }
          const here = lights[i]!
          const next = i < words.length - 1 ? lights[i + 1] : null
          const prev = i > 0 ? lights[i - 1] : null
          // A band carries across the space between two words it lights —
          // the space is lit too (`psg__sp`), and the corners between them
          // square off. Lit word by word, a chosen phrase read as a row of
          // tiles with slits between them, wider the wider the font's space.
          const joinR = joined(here, next)
          const joinL = joined(prev, here)
          const lightProps = (l: Light) => ({
            'data-on': l.on ? 'true' : undefined,
            'data-hl': l.hl,
            'data-lit': l.lit ? 'true' : undefined,
            'data-pending': l.pending ? 'true' : undefined,
          })
          const hover = onHoverHighlight
            ? (e: ReactMouseEvent<HTMLElement>) =>
                onHoverHighlight(here.keys.length ? here.keys : null, here.keys.length ? e.currentTarget : null)
            : undefined
          return (
            <span key={i}>
              <span
                className="psg__w"
                data-v={f.n}
                data-start={w.start}
                {...lightProps(here)}
                data-keys={here.keys.length ? here.keys.join(' ') : undefined}
                data-jl={joinL ? 'true' : undefined}
                data-jr={joinR ? 'true' : undefined}
                onMouseEnter={hover}
              >
                {divineName(w.text).map((seg, k) =>
                  seg.name ? (
                    <span key={k} className="psg__sc">
                      {seg.text[0]}
                      <span>{seg.text.slice(1)}</span>
                    </span>
                  ) : (
                    seg.text
                  ),
                )}
              </span>
              {i < words.length - 1 &&
                (joinR ? (
                  <span className="psg__sp" {...lightProps(here)} onMouseEnter={hover}>
                    {' '}
                  </span>
                ) : (
                  ' '
                ))}
            </span>
          )
        })}{' '}
      </span>
    )
  }

  return (
    <div
      ref={rootRef}
      className="psg"
      data-mode={mode}
      data-selecting={selecting ? 'true' : undefined}
      data-slow={slow ? 'true' : undefined}
      onPointerDown={() => {
        if (selecting) down.current = true
      }}
      onPointerUp={(e) => {
        if (!selecting) return
        down.current = false
        const span = readSelection()
        if (span) {
          settle(span)
          return
        }
        // No selection: a click (or a tap) on one word takes the word.
        const word = (e.target as HTMLElement).closest<HTMLElement>('.psg__w')
        if (!word) {
          onChoosing?.(null)
          return
        }
        const n = Number(word.dataset.v)
        const w = wordsOf(clean.find((x) => x.n === n)?.text ?? '').find((x) => x.start === Number(word.dataset.start))
        if (w) settle(wordSpan(n, w))
      }}
      onPointerMove={(e) => {
        if (!selecting || down.current || !onRest) return
        const word = (e.target as HTMLElement).closest<HTMLElement>('.psg__w')
        onRest(word ? { n: Number(word.dataset.v), offset: Number(word.dataset.start) } : null)
      }}
      onPointerLeave={() => {
        onRest?.(null)
        onHoverHighlight?.(null, null)
      }}
    >
      {rows.map((row, ri) => (
        <Fragment key={ri}>
          {row.head && (
            <div className="psg__head" data-kind={row.head.kind}>
              {row.head.text}
            </div>
          )}
          <div
            className="psg__row"
            data-kind={row.kind}
            data-indent={row.kind === 'poetry' ? row.indent : undefined}
            data-gap={row.gap ? 'true' : undefined}
            data-flush={row.flush ? 'true' : undefined}
          >
            {row.frags.map((f, fi) => fragment(f, row.kind === 'poetry' && fi === 0))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
