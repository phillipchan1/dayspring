import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { liveRitualRange } from './practices/usePracticeInsertion'

/**
 * The hold: while the caret is inside a ritual, the rest of the entry recedes.
 *
 * A ritual is usually begun partway down a page that already has writing on it,
 * and the question you are answering has to compete with every sentence around
 * it — which is what made a practice hard to see, and worst on a phone, where
 * the keyboard has already taken half the screen. Stepping into the block quiets
 * everything that is not the practice; stepping out gives it all straight back.
 *
 * Independent of focus mode (`dimming.ts`), which fades everything outside the
 * paragraph under the cursor and only when the writer has asked for it. This is
 * narrower and unasked-for: it lasts exactly as long as the caret is inside a
 * ritual, and it recedes a great deal less far, because what it is quieting is
 * the writer's own earlier writing.
 *
 * A `ViewPlugin` rather than a `StateField` so it can walk `visibleRanges` and
 * decorate only what is on screen — a long entry never pays for the lines nobody
 * is looking at.
 */
const awayLine = Decoration.line({ class: 'cm-ritual-away' })

function buildDecorations(view: EditorView): DecorationSet {
  const range = liveRitualRange(view.state)
  if (!range) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const { doc } = view.state
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.to < range.from || line.from > range.to) {
        builder.add(line.from, line.from, awayLine)
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const holdTheme = EditorView.theme({
  '.cm-ritual-away': {
    opacity: '0.32',
    transition: 'opacity 220ms ease',
  },
  // Scripture and prayer render as block widgets that sit *between* lines, so a
  // line decoration can't reach them — left alone one would stay at full
  // strength and dominate a page that has otherwise stepped back. The blank stub
  // CodeMirror renders for the widget's own line carries the class, so adjacency
  // reaches it. Same trick `dimming.ts` uses.
  '.cm-line.cm-ritual-away + .cm-spiritual-block': {
    opacity: '0.32',
    transition: 'opacity 220ms ease',
  },
  // Readable on demand — the same bargain focus mode strikes.
  '.cm-ritual-away:hover, .cm-line.cm-ritual-away + .cm-spiritual-block:hover': {
    opacity: '1',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-ritual-away, .cm-line.cm-ritual-away + .cm-spiritual-block': {
      transition: 'none',
    },
  },
})

const holdPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

/**
 * Registered unconditionally — it costs one null check per update in an entry
 * with no ritual in it, which is nearly every entry.
 */
export const ritualHoldExtension: Extension = [holdTheme, holdPlugin]
