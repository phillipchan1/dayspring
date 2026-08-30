import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from 'react'
import { ChangeSet, Compartment, EditorState, Prec, type ChangeSpec, type Extension } from '@codemirror/state'
import { dropCursor, EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { editorTheme } from './theme'
import { proseHighlighting } from './proseHighlighting'
import { nativeTypingAttributes } from './nativeTyping'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { highlightDecoration } from './highlightDecoration'
import { concealMarkersExtension } from './concealMarkers'
import { typewriterExtension } from './typewriter'
import { dimmingExtension } from './dimming'
import { ritualHoldExtension } from './ritualHold'
import { firstLineTitleExtension } from './firstLineTitle'
import { bodyLinePlaceholder } from './bodyLinePlaceholder'
import {
  spiritualBlockExtension,
  type SpiritualBlockEditTarget,
} from './spiritualBlockDecoration'
import { spiritualBlocksField } from './spiritualBlocksField'
import { lineMenuExtension } from './lineMenu'
import { scripturePasteExtension } from './scripturePasteExtension'
import { ensureBlockSeparation, parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { wrapLinesInFence } from '@/lib/markSelection'
import type { SpiritualItemType } from '@/lib/types'
import type { InlinePanelAnchor } from './inlinePanelAnchor'
import { formatKeymap } from './formatKeymap'
import {
  applyHighlight as applyHighlightToSelection,
  clearLink,
  expandToInlineSpans,
  linkUrlInRange,
  selectionAnchorRect,
  setLink,
} from './formatSelection'
import { LinkPopover, type LinkPopoverTarget } from './LinkPopover'
import { anchorFromView, SelectionFormatBar, type FormatBarAnchor } from './SelectionFormatBar'
import { commandLineHighlight } from './commandLineHighlight'
import { scriptureRefDecoration } from './scriptureRefDecoration'
import { applyMarks, marksField } from './markDecoration'
import { anchorOf, normalizeQuote, type Mark } from '@/lib/marks'
import { taskListExtension } from './taskListExtension'
import { horizontalRuleExtension } from './horizontalRule'
import { orderedListNumberingExtension } from './orderedListNumbering'
import { editorTabKeymap } from './tabKeymap'
import { computeInlinePanelAnchor } from './inlinePanelAnchor'
import { minimalDocChange } from './minimalDocChange'
import { detectSlash, reconcileSlashState, type SlashCommandId, type SlashState } from './slashDetect'
import { SlashPalette } from './SlashPalette'
import { applyFormatCommand, type FormatCommandId, type SlashSelection } from './slashCommands'
import type { HighlightColor } from '@/lib/highlightColors'
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
  /** Apply a markdown format at the caret/selection (for the mobile toolbar). */
  applyFormatCommand: (id: FormatCommandId) => void
  /** Apply a highlighter colour at the caret/selection (for the mobile toolbar). */
  applyHighlight: (color: HighlightColor) => void
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
   * Turn the selection's lines — or the caret's paragraph — into a marking of
   * `kind`. Returns the writer's words the fence now carries, so the caller can
   * write the matching row, or null when the range can't be marked.
   */
  markLines: (kind: SpiritualItemType, id: string) => string | null
  /**
   * Keep something the journal noticed: find the writer's own sentence in the
   * live document and mark the lines it sits on. Returns null when the sentence
   * is no longer there — they may have edited it while the pencil note sat in
   * the margin, and a proposal about words that no longer exist must do nothing
   * at all rather than mark the nearest thing.
   */
  markQuote: (quote: string, kind: SpiritualItemType, id: string) => string | null
  /**
   * Bring a document position into view without touching the selection.
   *
   * Used by the open margin: nothing there is allowed to steal focus, so a note
   * scrolls to its line and leaves the caret exactly where the writer left it.
   */
  revealPos: (pos: number) => void
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
  /**
   * Leave markdown's syntax characters visible. Defaults to false — they're
   * concealed until the cursor is inside the span they belong to.
   */
  showMarkdownSyntax?: boolean
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
  /** Scripture blocks: primary click opens the chapter pane. */
  onOpenChapter?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void
  /** A Bible-app paste was wrapped as a scripture fence. */
  onScripturePaste?: (reference: string) => void
  /** Called when the user left- or right-clicks a photo block to open its options menu. */
  onImageMenu?: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void
  /** Called when the user opens a practice's "about" sheet (by practice name). */
  onAboutPractice?: (name: string) => void
  /**
   * Passages already marked in this entry. Drawn as a quiet ground.
   */
  marks?: Mark[]
  /**
   * Set the selected text aside, or clear it if it is already marked.
   *
   * Absent while composing. Marking is a READING act: the caller passes this
   * only for an entry written on a previous day, so today's page keeps exactly
   * the bar it has always had and the writing surface gains nothing.
   */
  onToggleMark?: (quote: string, charStart: number, alreadyMarked: Mark | null) => void
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
    showMarkdownSyntax = false,
    slashEnabled = false,
    commandLinePos = null,
    onSlashCommand,
    onEditBlock,
    onOpenChapter,
    onScripturePaste,
    onImageMenu,
    onAboutPractice,
    onSlashPaletteChange,
    skipAutofocusRef,
    marks,
    onToggleMark,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const typewriterCompartment = useRef(new Compartment())
  const dimCompartment = useRef(new Compartment())
  const titleCompartment = useRef(new Compartment())
  const concealCompartment = useRef(new Compartment())
  const commandLineCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onEditBlockRef = useRef(onEditBlock)
  const onOpenChapterRef = useRef(onOpenChapter)
  const onScripturePasteRef = useRef(onScripturePaste)
  const onImageMenuRef = useRef(onImageMenu)
  const onAboutPracticeRef = useRef(onAboutPractice)
  const setFormatBarRef = useRef<(anchor: FormatBarAnchor | null) => void>(() => {})
  const slashEnabledRef = useRef(slashEnabled)
  const titleStylingRef = useRef(titleStyling)
  const [formatBar, setFormatBar] = useState<FormatBarAnchor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [linkTarget, setLinkTarget] = useState<LinkPopoverTarget | null>(null)
  const setSlashRef = useRef(setSlashState)
  /**
   * Open the palette from the `+`, without typing anything.
   *
   * The palette has one other way in — `detectSlash` on a document update —
   * and this deliberately does NOT go through it by inserting a `/`. A `+` is a
   * button, and a button that works by writing a character into the document
   * would put a stray `/` on the page for every frame between the click and the
   * pick, and leave one behind on any path that doesn't end in a selection.
   *
   * `from === to` makes the removal in `handleSlashSelect` a no-op change,
   * which is exactly right: there is no `/command` text to take back out.
   */
  const openPaletteRef = useRef((pos: number, at: { top: number; left: number }) => {
    const view = viewRef.current
    if (!view || !slashEnabledRef.current) return
    // The caret follows the `+`, the way it does in every editor that has one:
    // you pressed the button beside THIS line, so this is the line you are on.
    view.dispatch({ selection: { anchor: pos, head: pos } })
    view.focus()
    const coords = view.coordsAtPos(pos)
    setSlashRef.current({
      query: '',
      from: pos,
      to: pos,
      x: coords?.left ?? at.left,
      y: coords?.bottom ?? at.top,
      yTop: coords?.top ?? at.top,
    })
  })
  onChangeRef.current = onChange
  onEditBlockRef.current = onEditBlock
  onOpenChapterRef.current = onOpenChapter
  onScripturePasteRef.current = onScripturePaste
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
    // Widen to the whole `[label](url)`: with the brackets concealed, selecting
    // an existing link's visible label would otherwise nest a second link.
    const { from, to } = expandToInlineSpans(view.state, sel.from, sel.to)
    setLinkTarget({
      from,
      to,
      url: linkUrlInRange(view, from, to) ?? '',
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
    applyFormatCommand: (id: FormatCommandId) => {
      const view = viewRef.current
      if (!view) return
      applyFormatCommand(view, id)
    },
    applyHighlight: (color: HighlightColor) => {
      const view = viewRef.current
      if (!view) return
      applyHighlightToSelection(view, color)
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
      markLines: (kind, id) => {
      const view = viewRef.current
      if (!view) return null
      const { from, to } = view.state.selection.main
      const wrap = wrapLinesInFence(view.state.doc.toString(), from, to, kind, id)
      if (!wrap) return null
      view.dispatch({
        changes: { from: wrap.from, to: wrap.to, insert: wrap.insert },
        // Collapse to the start of the new fence. The range the caret was in is
        // now inside an atomic block, and leaving the old selection would put it
        // somewhere the caret is not allowed to be.
        selection: { anchor: wrap.from },
      })
      view.focus()
      return wrap.content
    },
    markQuote: (quote, kind, id) => {
      const view = viewRef.current
      if (!view || !quote) return null
      const doc = view.state.doc.toString()
      const at = doc.indexOf(quote)
      if (at === -1) return null
      const wrap = wrapLinesInFence(doc, at, at + quote.length, kind, id)
      if (!wrap) return null
      // No selection change and no focus grab: keeping something from the margin
      // must not move the caret out from under whatever the writer is doing.
      view.dispatch({ changes: { from: wrap.from, to: wrap.to, insert: wrap.insert } })
      return wrap.content
    },
    revealPos: (pos) => {
      const view = viewRef.current
      if (!view) return
      const at = Math.max(0, Math.min(pos, view.state.doc.length))
      // Effect only — no `selection`, so the caret stays where the writer left
      // it and the editor keeps whatever focus it already had.
      view.dispatch({ effects: EditorView.scrollIntoView(at, { y: 'center' }) })
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
          //
          // Highlight/Underline — `==text==` and `++text++`, which CommonMark
          // has no syntax for. Always parsed, regardless of the conceal setting.
          markdown({
            base: markdownLanguage,
            codeLanguages: [],
            extensions: [
              { remove: ['IndentedCode', 'SetextHeading'] },
              HighlightExtension,
              UnderlineExtension,
            ],
          }),
          // Skip mark decorations on the caret line so Safari / WKWebView
          // keep tracking the word for autocorrect. Finished lines still paint.
          proseHighlighting(),
          highlightDecoration(),
          concealCompartment.current.of(showMarkdownSyntax ? [] : concealMarkersExtension()),
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
          spiritualBlockExtension(
            (target, anchor) => onEditBlockRef.current?.(target, anchor),
            (target, anchor) => {
              if (onOpenChapterRef.current) onOpenChapterRef.current(target, anchor)
              else onEditBlockRef.current?.(target, anchor)
            },
          ),
          // The `+` in the left gutter, and the palette it opens. Must follow
          // spiritualBlocksField, which it reads to stay off fenced lines.
          lineMenuExtension((pos, at) => openPaletteRef.current(pos, at)),
          scriptureRefDecoration(),
          // Marked passages. Reads spiritualBlocksField above, same as the
          // scripture underline, so it must stay below it.
          marksField,
          taskListExtension(),
          horizontalRuleExtension(),
          // Renders a ritual's prompts as display-only decorations over hidden
          // tokens, one movement at a time.
          practicePromptExtension((name) => onAboutPracticeRef.current?.(name)),
          // Lets the rest of the entry recede while a ritual has the page.
          // Must follow the extension above — it reads its field.
          ritualHoldExtension,
          attachmentBlockNormalizeExtension(),
          attachmentImageExtension((target, point, anchor) =>
            onImageMenuRef.current?.(target, point, anchor),
          ),
          // Live insertion caret while dragging a file in or reordering a photo.
          dropCursor(),
          Prec.highest(attachmentDropExtension()),
          Prec.high(
            scripturePasteExtension((reference) => onScripturePasteRef.current?.(reference)),
          ),
          EditorView.lineWrapping,
          nativeTypingAttributes,
          editorTheme,
          typewriterCompartment.current.of(typewriter ? typewriterExtension : []),
          dimCompartment.current.of(dimming ? dimmingExtension : []),
          commandLineCompartment.current.of(commandLineHighlight(commandLinePos)),
          cmPlaceholder(placeholder ?? 'Write…'),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
            if (u.selectionSet || u.focusChanged || u.docChanged) syncFormatBar(u.view)
            if (slashEnabledRef.current && (u.docChanged || u.selectionSet)) {
              const detected = detectSlash(u.view, titleStylingRef.current)
              const sel = u.view.state.selection.main
              setSlashRef.current((prev) =>
                reconcileSlashState(prev, detected, {
                  docChanged: u.docChanged,
                  selectionEmpty: sel.empty,
                  caret: sel.head,
                }),
              )
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    // Honour the skip flag here too, not just on docKey swaps. This effect runs
    // on every *mount*, and the editor unmounts whenever an alternate surface
    // takes the canvas — so without this, returning to an entry from Lamp/Altar/
    // Ascent stole focus (and popped the iOS keyboard) even though the caller
    // had asked us not to. The docKey effect can't cover it: on a fresh mount it
    // sees entryChanged === false and only clears the flag.
    if (skipAutofocusRef?.current) {
      skipAutofocusRef.current = false
    } else if (autofocus) {
      view.focus()
    }

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
      concealCompartment.current,
      showMarkdownSyntax ? [] : concealMarkersExtension(),
    )
  }, [showMarkdownSyntax])

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

  // Push marks into the view when they load or change. Between pushes the field
  // maps its ranges through edits itself, so typing never re-runs this.
  useEffect(() => {
    const view = viewRef.current
    if (view) applyMarks(view, marks ?? [])
  }, [marks, docKey])

  // Touch: the palette is a bottom sheet, so it covers the lower half of the
  // editor. Docking it there is what keeps it off the caret — but only if the
  // caret then moves above it, so scroll the line being written clear of the
  // sheet. Measured rather than assumed: the sheet's height depends on how many
  // commands survived the query.
  const slashOpen = slashState !== null
  useEffect(() => {
    if (!slashOpen) return
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const host = hostRef.current
    if (!host || !viewRef.current) return
    // The scroll only has somewhere to go if the document is taller than the
    // scrollport, and most entries aren't — so open up room below the last line
    // first (CSS: `.editor-host[data-slash-sheet]`). Removing it again on close
    // lets CodeMirror clamp the scroll back.
    host.dataset.slashSheet = 'true'
    // A frame, so the sheet has laid out and the padding has taken effect.
    const raf = requestAnimationFrame(() => {
      const sheet = document.querySelector('.slash-palette--sheet')
      const view = viewRef.current
      if (!sheet || !view) return
      // How much of the *scroller* the sheet actually hides — not the sheet's
      // own height, which overshoots (the sheet extends past the editor, over
      // the command bar) and scrolls the line clean off the top.
      const hidden = Math.max(
        0,
        view.scrollDOM.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top,
      )
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.selection.main.head, {
          y: 'end',
          yMargin: hidden + 12,
        }),
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      delete host.dataset.slashSheet
    }
  }, [slashOpen, slashState?.query])

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

  /**
   * Backing out on purpose — the scrim, the grab handle, or Cancel. Unlike
   * `handleSlashDismiss` (which also fires when the query stops matching
   * anything, mid-typing), this takes the `/command` text with it: on touch the
   * only way to close the old popover was to tap elsewhere, which left a literal
   * `/` sitting in the entry.
   */
  function handleSlashCancel() {
    const view = viewRef.current
    const s = slashState
    setSlashState(null)
    if (!view || !s) return
    view.dispatch({ changes: { from: s.from, to: s.to, insert: '' }, selection: { anchor: s.from } })
    view.focus()
  }

  /** The mark covering the current selection, if the writer already set it aside. */
  const selectionMark = (() => {
    if (!formatBar || !marks?.length) return null
    const { from, to } = formatBar.view.state.selection.main
    if (from === to) return null
    const body = formatBar.view.state.doc.toString()
    return (
      marks.find((m) => {
        const at = anchorOf(body, m)
        // Overlap, not equality: re-selecting "roughly that sentence" should
        // offer to unmark rather than silently mark a near-duplicate.
        return at != null && at < to && at + m.quote.length > from
      }) ?? null
    )
  })()

  const handleToggleMark = (view: EditorView) => {
    const { from, to } = view.state.selection.main
    if (from === to) return
    onToggleMark?.(normalizeQuote(view.state.sliceDoc(from, to)), from, selectionMark)
    // The bar is transient; dismissing it makes the mark feel committed.
    setFormatBar(null)
  }

  return (
    <>
      <div ref={hostRef} className="editor-host" style={{ height: '100%' }} />
      <SelectionFormatBar
        anchor={linkTarget ? null : formatBar}
        onRequestLink={(view) => requestLinkRef.current(view)}
        onMark={onToggleMark ? handleToggleMark : undefined}
        marked={!!selectionMark}
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
          onCancel={handleSlashCancel}
        />
      )}
    </>
  )
})

function reconfigure(view: EditorView | null, compartment: Compartment, ext: Extension) {
  if (!view) return
  view.dispatch({ effects: compartment.reconfigure(ext) })
}
