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
import { asEntryMarkdown } from '@/lib/entryLabels'
import { getEntryById, wordCount, byCreatedDesc } from '@/lib/entries'
import { subscribeEntryChanges } from '@/lib/entriesRealtime'
import { isSupabaseConfigured } from '@/lib/env'
import { isTauri } from '@/lib/platform'
import { addBreadcrumb } from '@/lib/crashReport'
import * as repo from '@/lib/repo'
import { cacheGet, cachePut } from '@/lib/db'
import { syncStore } from '@/lib/sync'
import type { Entry, PrayerType } from '@/lib/types'
import { useAppNavigation } from '@/context/AppNavigation'
import { useFocusMode } from './useFocusMode'
import { useJournalShortcuts } from './useJournalShortcuts'
import { useEntryEditorFocusToggle } from './useEntryEditorFocusToggle'
import { DesktopJournal } from './DesktopJournal'
import { MobileJournal } from './MobileJournal'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { ShortcutsOverlay } from '@/features/shortcuts/ShortcutsOverlay'
import { focusEntrySearch, isInEditor, shouldIgnoreTarget } from './keyboard'
import { filterEntries } from './search'
import { nextEntryIdAfterDelete, orderedEntryIds } from './orderedEntryIds'
import { entryReturnFromState } from '@/lib/appHistory'
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
import { AscentView } from '@/features/ascent/AscentView'
import { AltarView } from '@/features/altar/AltarView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { FeatureFlagProvider, resolveFlag } from '@/features/flags'
import { EntryBulkCanvas } from './EntryBulkCanvas'
import {
  copyEntriesMarkdown,
  copyEntriesText,
  exportEntriesZip,
} from './entryBulkActions'
import type { EntrySelectionApi, EntrySelectionState } from './entrySelectionApi'
import { InlinePrayPopover } from '@/features/capture/InlinePrayPopover'
import { InlineSensePopover } from '@/features/capture/InlineSensePopover'
import { InlineScripturePopover } from '@/features/capture/InlineScripturePopover'
import { PracticeLibrary } from '@/editor/practices/PracticeLibrary'
import { PracticeAboutSheet } from '@/editor/practices/PracticeAboutSheet'
import { usePracticeInsertion } from '@/editor/practices/usePracticeInsertion'
import { PRACTICE_BY_NAME, type Practice } from '@/editor/practices/practicesData'
import { InlineImagePopover } from '@/features/capture/InlineImagePopover'
import { InlineImageEditPopover } from '@/features/capture/InlineImageEditPopover'
import { ImageContextMenu, type ImageMenuPhase } from './ImageContextMenu'
import type { AttachmentEditTarget, ImageMenuPoint } from '@/editor/attachmentImageExtension'
import {
  formatAttachmentMarkdown,
  formatPendingAttachmentMarkdown,
  uploadImageAttachment,
  type ImageSize,
} from '@/lib/attachments'
import { IMAGE_MAX_BYTES, isImageFile } from '@/editor/attachmentInsert'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { supabase } from '@/lib/supabase'
import { CommandToolbar } from '@/editor/CommandToolbar'
import { ProcessingBanner } from './ProcessingBanner'
import { lightEmber, markSurfaceVisited } from './surfaceEmbers'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { deleteSpiritualItem, syncSpiritualBlocksFromMarkdown } from '@/lib/spiritual'
import { syncScriptureRefsFromMarkdown } from '@/lib/scripture/capture'
interface JournalScreenProps {
  userEmail: string
  featureFlags: string[]
}

