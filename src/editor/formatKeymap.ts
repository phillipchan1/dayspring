import { keymap, type EditorView } from '@codemirror/view'
import { applyFormat } from './formatSelection'

/**
 * Editor-local formatting shortcuts. With no selection, inline marks (bold/italic/code/strike)
 * insert paired markers and place the cursor between them. `onRequestLink` is invoked for ⌘K
 * so the caller can open the link popover — link entry is a UI flow, not a synchronous text edit.
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
      // Deliberate shadow: historyKeymap binds Mod-u to `undoSelection`, and this
      // keymap is registered at Prec.highest, so underline wins inside the
      // editor. undoSelection is obscure and isn't in the shortcuts guide;
      // underline is a formatting control people expect on ⌘U. (⌘U is not
      // view-source on macOS — Safari and Chrome both use ⌥⌘U — and
      // preventDefault covers the browsers where Ctrl+U is.)
      key: 'Mod-u',
      preventDefault: true,
      run: (view) => applyFormat(view, 'underline'),
    },
    {
      // ⌘H is unavailable: macOS takes it for Hide Application above the page.
      key: 'Mod-Shift-h',
      preventDefault: true,
      run: (view) => applyFormat(view, 'highlight'),
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
