import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from 'react'
import { ChangeSet, Compartment, EditorState, Prec, type ChangeSpec, type Extension } from '@codemirror/state'
import { dropCursor, EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit, syntaxHighlighting } from '@codemirror/language'
import { editorTheme } from './theme'
import { markdownHighlight } from './highlight'
import { typewriterExtension } from './typewriter'
import { dimmingExtension } from './dimming'
import { firstLineTitleExtension } from './firstLineTitle'
import { bodyLinePlaceholder } from './bodyLinePlaceholder'
import {
  spiritualBlockExtension,
  type SpiritualBlockEditTarget,
} from './spiritualBlockDecoration'
import { spiritualBlocksField } from './spiritualBlocksField'
import { ensureBlockSeparation, parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from './inlinePanelAnchor'
import { formatKeymap } from './formatKeymap'
import { clearLink, linkUrlInRange, selectionAnchorRect, setLink } from './formatSelection'
import { LinkPopover, type LinkPopoverTarget } from './LinkPopover'
import { anchorFromView, SelectionFormatBar, type FormatBarAnchor } from './SelectionFormatBar'
import { commandLineHighlight } from './commandLineHighlight'
import { scriptureRefDecoration } from './scriptureRefDecoration'
import { taskListExtension } from './taskListExtension'
import { orderedListNumberingExtension } from './orderedListNumbering'
import { editorTabKeymap } from './tabKeymap'
import { computeInlinePanelAnchor } from './inlinePanelAnchor'
import { minimalDocChange } from './minimalDocChange'
import { detectSlash, type SlashCommandId, type SlashState } from './slashDetect'
import { SlashPalette } from './SlashPalette'
import { applyFormatCommand, type SlashSelection } from './slashCommands'
import {
  attachmentImageExtension,
  type AttachmentEditTarget,
  type ImageMenuPoint,
} from './attachmentImageExtension'
import type { ImageSize } from '@/lib/attachments'
import {
  attachmentBlockNormalizeExtension,
  insertBlockAttachmentAt,
  insertBlockPendingAttachmentsAt,
  removePendingAttachmentInView,
  replacePendingAttachmentInView,
} from './attachmentInsert'
import { attachmentDropExtension } from './attachmentDropExtension'
import { practicePromptExtension } from './practices/usePracticeInsertion'

export interface EditorHandle {
  /** Insert text at the given document position (e.g. after removing a /command). */
  insertAt: (pos: number, text: string) => void
  /** Replace the document range [from, to) — used to edit/remove a block in place. */
  replaceRange: (from: number, to: number, text: string) => void
  /** The editor's live document — authoritative when React `content` may lag. */
  getDoc: () => string
  /** Current caret position (main selection head) — capture before opening an overlay. */
  getCursor: () => number
  focus: () => void
  /** Return focus to the editor, optionally restoring the caret. */
  focusAt: (pos?: number) => void
  /** Blur the editor — dismisses the soft keyboard on mobile. */
  blur: () => void
  /** Trigger a slash command at the current cursor position (for mobile UI). */
  triggerCommand: (cmd: SlashCommandId) => void
  /** Insert a block-isolated attachment image at the given position. Returns caret after. */
  insertBlockAttachment: (pos: number, hash: string, ext: string, alt?: string) => number
  /** Show an uploading placeholder, then resolve via replace/remove helpers. */
  insertBlockPendingAttachment: (pos: number, pendingId: string, alt?: string) => number
  replacePendingAttachment: (
    pendingId: string,
    hash: string,
    ext: string,
    alt?: string,
    size?: ImageSize,
  ) => void
  removePendingAttachment: (pendingId: string) => void
  /**
   * Replace the document with a version that arrived from another device.
   *
   * The `initialDoc` effect deliberately refuses to re-seed an entry that is
   * already loaded, so it never fights live typing. This is the narrow, explicit
   * exception to that rule, and callers must only use it when the editor has no
   * unsaved local edits. The change is narrowed to the range that actually
   * differs so the caret, selection and scroll position survive.
   */
  applyRemoteDoc: (next: string) => void
}

interface EditorProps {
  /** Initial document. Re-seeded only when `docKey` changes (i.e. a different entry). */
  initialDoc: string
  /** Identity of the loaded entry. Changing it swaps the document. */
  docKey: string
  onChange: (doc: string) => void
  placeholder?: string
  /** When true, the next docKey swap skips autofocus (sidebar selection keeps list focus). */
  skipAutofocusRef?: MutableRefObject<boolean>
  autofocus?: boolean
  typewriter?: boolean
  dimming?: boolean
  /** Style the first content line as the entry title. Defaults to true. */
  titleStyling?: boolean
  /** Placeholder shown on the first body line (line 2) when a title exists but no body has been written. */
  bodyPlaceholder?: string
  slashEnabled?: boolean
  /** Highlight the line at this doc position while a command popover is open. */
  commandLinePos?: number | null
  /** Called when the /command picker opens or closes. */
  onSlashPaletteChange?: (open: boolean) => void
  /** Called when the user confirms a slash command; carries the doc position where
   *  the /command text began so the caller knows where to insert a response. */
  onSlashCommand?: (
    cmd: SlashCommandId,
    insertAt: number,
    anchor: ReturnType<typeof computeInlinePanelAnchor>,
  ) => void
  /** Called when the user clicks a rendered spiritual block to edit it. */
  onEditBlock?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void
  /** Called when the user left- or right-clicks a photo block to open its options menu. */
  onImageMenu?: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void
  /** Called when the user opens a practice's "about" sheet (by practice name). */
  onAboutPractice?: (name: string) => void
}

/**
 * CodeMirror 6, single-pane, near-live inline markdown.
 *
 * The view owns the document (uncontrolled) so typing is never gated by React
 * re-renders — zero input lag. We only push a fresh doc into the view when
 * `docKey` changes (loading another entry), preserving the caret otherwise.
 * Typewriter / dimming live in compartments so they toggle without rebuilding.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    initialDoc,
    docKey,
    onChange,
    placeholder,
    bodyPlaceholder,
    autofocus,
    typewriter = false,
    dimming = false,
    titleStyling = true,
    slashEnabled = false,
    commandLinePos = null,
    onSlashCommand,
    onEditBlock,
    onImageMenu,
    onAboutPractice,
    onSlashPaletteChange,
    skipAutofocusRef,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const typewriterCompartment = useRef(new Compartment())
  const dimCompartment = useRef(new Compartment())
  const titleCompartment = useRef(new Compartment())
  const commandLineCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onEditBlockRef = useRef(onEditBlock)
  const onImageMenuRef = useRef(onImageMenu)
  const onAboutPracticeRef = useRef(onAboutPractice)
  const setFormatBarRef = useRef<(anchor: FormatBarAnchor | null) => void>(() => {})
  const slashEnabledRef = useRef(slashEnabled)
  const titleStylingRef = useRef(titleStyling)
  const [formatBar, setFormatBar] = useState<FormatBarAnchor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [linkTarget, setLinkTarget] = useState<LinkPopoverTarget | null>(null)
  const setSlashRef = useRef(setSlashState)
  onChangeRef.current = onChange
  onEditBlockRef.current = onEditBlock
  onImageMenuRef.current = onImageMenu
  onAboutPracticeRef.current = onAboutPractice
  setFormatBarRef.current = setFormatBar
  slashEnabledRef.current = slashEnabled
  titleStylingRef.current = titleStyling
  setSlashRef.current = setSlashState

  // Open the link popover for the live selection (⌘K or the format-bar link button).
  const requestLink = useCallback((view: EditorView) => {
    const sel = view.state.selection.main
    if (sel.empty) return
    const rect = selectionAnchorRect(view)
    if (!rect) return
    setLinkTarget({
      from: sel.from,
      to: sel.to,
      url: linkUrlInRange(view, sel.from, sel.to) ?? '',
      rect,
    })
  }, [])
  const requestLinkRef = useRef(requestLink)
  requestLinkRef.current = requestLink

  useImperativeHandle(ref, () => ({
    insertAt: (pos: number, text: string) => {
      const view = viewRef.current
      if (!view) return
      const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
      view.dispatch({
        changes: { from: clamped, to: clamped, insert: text },
        selection: { anchor: clamped + text.length, head: clamped + text.length },
      })
      view.focus()
    },
    replaceRange: (from: number, to: number, text: string) => {
      const view = viewRef.current
      if (!view) return
      const len = view.state.doc.length
      const f = Math.max(0, Math.min(from, len))
      const t = Math.max(f, Math.min(to, len))
      view.dispatch({
        changes: { from: f, to: t, insert: text },
        selection: { anchor: f + text.length, head: f + text.length },
      })
      view.focus()
    },
    getDoc: () => viewRef.current?.state.doc.toString() ?? '',
    getCursor: () => viewRef.current?.state.selection.main.head ?? 0,
    focus: () => viewRef.current?.focus(),
    blur: () => viewRef.current?.contentDOM.blur(),
    focusAt: (pos?: number) => {
      const view = viewRef.current
      if (!view) return
      if (pos != null) {
        const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
        view.dispatch({ selection: { anchor: clamped, head: clamped } })
      }
      view.focus()
    },
    triggerCommand: (cmd: SlashCommandId) => {
      const view = viewRef.current
      if (!view || !onSlashCommand) return
      const insertAt = view.state.selection.main.head
      const anchor = computeInlinePanelAnchor(view, insertAt)
      onSlashCommand(cmd, insertAt, anchor)
    },
    insertBlockAttachment: (pos, hash, ext, alt) => {
      const view = viewRef.current
      if (!view) return pos
      return insertBlockAttachmentAt(view, pos, hash, ext, alt)
    },
    insertBlockPendingAttachment: (pos, pendingId, alt) => {
      const view = viewRef.current
      if (!view) return pos
      return insertBlockPendingAttachmentsAt(view, pos, [{ id: pendingId, alt: alt ?? '' }])
    },
    replacePendingAttachment: (pendingId, hash, ext, alt, size) => {
      const view = viewRef.current
      if (!view) return
      replacePendingAttachmentInView(view, pendingId, hash, ext, alt ?? '', size ?? 'm')
    },
    removePendingAttachment: (pendingId) => {
      const view = viewRef.current
      if (!view) return
      removePendingAttachmentInView(view, pendingId)
    },
    applyRemoteDoc: (next) => {
      const view = viewRef.current
      if (!view) return
      const change = minimalDocChange(view.state.doc.toString(), ensureBlockSeparation(next))
      if (!change) return
      // No `selection` and no `scrollIntoView`: CodeMirror maps the existing
      // caret and viewport through the change, so an edit from another device
      // lands without moving anything under the reader.
      view.dispatch({ changes: change })
    },
  }))

  const syncFormatBar = useCallback((view: EditorView) => {
    if (view.state.selection.main.empty) {
      setFormatBarRef.current(null)
      return
    }
    setFormatBarRef.current(anchorFromView(view))
  }, [])

  // Create the view once.
  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        // Seed verbatim so the view never diverges from React's `content` (create
        // fires no onChange). Block separation is applied on the docKey-swap
        // dispatch below, which *does* sync content back through onChange.
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          // Above defaultKeymap — CM binds Mod-i to selectParentSyntax (whole line/paragraph).
          Prec.highest(formatKeymap((view) => requestLinkRef.current(view))),
          editorTabKeymap,
          // 3 spaces (not 2) — CommonMark/GFM requires a nested list item to be indented
          // at least as wide as the parent marker (e.g. "1. " is 3 columns); 2 spaces
          // under-indents ordered-list children so renderers (marked) flatten them into
          // the parent list instead of nesting them.
          indentUnit.of('   '),
          // Prose-journal grammar: disable rules that fire accidentally during writing.
          //
          // IndentedCode — any line indented ≥4 spaces at a block start becomes a
          // code block, silently flipping the entry to the mono face. Removed so
          // indented prose stays prose; fenced ``` blocks (spiritual blocks) are untouched.
          //
          // SetextHeading — CommonMark turns `text\n-` into an H2 and `text\n=`
          // into an H1 (underline-style headings). So typing `-` on the line after
          // any prose line instantly re-styles it as a heading. Removed here; ATX
          // headings (`## text`) are still supported for intentional formatting.
          markdown({ base: markdownLanguage, codeLanguages: [], extensions: { remove: ['IndentedCode', 'SetextHeading'] } }),
          syntaxHighlighting(markdownHighlight),
          orderedListNumberingExtension(),
          titleCompartment.current.of(
            titleStyling
              ? [firstLineTitleExtension, ...(bodyPlaceholder ? [bodyLinePlaceholder(bodyPlaceholder)] : [])]
              : [],
          ),
          // Rewrite duplicate block UUIDs (copy-paste creates same UUID twice).
          // Runs as a transaction filter so duplication is fixed atomically,
          // before decorations or listeners observe the new doc.
          EditorState.transactionFilter.of((tr) => {
            if (!tr.docChanged) return tr
            const docStr = tr.newDoc.toString()
            const blocks = parseSpiritualBlocks(docStr)
            const seenIds = new Set<string>()
            const changes: ChangeSpec[] = []
            for (const block of blocks) {
              if (!seenIds.has(block.id)) {
                seenIds.add(block.id)
                continue
              }
              // Duplicate found — replace its UUID in the opening fence line.
              const newId = crypto.randomUUID()
              const openLine = tr.newDoc.sliceString(block.from, tr.newDoc.lineAt(block.from).to)
              const idPos = openLine.indexOf(block.id)
              if (idPos >= 0) {
                changes.push({
                  from: block.from + idPos,
                  to: block.from + idPos + block.id.length,
                  insert: newId,
                })
              }
            }
            if (changes.length === 0) return tr
            // Compose dedup fixes onto tr's changes so we return a single
            // changeset mapping original→corrected. The old [tr, { changes }]
            // form crashes because CM merges specs expecting positions relative
            // to the original doc, but ours reference tr.newDoc.
            const dedupCS = ChangeSet.of(changes, tr.newDoc.length)
            return {
              changes: tr.changes.compose(dedupCS),
              selection: tr.selection,
              effects: tr.effects,
              scrollIntoView: tr.scrollIntoView,
            }
          }),
          // Parse spiritual blocks once per doc change; the three decorations
          // below all read this field instead of each re-parsing the full doc.
          // Must precede them so the value is ready when they update.
          spiritualBlocksField,
          spiritualBlockExtension((target, anchor) => onEditBlockRef.current?.(target, anchor)),
          scriptureRefDecoration(),
          taskListExtension(),
          // Renders /practice prompts as display-only decorations over hidden tokens.
          practicePromptExtension((name) => onAboutPracticeRef.current?.(name)),
          attachmentBlockNormalizeExtension(),
          attachmentImageExtension((target, point, anchor) =>
            onImageMenuRef.current?.(target, point, anchor),
          ),
          // Live insertion caret while dragging a file in or reordering a photo.
          dropCursor(),
          Prec.highest(attachmentDropExtension()),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'on' }),
          editorTheme,
          typewriterCompartment.current.of(typewriter ? typewriterExtension : []),
          dimCompartment.current.of(dimming ? dimmingExtension : []),
          commandLineCompartment.current.of(commandLineHighlight(commandLinePos)),
          cmPlaceholder(placeholder ?? 'Write…'),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
            if (u.selectionSet || u.focusChanged || u.docChanged) syncFormatBar(u.view)
            if (slashEnabledRef.current && (u.docChanged || u.selectionSet)) {
              setSlashRef.current(detectSlash(u.view, titleStylingRef.current))
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    if (autofocus) view.focus()

    const onScroll = () => syncFormatBar(view)
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll)
      view.destroy()
      viewRef.current = null
      setFormatBarRef.current(null)
      setSlashRef.current(null)
      setLinkTarget(null)
    }
    // Intentionally run once; doc swaps + compartments handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the view in sync when the parent loads or switches entries. `docKey`
  // handles navigation; `initialDoc` handles the body arriving after mount (cache
  // / sync) without fighting live typing — CM and React content stay matched while
  // you type, so this only runs when they diverge.
  const prevDocKeyRef = useRef(docKey)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    const entryChanged = prevDocKeyRef.current !== docKey
    prevDocKeyRef.current = docKey
    if (current !== initialDoc) {
      // Swapping entries replaces the doc; on the same entry only seed an empty
      // editor when the body arrives after mount — never fight live typing.
      if (entryChanged || (current.trim() === '' && initialDoc.trim() !== '')) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: ensureBlockSeparation(initialDoc) } })
      }
    }
    if (skipAutofocusRef?.current) {
      skipAutofocusRef.current = false
      return
    }
    if (!autofocus || !entryChanged) return
    view.focus()
    const atEnd = view.state.doc.length
    view.dispatch({ selection: { anchor: atEnd, head: atEnd } })
  }, [docKey, initialDoc, autofocus, skipAutofocusRef])

  // Reconfigure typewriter / dimming when their toggles change.
  useEffect(() => {
    reconfigure(viewRef.current, typewriterCompartment.current, typewriter ? typewriterExtension : [])
  }, [typewriter])

  useEffect(() => {
    reconfigure(viewRef.current, dimCompartment.current, dimming ? dimmingExtension : [])
  }, [dimming])

  useEffect(() => {
    reconfigure(viewRef.current, titleCompartment.current, titleStyling
      ? [firstLineTitleExtension, ...(bodyPlaceholder ? [bodyLinePlaceholder(bodyPlaceholder)] : [])]
      : [])
  }, [titleStyling, bodyPlaceholder])

  useEffect(() => {
    reconfigure(
      viewRef.current,
      commandLineCompartment.current,
      commandLineHighlight(commandLinePos),
    )
  }, [commandLinePos])

  useEffect(() => {
    onSlashPaletteChange?.(slashState !== null)
  }, [slashState, onSlashPaletteChange])

  function handleSlashSelect(sel: SlashSelection) {
    const view = viewRef.current
    const s = slashState
    if (!view || !s) return
    // Remove the /command text from the document, collapsing the caret to its start.
    view.dispatch({ changes: { from: s.from, to: s.to, insert: '' }, selection: { anchor: s.from } })
    setSlashState(null)
    // Markdown formatting is a synchronous edit at the caret — no popover.
    if (sel.kind === 'format') {
      applyFormatCommand(view, sel.id)
      return
    }
    const panelAnchor = computeInlinePanelAnchor(view, s.from)
    onSlashCommand?.(sel.id, s.from, panelAnchor)
  }

  function handleSlashDismiss() {
    setSlashState(null)
  }

  return (
    <>
      <div ref={hostRef} className="editor-host" style={{ height: '100%' }} />
      <SelectionFormatBar
        anchor={linkTarget ? null : formatBar}
        onRequestLink={(view) => requestLinkRef.current(view)}
      />
      {linkTarget && (
        <LinkPopover
          target={linkTarget}
          onSubmit={(url) => {
            const view = viewRef.current
            if (view) setLink(view, linkTarget.from, linkTarget.to, url)
            setLinkTarget(null)
          }}
          onRemove={() => {
            const view = viewRef.current
            if (view) clearLink(view, linkTarget.from, linkTarget.to)
            setLinkTarget(null)
          }}
          onCancel={() => {
            setLinkTarget(null)
            viewRef.current?.focus()
          }}
        />
      )}
      {slashState && slashEnabled && (
        <SlashPalette
          state={slashState}
          onSelect={handleSlashSelect}
          onDismiss={handleSlashDismiss}
        />
      )}
    </>
  )
})

function reconfigure(view: EditorView | null, compartment: Compartment, ext: Extension) {
  if (!view) return
  view.dispatch({ effects: compartment.reconfigure(ext) })
}
