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
import { DesktopJournal } from './DesktopJournal'
import { MobileJournal } from './MobileJournal'
import { Reader } from './Reader'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { deriveTitle } from './deriveTitle'
import { filterEntries } from './search'
import type { JournalViewProps, ViewMode } from './journalViewProps'

export function JournalScreen({ userEmail }: { userEmail: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ViewMode>('write')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  const focus = useFocusMode()

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

  const words = useMemo(() => wordCount(content), [content])
  const visibleEntries = useMemo(() => filterEntries(entries, query), [entries, query])
  const activeEntry = entries.find((e) => e.id === activeId) ?? null
  const docKey = activeId ?? 'new'

  const mainSlot = loadError ? (
    <p style={{ color: 'var(--danger)' }}>{loadError}</p>
  ) : mode === 'read' ? (
    <Reader markdown={content} createdAt={activeEntry?.created_at} />
  ) : (
    <Editor
      docKey={docKey}
      initialDoc={content}
      onChange={setContent}
      placeholder={deriveTitle(content) ? 'Keep going…' : 'What happened today?'}
      autofocus
      typewriter={focus.active && settings.typewriter}
      dimming={focus.active && settings.dimming}
    />
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
    onOpenSettings: () => setSettingsOpen(true),
    settings,
    updateSettings,
    focus,
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
