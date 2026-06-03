import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor, type EditorHandle } from '@/editor/Editor'
import type { SpiritualBlockEditTarget } from '@/editor/spiritualBlockDecoration'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { SlashCommandId } from '@/editor/slashDetect'
import { useAutosave } from '@/hooks/useAutosave'
import { useSettings } from '@/hooks/useSettings'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { useKeyboardOpen, useKeyboardInset } from '@/hooks/useKeyboard'
import { asEntryMarkdown } from '@/lib/entryLabels'
import { getEntryById, wordCount } from '@/lib/entries'
import { subscribeEntryChanges } from '@/lib/entriesRealtime'
import { isSupabaseConfigured } from '@/lib/env'
import * as repo from '@/lib/repo'
import { cacheGet } from '@/lib/db'
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
import { deriveTitle } from './deriveTitle'
import { filterEntries } from './search'
import { nextEntryIdAfterDelete, orderedEntryIds } from './orderedEntryIds'
import { entryReturnFromState } from '@/lib/appHistory'
import {
  copyEntryMarkdown,
  copyEntryText,
  downloadEntryMarkdown,
  printEntry,
} from './entryActions'
import type { EntryMenuAction } from './EntryContextMenu'
import { isEntryRowTarget } from './useSuppressNativeContextMenu'
import type { JournalViewProps } from './journalViewProps'
import { AscentView } from '@/features/ascent/AscentView'
import { AltarView } from '@/features/altar/AltarView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
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
import { InlineRemindPopover } from '@/features/capture/InlineRemindPopover'
import { CommandToolbar } from '@/editor/CommandToolbar'
import { deleteSpiritualItem, syncSpiritualBlocksFromMarkdown } from '@/lib/spiritual'
import { syncScriptureRefsFromMarkdown } from '@/lib/scripture/capture'
interface JournalScreenProps {
  userEmail: string
}

/**
 * Extract the sentence nearest `pos` in `content` for pre-populating /remind.
 * Strips any trailing /command text and falls back to the paragraph if the
 * detected sentence is too short.
 */
function sentenceNear(content: string, pos: number): string {
  const before = content.slice(0, pos)
  if (!before.trim()) return ''

  // Find the last sentence boundary before pos.
  let lastBoundary = 0
  const re = /[.!?]\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(before)) !== null) lastBoundary = m.index + m[0].length

  // Also treat paragraph breaks as sentence starts.
  const lastPara = before.lastIndexOf('\n\n')
  const start = Math.max(lastBoundary, lastPara < 0 ? 0 : lastPara + 2)

  // Sentence extends to the first ., !, ? or \n after pos.
  const after = content.slice(pos)
  const endM = /^[^.!?\n]*[.!?\n]?/.exec(after)
  const end = pos + (endM ? endM[0].length : 0)

  const raw = content.slice(start, end)
  // Strip the slash command text itself.
  const cleaned = raw.replace(/\s*\/[a-z]*\s*/, ' ').trim()

  // If too short, use last ~200 chars before pos.
  if (cleaned.length < 15) {
    return before.slice(-200).replace(/\s*\/[a-z]*\s*$/, '').trim()
  }
  return cleaned
}

