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
  '.cm-spiritual-block__label': {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    marginBottom: '0.35rem',
  },
  '.cm-spiritual-block__content': {
    margin: '0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.02em',
    lineHeight: '1.55',
    color: 'var(--text-bright)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-spiritual-block--scripture': {
    padding: '0 0 0 0.85rem',
    borderLeft: '1px solid color-mix(in srgb, var(--border) 75%, transparent)',
    background: 'transparent',
  },
  '.cm-spiritual-block__verse': {
    margin: '0',
    fontFamily: 'var(--font-display)',
    fontSize: '0.9em',
    fontStyle: 'italic',
    lineHeight: '1.55',
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '.cm-spiritual-block__reference': {
    margin: '0.2em 0 0',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75em',
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
    fontFamily: 'var(--font-display)',
    fontSize: '0.95em',
    fontStyle: 'italic',
    lineHeight: '1.55',
    color: 'var(--md-emphasis)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
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
 */
function blockClickHandler(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const el = event.target as HTMLElement | null
      const blockEl = el?.closest('.cm-spiritual-block') as HTMLElement | null
      const id = blockEl?.dataset.blockId
      if (!id || !blockEl) return false
      const block = view.state.field(spiritualBlocksField).find((b) => b.id === id)
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