export function JournalScreen({ userEmail, featureFlags }: JournalScreenProps) {
  const { state, go, back, closeSettings } = useAppNavigation()
  const { entryId, restrictIds } = state

  const [entries, setEntries] = useState<Entry[]>([])
  const [content, setContent] = useState('')
  const handleContentChange = useCallback((doc: string) => {
    setContent((prev) => (prev === doc ? prev : doc))
  }, [])
  const [entriesReady, setEntriesReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editDateEntry, setEditDateEntry] = useState<Entry | null>(null)
  const [query, setQuery] = useState('')
  // Desktop entries-panel visibility (mobile uses `state.sidebar` for its drawer).
  const [entriesOpen, setEntriesOpen] = useState(true)

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
  const settingsOpen = state.settings !== null
  const helpOpen = state.help
  const sidebarOpen = state.sidebar
  const reflectionsActive = state.surface === 'reflections'
  const altarActive = state.surface === 'altar'
  const scriptureActive = state.surface === 'scripture'
  // Altar is unfinished — hidden behind the `altar` flag (per-profile or
  // VITE_FF_ALTAR). When off, the rail/mobile buttons and ⌘4 are suppressed and
  // any stray navigation to the surface is redirected back to the journal.
  const altarEnabled = resolveFlag(featureFlags, 'altar')
  const canvasAlternateActive = reflectionsActive || altarActive || scriptureActive
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
  const skipEditorAutofocusRef = useRef(false)
  const selectionApiRef = useRef<EntrySelectionApi | null>(null)
  const [isNewEntryMode, setIsNewEntryMode] = useState(false)
  // Monotonically increasing counter so docKey always changes on handleNew(),
  // even when entryId is already null (go() would be a no-op, keeping docKey
  // at 'new' and preventing the Editor sync effect from clearing the CM view).
  const [newEntryGeneration, setNewEntryGeneration] = useState(0)
  const [bulkSelection, setBulkSelection] = useState<Entry[]>([])
  const [rangeSelectActive, setRangeSelectActive] = useState(false)

  // Slash command modals
  const editorRef = useRef<EditorHandle>(null)
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

  function handleSlashCommand(
    cmd: SlashCommandId,
    insertAt: number,
    anchor: InlinePanelAnchor,
  ) {
    addBreadcrumb('command', `slash:${cmd}`)
    setSlashCapture({ cmd, insertAt, anchor })
  }

  /** Map a clicked spiritual block to the popover that created it, pre-filled. */
  const handleEditBlock = useCallback(
    (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => {
      const cmd: SlashCommandId =
        target.type === 'prayer' ? 'pray' : target.type === 'sense' ? 'sense' : 'scripture'
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
      editorRef.current?.replaceRange(
        target.from,
        target.to,
        formatPendingAttachmentMarkdown(pendingId, alt),
      )
      try {
        const { hash, ext } = await uploadImageAttachment(
          supabase,
          file,
          takenAt ? { takenAt } : undefined,
        )
        editorRef.current?.replacePendingAttachment(pendingId, hash, ext, alt, target.size)
      } catch (e) {
        console.warn('[images] replace upload failed', e)
        editorRef.current?.removePendingAttachment(pendingId)
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

  /** Insert a practice's structured prompt block, then close the library. */
  const beginPractice = usePracticeInsertion(editorRef)
  const handleBeginPractice = useCallback(
    (practice: Practice) => {
      const cap = slashCaptureRef.current
      if (!cap) return
      setSlashCapture(null)
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

  function hydrateActiveEntry(list: Entry[]) {
    const wantedId = entryIdRef.current
    const match = wantedId ? list.find((e) => e.id === wantedId) : null
    if (match) {
      skipEntrySyncRef.current = true
      setContent(asEntryMarkdown(match.body_markdown))
      loadedEntryIdRef.current = wantedId
      return
    }
    if (!wantedId && list[0] && !contentRef.current.trim()) {
      skipEntrySyncRef.current = true
      go({ entryId: list[0].id }, { replace: true })
      setContent(asEntryMarkdown(list[0].body_markdown))
      loadedEntryIdRef.current = list[0]!.id
    }
  }

  function applySyncedList(synced: Entry[]) {
    const wantedId = entryIdRef.current
    const match = wantedId ? synced.find((e) => e.id === wantedId) : null
    if (match) {
      // Current entry is in the synced list — straightforward update.
      setEntries(synced)
      const body = asEntryMarkdown(match.body_markdown)
      const shouldSeed =
        loadedEntryIdRef.current !== wantedId ||
        (!contentRef.current.trim() && body.trim() !== '')
      if (shouldSeed && body !== contentRef.current) {
        skipEntrySyncRef.current = true
        setContent(body)
        loadedEntryIdRef.current = wantedId
      }
      return
    }
    if (!wantedId && synced.length && !contentRef.current.trim()) {
      setEntries(synced)
      skipEntrySyncRef.current = true
      const first = synced[0]!
      go({ entryId: first.id }, { replace: true })
      setContent(asEntryMarkdown(first.body_markdown))
      loadedEntryIdRef.current = first.id
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
        const synced = await repo.sync(entryIdRef.current)
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
      void repo.sync(entryIdRef.current).then((list) => {
        if (list) applySyncedList(list)
      })
    }
    const resyncChanged = () => {
      void repo.syncChanged(entryIdRef.current).then((list) => {
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
    const orderBefore = orderedEntryIds(entries, null)
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
    void repo.sync(entryIdRef.current).then((list) => {
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
          const preserveId = entryIdRef.current
          const changes = events.map((event) =>
            event.eventType === 'DELETE'
              ? ({ kind: 'delete' as const, entryId: event.entryId })
              : ({ kind: 'upsert' as const, entry: event.entry }),
          )

          const result = await repo.applyRemoteChanges(changes, preserveId)
          if (result === 'resync') {
            const synced = await repo.sync(preserveId)
            if (!synced) return
            setEntries(synced)
            if (preserveId && !synced.some((e) => e.id === preserveId)) {
              navigateAwayFromDeletedEntry(synced, [preserveId])
            }
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

          if (preserveId && deletedSet.has(preserveId)) {
            const remaining = (await repo.listEntries()).filter((e) => !deletedSet.has(e.id))
            navigateAwayFromDeletedEntry(remaining, [preserveId])
          }
        })()
      },
      onReconnect: resyncFull,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable subscription; refs hold live ids
  }, [resyncFull])

  // Heartbeat: every 2 minutes, pull any entries changed since the last sync.
  // syncChanged() is cursor-based — when nothing changed it's a single cheap
  // HTTP request that returns an empty array (no IDB writes, no re-render).
  // It auto-escalates to a full sync() when >5 min have passed since the last
  // full reconcile, which bounds cross-device staleness even if realtime drops
  // silently and focus/visibility events never fire (e.g. app stays open all day).
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const id = setInterval(() => {
      void repo.syncChanged(entryIdRef.current).then((list) => {
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
  const { status, lastSavedAt, error: saveError, saveNow, resetEntry } = useAutosave({
    entryId,
    content,
    enabled: entriesReady && state.surface === 'journal',
    onAfterSave: (saved) => {
      void syncSpiritualBlocksFromMarkdown(entryIdRef.current, saved).catch(() => {
        // Non-fatal — entry body is already persisted
      })
      void syncScriptureRefsFromMarkdown(entryIdRef.current, saved).catch(() => {
        // Non-fatal — refs just won't update until the next save
      })
    },
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

    loadedEntryIdRef.current = entryId
    setContent(asEntryMarkdown(entry.body_markdown))
  }, [entryId, entries, entriesReady, state.surface])

  async function toggleLookBack() {
    if (state.entryReturn?.surface === 'reflections') {
      returnFromEntryOrigin()
      return
    }
    if (reflectionsActive) back()
    else {
      // Persist outstanding keystrokes BEFORE navigating (local-only, ~ms).
      // Unawaited, the flush raced the entryId→null transition and could land
      // after the autosave session reset — losing the tail of the entry.
      await saveNow()
      setEntriesOpen(false)
      go({
        surface: 'reflections',
        entryId: null,
        entryReturn: null,
        ascentAltitude: 0,
        ascentDrill: null,
        settings: null,
        help: false,
        sidebar: false,
      })
    }
  }

  async function toggleScripture() {
    if (state.entryReturn?.surface === 'scripture') {
      returnFromEntryOrigin()
      return
    }
    if (scriptureActive) back()
    else {
      await saveNow() // see toggleLookBack — must complete before entryId nulls
      setEntriesOpen(false)
      // Always land on the canon map, never a stale book panel.
      go({
        surface: 'scripture',
        entryId: null,
        entryReturn: null,
        ascentDrill: null,
        settings: null,
        help: false,
        sidebar: false,
        scriptureBook: null,
        scriptureVerse: null,
      })
    }
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
    else {
      await saveNow() // see toggleLookBack — must complete before entryId nulls
      setEntriesOpen(false)
      go({
        surface: 'altar',
        entryId: null,
        entryReturn: null,
        ascentDrill: null,
        settings: null,
        help: false,
        sidebar: false,
      })
    }
  }

  function toggleEntries() {
    if (canvasAlternateActive) {
      go({ surface: 'journal', sidebar: isMobile })
      setEntriesOpen(true)
      return
    }
    if (isMobile) {
      if (state.sidebar) back()
      else go({ sidebar: true })
    } else {
      setEntriesOpen((open) => !open)
    }
  }

  // Alternate surfaces own the canvas — keep the journal list tucked away.
  useEffect(() => {
    if (!canvasAlternateActive) return
    setEntriesOpen(false)
    if (state.sidebar) go({ sidebar: false }, { replace: true })
  }, [canvasAlternateActive, state.sidebar, go])

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
    if (s === 'reflections' || s === 'scripture' || s === 'altar') markSurfaceVisited(s)
  }, [state.surface])

  useJournalShortcuts({
    onNew: () => void handleNew(),
    onSave: saveNow,
    onToggleEntries: toggleEntries,
    onLookBack: toggleLookBack,
    onScripture: toggleScripture,
    onAltar: toggleAltar,
    onOpenSettings: () => {
      if (settingsOpen) closeSettings()
      else openSettings()
    },
    onFocusSearch: () => {
      // Reveal the list before focusing search: desktop opens its panel, mobile
      // its drawer. The input mounts immediately, so one frame is enough.
      if (isMobile) go({ sidebar: true })
      else setEntriesOpen(true)
      requestAnimationFrame(() => focusEntrySearch())
    },
    onToggleRailLabels: () => updateSettings({ railLabels: !settings.railLabels }),
    onFontSizeUp: () =>
      updateSettings({ fontSize: Math.min(FONT_SIZE_MAX, settings.fontSize + 1) }),
    onFontSizeDown: () =>
      updateSettings({ fontSize: Math.max(FONT_SIZE_MIN, settings.fontSize - 1) }),
    onFontSizeReset: () => updateSettings({ fontSize: FONT_SIZE_DEFAULT }),
    focusActive: focus.active,
    settingsOpen,
  })

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
  }

  async function handleBrowse(entry: Entry) {
    skipEditorAutofocusRef.current = true
    setIsNewEntryMode(false)
    if (bulkSelection.length >= 2 || rangeSelectActive) return

    const body = asEntryMarkdown(entry.body_markdown)
    if (entry.id === entryId && !canvasAlternateActive) {
      // Re-selecting the already-open entry: the editor holds the live text and
      // the list row is only a debounced echo of it, so never reload from the
      // list — that could clobber keystrokes the row sync hasn't caught up to.
      return
    }
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = entry.id
    setContent(body)
    go({ surface: 'journal', entryId: entry.id }, { replace: true })
  }

  async function handleEditEntry(entry: Entry) {
    selectionApiRef.current?.clear()
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

  const handleSelectionChange = useCallback((state: EntrySelectionState, api: EntrySelectionApi) => {
    selectionApiRef.current = api
    setRangeSelectActive((prev) => (prev === state.rangeActive ? prev : state.rangeActive))
    setBulkSelection((prev) => {
      const next = state.entries
      if (prev.length === next.length && prev.every((e, i) => e.id === next[i]?.id)) return prev
      return next
    })
    if (state.rangeActive || state.entries.length >= 2) {
      skipEditorAutofocusRef.current = true
    }
  }, [])

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
  const visibleEntries = useMemo(() => {
    let list: Entry[]
    if (restrictIds) {
      const set = new Set(restrictIds)
      list = entries.filter((e) => set.has(e.id))
    } else {
      list = filterEntries(entries, query)
    }
    // Defensive dedup — should never be needed but prevents duplicate rows from
    // appearing in the list if concurrent state updates race in unexpected ways.
    const seen = new Set<string>()
    return list.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }, [entries, query, restrictIds])

  useEntryEditorFocusToggle({
    activeIdRef: entryIdRef,
    entries: visibleEntries,
    onEditEntry: (entry) => void handleEditEntry(entry),
    blocked:
      settingsOpen ||
      helpOpen ||
      focus.active ||
      canvasAlternateActive ||
      slashCapture !== null,
  })

  const docKey = entryId ?? `new-${newEntryGeneration}`

  // One-shot opening prompt handed over from the fresh-start onboarding path.
  // Shown as a gentle placeholder on the first new, empty entry only.
  const [seedPrompt] = useState(() => consumeSeedPrompt())

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {entriesReady ? (
          <Editor
            ref={editorRef}
            docKey={docKey}
            initialDoc={content}
            onChange={handleContentChange}
            placeholder={
              entryId === null && seedPrompt
                ? seedPrompt
                : settings.firstLineTitle
                  ? 'Title'
                  : 'Write — or type / for scripture, prayer & rituals'
            }
            {...(settings.firstLineTitle && { bodyPlaceholder: 'Keep going — or type / for scripture, prayer & rituals' })}
            autofocus
            skipAutofocusRef={skipEditorAutofocusRef}
            typewriter={focus.active && focusEditorReady && settings.typewriter}
            dimming={focus.active && focusEditorReady && settings.dimming}
            titleStyling={settings.firstLineTitle}
            slashEnabled
            // Only band the line for a fresh /command; editing a block targets an
            // atomic widget line, where a line decoration collides with the block.
            commandLinePos={slashCapture && !slashCapture.edit ? slashCapture.insertAt : null}
            onSlashCommand={handleSlashCommand}
            onEditBlock={handleEditBlock}
            onImageMenu={handleImageMenu}
            onAboutPractice={(name) => setAboutPractice(PRACTICE_BY_NAME.get(name) ?? null)}
            onSlashPaletteChange={setSlashPaletteOpen}
          />
        ) : null}
      </div>
      {showCommandBar && !focus.active && (
        <CommandToolbar
          onCommand={(cmd) => editorRef.current?.triggerCommand(cmd)}
          onDismissKeyboard={() => editorRef.current?.blur()}
          visible={
            !slashPaletteOpen && slashCapture === null && imageEdit === null && imageMenu === null
          }
          docked={!isMobile}
          keyboardInset={keyboardInset}
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
  ) : restrictIds ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="restrict-banner">
        <span>
          Showing {visibleEntries.length} {visibleEntries.length === 1 ? 'entry' : 'entries'} from a topic
        </span>
        <button
          className="btn btn--ghost"
          onClick={() => go({ restrictIds: null }, { replace: true })}
        >
          Clear
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{surface}</div>
    </div>
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
    onSelectionChange: handleSelectionChange,
    bulkActive,
    bulkCount: bulkSelection.length,
    rangeSelectActive,
    onEntryMenuAction: handleEntryMenuAction,
    onDeleteEntries: handleDeleteEntries,
    onNew: () => void handleNew(),
    isNewEntry: isNewEntryMode,
    query,
    onQueryChange: setQuery,
    onLookBack: toggleLookBack,
    onScripture: toggleScripture,
    onAltar: toggleAltar,
    altarEnabled,
    onOpenSettings: () => openSettings(),
    onSync: () => {
      void repo.sync(entryIdRef.current).then((list) => {
        if (list) applySyncedList(list)
      })
    },
    settings,
    updateSettings,
    focus,
    sidebarOpen,
    onToggleSidebar: () => {
      if (sidebarOpen) back()
      else go({ sidebar: true })
    },
    entriesOpen,
    onToggleEntries: toggleEntries,
    mainSlot,
    reflectionsActive,
    altarActive,
    scriptureActive,
    entryReturn: state.entryReturn,
    onReturnFromEntry: returnFromEntryOrigin,
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
