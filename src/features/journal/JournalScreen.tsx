import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@/editor/Editor'
import { useAutosave } from '@/hooks/useAutosave'
import { useSettings } from '@/hooks/useSettings'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { wordCount } from '@/lib/entries'
import * as repo from '@/lib/repo'
import { syncStore } from '@/lib/sync'
import type { Entry } from '@/lib/types'
import { useFocusMode } from './useFocusMode'
import { useJournalShortcuts } from './useJournalShortcuts'
import { DesktopJournal } from './DesktopJournal'
import { MobileJournal } from './MobileJournal'
import { Reader } from './Reader'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { deriveTitle } from './deriveTitle'
import { filterEntries } from './search'
import type { JournalViewProps, ViewMode } from './journalViewProps'

interface JournalScreenProps {
  userEmail: string
  /** Route to the Reflections surface. */
  onLookBack: () => void
  /** When set, select & open this entry (from a rollup quote), then clear. */
  jumpEntryId: string | null
  onConsumeJump: () => void
  /** When set, restrict the entry list to these ids (from a rollup topic). */
  restrictIds: string[] | null
  onClearRestrict: () => void
}

export function JournalScreen({
  userEmail,
  onLookBack,
  jumpEntryId,
  onConsumeJump,
  restrictIds,
  onClearRestrict,
}: JournalScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('write')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  const focus = useFocusMode(settingsOpen)

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  // Cache-first load: show local entries instantly, then sync from the server.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await repo.listEntries()
        if (!cancelled && cached.length) {
          setEntries(cached)
          const first = cached[0]!
          setActiveId(first.id)
          setContent(first.body_markdown)
        }
      } catch {
        /* cache miss is fine; sync will populate */
      }
      try {
        const synced = await repo.sync(activeIdRef.current)
        if (!cancelled && synced) {
          setEntries(synced)
          if (activeIdRef.current === null && synced.length) {
            const first = synced[0]!
            setActiveId(first.id)
            setContent(first.body_markdown)
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Re-sync when we regain connectivity or refocus the tab; flag offline promptly.
  useEffect(() => {
    const resync = () => {
      void repo.sync(activeIdRef.current).then((list) => {
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

  const { status, lastSavedAt, error: saveError, saveNow } = useAutosave({
    entryId: activeId,
    content,
    enabled: mode === 'write',
    onCreated: (created) => {
      setActiveId(created.id)
      setEntries((prev) => [created, ...prev])
    },
  })

  useJournalShortcuts({
    onNew: () => void handleNew(),
    onSave: saveNow,
    onExitEdit: () => setMode('read'),
    onEnterEdit: () => setMode('write'),
    onOpenSettings: openSettings,
    mode,
    focusActive: focus.active,
    settingsOpen,
  })

  // Keep the active entry's list row in sync as you type.
  useEffect(() => {
    if (activeId === null) return
    setEntries((prev) =>
      prev.map((e) =>
        e.id === activeId ? { ...e, body_markdown: content, word_count: wordCount(content) } : e,
      ),
    )
  }, [content, activeId])

  async function handleNew() {
    await saveNow()
    setActiveId(null)
    setContent('')
    setMode('write')
  }

  async function handleSelect(entry: Entry) {
    if (entry.id === activeId) return
    await saveNow()
    setActiveId(entry.id)
    setContent(entry.body_markdown)
  }

  function openSettings() {
    setSettingsOpen(true)
  }

  // A rollup quote click sets jumpEntryId: open that entry in the reader once
  // it's loaded, then consume the intent so re-renders don't re-trigger it.
  const consumedJumpRef = useRef<string | null>(null)
  useEffect(() => {
    if (!jumpEntryId || consumedJumpRef.current === jumpEntryId) return
    const target = entries.find((e) => e.id === jumpEntryId)
    if (!target) return // entries still loading; retry when they arrive
    consumedJumpRef.current = jumpEntryId
    void (async () => {
      await saveNow()
      setActiveId(jumpEntryId)
      setContent(target.body_markdown)
      setMode('read')
      onConsumeJump()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpEntryId, entries])

  const words = useMemo(() => wordCount(content), [content])
  const visibleEntries = useMemo(() => {
    if (restrictIds) {
      const set = new Set(restrictIds)
      return entries.filter((e) => set.has(e.id))
    }
    return filterEntries(entries, query)
  }, [entries, query, restrictIds])
  const activeEntry = entries.find((e) => e.id === activeId) ?? null
  const docKey = activeId ?? 'new'

  const surface = loadError ? (
    <p style={{ color: 'var(--danger)' }}>{loadError}</p>
  ) : mode === 'read' ? (
    <Reader markdown={content} createdAt={activeEntry?.created_at} />
  ) : (
    <Editor
      docKey={docKey}
      initialDoc={content}
      onChange={setContent}
      placeholder={deriveTitle(content) ? 'Keep going…' : 'Title'}
      autofocus
      typewriter={focus.active && settings.typewriter}
      dimming={focus.active && settings.dimming}
    />
  )

  const mainSlot = restrictIds ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="restrict-banner">
        <span>
          Showing {visibleEntries.length} {visibleEntries.length === 1 ? 'entry' : 'entries'} from a topic
        </span>
        <button className="btn btn--ghost" onClick={onClearRestrict}>
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
    activeId,
    words,
    status,
    lastSavedAt,
    saveError,
    onSelect: (e) => void handleSelect(e),
    onNew: () => void handleNew(),
    query,
    onQueryChange: setQuery,
    mode,
    onToggleMode: () => setMode((m) => (m === 'write' ? 'read' : 'write')),
    onLookBack,
    onOpenSettings: openSettings,
    settings,
    updateSettings,
    focus,
    sidebarOpen,
    onToggleSidebar: () => setSidebarOpen((prev) => !prev),
    mainSlot,
  }

  return (
    <>
      {isMobile ? <MobileJournal {...viewProps} /> : <DesktopJournal {...viewProps} />}
      {settingsOpen && (
        <SettingsPanel settings={settings} update={updateSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  )
}
