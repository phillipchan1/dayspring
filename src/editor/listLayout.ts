import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'
import { parseTaskLine, taskBodyStart, taskMarkerRange } from '@/lib/taskListMarkdown'

/**
 * Lists set the way a book sets them: every item's words start on one
 * vertical, and a long item wraps under its own words rather than back under
 * the bullet.
 *
 * Markdown can't do that by itself. The prefix (`  - `, `1. `, `- [ ] `) is
 * ordinary text, its width depends on the face, and a wrapped line has no idea
 * it belongs to a list — so the second line of every long item used to start
 * at the left margin, under the dash.
 *
 * So the prefix is set in a fixed marker column instead:
 *
 *   - the indentation and the space after the marker are hidden (they're
 *     still in the document; nothing here rewrites an entry),
 *   - the marker itself — a drawn bullet, `orderedListNumbering`'s label, or
 *     `taskListExtension`'s checkbox — is exactly one column wide,
 *   - and the line hangs: `padding-left` of depth × column, `text-indent` of
 *     minus one column. The first line's marker sits in the gutter that makes;
 *     every wrapped line lands under the text.
 *
 * None of the widths depend on the face, which is the point — it holds in
 * Newsreader at 24px and in iA Writer Duo at 30px alike.
 *
 * Lives in the conceal compartment (Editor.tsx): with "Show markdown syntax"
 * on, the writer asked to see the characters, and a hidden indent is exactly
 * what they asked not to have.
 */

/** Each list level is one marker column deep. Mirrored in the theme below. */
const COLUMN = '1.5em'

class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }

  eq(other: BulletWidget): boolean {
    return other.depth === this.depth
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span')
    // Solid, hollow, square — the three a reader recognises as "one level in",
    // drawn rather than typed so they sit identically in every face (a text
    // `◦` falls back to some other font in half of the writing faces).
    el.className = `cm-li-bullet cm-li-bullet--${((this.depth - 1) % 3) + 1}`
    el.setAttribute('aria-hidden', 'true')
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

const bullets = new Map<number, Decoration>()
const bulletAt = (depth: number) => {
  let d = bullets.get(depth)
  if (!d) bullets.set(depth, (d = Decoration.replace({ widget: new BulletWidget(depth) })))
  return d
}

const lines = new Map<number, Decoration>()
const lineAt = (depth: number) => {
  let d = lines.get(depth)
  if (!d) {
    lines.set(
      depth,
      (d = Decoration.line({ class: 'cm-li', attributes: { style: `--li-depth: ${depth}` } })),
    )
  }
  return d
}

const hidden = Decoration.replace({})

function overlaps(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((r) => r.to >= from && r.from <= to)
}

/** Count of list containers above a ListItem — 1 for a top-level item. */
function listDepth(node: { parent: { name: string; parent: unknown } | null }): number {
  let depth = 0
  for (let n = node.parent as { name: string; parent: unknown } | null; n; n = n.parent as typeof n) {
    if (n.name === 'BulletList' || n.name === 'OrderedList') depth++
  }
  return depth
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view
  const { doc } = state
  const tree = syntaxTree(state)
  const blocks = state.field(spiritualBlocksField)
  // The tree pass and the bare-task pass interleave positions; collect, then
  // let Decoration.set order them.
  const out: { from: number; to: number; deco: Decoration }[] = []
  const done = new Set<number>()

  const layout = (lineFrom: number, depth: number, markFrom: number, markTo: number, kind: 'bullet' | 'ordered' | 'task') => {
    if (done.has(lineFrom)) return
    done.add(lineFrom)
    const line = doc.lineAt(lineFrom)
    const text = line.text
    const add = (from: number, to: number, deco: Decoration) => {
      if (to > from) out.push({ from, to, deco })
    }

    if (kind === 'task') {
      const marker = taskMarkerRange(text)
      if (!marker) return
      const boxFrom = line.from + marker.from
      const boxTo = line.from + marker.to
      const bodyFrom = line.from + taskBodyStart(text)
      out.push({ from: line.from, to: line.from, deco: lineAt(depth) })
      // Indent, then the `- ` that a checkbox makes redundant, then the gap
      // after the box: all hidden. The box itself is taskListExtension's.
      add(line.from, boxFrom, hidden)
      add(boxTo, bodyFrom, hidden)
      return
    }

    // The space(s) after the marker. A bare `-` with nothing after it is not
    // a list item yet, so there's always at least one here.
    let bodyFrom = markTo
    while (bodyFrom < line.to && (text[bodyFrom - line.from] === ' ' || text[bodyFrom - line.from] === '\t')) bodyFrom++

    out.push({ from: line.from, to: line.from, deco: lineAt(depth) })
    add(line.from, markFrom, hidden)
    // The marker shows as typed while the caret is on it — the same reveal
    // orderedListNumbering gives digits — so it can be retyped.
    if (kind === 'bullet' && !overlaps(view, markFrom, markTo)) add(markFrom, markTo, bulletAt(depth))
    add(markTo, bodyFrom, hidden)
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'ListItem') return
        if (posInsideBlock(blocks, node.from)) return false
        const mark = node.node.getChild('ListMark')
        if (!mark) return
        const line = doc.lineAt(mark.from)
        // A marker that isn't the first thing on its line (`> - x`, a list in
        // a quote) has text before it that this column can't account for.
        if (line.text.slice(0, mark.from - line.from).trim()) return
        const depth = listDepth(node.node)
        if (depth < 1) return
        const ordered = node.node.parent?.name === 'OrderedList'
        const task = !ordered && parseTaskLine(line.text) !== null
        layout(line.from, depth, mark.from, mark.to, ordered ? 'ordered' : task ? 'task' : 'bullet')
      },
    })

    // `[] item` with no bullet is a task line too (taskListExtension draws its
    // box), but it isn't a markdown list, so the tree never offered it above.
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos)
      if (!done.has(line.from) && line.text && !posInsideBlock(blocks, line.from)) {
        const parsed = parseTaskLine(line.text)
        if (parsed && !parsed.bullet) layout(line.from, 1, line.from, line.from, 'task')
      }
      pos = line.to + 1
    }
  }

  // Decoration.set sorts by side as well as position — a line decoration and
  // a replace both starting at a line's first character must go in that order.
  return Decoration.set(
    out.map((r) => r.deco.range(r.from, r.to)),
    true,
  )
}

const listLayoutPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.state) != syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

const listLayoutTheme = EditorView.theme({
  // `.cm-line.cm-li`, not `.cm-li`: editorTheme zeroes `.cm-line` padding at
  // the same specificity, and theme order isn't something to lean on.
  '.cm-line.cm-li': {
    paddingLeft: `calc(var(--li-depth, 1) * ${COLUMN})`,
    textIndent: `calc(-1 * ${COLUMN})`,
  },
  // Every marker is exactly one column. text-indent is inherited, so each
  // inline-block resets it or its own content slides out of the box.
  '.cm-li-bullet': {
    display: 'inline-block',
    width: COLUMN,
    textIndent: '0',
    position: 'relative',
    // An empty inline-block's baseline is its bottom edge; with no height it
    // sits on the text baseline and adds nothing to the line box.
    height: '0',
  },
  '.cm-li-bullet::before': {
    content: '""',
    position: 'absolute',
    // Centre at ~0.35em: the centre of a numeral in the same column, so a
    // bulleted list and a numbered one beside it share an axis.
    left: '0.2em',
    // Centred on the x-height, which is where a reader's eye expects a bullet
    // — not on the line box, which in a 1.7 leading is well above the letters.
    bottom: '0.2em',
    width: '0.3em',
    height: '0.3em',
    borderRadius: '50%',
    background: 'currentColor',
    boxSizing: 'border-box',
  },
  '.cm-li-bullet--2::before': {
    background: 'transparent',
    border: '0.075em solid currentColor',
  },
  '.cm-li-bullet--3::before': {
    borderRadius: '0.05em',
    width: '0.27em',
    height: '0.27em',
    bottom: '0.215em',
  },
  '.cm-li-bullet, .cm-li .cm-list-label': {
    color: 'color-mix(in srgb, var(--text) 55%, transparent)',
  },
  '.cm-li .cm-list-label': {
    display: 'inline-block',
    minWidth: COLUMN,
    textIndent: '0',
    fontVariantNumeric: 'lining-nums tabular-nums',
  },
  // The box is 0.95em; the margin fills the rest of the column.
  '.cm-li .cm-task-checkbox': {
    marginRight: `calc(${COLUMN} - 0.95em)`,
    textIndent: '0',
  },
})

/**
 * The hidden indent and gap are atomic, so the caret steps over them in one
 * press instead of stalling on characters nobody can see.
 */
export function listLayoutExtension(): Extension {
  return [
    listLayoutTheme,
    listLayoutPlugin,
    EditorView.atomicRanges.of((view) => view.plugin(listLayoutPlugin)?.decorations ?? Decoration.none),
  ]
}
