import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { parseSpiritualBlocks, type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'

class SpiritualBlockWidget extends WidgetType {
  constructor(
    readonly type: SpiritualItemType,
    readonly content: string,
    readonly reference: string | null,
  ) {
    super()
  }

  eq(other: SpiritualBlockWidget): boolean {
    return (
      other.type === this.type &&
      other.content === this.content &&
      other.reference === this.reference
    )
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = `cm-spiritual-block cm-spiritual-block--${this.type}`
    root.setAttribute('contenteditable', 'false')

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

function buildDecorations(state: EditorView['state']): DecorationSet {
  const markdown = state.doc.toString()
  const blocks = parseSpiritualBlocks(markdown)
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
      widget: new SpiritualBlockWidget(block.type, block.content, block.reference ?? null),
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
    return buildDecorations(state)
  },
  update(deco, tr) {
    if (tr.docChanged) return buildDecorations(tr.state)
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

/**
 * Paint Dayspring spiritual fences as styled blocks; raw ```dayspring-*``` syntax
 * stays in the document for search, sync, and export.
 */
export const spiritualBlockExtension: Extension = [spiritualBlockTheme, spiritualBlockField]
