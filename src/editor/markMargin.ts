import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { Prec, RangeSetBuilder, StateField, type Extension, type Text } from '@codemirror/state'
import type { ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import { buildGlyphElement } from './markGlyph'
import { markedRunLines } from './spiritualBlockDecoration'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'

/**
 * The margin, closed.
 *
 * Not a button labelled "sidebar" — the page's own margin rule: a hairline down
 * the right edge of the writing column, with a small glyph sitting on it at the
 * vertical position of each marking's line. Closed, it is already meaningful:
 * you can see there are three markings and roughly where, in fourteen pixels.
 * It isn't chrome, because a page has a margin whether or not anyone writes in
 * it.
 *
 * The glyphs are widget decorations attached to their own lines rather than an
 * overlay positioned by measurement. That is the whole reason this costs
 * nothing: a decoration moves and scrolls with its line for free, so there is no
 * per-frame `coordsAtPos` sweep on the input path and nothing to keep in sync.
 * Principle 3 is a hard constraint on this surface, not a preference.
 *
 * Scripture is the exception, and it has to be: it still renders as a block
 * replace widget, and a decoration placed inside a replaced range is swallowed.
 * Its glyph is drawn by the block widget itself (spiritualBlockDecoration.ts),
 * positioned against the same rule.
 */

/** Distance from the writing column's right edge to the rule, in rem. */
const RULE_OFFSET_REM = 1.1
/** Half-width of the clickable band around the rule, in px. */
const RULE_HIT_PX = 9

class MarkGlyphWidget extends WidgetType {
  constructor(
    readonly kind: SpiritualItemType,
    readonly id: string,
  ) {
    super()
  }

  eq(other: MarkGlyphWidget): boolean {
    return other.kind === this.kind && other.id === this.id
  }

  toDOM(): HTMLElement {
    return buildGlyphElement(this.kind, this.id)
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildGlyphs(blocks: readonly ParsedSpiritualBlock[], doc: Text): DecorationSet {
  if (blocks.length === 0) return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  for (const block of blocks) {
    // Drawn inside its own block widget instead — see the module comment.
    if (block.type === 'scripture') continue
    const run = markedRunLines(doc, block)
    if (!run) continue
    const at = doc.line(run.firstLine).from
    builder.add(
      at,
      at,
      Decoration.widget({ widget: new MarkGlyphWidget(block.type, block.id), side: -1 }),
    )
  }
  return builder.finish()
}

const glyphField = StateField.define<DecorationSet>({
  create(state) {
    return buildGlyphs(state.field(spiritualBlocksField), state.doc)
  },
  update(deco, tr) {
    if (tr.docChanged) return buildGlyphs(tr.state.field(spiritualBlocksField), tr.state.doc)
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

const marginTheme = EditorView.theme({
  // The containing block for the rule. `.cm-content` is the writing column
  // itself, so the rule runs the full height of the document and scrolls with
  // it — which is what makes it a margin rather than a fixed strip of UI.
  '.cm-content': {
    position: 'relative',
  },
  // A pseudo-element, so there is one more paint and zero more DOM inside a
  // contenteditable. It takes no pointer events; the band around it is handled
  // by a listener on the scroller, which also catches clicks on bare margin.
  '.cm-content::before': {
    content: '""',
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    width: '1px',
    background: 'color-mix(in srgb, var(--text-faint) 26%, transparent)',
    pointerEvents: 'none',
  },
  // Each glyph is positioned against its own line, which is what lets it track
  // the text with no measurement.
  '.cm-line': {
    position: 'relative',
  },
  '.cm-mark-glyph': {
    // `display` is set here rather than only in global.css: the base rule there
    // hides the scripture widget's own hand when this extension isn't loaded.
    display: 'inline-flex',
    position: 'absolute',
    top: '0.15em',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    transform: 'translateX(-50%)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '1.15em',
    cursor: 'pointer',
    userSelect: 'none',
    // Arrival is a fade, never a movement: motion in peripheral vision is what
    // breaks concentration, opacity is not.
    animation: 'ds-glyph-in 600ms ease both',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-mark-glyph': { animation: 'none' },
  },
  // Faint to the point of nearly not being there until you look for it, and it
  // brightens on hover. This sits in the writing surface permanently, so it has
  // to earn its pixels twice.
  '.cm-mark-here': {
    position: 'absolute',
    top: '0.1em',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '1.2em',
    color: 'var(--text-faint)',
    fontSize: '0.7em',
    lineHeight: '1',
    opacity: '0.45',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'opacity 120ms ease, color 120ms ease',
  },
  '.cm-mark-here:hover': {
    opacity: '1',
    color: 'var(--text)',
  },

  // The rule, its hands and the `+` are the margin's whole closed state, and a
  // phone has no room beside the column for any of them. The margin opens as a
  // bottom sheet there instead (MarkMargin.css), and marking on touch stays with
  // the command toolbar above the keyboard.
  '@media (max-width: 767px)': {
    '.cm-content::before': { display: 'none' },
    '.cm-mark-glyph': { display: 'none' },
    '.cm-mark-here': { display: 'none' },
  },
})

/**
 * The margin `+`, on the rule beside wherever you are.
 *
 * One affordance serves both manual gestures. With a selection it marks the
 * selection's lines; with a bare caret it marks the paragraph you are in. They
 * were specified as two gestures — select-then-choose, and a `+` on the current
 * line — but they differ only in what the range resolves to, and a second
 * control in the writing surface is exactly the accretion Principle 3 warns
 * about. The place you read markings is the place you make them.
 *
 * It appears only while the editor has focus, and never beside a line that is
 * already marked: a fence inside a fence is not a document anyone can edit back
 * out of, and the line already has a hand on the rule there.
 */
class MarkHereWidget extends WidgetType {
  eq(): boolean {
    // Identical wherever it lands, so CodeMirror moves the same node between
    // lines instead of tearing one down and fading a new one in on every
    // keystroke.
    return true
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-mark-here'
    el.setAttribute('contenteditable', 'false')
    el.title = 'Set this apart'
    el.textContent = '+'
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

const markHereWidget = Decoration.widget({ widget: new MarkHereWidget(), side: -1 })

function buildMarkHere(view: EditorView): DecorationSet {
  if (!view.hasFocus) return Decoration.none
  const { from } = view.state.selection.main
  const blocks = view.state.field(spiritualBlocksField)
  if (posInsideBlock(blocks, from)) return Decoration.none
  const line = view.state.doc.lineAt(from)
  return Decoration.set([markHereWidget.range(line.from)])
}

function markHerePlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildMarkHere(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          this.decorations = buildMarkHere(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/**
 * Open the margin from the closed rule: a click on a glyph, or anywhere in the
 * narrow band around the hairline.
 *
 * The band is checked against the content box on the click itself rather than
 * tracked — a rect read per click costs nothing, and there is no resize
 * observer to keep alive.
 */
function railClickPlugin(onOpen: () => void) {
  return ViewPlugin.define((view: EditorView) => {
    const onMouseDown = (event: MouseEvent) => {
      // The `+` sits in this same band and has its own handler. Without this the
      // one click both opened the picker and opened the margin.
      const el = event.target as HTMLElement | null
      if (el?.closest('.cm-mark-here')) return
      const rect = view.contentDOM.getBoundingClientRect()
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const ruleX = rect.right + RULE_OFFSET_REM * rem
      if (Math.abs(event.clientX - ruleX) > RULE_HIT_PX) return
      event.preventDefault()
      onOpen()
    }
    view.scrollDOM.addEventListener('mousedown', onMouseDown)
    return {
      destroy() {
        view.scrollDOM.removeEventListener('mousedown', onMouseDown)
      },
    }
  })
}

/**
 * The closed margin: the rule, and a hand on it beside every marking.
 *
 * `onOpen` fires from a glyph or from the rule itself. Nothing here ever takes
 * focus — you can write straight through it.
 */
export function markMarginExtension(
  onOpen: () => void,
  /** The `+` was pressed. Carries the viewport rect of the `+` itself. */
  onMarkHere?: (at: { top: number; bottom: number; left: number }) => void,
): Extension {
  return [
    marginTheme,
    glyphField,
    markHerePlugin(),
    railClickPlugin(onOpen),
    // Ahead of the block click handler, which would otherwise read a click on
    // the scripture glyph as a click on the verse and open the chapter pane.
    Prec.highest(
      EditorView.domEventHandlers({
        mousedown(event) {
          const el = event.target as HTMLElement | null
          const plus = el?.closest('.cm-mark-here') as HTMLElement | null
          if (plus) {
            // Cancel the mousedown rather than handling the click: the caret and
            // any live selection have to survive, since the selection is the
            // range about to be marked.
            event.preventDefault()
            const rect = plus.getBoundingClientRect()
            onMarkHere?.({ top: rect.top, bottom: rect.bottom, left: rect.left })
            return true
          }
          if (!el?.closest('.cm-mark-glyph')) return false
          event.preventDefault()
          onOpen()
          return true
        },
      }),
    ),
  ]
}
