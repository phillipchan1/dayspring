import { keymap } from '@codemirror/view'
import { applyFormat } from './formatSelection'

/** Editor-local formatting shortcuts (won't fire when selection is empty). */
export const formatKeymap = keymap.of([
  {
    key: 'Mod-b',
    run: (view) => applyFormat(view, 'bold'),
  },
  {
    key: 'Mod-i',
    run: (view) => applyFormat(view, 'italic'),
  },
  {
    key: 'Mod-e',
    run: (view) => applyFormat(view, 'code'),
  },
  {
    key: 'Mod-k',
    preventDefault: true,
    run: (view) => {
      if (view.state.selection.main.empty) return false
      return applyFormat(view, 'link')
    },
  },
])
