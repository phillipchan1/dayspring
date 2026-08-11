import { Prec, RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { spiritualBlocksField, posInsideBlock } from './spiritualBlocksField'
import {
  parseTaskLine,
  taskBodyStart,
  taskMarkerRange,
  toggledMarker,
  uncheckedTaskPrefix,
} from '@/lib/taskListMarkdown'

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly markerFrom: number,
    readonly markerTo: number,
    readonly checked: boolean,
  ) {
    super()
  }

  eq(other: TaskCheckboxWidget): boolean {
    return (
      other.markerFrom === this.markerFrom &&
      other.markerTo === this.markerTo &&
      other.checked === this.checked
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-task-checkbox${this.checked ? ' cm-task-checkbox--checked' : ''}`
    el.setAttribute('role', 'checkbox')
    el.setAttribute('aria-checked', this.checked ? 'true' : 'false')
    el.setAttribute('aria-label', this.checked ? 'Mark incomplete' : 'Mark complete')
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      toggleTaskAt(view, this.markerFrom)
    })
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

function toggleTaskAt(view: EditorView, markerFrom: number): void {
  const line = view.state.doc.lineAt(markerFrom)
  const parsed = parseTaskLine(line.text)
  if (!parsed) return
  const range = taskMarkerRange(line.text)
  if (!range) return
  const from = line.from + range.from
  const to = line.from + range.to
  const insert = toggledMarker(parsed)
  view.dispatch({ changes: { from, to, insert } })
  view.focus()
}

function continueTaskOnEnter(view: EditorView): boolean {
  if (!view.state.selection.main.empty) return false

  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  const parsed = parseTaskLine(line.text)
  if (!parsed) return false

  const bodyStart = taskBodyStart(line.text)
  const rel = pos - line.from

  if (rel < bodyStart) return false

  if (!parsed.body.trim() && rel >= bodyStart && pos >= line.to) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: parsed.indent },
      selection: { anchor: line.from + parsed.indent.length },
    })
    return true
  }

  const cont = uncheckedTaskPrefix(parsed)

  if (rel === line.to) {
    const insert = `\n${cont}`
    view.dispatch({
      changes: { from: pos, insert },
      selection: { anchor: pos + insert.length },
    })
    return true
  }

  const beforeBody = line.text.slice(bodyStart, rel)
  const afterBody = line.text.slice(rel)
  const insert = `${beforeBody}\n${cont}${afterBody}`
  view.dispatch({
    changes: { from: line.from + bodyStart, to: line.to, insert },
    selection: { anchor: line.from + bodyStart + beforeBody.length + 1 + cont.length },
  })
  return true
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const blocks = view.state.field(spiritualBlocksField)
  const insideBlock = (pos: number) => posInsideBlock(blocks, pos)

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.text && !insideBlock(line.from)) {
        const parsed = parseTaskLine(line.text)
        if (parsed) {
          const marker = taskMarkerRange(line.text)
          if (marker) {
            const markerFrom = line.from + marker.from
            const markerTo = line.from + marker.to
            builder.add(
              markerFrom,
              markerTo,
              Decoration.replace({
                widget: new TaskCheckboxWidget(markerFrom, markerTo, parsed.checked),
                inclusive: false,
              }),
            )

            const bodyFrom = line.from + taskBodyStart(line.text)
            if (parsed.checked && bodyFrom < line.to) {
              builder.add(bodyFrom, line.to, Decoration.mark({ class: 'cm-task-body--checked' }))
            }
          }
        }
      }
      pos = line.to + 1
    }
  }

  return builder.finish()
}

const taskListPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

const taskListTheme = EditorView.theme({
  '.cm-task-checkbox': {
    display: 'inline-block',
    width: '0.95em',
    height: '0.95em',
    marginRight: '0.35em',
    verticalAlign: '-0.12em',
    border: '1.5px solid var(--text-dim)',
    borderRadius: '0.2em',
    background: 'color-mix(in srgb, var(--bg-input) 70%, transparent)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    position: 'relative',
  },
  '.cm-task-checkbox--checked': {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  '.cm-task-checkbox--checked::after': {
    content: '""',
    position: 'absolute',
    left: '0.17em',
    top: '0.06em',
    width: '0.28em',
    height: '0.48em',
    border: 'solid var(--accent)',
    borderWidth: '0 2px 2px 0',
    transform: 'rotate(45deg)',
  },
  '.cm-task-body--checked': {
    textDecoration: 'line-through',
    color: 'var(--text-dim)',
  },
})

/** Task list lines (`[]`, `[x]`, `- [ ]`) with Enter continuation and click-to-check. */
export function taskListExtension(): Extension {
  return [
    taskListTheme,
    taskListPlugin,
    Prec.highest(keymap.of([{ key: 'Enter', run: continueTaskOnEnter }])),
  ]
}
