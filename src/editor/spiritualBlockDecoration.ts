import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import { computeBlockPanelAnchor, type InlinePanelAnchor } from './inlinePanelAnchor'
import { spiritualBlocksField } from './spiritualBlocksField'

/** A spiritual block the user clicked, resolved fresh from the live document. */
export interface SpiritualBlockEditTarget {
  id: string
  type: SpiritualItemType
  content: string
  reference: string | null
  /** Character range of the fenced block in the current document. */
  from: number
  to: number
}

class SpiritualBlockWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly type: SpiritualItemType,
    readonly content: string,
    readonly reference: string | null,
  ) {
    super()
  }

  eq(other: SpiritualBlockWidget): boolean {
    return (
      other.id === this.id &&
      other.type === this.type &&
      other.content === this.content &&
      other.reference === this.reference
    )
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = `cm-spiritual-block cm-spiritual-block--${this.type}`
    root.setAttribute('contenteditable', 'false')
    root.dataset.blockId = this.id
    root.title = 'Click to edit'

    if (this.type === 'scripture') {
      const verse = document.createElement('p')
      verse.className = 'cm-spiritual-block__verse'
      verse.textContent = this.content || ' '
      root.append(verse)
      if (this.reference) {
        const ref = document.createElement('p')
        ref.className = 'cm-spiritual-block__reference'
        ref.textContent = this.reference
        root.append(ref)
      }
      return root
    }

    if (this.type === 'sense') {
      const body = document.createElement('p')
      body.className = 'cm-spiritual-block__sense'
      body.textContent = this.content || ' '
      root.append(body)
      return root
    }

    const label = document.createElement('span')
    label.className = 'cm-spiritual-block__label'
    label.textContent = this.type

    const body = document.createElement('p')
    body.className = 'cm-spiritual-block__content'
    body.textContent = this.content || ' '

    root.append(label, body)
    return root
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildDecorations(blocks: readonly ParsedSpiritualBlock[]): DecorationSet {
  if (blocks.length === 0) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  for (const block of blocks) {
    addBlockDecoration(builder, block)
  }
  return builder.finish()
}

function addBlockDecoration(
  builder: RangeSetBuilder<Decoration>,
  block: ParsedSpiritualBlock,
): void {
  if (block.to <= block.from) return
  builder.add(
    block.from,
    block.to,
    Decoration.replace({
      widget: new SpiritualBlockWidget(
        block.id,
        block.type,
        block.content,
        block.reference ?? null,
      ),
      block: true,
      inclusive: false,
    }),
  )
}

const spiritualBlockTheme = EditorView.theme({
  '.cm-spiritual-block': {
    display: 'block',
    margin: '0.2rem 0',
    userSelect: 'none',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    transition: 'background 120ms ease, box-shadow 120ms ease',
  },
  '.cm-spiritual-block:hover': {
    background: 'color-mix(in srgb, var(--accent-soft) 30%, transparent)',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  '.cm-spiritual-block--prayer:hover': {
    background: 'color-mix(in srgb, var(--accent-soft) 62%, transparent)',
  },
  '.cm-spiritual-block--prayer': {
    padding: '0.5rem 0 0.5rem 0.85rem',
    borderLeft: '2px solid var(--accent)',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
    background: 'color-mix(in srgb, var(--accent-soft) 45%, transparent)',
  },
  // Letter-spaced cap label — the shared elegance motif (matches practice
  // labels + scripture citations) so one font still reads as a type system.
  '.cm-spiritual-block__label': {
    display: 'block',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    fontWeight: '500',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    marginBottom: '0.4rem',
  },
  '.cm-spiritual-block__content': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    fontSize: '1.02em',
    lineHeight: '1.6',
    color: 'var(--text-bright)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontOpticalSizing: 'auto',
  },
  '.cm-spiritual-block--scripture': {
    padding: '0.1rem 0 0.1rem 1rem',
    borderLeft: '1px solid color-mix(in srgb, var(--accent) 32%, transparent)',
    background: 'transparent',
  },
  // The quoted verse reads as an elegant pull-quote: italic, a touch larger for
  // presence, airy leading, optically sized on variable serifs.
  '.cm-spiritual-block__verse': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    // A tier below the practice question (1.06em) so a quoted verse reads as
    // supporting content, not a competing prompt.
    fontSize: '0.9em',
    fontStyle: 'italic',
    lineHeight: '1.6',
    letterSpacing: '0.005em',
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontOpticalSizing: 'auto',
  },
  // The citation echoes the cap-label motif — a tracked small cap, not a stray
  // mono line — which is what knits the verse into the rest of the surface.
  '.cm-spiritual-block__reference': {
    margin: '0.55em 0 0',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    fontWeight: '500',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    lineHeight: '1.4',
    color: 'var(--text-faint)',
  },
  '.cm-spiritual-block--sense': {
    padding: '0.1rem 0',
    border: 'none',
    background: 'transparent',
  },
  '.cm-spiritual-block__sense': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.95em',
    fontStyle: 'italic',
    lineHeight: '1.6',
    letterSpacing: '0.005em',
    color: 'var(--md-emphasis)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontOpticalSizing: 'auto',
  },
})

