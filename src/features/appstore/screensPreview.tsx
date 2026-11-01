/**
 * `?__preview=screens&surface=…` — every main surface inside the REAL shell,
 * at whatever size the window is.
 *
 * The listing shots frame one component with no chrome around it, which is
 * right for a gallery thumbnail and useless for checking a layout: the bars,
 * the rail, the tab bar and the gutters between them are exactly what goes
 * wrong from one device to the next. This renders the shell the app would pick
 * at this width (`useIsMobile`, the same 767px switch JournalScreen uses), with
 * the surface in its slot, so a screenshot sweep across phone, iPad and desktop
 * sizes sees what a person sees.
 *
 * Fixtures only: `screens` is a capture preview (src/lib/previewMode.ts), so the
 * Altar, Lamp and Ascent data seams serve the fabricated archive and never a
 * signed-in account. Dev-only; the import in main.tsx sits behind
 * `import.meta.env.DEV` and is dropped from a production build.
 *
 *   surface = editor | pages | reader | ascent | summit | altar | lamp | settings | ascent-trip
 *   &tab=   appearance | writing | import | shortcuts | billing | about  (settings)
 *   &theme= any theme id (default ink)
 *
 * `ascent-trip` is the one that is not a still: the Ascent with an entry to open,
 * so the way back can be walked — step to an earlier period, open anything, then
 * Back / Esc / ⌘[ / the mouse's side button. It runs the real navigation
 * provider, the real AscentView and the real shell's Back control; only the
 * entry itself is a stand-in, and the `go(...)` that opens it is the one
 * `handleOpenReflectionEntry` makes (JournalScreen.tsx).
 */

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AppNavigationProvider, useAppNavigation } from '@/context/AppNavigation'
import { FeatureFlagProvider } from '@/features/flags'
import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { MobileJournal } from '@/features/journal/MobileJournal'
import { AscentView } from '@/features/ascent/AscentView'
import '@/features/ascent/Ascent.css'
import { AltarView } from '@/features/altar/AltarView'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { PagesView } from '@/features/pages/PagesView'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { entryReturnFromState, type SettingsTab } from '@/lib/appHistory'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSettings } from '@/hooks/useSettings'
import { EDITOR_FONT_VARS, settingsStore } from '@/lib/settings'
import { isLightTheme, THEMES, type ThemeId } from '@/lib/resolveTheme'
import { editorSlot, journalProps } from './devices'
import { MOCK_ENTRIES } from './mock'

const noop = () => {}

type Surface = 'editor' | 'pages' | 'reader' | 'ascent' | 'summit' | 'altar' | 'lamp' | 'settings' | 'ascent-trip'

