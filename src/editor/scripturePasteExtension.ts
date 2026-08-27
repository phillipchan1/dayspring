import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { formatScriptureInsert } from '@/lib/spiritualBlocks'
import { detectScripturePaste } from '@/lib/scripture/pasteDetect'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'

/**
 * On paste, wrap a high-confidence Bible-app verse as a scripture fence.
 * Uncertain pastes fall through as plain text. Image pastes are left to
 * attachmentDropExtension (higher precedence).
 */
export function scripturePasteExtension(onWrapped: (reference: string) => void): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const dt = event.clipboardData
      if (!dt) return false
      if (dt.files && dt.files.length > 0) return false
      const text = dt.getData('text/plain')
      if (!text) return false

      const hit = detectScripturePaste(text)
      if (!hit) return false

      const sel = view.state.selection.main
      const blocks = view.state.field(spiritualBlocksField)
      if (posInsideBlock(blocks, sel.from)) return false

      event.preventDefault()
      const doc = view.state.doc.toString()
      const id = crypto.randomUUID()
      const insert = formatScriptureInsert(id, hit.body, hit.reference, doc, sel.from)
      const withTrailing = insert.endsWith('\n') ? insert : `${insert}\n`
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: withTrailing },
        selection: { anchor: sel.from + withTrailing.length },
      })
      onWrapped(hit.reference)
      return true
    },
  })
}
