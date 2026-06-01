import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor, type EditorHandle } from '@/editor/Editor'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { SlashCommandId } from '@/editor/slashDetect'
import { useAutosave } from '@/hooks/useAutosave'
import { useSettings } from '@/hooks/useSettings'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { wordCount } from '@/lib/entries'
import { subscribeEntryChanges } from '@/lib/entriesRealtime'
import { isSupabaseConfigured } from '@/lib/env'
import * as repo from '@/lib/repo'
import { syncStore } from '@/lib/sync'
import type { Entry } from '@/lib/types'
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
import {
  copyEntryMarkdown,
  copyEntryText,
  downloadEntryMarkdown,
  printEntry,
} from './entryActions'
import type { EntryMenuAction } from './EntryContextMenu'
import { isEntryRowTarget } from './useSuppressNativeContextMenu'
import type { JournalViewProps } from './journalViewProps'
import { LookingBack } from '@/features/reflections/LookingBack'
import { AltarView } from '@/features/altar/AltarView'
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
import { syncSpiritualBlocksFromMarkdown } from '@/lib/spiritual'
import { ResurfaceCard } from './ResurfaceCard'
import { fetchCurrentResurface, type ResurfaceCard as ResurfaceCardData } from '@/lib/echoes'
import '@/features/reflect/Reflect.css'

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
  const { state, go, back } = useAppNavigation()
  const { entryId, restrictIds } = state

  const [entries, setEntries] = useState<Entry[]>([])
  const [content, setContent] = useState('')
  const [entriesReady, setEntriesReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Desktop entries-panel visibility (mobile uses `state.sidebar` for its drawer).
  const [entriesOpen, setEntriesOpen] = useState(true)

  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  const settingsOpen = state.settings !== null
  const helpOpen = state.help
  const sidebarOpen = state.sidebar
  const reflectionsActive = state.surface === 'reflections'
  const altarActive = state.surface === 'altar'
  const canvasAlternateActive = reflectionsActive || altarActive
  const focus = useFocusMode(settingsOpen)
  /** Defer typewriter/dimming one frame after chrome hides — avoids CM measure churn. */
  const [focusEditorReady, setFocusEditorReady] = useState(false)
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
  const skipEntrySyncRef = useRef(false)
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
  } | null>(null)
  const slashCaptureRef = useRef(slashCapture)
  slashCaptureRef.current = slashCapture

  function handleSlashCommand(
    cmd: SlashCommandId,
    insertAt: number,
    anchor: InlinePanelAnchor,
  ) {
    setSlashCapture({ cmd, insertAt, anchor })
  }

  /** Insert at the slash position, close the popover, return focus to the editor. */
  const completeSlashInsert = useCallback((text: string) => {
    const cap = slashCaptureRef.current
    if (!cap) return
    editorRef.current?.insertAt(cap.insertAt, text)
    const after = cap.insertAt + text.length
    setSlashCapture(null)
    requestAnimationFrame(() => editorRef.current?.focusAt(after))
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

  // Resurfacing — one invitational card above the editor (echo, prayer, reminder, sense).
  const [resurface, setResurface] = useState<ResurfaceCardData | null>(null)
  useEffect(() => {
    fetchCurrentResurface().then((card) => setResurface(card)).catch(() => null)
  }, [])

  function hydrateActiveEntry(list: Entry[]) {
    const wantedId = entryIdRef.current
    const match = wantedId ? list.find((e) => e.id === wantedId) : null
    if (match) {
      skipEntrySyncRef.current = true
      setContent(match.body_markdown)
      return
    }
    if (!wantedId && list[0]) {
      skipEntrySyncRef.current = true
      go({ entryId: list[0].id }, { replace: true })
      setContent(list[0].body_markdown)
    }
  }

  // Cache-first load: show local entries instantly, then sync from the server.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await repo.listEntries()
        if (!cancelled && cached.length) {
          setEntries(cached)
          hydrateActiveEntry(cached)
        }
      } catch {
        /* cache miss is fine; sync will populate */
      }
      try {
        const synced = await repo.sync(entryIdRef.current)
        if (!cancelled && synced) {
          setEntries(synced)
          const wantedId = entryIdRef.current
          const match = wantedId ? synced.find((e) => e.id === wantedId) : null
          if (match) {
            skipEntrySyncRef.current = true
            setContent(match.body_markdown)
          } else if (!wantedId && synced.length) {
            skipEntrySyncRef.current = true
            const first = synced[0]!
            go({ entryId: first.id }, { replace: true })
            setContent(first.body_markdown)
          } else if (wantedId && synced.length) {
            navigateAwayFromDeletedEntry(synced)
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setEntriesReady(true)
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
        if (list) setEntries(list)
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

  function navigateAwayFromDeletedEntry(remaining: Entry[]) {
    skipEntrySyncRef.current = true
    const next = remaining[0] ?? null
    if (next) {
      go({ surface: 'journal', entryId: next.id })
      setContent(next.body_markdown)
    } else {
      go({ surface: 'journal', entryId: null })
      setContent('')
    }
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
            navigateAwayFromDeletedEntry(synced)
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
          navigateAwayFromDeletedEntry(remaining)
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
      void syncSpiritualBlocksFromMarkdown(saved).catch(() => {
        // Non-fatal — entry body is already persisted
      })
    },
    onCreated: (created) => {
      go({ entryId: created.id }, { replace: true })
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

  // Browser back / forward: load the entry body for the restored frame.
  useEffect(() => {
    if (!entriesReady) return
    if (skipEntrySyncRef.current) {
      skipEntrySyncRef.current = false
      return
    }
    if (entryId === null) {
      setContent('')
      return
    }
    const entry = entries.find((e) => e.id === entryId)
    if (entry) setContent(entry.body_markdown)
  }, [entryId, entries, entriesReady])

  function toggleLookBack() {
    if (reflectionsActive) back()
    else {
      void saveNow()
      setEntriesOpen(false)
      go({ surface: 'reflections', settings: null, help: false, sidebar: false })
    }
  }

  function toggleAltar() {
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
    onAltar: toggleAltar,
    onOpenSettings: () => {
      if (settingsOpen) back()
      else openSettings()
    },
    onFocusSearch: () => {
      // Reveal the list before focusing search: desktop opens its panel, mobile
      // its drawer. The input mounts immediately, so one frame is enough.
      if (isMobile) go({ sidebar: true })
      else setEntriesOpen(true)
      requestAnimationFrame(() => focusEntrySearch())
    },
    focusActive: focus.active,
    settingsOpen,
  })

  const revealEntryList = useCallback(() => {
    if (canvasAlternateActive || focus.active) return
    if (isMobile) go({ sidebar: true })
    else setEntriesOpen(true)
  }, [canvasAlternateActive, focus.active, isMobile, go])

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

  // Keep the active entry's list row in sync as you type.
  useEffect(() => {
    if (entryId === null) return
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, body_markdown: content, word_count: wordCount(content) } : e,
      ),
    )
  }, [content, entryId])

  async function handleNew() {
    await saveNow()
    skipEntrySyncRef.current = true
    go({ surface: 'journal', entryId: null })
    setContent('')
  }

  async function handleBrowse(entry: Entry) {
    skipEditorAutofocusRef.current = true
    if (bulkSelection.length >= 2 || rangeSelectActive) return

    if (entry.id === entryId && !canvasAlternateActive) return
    skipEntrySyncRef.current = true
    go({ surface: 'journal', entryId: entry.id })
    setContent(entry.body_markdown)
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
    go({ surface: 'journal', entryId: entry.id })
    setContent(entry.body_markdown)
  }

  function handleOpenReflectionEntry(id: string) {
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    void handleBrowse(entry)
  }

  const handleSelectionChange = useCallback((state: EntrySelectionState, api: EntrySelectionApi) => {
    selectionApiRef.current = api
    setRangeSelectActive(state.rangeActive)
    setBulkSelection(state.entries)
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
      setContent(copy.body_markdown)
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
            await copyEntryMarkdown(entry)
            break
          case 'export-markdown':
            downloadEntryMarkdown(entry)
            break
          case 'duplicate':
            await handleDuplicate(entry)
            break
          case 'print':
            printEntry(entry)
            break
          case 'delete':
            await handleDelete(entry)
            break
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'That action failed')
      }
    })()
  }

  async function handleDelete(entry: Entry) {
    await handleDeleteEntries([entry.id])
  }

  async function handleDeleteEntries(ids: string[]) {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    if (entryId && idSet.has(entryId)) await saveNow()

    const remaining = entries.filter((e) => !idSet.has(e.id))
    if (entryId && idSet.has(entryId)) {
      skipEntrySyncRef.current = true
      const next = remaining[0] ?? null
      if (next) {
        go({ surface: 'journal', entryId: next.id })
        setContent(next.body_markdown)
      } else {
        go({ surface: 'journal', entryId: null })
        setContent('')
      }
    }

    try {
      await Promise.all(ids.map((id) => repo.removeEntry(id)))
      setEntries(remaining)
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? e.message
          : ids.length === 1
            ? 'Failed to delete entry'
            : 'Failed to delete entries',
      )
      throw e
    }
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
    onRevealList: revealEntryList,
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
      onCopyMarkdown={() => void copyEntriesMarkdown(bulkSelection)}
      onExportZip={() => void exportEntriesZip(bulkSelection)}
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
      {resurface && (
        <ResurfaceCard card={resurface} onDismiss={() => setResurface(null)} />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {entriesReady ? (
          <Editor
            ref={editorRef}
            docKey={docKey}
            initialDoc={content}
            onChange={setContent}
            placeholder={deriveTitle(content) ? 'Keep going…' : 'Title'}
            autofocus
            skipAutofocusRef={skipEditorAutofocusRef}
            typewriter={focus.active && focusEditorReady && settings.typewriter}
            dimming={focus.active && focusEditorReady && settings.dimming}
            slashEnabled
            commandLinePos={slashCapture?.insertAt ?? null}
            onSlashCommand={handleSlashCommand}
          />
        ) : null}
      </div>
    </div>
  )

  const mainSlot = altarActive ? (
    <AltarView onOpenEntry={handleOpenReflectionEntry} />
  ) : reflectionsActive ? (
    <LookingBack embedded onOpenEntry={handleOpenReflectionEntry} />
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
          onInsert={completeSlashInsert}
          onClose={closeSlashCapture}
        />
      )}
      {slashCapture?.cmd === 'pray' && (
        <InlinePrayPopover
          entryId={entryId}
          anchor={slashCapture.anchor}
          onInsert={completeSlashInsert}
          onClose={closeSlashCapture}
        />
      )}
      {slashCapture?.cmd === 'sense' && (
        <InlineSensePopover
          entryId={entryId}
          anchor={slashCapture.anchor}
          onInsert={completeSlashInsert}
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
          onClose={back}
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
            go({ settings: { tab: 'import', importSource } }, { replace: true })
          }
          onImportSourceBack={() =>
            go({ settings: { tab: 'import', importSource: null } }, { replace: true })
          }
        />
      )}
      {helpOpen && <ShortcutsOverlay onClose={back} />}
    </>
  )
}