function applyTheme(theme: ThemeId): void {
  settingsStore.update({
    appearance: isLightTheme(theme) ? 'light' : 'dark',
    ...(isLightTheme(theme) ? { lightTheme: theme } : { darkTheme: theme }),
  })
  const s = settingsStore.get()
  const root = document.documentElement
  const light = isLightTheme(theme)
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', light ? 'light' : 'dark')
  root.style.colorScheme = light ? 'light' : 'dark'
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`)
  root.style.setProperty('--editor-line-height', String(s.lineHeight))
  root.style.setProperty('--editor-max-width', `${s.maxWidth}rem`)
  root.style.setProperty('--font-editor', EDITOR_FONT_VARS[s.editorFont])
}

/** The Pages surface, with an open page when `reader` asks for one. */
function Pages({ open }: { open: boolean }) {
  const { settings, update } = useSettings()
  const [spreadId, setSpreadId] = useState<string | null>(open ? MOCK_ENTRIES[1]!.id : null)
  const [subjectKey, setSubjectKey] = useState<string | null>(null)
  return (
    <PagesView
      entries={MOCK_ENTRIES}
      marks={[]}
      ready
      activeId={null}
      subjectKey={subjectKey}
      onSubject={setSubjectKey}
      asked={null}
      onClearAsked={noop}
      spreadId={spreadId}
      onSpread={setSpreadId}
      volumeAt={null}
      volumeFrom={null}
      onVolumeAt={noop}
      onOpenEntry={noop}
      onNew={noop}
      onEntryMenuAction={noop}
      onDeleteEntries={noop}
      settings={settings}
      updateSettings={update}
    />
  )
}

/** Drives the Ascent to the Summit — the provider boots it at altitude 0. */
function Summit({ children }: { children: React.ReactNode }) {
  const { go } = useAppNavigation()
  useEffect(() => {
    go({ ascentAltitude: 3 }, { replace: true })
  }, [go])
  return <>{children}</>
}

/**
 * The Ascent with somewhere to go. Opening an entry makes the same `go(...)`
 * JournalScreen's `handleOpenReflectionEntry` makes; Esc is `returnFromEntryOrigin`
 * (a history pop); the shell's own top bar draws the Back control from the ticket.
 */
function AscentTrip() {
  const isMobile = useIsMobile()
  const Shell = isMobile ? MobileJournal : DesktopJournal
  const { state, go, back } = useAppNavigation()
  const reading = state.surface === 'journal' && state.entryId !== null

  // Boot on the Ascent, as the rail would (the provider starts on the journal).
  useEffect(() => {
    if (state.surface === 'journal' && state.entryId === null) go({ surface: 'reflections' }, { replace: true })
    // Mount only: the trip itself is navigation, and must not be re-seated.
  }, [])

  useEffect(() => {
    if (!reading) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reading, back])

  const openEntry = (id: string) =>
    go({
      surface: 'journal',
      entryId: id,
      entryReturn: entryReturnFromState(state),
      ascentDrill: null,
      scriptureBook: null,
      scriptureVerse: null,
      settings: null,
      help: false,
    })

  const slot = reading ? (
    <div data-testid="trip-entry" style={{ padding: '4rem 2rem', color: 'var(--text)' }}>
      <h2 style={{ fontFamily: 'var(--font-display, inherit)', fontWeight: 400 }}>An entry</h2>
      <p style={{ opacity: 0.7 }}>{state.entryId}</p>
    </div>
  ) : (
    <AscentView onOpenEntry={openEntry} />
  )
  return (
    <Shell
      {...journalProps(slot, reading ? {} : { reflectionsActive: true })}
      entryReturn={state.entryReturn}
      onReturnFromEntry={back}
    />
  )
}

function Screen({ surface, tab }: { surface: Surface; tab: SettingsTab }) {
  const isMobile = useIsMobile()
  const Shell = isMobile ? MobileJournal : DesktopJournal
  if (surface === 'ascent-trip') return <AscentTrip />

  let slot: React.ReactNode
  let active: Parameters<typeof journalProps>[1] = {}
  switch (surface) {
    case 'pages':
    case 'reader':
      slot = <Pages open={surface === 'reader'} />
      active = { pagesActive: true }
      break
    case 'ascent':
    case 'summit':
      slot = <AscentView onOpenEntry={noop} />
      active = { reflectionsActive: true }
      break
    case 'altar':
      slot = <AltarView onOpenEntry={noop} />
      active = { altarActive: true }
      break
    case 'lamp':
      slot = <ScriptureView onOpenEntry={noop} />
      active = { scriptureActive: true }
      break
    default:
      slot = editorSlot()
  }

  const shell = <Shell {...journalProps(slot, active)} />
  return (
    <>
      {surface === 'summit' ? <Summit>{shell}</Summit> : shell}
      {surface === 'settings' ? (
        <SettingsPanel
          settings={settingsStore.get()}
          update={noop}
          onClose={noop}
          tab={tab}
          importSourceId={null}
          onTabChange={noop}
          onImportSourceChange={noop}
          onImportSourceBack={noop}
          userEmail="you@example.com"
          featureFlags={[]}
        />
      ) : null}
    </>
  )
}

const SURFACES: Surface[] = ['editor', 'pages', 'reader', 'ascent', 'summit', 'altar', 'lamp', 'settings', 'ascent-trip']

export function renderScreensPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('surface') as Surface | null
  const surface: Surface = wanted && SURFACES.includes(wanted) ? wanted : 'editor'
  const tab = (params.get('tab') ?? 'appearance') as SettingsTab
  const wantedTheme = params.get('theme')
  const theme: ThemeId = THEMES.some((t) => t.id === wantedTheme) ? (wantedTheme as ThemeId) : 'ink'
  applyTheme(theme)

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  createRoot(el).render(
    <FeatureFlagProvider flags={[]}>
      <AppNavigationProvider>
        <Screen surface={surface} tab={tab} />
      </AppNavigationProvider>
    </FeatureFlagProvider>,
  )
}