/** Block replace widgets must live on EditorView.decorations, not ViewPlugin. */
const spiritualBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.field(spiritualBlocksField))
  },
  update(deco, tr) {
    if (tr.docChanged) return buildDecorations(tr.state.field(spiritualBlocksField))
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

/**
 * Click a rendered block to edit it: resolve the block fresh from the live
 * document (positions stay correct even after edits above it) and hand the
 * caller its range + contents so it can reopen the matching popover.
 *
 * Uses click-coordinate → document position lookup so that two blocks sharing
 * the same UUID (e.g. copy-pasted) are each resolved to their own range rather
 * than always resolving to the first occurrence.
 */
function blockClickHandler(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const el = event.target as HTMLElement | null
      const blockEl = el?.closest('.cm-spiritual-block') as HTMLElement | null
      if (!blockEl) return false

      // Resolve which block was clicked by position, not by ID — two blocks
      // with the same UUID (copy-paste) must each be independently editable.
      const blocks = view.state.field(spiritualBlocksField)
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      let block = pos === null ? undefined : blocks.find((b) => pos >= b.from && pos < b.to)
      // Coords can land outside the block's range when it's rendered tight against
      // another block widget (e.g. a scripture answer beneath a practice prompt)
      // or when the click hits the citation at the very bottom edge. Fall back to
      // the clicked element's own id so the block is always editable.
      if (!block && blockEl.dataset.blockId) {
        block = blocks.find((b) => b.id === blockEl.dataset.blockId)
      }
      if (!block) return false

      event.preventDefault()
      // Exclude the block's trailing newline so an in-place replace keeps the
      // surrounding paragraph spacing intact.
      const docLen = view.state.doc.length
      const to = Math.min(block.to, docLen)
      const editTo = to > 0 && view.state.doc.sliceString(to - 1, to) === '\n' ? to - 1 : to
      onEdit(
        {
          id: block.id,
          type: block.type,
          content: block.content,
          reference: block.reference ?? null,
          from: block.from,
          to: editTo,
        },
        computeBlockPanelAnchor(view, blockEl),
      )
      return true
    },
  })
}

/**
 * Paint Dayspring spiritual fences as styled blocks; raw ```dayspring-*``` syntax
 * stays in the document for search, sync, and export. Clicking a block invokes
 * `onEdit` so the caller can reopen the matching capture popover.
 */
export function spiritualBlockExtension(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  return [
    spiritualBlockTheme,
    spiritualBlockField,
    // Treat each rendered block as a single atom: arrows skip over it and
    // Backspace/Delete from an edge removes the whole fence in one stroke.
    EditorView.atomicRanges.of((view) => view.state.field(spiritualBlockField)),
    blockClickHandler(onEdit),
  ]
}