export function JournalScreen({ userEmail }: JournalScreenProps) {
  const { state, go, back, closeSettings } = useAppNavigation()
  const { entryId, restrictIds } = state

  const [entries, setEntries] = useState<Entry[]>([])
  const [content, setContent] = useState('')
  const handleContentChange = useCallback((doc: string) => {
    setContent((prev) => (prev === doc ? prev : doc))
  }, [])
  const [entriesReady, setEntriesReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
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
  const skipEntrySyncRef = useRef(false)
  /** While true, autosave may create an entry but we must not adopt its id (⌘N / C “new”). */
  const skipAdoptOnCreateRef = useRef(false)
  /** Last entry id whose body we loaded into the editor — avoids reloading on list sync. */
  const loadedEntryIdRef = useRef<string | null>(null)
  const skipEditorAutofocusRef = useRef(false)
  const selectionApiRef = useRef<EntrySelectionApi | null>(null)
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

  const [slashPaletteOpen, setSlashPaletteOpen] = useState(false)
  const focusOverlaysOpen =
    settingsOpen || helpOpen || slashCapture !== null || slashPaletteOpen
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

  /** Insert at the slash position (or replace an edited block), then refocus. */
  const completeSlashInsert = useCallback((text: string) => {
    const cap = slashCaptureRef.current
    if (!cap) return
    if (cap.edit) {
      editorRef.current?.replaceRange(cap.edit.from, cap.edit.to, text)
      const after = cap.edit.from + text.length
      setSlashCapture(null)
      requestAnimationFrame(() => editorRef.current?.focusAt(after))
      return
    }
    editorRef.current?.insertAt(cap.insertAt, text)
    const after = cap.insertAt + text.length
    setSlashCapture(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(after))
  }, [])

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
    setEntries(synced)
    const wantedId = entryIdRef.current
    const match = wantedId ? synced.find((e) => e.id === wantedId) : null
    if (match) {
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
      skipEntrySyncRef.current = true
      const first = synced[0]!
      go({ entryId: first.id }, { replace: true })
      setContent(asEntryMarkdown(first.body_markdown))
      loadedEntryIdRef.current = first.id
      return
    }
    if (wantedId && synced.length) {
      navigateAwayFromDeletedEntry(synced, [wantedId])
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
  useEffect(() => {
    const resync = () => {
      void repo.sync(entryIdRef.current).then((list) => {
        if (list) applySyncedList(list)
      })
    }
    const onOffline = () => syncStore.setOnline(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync()
    }
    window.addEventListener('online', resync)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', resync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', resync)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', resync)
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
  useEffect(() => {
    if (!isSupabaseConfigured) return

    return subscribeEntryChanges((events) => {
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
          return next.sort((a, b) => b.created_at.localeCompare(a.created_at))
        })

        if (preserveId && deletedSet.has(preserveId)) {
          const remaining = (await repo.listEntries()).filter((e) => !deletedSet.has(e.id))
          navigateAwayFromDeletedEntry(remaining, [preserveId])
        }
      })()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable subscription; refs hold live ids
  }, [])

  const { status, lastSavedAt, error: saveError, saveNow } = useAutosave({
    entryId,
    content,
    enabled: entriesReady,
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

  // Browser back / forward: load the entry body when the active entry changes.
  // Do not reload when `entries` refreshes from list sync — that fights live typing.
  useEffect(() => {
    if (!entriesReady) return
    if (state.surface !== 'journal') {
      loadedEntryIdRef.current = null
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

    const body = asEntryMarkdown(entry.body_markdown)
    if (loadedEntryIdRef.current === entryId && body === content) return

    loadedEntryIdRef.current = entryId
    setContent(body)
  }, [entryId, entries, entriesReady, state.surface])

  function toggleLookBack() {
    if (state.entryReturn?.surface === 'reflections') {
      returnFromEntryOrigin()
      return
    }
    if (reflectionsActive) back()
    else {
      void saveNow()
      setEntriesOpen(false)
      go({ surface: 'reflections', settings: null, help: false, sidebar: false })
    }
  }

  function toggleScripture() {
    if (state.entryReturn?.surface === 'scripture') {
      returnFromEntryOrigin()
      return
    }
    if (scriptureActive) back()
    else {
      void saveNow()
      setEntriesOpen(false)
      // Always land on the canon map, never a stale book panel.
      go({
        surface: 'scripture',
        settings: null,
        help: false,
        sidebar: false,
        scriptureBook: null,
        scriptureVerse: null,
        entryReturn: null,
      })
    }
  }

  /** Leave an entry opened from Lamp / Altar / Ascent and restore that canvas. */
  function returnFromEntryOrigin() {
    const ret = state.entryReturn
    if (!ret) {
      back()
      return
    }
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = null
    go(
      {
        surface: ret.surface,
        entryId: null,
        entryReturn: null,
        scriptureBook: ret.scriptureBook,
        scriptureVerse: ret.scriptureVerse,
        settings: null,
        help: false,
      },
      { replace: true },
    )
  }

  function toggleAltar() {
    if (state.entryReturn?.surface === 'altar') {
      returnFromEntryOrigin()
      return
    }
    if (altarActive) back()
    else {
      void saveNow()
      setEntriesOpen(false)
      go({ surface: 'altar', settings: null, help: false, sidebar: false })
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

  // Keep the active entry's list row in sync as you type.
  useEffect(() => {
    if (state.surface !== 'journal' || entryId === null) return
    const words = wordCount(content)
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entryId)
      if (idx === -1) return prev
      const row = prev[idx]!
      if (row.body_markdown === content && row.word_count === words) return prev
      return prev.map((e) =>
        e.id === entryId
          ? { ...e, body_markdown: asEntryMarkdown(content), word_count: words }
          : e,
      )
    })
  }, [content, entryId, state.surface])

  async function handleNew() {
    skipAdoptOnCreateRef.current = true
    try {
      await saveNow()
      skipEntrySyncRef.current = true
      go({ surface: 'journal', entryId: null })
      setContent('')
    } finally {
      skipAdoptOnCreateRef.current = false
    }
  }

  async function handleBrowse(entry: Entry) {
    skipEditorAutofocusRef.current = true
    if (bulkSelection.length >= 2 || rangeSelectActive) return

    const body = asEntryMarkdown(entry.body_markdown)
    if (entry.id === entryId && !canvasAlternateActive) {
      if (body !== content) {
        skipEntrySyncRef.current = true
        setContent(body)
      }
      return
    }
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = entry.id
    go({ surface: 'journal', entryId: entry.id })
    setContent(body)
  }

  async function handleEditEntry(entry: Entry) {
    selectionApiRef.current?.clear()
    skipEditorAutofocusRef.current = false
    if (entry.id === entryId && !canvasAlternateActive) {
      requestAnimationFrame(() => editorRef.current?.focus())
      return
    }
    await saveNow()
    skipEntrySyncRef.current = true
    loadedEntryIdRef.current = entry.id
    go({ surface: 'journal', entryId: entry.id })
    setContent(asEntryMarkdown(entry.body_markdown))
  }

  async function handleOpenReflectionEntry(id: string) {
    // The Scripture map and Altar reference entries spanning years; the one we
    // want may be older than the locally-cached ~500-entry window, so fall back
    // to the cache and then to the server.
    const entry =
      entries.find((e) => e.id === id) ?? (await cacheGet(id)) ?? (await getEntryById(id))
    if (!entry) return

    const returnCtx = entryReturnFromState(state)
    skipEditorAutofocusRef.current = true
    skipEntrySyncRef.current = true
    go({
      surface: 'journal',
      entryId: entry.id,
      entryReturn: returnCtx,
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
      setEntries((prev) => [copy, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      skipEntrySyncRef.current = true
      go({ surface: 'journal', entryId: copy.id })
      setContent(asEntryMarkdown(copy.body_markdown))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to duplicate entry')
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
    if (restrictIds) {
      const set = new Set(restrictIds)
      return entries.filter((e) => set.has(e.id))
    }
    return filterEntries(entries, query)
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

  const docKey = entryId ?? 'new'

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
              deriveTitle(asEntryMarkdown(content))
                ? 'Keep going — or type / for scripture, prayer & more'
                : settings.firstLineTitle
                  ? 'Title'
                  : 'Write…'
            }
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
            onSlashPaletteChange={setSlashPaletteOpen}
          />
        ) : null}
      </div>
      {showCommandBar && !focus.active && (
        <CommandToolbar
          onCommand={(cmd) => editorRef.current?.triggerCommand(cmd)}
          onDismissKeyboard={() => editorRef.current?.blur()}
          visible={!slashPaletteOpen && slashCapture === null}
          docked={!isMobile}
          keyboardInset={keyboardInset}
        />
      )}
    </div>
  )

  const mainSlot = scriptureActive ? (
    <ScriptureView onOpenEntry={handleOpenReflectionEntry} />
  ) : altarActive ? (
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
    query,
    onQueryChange: setQuery,
    onLookBack: toggleLookBack,
    onScripture: toggleScripture,
    onAltar: toggleAltar,
    onOpenSettings: () => openSettings(),
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
    <>
      {isMobile ? <MobileJournal {...viewProps} /> : <DesktopJournal {...viewProps} />}

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
      {slashCapture?.cmd === 'remind' && (
        <InlineRemindPopover
          entryId={entryId}
          sentence={sentenceNear(content, slashCapture.insertAt)}
          anchor={slashCapture.anchor}
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
    </>
  )
}
