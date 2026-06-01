import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@/editor/Editor'
import { useAutosave } from '@/hooks/useAutosave'
import { useSettings } from '@/hooks/useSettings'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { wordCount } from '@/lib/entries'
import * as repo from '@/lib/repo'
import { syncStore } from '@/lib/sync'
import type { Entry } from '@/lib/types'
import { useAppNavigation } from '@/context/AppNavigation'
import { useFocusMode } from './useFocusMode'
import { useJournalShortcuts } from './useJournalShortcuts'
import { DesktopJournal } from './DesktopJournal'
import { MobileJournal } from './MobileJournal'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { ShortcutsOverlay } from '@/features/shortcuts/ShortcutsOverlay'
import { isInEditor, shouldIgnoreTarget } from './keyboard'
import { deriveTitle } from './deriveTitle'
import { filterEntries } from './search'
import type { JournalViewProps } from './journalViewProps'

interface JournalScreenProps {
  userEmail: string
}

export function JournalScreen({ userEmail }: JournalScreenProps) {
  const { state, go, back } = useAppNavigation()
  const { entryId, restrictIds } = state

  const [entries, setEntries] = useState<Entry[]>([])
  const [content, setContent] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  const settingsOpen = state.settings !== null
  const helpOpen = state.help
  const sidebarOpen = state.sidebar
  const focus = useFocusMode(settingsOpen)

  const entryIdRef = useRef<string | null>(null)
  entryIdRef.current = entryId

  // Cache-first load: show local entries instantly, then sync from the server.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await repo.listEntries()
        if (!cancelled && cached.length) {
          setEntries(cached)
          const pick = entryIdRef.current
            ? (cached.find((e) => e.id === entryIdRef.current) ?? cached[0]!)
            : cached[0]!
          if (!entryIdRef.current) {
            go({ entryId: pick.id }, { replace: true })
          }
          setContent(pick.body_markdown)
        }
      } catch {
        /* cache miss is fine; sync will populate */
      }
      try {
        const synced = await repo.sync(entryIdRef.current)
        if (!cancelled && synced) {
          setEntries(synced)
          if (entryIdRef.current === null && synced.length) {
            const first = synced[0]!
            go({ entryId: first.id }, { replace: true })
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

  const { status, lastSavedAt, error: saveError, saveNow } = useAutosave({
    entryId,
    content,
    enabled: true,
    onCreated: (created) => {
      go({ entryId: created.id }, { replace: true })
      setEntries((prev) => [created, ...prev])
    },
  })

  // Flush the entry we're leaving when back/forward changes `entryId`.
  useEffect(() => {
    return () => {
      void saveNow()
    }
  }, [entryId, saveNow])

  // Browser back / forward: load the entry body for the restored frame.
  const skipEntrySyncRef = useRef(false)
  useEffect(() => {
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
  }, [entryId, entries])

  useJournalShortcuts({
    onNew: () => void handleNew(),
    onSave: saveNow,
    onOpenSettings: openSettings,
    focusActive: focus.active,
    settingsOpen,
  })

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
    go({ entryId: null })
    setContent('')
  }

  async function handleSelect(entry: Entry) {
    if (entry.id === entryId) return
    await saveNow()
    skipEntrySyncRef.current = true
    go({ entryId: entry.id })
    setContent(entry.body_markdown)
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
  const docKey = entryId ?? 'new'

  const surface = loadError ? (
    <p style={{ color: 'var(--danger)' }}>{loadError}</p>
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
    onSelect: (e) => void handleSelect(e),
    onNew: () => void handleNew(),
    query,
    onQueryChange: setQuery,
    onLookBack: () => go({ surface: 'reflections', settings: null, help: false, sidebar: false }),
    onOpenSettings: () => openSettings(),
    settings,
    updateSettings,
    focus,
    sidebarOpen,
    onToggleSidebar: () => {
      if (sidebarOpen) back()
      else go({ sidebar: true })
    },
    mainSlot,
  }

  return (
    <>
      {isMobile ? <MobileJournal {...viewProps} /> : <DesktopJournal {...viewProps} />}
      {settingsOpen && state.settings && (
        <SettingsPanel
          settings={settings}
          update={updateSettings}
          onClose={back}
          tab={state.settings.tab}
          importSourceId={state.settings.importSource}
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
