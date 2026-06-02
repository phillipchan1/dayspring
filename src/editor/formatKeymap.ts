import { keymap } from '@codemirror/view'
import { applyFormat } from './formatSelection'

/** Editor-local formatting shortcuts (won't fire when selection is empty). */
export const formatKeymap = keymap.of([
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
      return applyFormat(view, 'link')
    },
  },
])
