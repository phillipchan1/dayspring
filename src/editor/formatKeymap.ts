import { keymap, type EditorView } from '@codemirror/view'
import { applyFormat } from './formatSelection'

/**
 * Editor-local formatting shortcuts (won't fire when the selection is empty).
 * `onRequestLink` is invoked for ⌘K so the caller can open the link popover —
 * link entry is a UI flow, not a synchronous text edit.
 */
export function formatKeymap(onRequestLink: (view: EditorView) => void) {
  return keymap.of([
    {
      key: 'Mod-b',
      preventDefault: true,
      run: (view) => applyFormat(view, 'bold'),
    },
    {
      key: 'Mod-i',
      preventDefault: true,
      run: (view) => applyFormat(view, 'italic'),
    },
    {
      key: 'Mod-e',
      preventDefault: true,
      run: (view) => applyFormat(view, 'code'),
    },
    {
      key: 'Mod-k',
      preventDefault: true,
      run: (view) => {
        if (view.state.selection.main.empty) return false
        onRequestLink(view)
        return true
      },
    },
  ])
}
