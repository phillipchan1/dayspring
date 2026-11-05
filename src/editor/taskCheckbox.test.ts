// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { taskListExtension } from './taskListExtension'
import { spiritualBlocksField } from './spiritualBlocksField'

/** jsdom has no PointerEvent; the tap model reads only these fields. */
function pointer(type: string, pointerType: string, x = 5, y = 5): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

const mounted: EditorView[] = []
afterEach(() => {
  for (const view of mounted.splice(0)) view.destroy()
  document.body.replaceChildren()
})

function mount(doc: string): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ base: markdownLanguage, codeLanguages: [] }),
        spiritualBlocksField,
        taskListExtension(),
      ],
    }),
    parent: document.body,
  })
  mounted.push(view)
  return view
}

const box = (view: EditorView) => view.dom.querySelector('.cm-task-checkbox') as HTMLElement

describe('task checkbox', () => {
  it('a mouse ticks it on the press', () => {
    const view = mount('- [ ] pray for Sam')
    box(view).dispatchEvent(pointer('pointerdown', 'mouse'))
    expect(view.state.doc.toString()).toBe('- [x] pray for Sam')
  })

  it('a finger ticks it on the release, not the press', () => {
    const view = mount('- [ ] pray for Sam')
    box(view).dispatchEvent(pointer('pointerdown', 'touch'))
    expect(view.state.doc.toString()).toBe('- [ ] pray for Sam')
    box(view).dispatchEvent(pointer('pointerup', 'touch'))
    expect(view.state.doc.toString()).toBe('- [x] pray for Sam')
  })

  it('a scroll that starts on the box does not tick it', () => {
    const view = mount('- [ ] pray for Sam')
    box(view).dispatchEvent(pointer('pointerdown', 'touch', 5, 5))
    box(view).dispatchEvent(pointer('pointermove', 'touch', 5, 60))
    box(view).dispatchEvent(pointer('pointerup', 'touch', 5, 60))
    expect(view.state.doc.toString()).toBe('- [ ] pray for Sam')
  })

  it('does not focus an editor that was only being read', () => {
    const view = mount('- [x] done')
    expect(view.hasFocus).toBe(false)
    box(view).dispatchEvent(pointer('pointerdown', 'touch'))
    box(view).dispatchEvent(pointer('pointerup', 'touch'))
    expect(view.state.doc.toString()).toBe('- [ ] done')
    expect(document.activeElement).not.toBe(view.contentDOM)
  })
})
