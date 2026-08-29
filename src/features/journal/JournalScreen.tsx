import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor, type EditorHandle } from '@/editor/Editor'
import type { SpiritualBlockEditTarget } from '@/editor/spiritualBlockDecoration'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { SlashCommandId } from '@/editor/slashDetect'
import { useAutosave } from '@/hooks/useAutosave'
import { useSettings } from '@/hooks/useSettings'
import { FONT_SIZE_MIN, FONT_SIZE_DEFAULT, FONT_SIZE_MAX } from '@/lib/settings'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { useKeyboardOpen, useKeyboardInset } from '@/hooks/useKeyboard'
import { uploadOrQueue } from '@/lib/attachmentQueue'
import { asEntryMarkdown } from '@/lib/entryLabels'
import { getEntryById, wordCount, byCreatedDesc } from '@/lib/entries'
import { subscribeEntryChanges } from '@/lib/entriesRealtime'
import { isSupabaseConfigured } from '@/lib/env'
import { isTauri } from '@/lib/platform'
import { addBreadcrumb } from '@/lib/crashReport'
import * as repo from '@/lib/repo'
import { cacheGet, cachePut, dictationList, dictationPrune, type PendingDictationRow } from '@/lib/db'
import { syncStore } from '@/lib/sync'
import type { Entry, PrayerType, SpiritualItemType } from '@/lib/types'
import { useAppNavigation } from '@/context/AppNavigation'
import { useFocusMode } from './useFocusMode'
import { useJournalShortcuts } from './useJournalShortcuts'
import { DesktopJournal } from './DesktopJournal'
import { MobileJournal } from './MobileJournal'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { ShortcutsOverlay } from '@/features/shortcuts/ShortcutsOverlay'
import { isInEditor, shouldIgnoreTarget } from './keyboard'
import { nextEntryIdAfterDelete } from './entryFocusAfterDelete'
import { EntryBulkCanvas } from './EntryBulkCanvas'
import { copyEntriesMarkdown, copyEntriesText, exportEntriesZip } from './entryBulkActions'
import { entryReturnFromState, type AppHistoryState } from '@/lib/appHistory'
import { consumeSeedPrompt } from '@/lib/onboardingSeed'
import {
  copyEntryMarkdown,
  copyEntryText,
  downloadEntryMarkdown,
  printEntry,
} from './entryActions'
import type { EntryMenuAction } from './EntryContextMenu'
import { EntryEditDateModal } from './EntryEditDateModal'
import { isEntryRowTarget } from './useSuppressNativeContextMenu'
import type { JournalViewProps } from './journalViewProps'
import { MARK_KIND, kindForCommand } from '@/lib/markKinds'
import { canMarkExistingLines } from '@/lib/markSelection'
import { InlineDeclaredPopover } from '@/features/capture/InlineDeclaredPopover'
import { createSpiritualItem } from '@/lib/spiritual'
import { AscentView } from '@/features/ascent/AscentView'
import { AltarView } from '@/features/altar/AltarView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { PagesView } from '@/features/pages/PagesView'
import { clampZoom, PAGES_ZOOM_DEFAULT, ZOOM_STEP } from '@/features/pages/zoom'
import { useMarks } from '@/features/pages/useMarks'
import { warmPageIndexes } from '@/features/pages/derived'
import { ask } from '@/lib/ask'
import type { EntrySelectionApi, EntrySelectionState } from './entrySelectionApi'
import type { Mark } from '@/lib/marks'
import { FindPalette } from '@/features/find/FindPalette'
import { FeatureFlagProvider, resolveFlag } from '@/features/flags'
import { InlinePrayPopover } from '@/features/capture/InlinePrayPopover'
import { InlineSensePopover } from '@/features/capture/InlineSensePopover'
import { InlineScripturePopover } from '@/features/capture/InlineScripturePopover'
import { PracticeLibrary } from '@/editor/practices/PracticeLibrary'
import { PracticeAboutSheet } from '@/editor/practices/PracticeAboutSheet'
import { usePracticeInsertion } from '@/editor/practices/usePracticeInsertion'
import { PRACTICE_BY_NAME, type Practice } from '@/editor/practices/practicesData'
import { InlineImagePopover } from '@/features/capture/InlineImagePopover'
import { InlineImageEditPopover } from '@/features/capture/InlineImageEditPopover'
import { InlineEmojiPopover } from '@/features/capture/InlineEmojiPopover'
import { ImageContextMenu, type ImageMenuPhase } from './ImageContextMenu'
import type { AttachmentEditTarget, ImageMenuPoint } from '@/editor/attachmentImageExtension'
import {
  formatAttachmentMarkdown,
  formatPendingAttachmentMarkdown,
  extFromImageFile,
  type ImageSize,
} from '@/lib/attachments'
import { IMAGE_MAX_BYTES, isImageFile } from '@/editor/attachmentInsert'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { supabase } from '@/lib/supabase'
import { CommandToolbar } from '@/editor/CommandToolbar'
import { VoiceCapture } from '@/features/capture/VoiceCapture'
import { PageScanCapture } from '@/features/capture/PageScanCapture'
import { DictationRecovery } from '@/features/capture/DictationRecovery'
import { ProcessingBanner } from './ProcessingBanner'
import { hasVisitedSurface, lightEmber, markSurfaceVisited } from './surfaceEmbers'
import { recordSurfaceUpdate } from './surfaceUpdates'
import { shouldAutoOpenLatest } from './arrivalNav'
import { track } from '@/lib/analytics'
import { parseSpiritualBlocks, type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import { deleteSpiritualItem } from '@/lib/spiritual'
import { recordScriptureCommandRef } from '@/lib/scripture/capture'
import { chapterFromCitation } from '@/lib/scripture/citation'
import { ChapterPane } from '@/features/scripture/ChapterPane'
interface JournalScreenProps {
  userEmail: string
  featureFlags: string[]
}

/**
 * A short, human label for a just-committed block, shown in its surface's
 * arrival line: the reference for scripture ("John 3:16"), the opening words
 * for a prayer or sense. Returns '' when there's nothing worth naming.
 */
function arrivalLabelFor(block: ParsedSpiritualBlock): string {
  const firstLine = block.content.split('\n')[0]?.trim() ?? ''
  const raw = block.type === 'scripture' ? block.reference?.trim() || firstLine : firstLine
  if (!raw) return ''
  return raw.length > 48 ? `${raw.slice(0, 47).trimEnd()}…` : raw
}

export function JournalScreen({ userEmail, featureFlags }: JournalScreenProps) {
  const { state, go, back, closeSettings } = useAppNavigation()
  const { entryId } = state

  const [entries, setEntries] = useState<Entry[]>([])
  const [content, setContent] = useState('')
  const handleContentChange = useCallback((doc: string) => {
    setContent((prev) => (prev === doc ? prev : doc))
  }, [])
  const [entriesReady, setEntriesReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editDateEntry, setEditDateEntry] = useState<Entry | null>(null)

  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  // Touch-primary device (phone or iPad without a trackpad/mouse). With a Magic
  // Keyboard trackpad the pointer becomes fine, so iPad then behaves like desktop.
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const keyboardOpen = useKeyboardOpen()
  const keyboardInset = useKeyboardInset()
  // Show the touch command bar whenever the on-screen keyboard is up on a touch
  // device — phone or iPad. It rides in-flow on phones, docked above the keyboard
  // on tablets. Hardware-keyboard users get no on-screen keyboard, so they use `/`.
  const showCommandBar = (isMobile || coarsePointer) && keyboardOpen
  // Read first, tap to write. On a touch device the editor never autofocuses —
  // opening an entry to read it shouldn't throw the software keyboard over half
  // the screen. The two handlers that mean "I came here to write" (handleNew,
  // handleEditEntry) focus explicitly instead. Desktop keeps autofocus, where a
  // focused caret costs nothing.
  const touchFirst = isMobile || coarsePointer
  const settingsOpen = state.settings !== null
  const helpOpen = state.help
  const reflectionsActive = state.surface === 'reflections'
  const altarActive = state.surface === 'altar'
  const scriptureActive = state.surface === 'scripture'
  const pagesActive = state.surface === 'pages'
  // Altar is unfinished — hidden behind the `altar` flag (per-profile or
  // VITE_FF_ALTAR). When off, the rail/mobile buttons and ⌘4 are suppressed and
  // any stray navigation to the surface is redirected back to the journal.
  const altarEnabled = resolveFlag(featureFlags, 'altar')
  // Pages carries no flag of its own: the alpha channel is the gate. See D-017.
  /**
   * A Return surface owns the canvas AND replaces the journal's chrome.
   *
   * Pages is deliberately NOT one of these. It takes the canvas, but the
   * entries panel stays open beside it — List and Pages are two ways of reading
   * the same archive, and the control that switches between them lives in the
   * panel, so the panel has to survive the switch.
   */
  const canvasAlternateActive = reflectionsActive || altarActive || scriptureActive
  // Marks are drawn by the editor and filtered on by the wall, so they load
  // always — and cheaply: this reads a small store, never the corpus.
  const marks = useMarks()
  /**
   * The last question asked, and the pages it found.
   *
   * Ephemeral on purpose — it is not in history. A question is something you
   * just asked, not a place you can navigate back into a week later, and 40 ids
   * in a history frame would be state pretending to be a location.
   */
  const selectionApiRef = useRef<EntrySelectionApi | null>(null)
  const [bulkSelection, setBulkSelection] = useState<Entry[]>([])
  const [rangeSelectActive, setRangeSelectActive] = useState(false)
  const [asked, setAsked] = useState<{ question: string; entryIds: string[] } | null>(null)
  // The question in flight. Pages no longer offers to ask one — the sheet has
  // no question row — but ⌘K still can, and this keeps that path honest.
  const [, setAsking] = useState<string | null>(null)
  /**
   * Was the open entry written on an earlier calendar day?
   *
   * The line between composing and re-reading. Today's page is a draft you are
   * still in; anything older is something you are coming back to, which is when
   * marking makes sense. A local-day comparison, not a 24-hour window — an entry
   * from 11pm last night is yesterday's.
   */
  const isPastEntry = useMemo(() => {
    if (!entryId) return false
    const created = entries.find((e) => e.id === entryId)?.created_at
    if (!created) return false
    const d = new Date(created)
    const now = new Date()
    return (
      d.getFullYear() !== now.getFullYear() ||
      d.getMonth() !== now.getMonth() ||
      d.getDate() !== now.getDate()
    )
  }, [entryId, entries])
  /** ⌘K — Find (instant, local), or Ask, which lights the wall with what it found. */
  const [findOpen, setFindOpen] = useState(false)
  const [findSeed, setFindSeed] = useState('')
  /** Defer typewriter/dimming one frame after chrome hides — avoids CM measure churn. */
  const [focusEditorReady, setFocusEditorReady] = useState(false)

  useEffect(() => {
    const base = 'Dayspring'
    document.title = scriptureActive ? `Lamp — ${base}` : base
    return () => {
      document.title = base
    }
  }, [scriptureActive])

  // Block the browser context menu outside the editor and entry rows (editor keeps native macOS menu).
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isEntryRowTarget(e.target)) return
      if (isInEditor(e.target)) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  const entryIdRef = useRef<string | null>(null)
  entryIdRef.current = entryId
  const contentRef = useRef(content)
  contentRef.current = content
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const skipEntrySyncRef = useRef(false)
  /** While true, autosave may create an entry but we must not adopt its id (⌘N / C “new”). */
  const skipAdoptOnCreateRef = useRef(false)
  /** Last entry id whose body we loaded into the editor — avoids reloading on list sync. */
  const loadedEntryIdRef = useRef<string | null>(null)
  // Autosave is constructed further down, but the sync effects mount before it
  // and need to ask it questions. Refs bridge the gap; both are assigned below.
  const isDirtyRef = useRef<() => boolean>(() => false)
  const adoptExternalTextRef = useRef<(forEntryId: string | null, text: string) => void>(() => {})
  const skipEditorAutofocusRef = useRef(false)
  const [isNewEntryMode, setIsNewEntryMode] = useState(false)
  // Live mirror for sync callbacks (applySyncedList) that must not repoint the
  // editor away from a deliberate new entry — see arrivalNav.shouldAutoOpenLatest.
  const isNewEntryModeRef = useRef(isNewEntryMode)
  isNewEntryModeRef.current = isNewEntryMode
  // Monotonically increasing counter so docKey always changes on handleNew(),
  // even when entryId is already null (go() would be a no-op, keeping docKey
  // at 'new' and preventing the Editor sync effect from clearing the CM view).
  const [newEntryGeneration, setNewEntryGeneration] = useState(0)

  // Voice dictation — caret captured when the mic opens so the text lands there.
  const [voiceOpen, setVoiceOpen] = useState(false)
  const voiceCaretRef = useRef(0)
  // Page scan — same caret-capture pattern as voice; the draft lands where you were.
  const [scanOpen, setScanOpen] = useState(false)
  const scanCaretRef = useRef(0)
  // An unfinished voice recording recovered from a previous session (crash/close).
  const [recoverableDictation, setRecoverableDictation] = useState<PendingDictationRow | null>(null)

  // Slash command modals
  const editorRef = useRef<EditorHandle>(null)

  // Insert dictated/recovered text at `pos`, padding so it reads as prose rather
  // than running into the previous word.
  const insertDictatedText = useCallback((text: string, pos: number) => {
    const doc = editorRef.current?.getDoc() ?? ''
    const clamped = Math.max(0, Math.min(pos, doc.length))
    const before = doc.slice(Math.max(0, clamped - 1), clamped)
    const lead = before && !/\s/.test(before) ? ' ' : ''
    editorRef.current?.insertAt(clamped, lead + text)
  }, [])

  // On load, surface any voice recording that was captured but never transcribed
  // (a crash, a closed tab, an unrecovered failure) so its words aren't lost.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const sb = supabase
        if (!sb) return
        const { data } = await sb.auth.getSession()
        const owner = data.session?.user?.id
        if (!owner) return
        // Offer BEFORE pruning. Pruning first meant a recording made just over a
        // day ago — a weekend away, a phone left in a drawer — was deleted rather
        // than offered, which is the one thing this recovery path exists to
        // prevent. A week is long enough to get back to it.
        const pending = await dictationList(owner)
        if (alive && pending.length > 0) setRecoverableDictation(pending[0] ?? null)
        await dictationPrune(7 * 24 * 60 * 60 * 1000)
      } catch {
        /* best-effort — recovery never blocks the app */
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  const [slashCapture, setSlashCapture] = useState<{
    cmd: SlashCommandId
    insertAt: number
    anchor: InlinePanelAnchor
    /** Present when editing an existing block in place rather than inserting. */
    edit?: {
      id: string
      from: number
      to: number
      content: string
      reference: string | null
      prayerType: PrayerType | null
    }
  } | null>(null)
  const slashCaptureRef = useRef(slashCapture)
  slashCaptureRef.current = slashCapture

  const [chapterOpen, setChapterOpen] = useState<{
    book: string
    chapter: number
    verse: number | null
    target: SpiritualBlockEditTarget
    anchor: InlinePanelAnchor
  } | null>(null)

  useEffect(() => {
    setChapterOpen(null)
  }, [entryId])

  const [imageEdit, setImageEdit] = useState<{
    target: AttachmentEditTarget
    anchor: InlinePanelAnchor
  } | null>(null)
  const imageEditRef = useRef(imageEdit)
  imageEditRef.current = imageEdit

  // Photo options menu (left- or right-click on a photo). Carries the caption
  // popover's anchor so "Edit caption…" can open it in place.
  const [imageMenu, setImageMenu] = useState<{
    target: AttachmentEditTarget
    point: ImageMenuPoint
    anchor: InlinePanelAnchor
  } | null>(null)

  // The practice "about" slide-over (opened from a practice header).
  const [aboutPractice, setAboutPractice] = useState<Practice | null>(null)

  const [slashPaletteOpen, setSlashPaletteOpen] = useState(false)
  const focusOverlaysOpen =
    settingsOpen ||
    helpOpen ||
    slashCapture !== null ||
    imageEdit !== null ||
    imageMenu !== null ||
    slashPaletteOpen
  const focus = useFocusMode(focusOverlaysOpen)

  useEffect(() => {
    if (!focus.active) {
      setFocusEditorReady(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFocusEditorReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [focus.active])

  /**
   * A capture command was chosen — from `/`, from the `+`, or from the touch bar.
   *
   * **The same row does two things, and which one is not a decision the writer
   * should have to make.** "Prayer" beside a paragraph you already wrote means
   * *that was a prayer*; "Prayer" on an empty line means *I am about to write
   * one*. Those are genuinely different acts — one wraps words that exist, the
   * other opens a popover to make some — but they have one name in every
   * writer's head, and offering both under two labels is how a menu of six
   * kinds becomes a menu of twelve.
   *
   * So the line decides. It reads the same from `/pray` and from the `+`, which
   * is the point: two doors that disagree about what a word means are worse
   * than one door.
   *
   * Scripture is excluded because its words are not the writer's own (it fetches
   * verbatim ESV text), and ritual / image / emoji are not kinds at all.
   */
  function handleSlashCommand(
    cmd: SlashCommandId,
    insertAt: number,
    anchor: InlinePanelAnchor,
  ) {
    // Touch devices use the OS emoji keyboard; the in-app picker is desktop-only.
    if (cmd === 'emoji' && touchFirst) return
    addBreadcrumb('command', `slash:${cmd}`)
    track('slash_used', { cmd })
    const kind = kindForCommand(cmd)
    if (kind && canMarkExistingLines(kind) && lineHasWords(insertAt)) {
      markLineAs(kind)
      return
    }
    setSlashCapture({ cmd, insertAt, anchor })
  }

  /**
   * Does the line at `pos` already carry words?
   *
   * Read from the live editor rather than React's `content`, which lags by a
   * render — and the `/command` text has just been removed from the document by
   * the time this runs, so a line that held only `/pray` correctly reads as
   * empty and opens the popover.
   */
  function lineHasWords(pos: number): boolean {
    const doc = editorRef.current?.getDoc()
    if (doc === undefined) return false
    const start = doc.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
    const nl = doc.indexOf('\n', pos)
    return doc.slice(start, nl === -1 ? doc.length : nl).trim().length > 0
  }

  /**
   * Put the caret somewhere a command may safely land, and return that position.
   *
   * Both doors below are pressed from outside the editor, where the caret is
   * usually nowhere at all — and "nowhere" means position 0, which with
   * `firstLineTitle` on is the TITLE line. A prayer block inserted there becomes
   * the entry's title. So: guarantee a body line exists, land on it, and only
   * then let the command read the selection.
   */
  const caretForCommand = useCallback((): number | null => {
    const ed = editorRef.current
    if (!ed) return null
    const doc = ed.getDoc()
    let at = doc.length
    if (settings.firstLineTitle && !doc.includes('\n')) {
      ed.replaceRange(at, at, '\n\n')
      at += 2
    }
    ed.focusAt(at)
    return at
  }, [settings.firstLineTitle])

  /** Run a capture command from the blank-page door in the top bar. */
  const runCommandAtCaret = useCallback(
    (cmd: SlashCommandId) => {
      if (caretForCommand() === null) return
      editorRef.current?.triggerCommand(cmd)
    },
    [caretForCommand],
  )


  /** Map a clicked spiritual block to the popover that created it, pre-filled. */
  const handleEditBlock = useCallback(
    (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => {
      const cmd = MARK_KIND[target.type].command as SlashCommandId
      setSlashCapture({
        cmd,
        insertAt: target.from,
        anchor,
        edit: {
          id: target.id,
          from: target.from,
          to: target.to,
          content: target.content,
          reference: target.reference,
          // Prayer type isn't carried in the fence; the pray popover rehydrates it.
          prayerType: null,
        },
      })
    },
    [],
  )

  const handleOpenChapter = useCallback(
    (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => {
      const hit = chapterFromCitation(target.reference)
      if (!hit) {
        handleEditBlock(target, anchor)
        return
      }
      setChapterOpen({ ...hit, target, anchor })
    },
    [handleEditBlock],
  )

  /**
   * Turn what the writer has selected — or the paragraph they are in — into a
   * marking of the chosen kind.
   *
   * The fence in the entry is the source of truth and lands immediately; the
   * `spiritual_items` row is written after and is allowed to fail. That order is
   * deliberate: offline, or before the type migration is applied, the marking
   * still exists on the page and save-time reconcile recreates the row later.
   */
  const markLineAs = useCallback((kind: SpiritualItemType) => {
    const id = crypto.randomUUID()
    const content = editorRef.current?.markLines(kind, id)
    if (!content) return
    track('slash_used', { cmd: MARK_KIND[kind].command as SlashCommandId })
    void createSpiritualItem({ id, entry_id: entryIdRef.current, type: kind, content }).catch(() => {
      // Reconcile on save picks the fence up.
    })
  }, [])

  /*
   * heartIQ is not on this screen.
   *
   * It used to run here: a pause, a model call, and up to three proposals in
   * pencil down the right of the page you were writing. It was built carefully
   * — off the input path, verbatim-checked twice, nothing counted until kept —
   * and it was still the wrong place for it. *"It doesn't make sense to show
   * the user the intelligence as they're writing it. It only makes sense upon
   * reading. It's a distracting thing."*
   *
   * That is the sharper version of Principle 3 than the one the original build
   * satisfied. The test it passed was "does this add latency"; the test it
   * failed is "does this belong in front of someone who is composing". Being
   * shown what a machine made of your half-finished sentence is an interruption
   * whether or not it costs a millisecond.
   *
   * The engine is untouched and still earns its keep — `api/spiritual/notice.ts`,
   * `lib/noticing.ts`, and the verbatim guarantee at both ends. It is waiting on
   * a reading surface to live in, where the question it answers is one somebody
   * is actually asking. See D-026.
   */

  const handleScripturePaste = useCallback((reference: string) => {
    void recordScriptureCommandRef(entryIdRef.current, reference).catch(() => {
      // Save-time reconcile will pick up the fence.
    })
  }, [])

  /** Open the photo options menu at the pointer (left- or right-click). */
  const handleImageMenu = useCallback(
    (target: AttachmentEditTarget, point: ImageMenuPoint, anchor: InlinePanelAnchor) => {
      setImageMenu({ target, point, anchor })
    },
    [],
  )

  const closeImageMenu = useCallback(() => {
    setImageMenu((current) => {
      if (current) requestAnimationFrame(() => editorRef.current?.focusAt(current.target.from))
      return null
    })
  }, [])

  /** "Edit caption…" — hand off from the menu to the caption popover. The
   *  popover anchors to the photo's bottom edge and tracks it on scroll (see
   *  InlineImageEditPopover); we pass the column-aligned block anchor as the
   *  initial position and force below-placement. */
  const handleMenuEditCaption = useCallback((target: AttachmentEditTarget) => {
    setImageMenu((current) => {
      if (current) setImageEdit({ target, anchor: { ...current.anchor, placeAbove: false } })
      return null
    })
  }, [])

  /** Replace a photo's bytes in place: pending placeholder → upload → swap. */
  const handleReplaceImageFile = useCallback(
    async (target: AttachmentEditTarget, file: File) => {
      if (!isImageFile(file) || file.size > IMAGE_MAX_BYTES || !supabase) return
      const pendingId = crypto.randomUUID()
      const alt = altFromFile(file) || target.alt
      const takenAt = takenAtFromFile(file)
      const ownerId = (await supabase.auth.getUser()).data.user?.id
      if (!ownerId) return
      editorRef.current?.replaceRange(
        target.from,
        target.to,
        formatPendingAttachmentMarkdown(pendingId, alt),
      )
      try {
        const ref = await uploadOrQueue(
          pendingId,
          ownerId,
          file,
          extFromImageFile(file),
          alt,
          takenAt ? { takenAt } : undefined,
        )
        // null → queued offline; the placeholder stays and resolves on reconnect.
        if (ref) {
          editorRef.current?.replacePendingAttachment(pendingId, ref.hash, ref.ext, alt, target.size)
        }
      } catch (e) {
        // The replacement will never upload. Put the ORIGINAL photo back — this
        // used to remove the placeholder outright, which destroyed a photo that
        // was already safely in storage just because its replacement failed.
        console.warn('[images] replace upload rejected', e)
        editorRef.current?.replacePendingAttachment(
          pendingId,
          target.hash,
          target.ext,
          target.alt,
          target.size,
        )
      }
    },
    [],
  )

  /** Set a photo's rendered size (Small/Medium/Full) — persists in the ref. */
  const handleSetImageSize = useCallback((target: AttachmentEditTarget, size: ImageSize) => {
    editorRef.current?.replaceRange(
      target.from,
      target.to,
      formatAttachmentMarkdown(target.hash, target.ext, target.alt, size),
    )
    setImageMenu(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(target.from))
  }, [])

  const closeImageEdit = useCallback(() => {
    setImageEdit((current) => {
      if (current) {
        requestAnimationFrame(() => editorRef.current?.focusAt(current.target.from))
      }
      return null
    })
  }, [])

  const handleSaveImageCaption = useCallback((alt: string) => {
    const edit = imageEditRef.current
    if (!edit) return
    const { hash, ext, from, to, size } = edit.target
    editorRef.current?.replaceRange(from, to, formatAttachmentMarkdown(hash, ext, alt, size))
    setImageEdit(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(from))
  }, [])

  const handleRemoveImage = useCallback((target: AttachmentEditTarget) => {
    editorRef.current?.replaceRange(target.from, target.to, '')
    setImageMenu(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(target.from))
  }, [])

  /** Insert at the slash position (or replace an edited block), then refocus. */
  const completeSlashInsert = useCallback((text: string) => {
    const cap = slashCaptureRef.current
    if (!cap) return
    // Synchronous guard: null the ref immediately so a second call (from key
    // repeat, React batching race, or any other double-fire path) is blocked
    // before React re-renders. setSlashCapture(null) below keeps state in sync.
    slashCaptureRef.current = null
    // A committed block means its Return surface now holds something of the
    // user's — light the one-time discovery ember (no-op once visited).
    if (cap.cmd === 'scripture') lightEmber('scripture')
    else if (cap.cmd === 'pray' || cap.cmd === 'sense') lightEmber('altar')
    // …and remember it as "new since last visit" so the surface can name it on
    // arrival. Only fresh blocks (not in-place edits, which re-commit the same id).
    if (!cap.edit) {
      const surface = cap.cmd === 'scripture' ? 'scripture' : 'altar'
      const block = parseSpiritualBlocks(text)[0]
      if (block) {
        const label = arrivalLabelFor(block)
        if (label) recordSurfaceUpdate(surface, { id: block.id, label, ts: Date.now() })
      }
    }
    if (cap.edit) {
      // Re-resolve the block's live range by id before replacing. The stored
      // from/to can go stale if the document shifted between opening the editor
      // and saving — and replacing a stale range leaves the original in place
      // while inserting the edited copy elsewhere (the duplication bug).
      let from = cap.edit.from
      let to = cap.edit.to
      const liveDoc = contentRef.current
      const live = parseSpiritualBlocks(liveDoc).find((b) => b.id === cap.edit!.id)
      if (live) {
        from = live.from
        to = live.to > live.from && liveDoc[live.to - 1] === '\n' ? live.to - 1 : live.to
      }
      editorRef.current?.replaceRange(from, to, text)
      const after = from + text.length
      setSlashCapture(null)
      requestAnimationFrame(() => editorRef.current?.focusAt(after))
      return
    }
    // Guarantee an editable line below the block: a block is atomic, so if it
    // butts against the next atomic line (e.g. a practice section token, or the
    // end of the doc) there's nowhere to place the caret to keep writing. Append
    // a newline and drop the caret on the line that follows the block.
    const withTrailingLine = text.endsWith('\n') ? text : `${text}\n`
    editorRef.current?.insertAt(cap.insertAt, withTrailingLine)
    const after = cap.insertAt + withTrailingLine.length
    setSlashCapture(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(after))
  }, [])

  /**
   * Insert a picked emoji glyph inline at the slash position. Unlike
   * {@link completeSlashInsert}, this never appends a trailing line — an emoji
   * is inline prose, not an atomic block, so writing should continue right
   * after it on the same line.
   */
  const completeEmojiInsert = useCallback((char: string) => {
    const cap = slashCaptureRef.current
    if (!cap) return
    slashCaptureRef.current = null
    editorRef.current?.insertAt(cap.insertAt, char)
    const after = cap.insertAt + char.length
    setSlashCapture(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(after))
  }, [])

  /** Insert a practice's structured prompt block, then close the library. */
  const beginPractice = usePracticeInsertion(editorRef)
  const handleBeginPractice = useCallback(
    (practice: Practice) => {
      const cap = slashCaptureRef.current
      if (!cap) return
      setSlashCapture(null)
      track('ritual_begun')
      // Use the editor's live document, not React `content`, which can still
      // hold the just-removed "/ritual" trigger text — stale positions would
      // insert the ritual in the wrong place and orphan the slash.
      const doc = editorRef.current?.getDoc() ?? contentRef.current
      beginPractice(practice, cap.insertAt, doc)
    },
    [beginPractice],
  )

  /** Remove an edited block from the entry and delete its Altar row. */
  const handleRemoveBlock = useCallback(() => {
    const cap = slashCaptureRef.current
    if (!cap?.edit) return
    const { id, from, to } = cap.edit
    editorRef.current?.replaceRange(from, to, '')
    setSlashCapture(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(from))
    void deleteSpiritualItem(id).catch(() => {
      // Non-fatal — save-time reconciliation will prune the orphan
    })
  }, [])

  const closeSlashCapture = useCallback(() => {
    setSlashCapture((current) => {
      if (current) {
        const pos = current.insertAt
        requestAnimationFrame(() => editorRef.current?.focusAt(pos))
      }
      return null
    })
  }, [])

  /**
   * Put a body that came from storage — the cache, the server, another device —
   * into the editor, and tell autosave it is the saved baseline.
   *
   * Without that second half the loaded text reads as an unsaved local edit: it
   * gets pushed straight back on the next debounce, and `getIsDirty` reports true
   * for an entry nobody has touched, which would keep sync frozen off it.
   */
  function seedEditor(id: string, body: string) {
    setContent(body)
    adoptExternalTextRef.current(id, body)
    loadedEntryIdRef.current = id
  }

  function hydrateActiveEntry(list: Entry[]) {
    const wantedId = entryIdRef.current
    const match = wantedId ? list.find((e) => e.id === wantedId) : null
    if (match) {
      skipEntrySyncRef.current = true
      seedEditor(match.id, asEntryMarkdown(match.body_markdown))
      return
    }
    if (
      shouldAutoOpenLatest({
        wantedId,
        hasEntries: list.length > 0,
        editorBlank: !contentRef.current.trim(),
        isNewEntry: isNewEntryModeRef.current,
      })
    ) {
      skipEntrySyncRef.current = true
      go({ entryId: list[0]!.id }, { replace: true })
      seedEditor(list[0]!.id, asEntryMarkdown(list[0]!.body_markdown))
    }
  }

  /**
   * The entry a sync must not overwrite: the one on screen, and only while it
   * holds unsaved edits. Passing the open entry unconditionally (as this used to)
   * froze it against every remote update — so writing on the phone left the
   * desktop showing a stale body, and the first keystroke there overwrote what
   * the phone had written. A clean editor is safe to refresh.
   */
  const preserveEditingId = useCallback(
    () => (isDirtyRef.current() ? entryIdRef.current : null),
    [],
  )

  /**
   * Land a body that arrived from another device in the open editor. Only call
   * this once the editor is known to be clean — it replaces what is on screen.
   * The change is narrowed to what differs, so the caret and scroll hold still.
   */
  function applyRemoteBody(id: string, body: string) {
    editorRef.current?.applyRemoteDoc(body)
    // Read back rather than trusting `body`: the editor normalises block
    // separation, and the autosave baseline has to match the doc exactly or the
    // difference reads as a local edit and gets pushed straight back.
    seedEditor(id, editorRef.current?.getDoc() ?? body)
  }

  function applySyncedList(synced: Entry[]) {
    const wantedId = entryIdRef.current
    const match = wantedId ? synced.find((e) => e.id === wantedId) : null
    if (match) {
      // Current entry is in the synced list — straightforward update.
      setEntries(synced)
      const body = asEntryMarkdown(match.body_markdown)
      if (body === contentRef.current) return
      const firstLoad = loadedEntryIdRef.current !== wantedId
      const fillingBlank = !contentRef.current.trim() && body.trim() !== ''
      if (firstLoad || fillingBlank) {
        skipEntrySyncRef.current = true
        seedEditor(match.id, body)
        return
      }
      // Already loaded, and the server's copy differs. With nothing unsaved
      // locally that difference came from another device — show it.
      if (!isDirtyRef.current()) applyRemoteBody(match.id, body)
      return
    }
    if (
      shouldAutoOpenLatest({
        wantedId,
        hasEntries: synced.length > 0,
        editorBlank: !contentRef.current.trim(),
        isNewEntry: isNewEntryModeRef.current,
      })
    ) {
      setEntries(synced)
      skipEntrySyncRef.current = true
      const first = synced[0]!
      go({ entryId: first.id }, { replace: true })
      seedEditor(first.id, asEntryMarkdown(first.body_markdown))
      setIsNewEntryMode(false)
      return
    }
    if (wantedId && synced.length) {
      // The current entry is not in the server's list. Before treating it as
      // deleted, check whether it still exists in local state — a just-created
      // entry that hasn't been pushed yet won't appear in a sync that started
      // before the push. In that case keep the entry in the list and stay put;
      // the next sync (after the push succeeds) will include it.
      const localEntry = entriesRef.current.find((e) => e.id === wantedId)
      if (localEntry) {
        // Preserve the local-only entry alongside the server list.
        setEntries((prev) => {
          const syncedIds = new Set(synced.map((e) => e.id))
          const localOnly = prev.filter((e) => !syncedIds.has(e.id))
          return [...localOnly, ...synced].sort(byCreatedDesc)
        })
        return
      }
      setEntries(synced)
      navigateAwayFromDeletedEntry(synced, [wantedId])
    } else {
      setEntries(synced)
    }
  }

  // Cache-first: editor and list unlock from IndexedDB immediately; full library
  // sync runs in the background (can take a while on slow links).
  useEffect(() => {
    let cancelled = false
    setEntriesReady(true)

    void (async () => {
      try {
        const cached = await repo.listEntries()
        if (cancelled) return
        setEntries(cached)
        if (cached.length) hydrateActiveEntry(cached)
        else setIsNewEntryMode(true)
      } catch {
        /* empty cache is fine — background sync or a new entry will populate */
      }
    })()

    if (!isSupabaseConfigured) return () => {
      cancelled = true
    }

    void (async () => {
      try {
        const synced = await repo.sync(preserveEditingId())
        if (cancelled || !synced) return
        applySyncedList(synced)
      } catch (e) {
        if (!cancelled) {
          const cached = await repo.listEntries().catch(() => [] as Entry[])
          if (cached.length === 0) {
            setLoadError(e instanceof Error ? e.message : 'Failed to load')
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, [])

  // Re-sync when we regain connectivity or refocus the tab; flag offline promptly.
  // Refocus (focus / visibility) pulls only what changed — realtime kept us
  // current while open, so this stays cheap. Reconnecting (`online`) does a full
  // reconcile, since realtime was down while offline and may have missed deletes.
  useEffect(() => {
    const resyncFull = () => {
      void repo.sync(preserveEditingId()).then((list) => {
        if (list) applySyncedList(list)
      })
    }
    const resyncChanged = () => {
      void repo.syncChanged(preserveEditingId()).then((list) => {
        if (list) applySyncedList(list)
      })
    }
    const onOffline = () => syncStore.setOnline(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') resyncChanged()
    }
    window.addEventListener('online', resyncFull)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', resyncChanged)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', resyncFull)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', resyncChanged)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  function navigateAwayFromDeletedEntry(remaining: Entry[], deletedIds: string[]) {
    skipEntrySyncRef.current = true
    const orderBefore = entries.map((e) => e.id)
    const nextId = nextEntryIdAfterDelete(orderBefore, deletedIds)
    if (nextId) {
      const next = remaining.find((e) => e.id === nextId) ?? remaining[0]
      if (next) {
        go({ surface: 'journal', entryId: next.id })
        setContent(asEntryMarkdown(next.body_markdown))
        loadedEntryIdRef.current = next.id
        return
      }
    }
    go({ surface: 'journal', entryId: null })
    setContent('')
    loadedEntryIdRef.current = null
  }

  // Live updates from other tabs / devices via Supabase Realtime.
  // Shared full-reconcile helper used by realtime reconnect and the heartbeat.
  const resyncFull = useCallback(() => {
    void repo.sync(preserveEditingId()).then((list) => {
      if (list) applySyncedList(list)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applySyncedList is stable; refs hold live ids
  }, [])

  // Live updates from other tabs / devices via Supabase Realtime.
  // onReconnect triggers a full reconcile when the WebSocket re-establishes
  // after a drop — catches any events missed during the outage.
  useEffect(() => {
    if (!isSupabaseConfigured) return

    return subscribeEntryChanges({
      onBatch: (events) => {
        void (async () => {
          // Two different questions: which entry is on screen (navigation), and
          // which one a remote copy must not overwrite (only a dirty one).
          const openId = entryIdRef.current
          const changes = events.map((event) =>
            event.eventType === 'DELETE'
              ? ({ kind: 'delete' as const, entryId: event.entryId })
              : ({ kind: 'upsert' as const, entry: event.entry }),
          )

          const result = await repo.applyRemoteChanges(changes, preserveEditingId())
          if (result === 'resync') {
            const synced = await repo.sync(preserveEditingId())
            if (synced) applySyncedList(synced)
            return
          }

          const { deletedIds, upserted } = result
          if (deletedIds.length === 0 && upserted.length === 0) return

          const deletedSet = new Set(deletedIds)
          setEntries((prev) => {
            let next = prev.filter((e) => !deletedSet.has(e.id))
            for (const entry of upserted) {
              const idx = next.findIndex((e) => e.id === entry.id)
              if (idx >= 0) next = next.map((e, i) => (i === idx ? entry : e))
              else next = [entry, ...next]
            }
            return next.sort(byCreatedDesc)
          })

          // The open entry just changed on another device and nothing is unsaved
          // here — update the editor too, or the list and the text disagree.
          const openUpsert = openId ? upserted.find((e) => e.id === openId) : null
          if (openUpsert && !isDirtyRef.current()) {
            const body = asEntryMarkdown(openUpsert.body_markdown)
            if (body !== contentRef.current) applyRemoteBody(openUpsert.id, body)
          }

          if (openId && deletedSet.has(openId)) {
            const remaining = (await repo.listEntries()).filter((e) => !deletedSet.has(e.id))
            navigateAwayFromDeletedEntry(remaining, [openId])
          }
        })()
      },
      onReconnect: resyncFull,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable subscription; refs hold live ids
  }, [resyncFull])

  // A photo queued while offline finally uploaded and its placeholder resolved
  // in the cache. Reflect it in the list, and in the editor if that entry is
  // still open — otherwise it keeps showing a pending photo that has arrived.
  useEffect(() => {
    return repo.onLocalEntryChange((changedIds) => {
      void (async () => {
        const cached = await repo.listEntries()
        setEntries(cached)
        const openId = entryIdRef.current
        if (!openId || !changedIds.includes(openId) || isDirtyRef.current()) return
        const entry = cached.find((e) => e.id === openId)
        if (entry) applyRemoteBody(entry.id, asEntryMarkdown(entry.body_markdown))
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs hold the live ids
  }, [])

  // Heartbeat: every 2 minutes, pull any entries changed since the last sync.
  // syncChanged() is cursor-based — when nothing changed it's a single cheap
  // HTTP request that returns an empty array (no IDB writes, no re-render).
  // It auto-escalates to a full sync() when >5 min have passed since the last
  // full reconcile, which bounds cross-device staleness even if realtime drops
  // silently and focus/visibility events never fire (e.g. app stays open all day).
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const id = setInterval(() => {
      void repo.syncChanged(preserveEditingId()).then((list) => {
        if (list) applySyncedList(list)
      })
    }, 2 * 60_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- applySyncedList is stable; ref holds live id
  }, [])

  // Autosave must be dormant on alternate surfaces (Ascent / Altar / Lamp). The
  // editor isn't visible there, but `content` still holds the last entry's body
  // while `entryId` is null — so a flush (debounce, or the visibilitychange /
  // beforeunload listeners that fire when a desktop window loses focus) would see
  // idRef === null with a full existing body and CREATE a duplicate row. Gating
  // `enabled` on the journal surface removes those listeners and short-circuits
  // flush() off-surface; returning to journal re-baselines via the wasEnabled
  // effect so no spurious save fires. This is the actual source of the recurring
  // "duplicate entry" bug — do not loosen this gate without reading that flow.
  const { status, lastSavedAt, error: saveError, saveNow, resetEntry, getIsDirty, adoptExternalText } = useAutosave({
    entryId,
    content,
    enabled: entriesReady && state.surface === 'journal',
    // Prayers and scripture refs are NOT derived here any more. They ran inline
    // on every save, straight to the network, with the failure swallowed — so
    // anything written offline never reached the Altar or Scripture at all. The
    // repo now queues a `derive` op once the entry's push lands, which is both
    // offline-durable and two fewer round trips while typing. See lib/entryDerive.ts.
    onCreated: (created) => {
      if (!skipAdoptOnCreateRef.current) {
        go({ entryId: created.id }, { replace: true })
        setIsNewEntryMode(false)
      }
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === created.id)
        if (idx >= 0) return prev.map((e, i) => (i === idx ? created : e))
        return [created, ...prev]
      })
    },
  })
  // Close the loop for the sync effects, which mounted before autosave existed.
  isDirtyRef.current = getIsDirty
  adoptExternalTextRef.current = adoptExternalText

  // Flush the entry we're leaving when back/forward changes `entryId`.
  useEffect(() => {
    return () => {
      void saveNow()
    }
  }, [entryId, saveNow])

  // Load the entry body when navigating to a different entry. Do not reload when
  // `entries` refreshes from local typing — that clobbered the caret to line 1.
  // The early return on same-entry is the key fix: entries updates every keystroke
  // (keep-in-sync effect), so we'd otherwise overwrite live typing with stale data.
  useEffect(() => {
    if (!entriesReady) return
    if (state.surface !== 'journal') {
      // Leaving the journal fully detaches the doc: consume any pending skip
      // flag (a leaked one used to suppress the clear below on return) and drop
      // the leftover text. A surviving (entryId=null + old body) pair is the
      // torn state that minted duplicate entry rows. Safe to clear here: the
      // editor is unmounted off-surface, and the autosave session became a
      // create-blocked draft when entryId nulled, so no flush can blank a row.
      skipEntrySyncRef.current = false
      loadedEntryIdRef.current = null
      if (contentRef.current !== '') setContent('')
      return
    }
    if (skipEntrySyncRef.current) {
      skipEntrySyncRef.current = false
      return
    }
    // Body can arrive after entriesReady; don't treat the id as "loaded" until
    // we've applied the entry text (or confirmed a deliberate blank new doc).
    if (entryId === null) {
      if (loadedEntryIdRef.current !== null) {
        loadedEntryIdRef.current = null
        setContent('')
      }
      return
    }
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return

    // Same entry — list sync / autosave echoes must not overwrite live typing.
    if (loadedEntryIdRef.current === entryId) return

    // seedEditor, not a bare setContent: this runs in an effect, after autosave
    // has already baselined the new entry against the PREVIOUS entry's text, so
    // the body landing here would otherwise read as an unsaved edit — a spurious
    // push on every navigation, and a dirty flag that keeps sync frozen off an
    // entry nobody has touched.
    seedEditor(entryId, asEntryMarkdown(entry.body_markdown))
  }, [entryId, entries, entriesReady, state.surface])

  /**
   * Leave the editor for a canvas surface.
   *
   * Every surface toggle needs the same four things, and each was somewhere to
   * get it wrong independently:
   *
   *  - Flush outstanding keystrokes BEFORE the entryId→null transition. Left
   *    unawaited, the flush raced the autosave session reset and landed after
   *    it — losing the tail of an entry.
   *  - Leave focus mode. In focus mode the rail is unmounted (DesktopJournal),
   *    so a surface opened from inside it was a canvas with no visible way out.
   *  - Clear the overlays that must not survive a surface change.
   */
  async function leaveForSurface(next: Partial<AppHistoryState>) {
    await saveNow()
    focus.exit()
    go({
      entryId: null,
      entryReturn: null,
      ascentDrill: null,
      settings: null,
      help: false,
      // Leaving a surface closes the page you had open on Pages.
      //
      // It used to persist, and the state then outlived the surface it belonged
      // to: pressing Pages later re-entered whatever you last read INSTEAD of
      // the wall, and Back out of that landed on whichever surface happened to
      // be underneath. "I cannot get to all entries at all" was this — not a
      // broken button, a stale id nothing ever cleared.
      pagesSpreadId: null,
      ...next,
    })
  }

  async function toggleLookBack() {
    if (state.entryReturn?.surface === 'reflections') {
      returnFromEntryOrigin()
      return
    }
    if (reflectionsActive) back()
    else await leaveForSurface({ surface: 'reflections', ascentAltitude: 0 })
  }

  async function toggleScripture() {
    if (state.entryReturn?.surface === 'scripture') {
      returnFromEntryOrigin()
      return
    }
    if (scriptureActive) back()
    // Always land on the canon map, never a stale book panel.
    else await leaveForSurface({ surface: 'scripture', scriptureBook: null, scriptureVerse: null })
  }

  /** Open ⌘K. Find is instant and local; Ask leaves for the server on Return. */
  function openFindOrAsk(seed = '') {
    setFindSeed(seed)
    setFindOpen(true)
  }

  /**
   * Return pressed on a question — the answer is a lit wall.
   *
   * Ask used to render its own surface. It doesn't need one: what it produces
   * is a set of entries, and the wall is where a set of entries is shown. The
   * semantic legs still earn their keep — they catch pages that circle a thing
   * without ever naming it, which literal matching can't — and the question
   * arrives as a chip you can pull off like any other filter.
   */
  async function askQuestion(question: string) {
    setFindOpen(false)
    setAsking(question)
    await leaveForSurface({ surface: 'pages' })
    try {
      const result = await ask(question)
      setAsked({ question, entryIds: result.entryIds })
    } catch {
      // Offline, or the call failed. The wall falls back to lighting the words
      // in the question, which is what it would have done without Ask at all.
      setAsked(null)
      go({ pagesSubject: `word:${question}` }, { replace: true })
    } finally {
      setAsking(null)
    }
  }

  /** Find is transit — jump straight to the entry and close behind you. */
  async function openEntryById(id: string) {
    setFindOpen(false)
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    if (state.surface !== 'journal') {
      // Carry the breadcrumb. This used to hard-code `entryReturn: null`, so
      // ⌘K from a surface dropped you in the editor with no way back to where
      // you were reading — most visible from Pages, which is now ⌘1.
      go({
        surface: 'journal',
        entryId: id,
        entryReturn: entryReturnFromState(state),
          })
      return
    }
    await handleBrowse(entry)
  }

  /** Leave an entry opened from Lamp / Altar / Ascent — pop the pushed preview frame. */
  function returnFromEntryOrigin() {
    if (!state.entryReturn) {
      back()
      return
    }
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = null
    back()
  }

  async function toggleAltar() {
    if (!altarEnabled) return
    if (state.entryReturn?.surface === 'altar') {
      returnFromEntryOrigin()
      return
    }
    if (altarActive) back()
    else await leaveForSurface({ surface: 'altar' })
  }

  /**
   * ⌘1 — Pages.
   *
   * It behaves like every other Return destination now: it takes the canvas,
   * and pressing it again comes back. The panel that used to open here is gone
   * (D-025) — the list it held lives at the far end of the wall's own zoom, so
   * ⌘1 still means "my pages" and there is one fewer thing to be in a mode of.
   */
  async function goToPages() {
    if (state.entryReturn?.surface === 'pages') {
      returnFromEntryOrigin()
      return
    }
    if (pagesActive) back()
    else await leaveForSurface({ surface: 'pages' })
  }

  /**
   * Close the mobile entries drawer by CONSUMING its frame, not popping it.
   *
   * The drawer gets its own pushed frame so system Back closes it — the scrim
   * and the left-swipe still pop it, and that is right. But opening an entry
   * from the drawer commits the selection with replaceState onto that very
   * frame, so popping afterwards threw the selection away and returned you to
   * whatever the drawer had opened over: from Ascent → Entries → tap an entry,
   * you landed back on Ascent, every time. Replacing keeps the entry and leaves
   * exactly one frame behind, so Back still returns to Ascent.
   */
  function consumeDrawerFrame() {
    go({ sidebar: false }, { replace: true })
  }

  // Altar is flag-gated: never strand a user on it (e.g. a stale history frame
  // from before the flag, or a profile that lost the flag) — send them home.
  useEffect(() => {
    if (altarActive && !altarEnabled) {
      go({ surface: 'journal', entryId: null, entryReturn: null }, { replace: true })
    }
  }, [altarActive, altarEnabled, go])

  // First visit to a Return surface puts its discovery ember out for good.
  useEffect(() => {
    const s = state.surface
    if (s !== 'reflections' && s !== 'scripture' && s !== 'altar') return
    const first = !hasVisitedSurface(s)
    markSurfaceVisited(s)
    track('surface_opened', { surface: s, first })
  }, [state.surface])

  useJournalShortcuts({
    onNew: () => void handleNew(),
    onSave: saveNow,
    onPages: () => void goToPages(),
    onLookBack: toggleLookBack,
    onScripture: toggleScripture,
    onAltar: toggleAltar,
    onOpenSettings: () => {
      if (settingsOpen) closeSettings()
      else openSettings()
    },
    onFindOrAsk: () => openFindOrAsk(''),
    onToggleRailLabels: () => updateSettings({ railLabels: !settings.railLabels }),
    // ⌘= / ⌘− / ⌘0 mean "bigger / smaller / normal", and what that acts on is
    // whatever owns the screen: the writing size while writing, how close
    // you're standing while on the wall.
    onZoomIn: () =>
      pagesActive
        ? updateSettings({ pagesZoom: clampZoom(settings.pagesZoom + ZOOM_STEP) })
        : updateSettings({ fontSize: Math.min(FONT_SIZE_MAX, settings.fontSize + 1) }),
    onZoomOut: () =>
      pagesActive
        ? updateSettings({ pagesZoom: clampZoom(settings.pagesZoom - ZOOM_STEP) })
        : updateSettings({ fontSize: Math.max(FONT_SIZE_MIN, settings.fontSize - 1) }),
    onZoomReset: () =>
      pagesActive
        ? updateSettings({ pagesZoom: PAGES_ZOOM_DEFAULT })
        : updateSettings({ fontSize: FONT_SIZE_DEFAULT }),
    focusActive: focus.active,
    settingsOpen,
  })

  /*
   * Derive what the wall needs before anyone asks for it.
   *
   * Pages unmounts when you leave it, so its corpus indexes are rebuilt on
   * every visit — and the FIRST visit of a session has nothing cached at all.
   * On a phone that is most of a second between tapping Journal and seeing it.
   * Warming in idle time moves the work to a moment with nothing waiting on it;
   * `derived.ts` chunks it so the warm-up is not itself a dropped frame.
   *
   * Cancelled on change: an archive that reloads underneath a half-finished
   * warm-up should not keep deriving the list it is replacing.
   */
  useEffect(() => {
    if (!entriesReady || entries.length === 0) return
    return warmPageIndexes(entries)
  }, [entriesReady, entries])

  // After chrome hides, return focus to the editor once layout has settled.
  useEffect(() => {
    if (!focusEditorReady || !entriesReady) return
    const id = requestAnimationFrame(() => editorRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [focusEditorReady, entriesReady])

  // “?” summons the keyboard cheat-sheet anywhere (except while typing or when
  // Settings is open, which has its own Shortcuts tab). ShortcutsOverlay owns Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || settingsOpen) return
      if (shouldIgnoreTarget(e.target) || isInEditor(e.target)) return
      e.preventDefault()
      if (helpOpen) back()
      else go({ help: true })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [settingsOpen, helpOpen, go, back])

  // ⌘⌥I — open Web Inspector on desktop when dev mode is enabled.
  useEffect(() => {
    if (!isTauri() || !settings.devMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'i' || !e.metaKey || !e.altKey) return
      e.preventDefault()
      void import('@tauri-apps/api/core').then(({ invoke }) => {
        void invoke('open_devtools')
      })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [settings.devMode])

  // Esc returns to Lamp / Altar / Ascent when previewing an entry from there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !state.entryReturn) return
      if (settingsOpen || helpOpen || focus.active || slashCapture !== null) return
      if (shouldIgnoreTarget(e.target) || isInEditor(e.target)) return
      e.preventDefault()
      returnFromEntryOrigin()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state.entryReturn, settingsOpen, helpOpen, focus.active, slashCapture])

  // Keep the active entry's list row (title + word count) in sync as you type.
  // Rebuilding the `entries` array re-filters and re-groups the whole library
  // (several O(n) passes per keystroke at thousands of entries), so we debounce
  // it: a burst of typing rebuilds the list at most once per pause instead of on
  // every character. The trailing edge is flushed the instant you leave the
  // entry (the effect below) so a back-navigation — which reloads the body from
  // this in-memory list — never reads stale text.
  const syncActiveRow = useCallback((id: string, text: string) => {
    const md = asEntryMarkdown(text)
    const words = wordCount(md)
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1) return prev
      const row = prev[idx]!
      if (row.body_markdown === md && row.word_count === words) return prev
      return prev.map((e, i) => (i === idx ? { ...e, body_markdown: md, word_count: words } : e))
    })
  }, [])

  // The latest (id, text) pair in the editor, captured each keystroke so the
  // flush-on-leave effect can land the final text even mid-burst.
  const pendingRowSyncRef = useRef<{ id: string | null; text: string }>({ id: null, text: '' })

  useEffect(() => {
    if (state.surface !== 'journal' || entryId === null) return
    pendingRowSyncRef.current = { id: entryId, text: content }
    const id = entryId
    const text = content
    const timer = setTimeout(() => syncActiveRow(id, text), 200)
    return () => clearTimeout(timer)
  }, [content, entryId, state.surface, syncActiveRow])

  // Leaving the entry (id change or unmount): flush the last typed text into the
  // list synchronously, before the load effect or a re-open reads from it. Reads
  // the ref (not a `content` closure) so it isn't torn down on every keystroke;
  // cleanups run before the next render's effect bodies, so the ref still holds
  // the entry we're leaving.
  useEffect(() => {
    return () => {
      const { id, text } = pendingRowSyncRef.current
      if (id !== null) syncActiveRow(id, text)
    }
  }, [entryId, syncActiveRow])

  async function handleNew() {
    skipAdoptOnCreateRef.current = true
    try {
      await saveNow()
    } finally {
      skipAdoptOnCreateRef.current = false
    }
    // When entryId is already null, go({ entryId: null }) is a no-op so the
    // [entryId] effect in useAutosave never fires — idRef would keep pointing at
    // the entry we just saved, causing the next typing session to update it
    // instead of creating a fresh one. Reset explicitly here.
    resetEntry()
    skipEditorAutofocusRef.current = false
    skipEntrySyncRef.current = true
    // The blank draft is now the loaded doc. Left stale at the previous entry's
    // id, a later entries-list sync would hit the null-entry branch of the load
    // effect and clear the draft mid-typing.
    loadedEntryIdRef.current = null
    setIsNewEntryMode(true)
    setNewEntryGeneration((g) => g + 1)
    go({ surface: 'journal', entryId: null })
    setContent('')
    // On touch the Editor gets autofocus={false}, so a new entry — the one place
    // you unambiguously arrived to write — has to ask for the caret itself.
    if (touchFirst) requestAnimationFrame(() => editorRef.current?.focus())
  }

  async function handleBrowse(entry: Entry) {
    skipEditorAutofocusRef.current = true
    setIsNewEntryMode(false)
    const body = asEntryMarkdown(entry.body_markdown)
    if (entry.id === entryId && !canvasAlternateActive) {
      // Re-selecting the already-open entry: the editor holds the live text and
      // the list row is only a debounced echo of it, so never reload from the
      // list — that could clobber keystrokes the row sync hasn't caught up to.
      // Nothing will consume the flag on this path — leaving it set would make
      // it swallow the *next* legitimate autofocus instead.
      skipEditorAutofocusRef.current = false
      return
    }
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = entry.id
    setContent(body)
    // Replace, not push: entry-to-entry browsing must not stack a frame each
    // time, or Back walks every page you glanced at instead of leaving Pages.
    go({ surface: 'journal', entryId: entry.id }, { replace: true })
  }

  async function handleEditEntry(entry: Entry) {
    skipEditorAutofocusRef.current = false
    setIsNewEntryMode(false)
    if (entry.id === entryId && !canvasAlternateActive) {
      requestAnimationFrame(() => editorRef.current?.focus())
      return
    }
    await saveNow()
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = entry.id
    go({ surface: 'journal', entryId: entry.id }, { replace: true })
    setContent(asEntryMarkdown(entry.body_markdown))
    // Explicit edit intent, and on touch autofocus is off — ask for the caret.
    if (touchFirst) requestAnimationFrame(() => editorRef.current?.focus())
  }

  async function handleOpenReflectionEntry(id: string) {
    // The Scripture map and Altar reference entries spanning years; the one we
    // want may be older than the locally-cached ~500-entry window, so fall back
    // to the cache and then to the server.
    let entry = entries.find((e) => e.id === id) ?? (await cacheGet(id))
    if (!entry) {
      const remote = await getEntryById(id)
      if (remote) {
        await cachePut(remote)
        entry = remote
      }
    }
    if (!entry) return

    const returnCtx = entryReturnFromState(state)
    skipEditorAutofocusRef.current = true
    skipEntrySyncRef.current = true
    go({
      surface: 'journal',
      entryId: entry.id,
      entryReturn: returnCtx,
      ascentDrill: null,
      scriptureBook: null,
      scriptureVerse: null,
      settings: null,
      help: false,
    })
    setContent(asEntryMarkdown(entry.body_markdown))
    loadedEntryIdRef.current = entry.id
  }


  async function handleDuplicate(entry: Entry) {
    await saveNow()
    try {
      const copy = await repo.createEntry({
        body_markdown: entry.body_markdown,
        title: entry.title,
        tags: [...entry.tags],
      })
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === copy.id)
        if (idx >= 0) return prev.map((e, i) => (i === idx ? copy : e)).sort(byCreatedDesc)
        return [copy, ...prev].sort(byCreatedDesc)
      })
      skipEntrySyncRef.current = true
      go({ surface: 'journal', entryId: copy.id })
      setContent(asEntryMarkdown(copy.body_markdown))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to duplicate entry')
    }
  }

  async function handleEditDateSave(entry: Entry, newCreatedAt: string) {
    setEditDateEntry(null)
    try {
      const updated = await repo.updateEntryDate(entry.id, newCreatedAt)
      setEntries((prev) =>
        prev
          .map((e) => (e.id === updated.id ? updated : e))
          .sort(byCreatedDesc),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to update date')
    }
  }

  function handleEntryMenuAction(action: EntryMenuAction, entry: Entry) {
    void (async () => {
      try {
        switch (action) {
          case 'copy-text':
            await copyEntryText(entry)
            break
          case 'copy-markdown':
            await copyEntryMarkdown(entry, settings.firstLineTitle)
            break
          case 'export-markdown':
            downloadEntryMarkdown(entry, settings.firstLineTitle)
            break
          case 'duplicate':
            await handleDuplicate(entry)
            break
          case 'print':
            printEntry(entry, settings.firstLineTitle)
            break
          case 'edit-date':
            setEditDateEntry(entry)
            break
          case 'delete':
            handleDelete(entry)
            break
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'That action failed')
      }
    })()
  }

  function handleDelete(entry: Entry) {
    handleDeleteEntries([entry.id])
  }

  function handleDeleteEntries(ids: string[], focusAfterId?: string | null): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const remaining = entries.filter((e) => !idSet.has(e.id))

    // UI first — list + editor update synchronously so keyboard nav stays instant.
    setEntries(remaining)
    if (focusAfterId !== undefined) {
      skipEntrySyncRef.current = true
      if (focusAfterId) {
        const next = remaining.find((e) => e.id === focusAfterId)
        if (next) {
          go({ surface: 'journal', entryId: next.id })
          setContent(asEntryMarkdown(next.body_markdown))
          loadedEntryIdRef.current = next.id
        }
      } else {
        go({ surface: 'journal', entryId: null })
        setContent('')
        loadedEntryIdRef.current = null
      }
    } else if (entryId && idSet.has(entryId)) {
      navigateAwayFromDeletedEntry(remaining, ids)
    }

    void repo.removeEntries(ids).catch((e) => {
      setLoadError(
        e instanceof Error
          ? e.message
          : ids.length === 1
            ? 'Failed to delete entry'
            : 'Failed to delete entries',
      )
    })
  }

  function openSettings() {
    go({ settings: { tab: 'appearance', importSource: null }, help: false })
  }

  const words = useMemo(() => wordCount(content), [content])
  /**
   * Only parsed while the margin is open. Closed, the rule and its glyphs come
   * from the editor's own `spiritualBlocksField`, which is already parsed once
   * per doc change — so a shut margin costs the writing surface nothing, which
   * is the only terms on which Principle 3 lets this exist at all.
   */
  /**
   * The kind an open capture is for, when its capture is the generic prose
   * popover. Prayer, sense and scripture resolve to null here and keep the
   * popovers they already had.
   */
  const proseCaptureKind = (() => {
    if (!slashCapture) return null
    const kind = kindForCommand(slashCapture.cmd)
    return kind && MARK_KIND[kind].capture === 'prose' ? kind : null
  })()
  /**
   * Defensive dedup. Should never be needed, but a duplicated row is the visible
   * symptom of the entry-duplication class of bug, and this is cheap insurance
   * against concurrent state updates racing.
   */
  const visibleEntries = useMemo(() => {
    const seen = new Set<string>()
    return entries.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }, [entries])

  const docKey = entryId ?? `new-${newEntryGeneration}`

  // One-shot opening prompt handed over from the fresh-start onboarding path.
  // Shown as a gentle placeholder on the first new, empty entry only.
  const [seedPrompt] = useState(() => consumeSeedPrompt())

  const handleSelectionChange = useCallback((sel: EntrySelectionState, api: EntrySelectionApi) => {
    selectionApiRef.current = api
    setRangeSelectActive((prev) => (prev === sel.rangeActive ? prev : sel.rangeActive))
    setBulkSelection((prev) => {
      const next = sel.entries
      if (prev.length === next.length && prev.every((e, i) => e.id === next[i]?.id)) return prev
      return next
    })
    if (sel.rangeActive || sel.entries.length >= 2) skipEditorAutofocusRef.current = true
  }, [])

  const bulkActive = bulkSelection.length >= 2

  const surface = loadError ? (
    <p style={{ color: 'var(--danger)' }}>{loadError}</p>
  ) : bulkActive ? (
    <EntryBulkCanvas
      count={bulkSelection.length}
      onCopyText={() => void copyEntriesText(bulkSelection)}
      onCopyMarkdown={() => void copyEntriesMarkdown(bulkSelection, settings.firstLineTitle)}
      onExportZip={() => void exportEntriesZip(bulkSelection, settings.firstLineTitle)}
      onDelete={() => selectionApiRef.current?.requestDelete()}
      onClear={() => selectionApiRef.current?.clear()}
    />
  ) : rangeSelectActive ? (
    <div className="entry-range-canvas">
      <p className="entry-range-canvas__eyebrow">Selecting</p>
      <p className="entry-range-canvas__hint">Shift+↑↓ to extend in either direction</p>
    </div>
  ) : (
    <div className={`journal-write${chapterOpen ? ' journal-write--with-pane' : ''}`}>
      <div className="journal-write__editor">
        <div
          className="journal-write__canvas"
        >
          {entriesReady ? (
            <Editor
              ref={editorRef}
              docKey={docKey}
              initialDoc={content}
              onChange={handleContentChange}
              marks={entryId ? marks.marksFor(entryId) : []}
              // Marking is a READING act. The button only exists on an entry
              // written on a previous day — today's page keeps exactly the
              // formatting bar it has always had, and the writing surface gains
              // nothing (Principle 3).
              {...(entryId && isPastEntry
                ? {
                    onToggleMark: (quote: string, charStart: number, existing: Mark | null) =>
                      marks.toggleMark(entryId, quote, charStart, existing),
                  }
                : {})}
              // The `/` hint is desktop copy: CommandToolbar already puts
              // Scripture / Pray / Sense / Image above the keyboard on touch,
              // where reaching for a slash is a two-tap detour. Ritual sits on
              // the blank-page top bar. The palette itself stays enabled everywhere.
              placeholder={
                entryId === null && seedPrompt
                  ? seedPrompt
                  : settings.firstLineTitle
                    ? 'Title'
                    : touchFirst
                      ? 'Write…'
                      : 'Write — or type / for scripture, prayer & rituals'
              }
              {...(settings.firstLineTitle && {
                bodyPlaceholder: touchFirst
                  ? 'Keep going…'
                  : 'Keep going — or type / for scripture, prayer & rituals',
              })}
              autofocus={!touchFirst}
              skipAutofocusRef={skipEditorAutofocusRef}
              typewriter={focus.active && focusEditorReady && settings.typewriter}
              dimming={focus.active && focusEditorReady && settings.dimming}
              titleStyling={settings.firstLineTitle}
              showMarkdownSyntax={settings.showMarkdownSyntax}
              slashEnabled
              // Only band the line for a fresh /command; editing a block targets an
              // atomic widget line, where a line decoration collides with the block.
              commandLinePos={slashCapture && !slashCapture.edit ? slashCapture.insertAt : null}
              onSlashCommand={handleSlashCommand}
              onEditBlock={handleEditBlock}
              onOpenChapter={handleOpenChapter}
              onScripturePaste={handleScripturePaste}
              onImageMenu={handleImageMenu}
              onAboutPractice={(name) => setAboutPractice(PRACTICE_BY_NAME.get(name) ?? null)}
              onSlashPaletteChange={setSlashPaletteOpen}
            />
          ) : null}
        </div>
      {showCommandBar && !focus.active && (
        <CommandToolbar
          onCommand={(cmd) => editorRef.current?.triggerCommand(cmd)}
          onFormat={(id) => editorRef.current?.applyFormatCommand(id)}
          onHighlight={(color) => editorRef.current?.applyHighlight(color)}
          onVoice={() => {
            voiceCaretRef.current = editorRef.current?.getCursor() ?? 0
            setVoiceOpen(true)
          }}
          onScan={() => {
            scanCaretRef.current = editorRef.current?.getCursor() ?? 0
            setScanOpen(true)
          }}
          onDismissKeyboard={() => editorRef.current?.blur()}
          // The slash palette used to suppress this bar, which took the
          // thumb-reachable row away exactly when a caret-anchored popover had
          // covered the writing surface. On touch the palette is now a sheet
          // docked on the keyboard, so it sits *over* this bar rather than
          // competing with it, and the bar comes straight back on cancel.
          visible={slashCapture === null && imageEdit === null && imageMenu === null}
          docked={!isMobile}
          keyboardInset={keyboardInset}
        />
      )}
      {voiceOpen && (
        <VoiceCapture
          onInsert={(text) => insertDictatedText(text, voiceCaretRef.current)}
          onClose={() => setVoiceOpen(false)}
        />
      )}
      {scanOpen && (
        <PageScanCapture
          onInsert={(text) => insertDictatedText(text, scanCaretRef.current)}
          onClose={() => setScanOpen(false)}
        />
      )}
      {recoverableDictation && !voiceOpen && !canvasAlternateActive && !settingsOpen && !focus.active && (
        <DictationRecovery
          row={recoverableDictation}
          onInsert={(text) => {
            const doc = editorRef.current?.getDoc() ?? ''
            const sep = doc.trim() ? '\n\n' : ''
            editorRef.current?.insertAt(doc.length, sep + text)
          }}
          onDismiss={() => setRecoverableDictation(null)}
        />
      )}
      </div>
      {chapterOpen && (
        <ChapterPane
          book={chapterOpen.book}
          chapter={chapterOpen.chapter}
          highlightVerse={chapterOpen.verse}
          onClose={() => setChapterOpen(null)}
          onEdit={() => {
            const open = chapterOpen
            setChapterOpen(null)
            handleEditBlock(open.target, open.anchor)
          }}
        />
      )}
    </div>
  )

  const mainSlot = scriptureActive ? (
    <ScriptureView onOpenEntry={handleOpenReflectionEntry} />
  ) : altarActive && altarEnabled ? (
    <AltarView onOpenEntry={handleOpenReflectionEntry} />
  ) : reflectionsActive ? (
    <AscentView onOpenEntry={handleOpenReflectionEntry} />
  ) : pagesActive ? (
    <PagesView
      entries={entries}
      marks={marks.marks}
      ready={entriesReady}
      activeId={entryId}
      subjectKey={state.pagesSubject}
      asked={asked}
      onClearAsked={() => setAsked(null)}
      // Replace, not push: a subject is a filter you try on, and pushing a frame
      // per chip would make Back walk every word you looked at.
      onSubject={(key) => go({ pagesSubject: key, pagesSpreadId: null }, { replace: true })}
      spreadId={state.pagesSpreadId}
      /*
       * Opening a page pushes a frame, so system Back closes it. Turning pages
       * replaces, so Back never walks every page you read.
       *
       * "All entries" is a DESTINATION, not an undo. It used to call `back()`,
       * which meant the way out of the reader depended on however you got in —
       * and when that frame was an entry, the way out of Pages was the editor.
       * A control that names where it goes has to go there.
       */
      onSpread={(id) => {
        if (id === null) go({ pagesSpreadId: null }, { replace: true })
        else if (state.pagesSpreadId) go({ pagesSpreadId: id }, { replace: true })
        else go({ pagesSpreadId: id })
      }}
      onOpenEntry={handleOpenReflectionEntry}
      onEntryMenuAction={handleEntryMenuAction}
      onDeleteEntries={handleDeleteEntries}
      settings={settings}
      updateSettings={updateSettings}
    />
  ) : (
    surface
  )

  const viewProps: JournalViewProps = {
    userEmail,
    entries: visibleEntries,
    activeId: entryId,
    words,
    status,
    lastSavedAt,
    saveError,
    onSelect: (e) => void handleBrowse(e),
    onEditEntry: (e) => void handleEditEntry(e),
    onEntryMenuAction: handleEntryMenuAction,
    onDeleteEntries: handleDeleteEntries,
    onNew: () => void handleNew(),
    isNewEntry: isNewEntryMode,
    onLookBack: toggleLookBack,
    onScripture: toggleScripture,
    onAltar: toggleAltar,
    altarEnabled,
    onOpenSettings: () => openSettings(),
    onSync: () => {
      // An explicit tap also un-retires anything the flush gave up on — whatever
      // the server objected to may have been fixed since.
      void repo
        .retryBlocked()
        .then(() => repo.sync(preserveEditingId()))
        .then((list) => {
          if (list) applySyncedList(list)
        })
    },
    settings,
    updateSettings,
    focus,
    onPages: goToPages,
    onDrawerNavigated: consumeDrawerFrame,
    sidebarOpen: state.sidebar,
    onToggleSidebar: () => (state.sidebar ? back() : go({ sidebar: true })),
    onSelectionChange: handleSelectionChange,
    bulkActive,
    bulkCount: bulkSelection.length,
    rangeSelectActive,
    mainSlot,
    reflectionsActive,
    altarActive,
    scriptureActive,
    pagesActive,
    onFindOrAsk: () => openFindOrAsk(''),
    entryReturn: state.entryReturn,
    onReturnFromEntry: returnFromEntryOrigin,
    onCommand: runCommandAtCaret,
  }

  return (
    <FeatureFlagProvider flags={featureFlags}>
      <>
      {isMobile ? <MobileJournal {...viewProps} /> : <DesktopJournal {...viewProps} />}

      <ProcessingBanner
        onSeeAscent={() => {
          if (!reflectionsActive) void toggleLookBack()
        }}
      />

      {slashCapture?.cmd === 'scripture' && (
        <InlineScripturePopover
          entryId={entryId}
          entryContent={content}
          insertAt={slashCapture.insertAt}
          anchor={slashCapture.anchor}
          edit={
            slashCapture.edit
              ? {
                  id: slashCapture.edit.id,
                  reference: slashCapture.edit.reference,
                  content: slashCapture.edit.content,
                }
              : undefined
          }
          onInsert={completeSlashInsert}
          onRemove={handleRemoveBlock}
          onClose={closeSlashCapture}
        />
      )}
      {slashCapture?.cmd === 'pray' && (
        <InlinePrayPopover
          entryId={entryId}
          anchor={slashCapture.anchor}
          edit={
            slashCapture.edit
              ? {
                  id: slashCapture.edit.id,
                  content: slashCapture.edit.content,
                  prayerType: slashCapture.edit.prayerType,
                }
              : undefined
          }
          onInsert={completeSlashInsert}
          onRemove={handleRemoveBlock}
          onClose={closeSlashCapture}
        />
      )}
      {slashCapture?.cmd === 'sense' && (
        <InlineSensePopover
          entryId={entryId}
          anchor={slashCapture.anchor}
          edit={
            slashCapture.edit
              ? { id: slashCapture.edit.id, content: slashCapture.edit.content }
              : undefined
          }
          onInsert={completeSlashInsert}
          onRemove={handleRemoveBlock}
          onClose={closeSlashCapture}
        />
      )}
      {proseCaptureKind && slashCapture && (
        <InlineDeclaredPopover
          kind={proseCaptureKind}
          entryId={entryId}
          anchor={slashCapture.anchor}
          edit={
            slashCapture.edit
              ? { id: slashCapture.edit.id, content: slashCapture.edit.content }
              : undefined
          }
          onInsert={completeSlashInsert}
          onRemove={handleRemoveBlock}
          onClose={closeSlashCapture}
        />
      )}
      {slashCapture?.cmd === 'ritual' && (
        <PracticeLibrary
          onBegin={handleBeginPractice}
          onClose={closeSlashCapture}
          skipPreview={settings.skipRitualPreview}
          onToggleSkipPreview={(v) => updateSettings({ skipRitualPreview: v })}
        />
      )}
      {aboutPractice && (
        <PracticeAboutSheet
          practice={aboutPractice}
          onClose={() => {
            setAboutPractice(null)
            editorRef.current?.focus()
          }}
        />
      )}
      <ImageContextMenu
        phase={
          (imageMenu
            ? { kind: 'menu', target: imageMenu.target, point: imageMenu.point }
            : { kind: 'closed' }) as ImageMenuPhase
        }
        onClose={closeImageMenu}
        onEditCaption={handleMenuEditCaption}
        onReplaceFile={handleReplaceImageFile}
        onSetSize={handleSetImageSize}
        onRemove={handleRemoveImage}
      />
      {imageEdit && (
        <InlineImageEditPopover
          target={imageEdit.target}
          anchor={imageEdit.anchor}
          onSaveCaption={handleSaveImageCaption}
          onClose={closeImageEdit}
        />
      )}

      {slashCapture?.cmd === 'image' && (
        <InlineImagePopover
          anchor={slashCapture.anchor}
          onBeginUpload={((capturedInsertAt) => (pendingId, alt) => {
            // Use the render-time insertAt so this works even if the popover was
            // auto-dismissed (e.g. iOS synthesises a touchstart after the file
            // picker returns, which clears slashCapture before onChange fires).
            setSlashCapture(null)
            const after =
              editorRef.current?.insertBlockPendingAttachment(capturedInsertAt, pendingId, alt) ??
              capturedInsertAt
            requestAnimationFrame(() => editorRef.current?.focusAt(after))
          })(slashCapture.insertAt)}
          onUploadComplete={(pendingId, hash, ext, alt) => {
            editorRef.current?.replacePendingAttachment(pendingId, hash, ext, alt)
          }}
          onUploadFailed={(pendingId) => {
            editorRef.current?.removePendingAttachment(pendingId)
          }}
          onClose={closeSlashCapture}
        />
      )}

      {slashCapture?.cmd === 'emoji' && (
        <InlineEmojiPopover
          anchor={slashCapture.anchor}
          onInsert={completeEmojiInsert}
          onClose={closeSlashCapture}
        />
      )}

      {findOpen && (
        <FindPalette
          initialQuery={findSeed}
          onClose={() => setFindOpen(false)}
          onOpenEntry={(id) => void openEntryById(id)}
          onAsk={(q) => void askQuestion(q)}
        />
      )}

      {settingsOpen && state.settings && (
        <SettingsPanel
          settings={settings}
          update={updateSettings}
          onClose={closeSettings}
          tab={state.settings.tab}
          importSourceId={state.settings.importSource}
          userEmail={userEmail}
          featureFlags={featureFlags}
          onTabChange={(tab) =>
            go(
              {
                settings: {
                  tab,
                  importSource: tab === 'import' ? state.settings!.importSource : null,
                },
              },
              { replace: true },
            )
          }
          onImportSourceChange={(importSource) =>
            go({ settings: { tab: 'import', importSource } })
          }
          onImportSourceBack={back}
        />
      )}
      {helpOpen && <ShortcutsOverlay onClose={back} />}
      <EntryEditDateModal
        entry={editDateEntry}
        onClose={() => setEditDateEntry(null)}
        onSave={handleEditDateSave}
      />
    </>
    </FeatureFlagProvider>
  )
}
