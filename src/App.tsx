import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { useSettings } from './hooks/useSettings'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { EDITOR_FONT_VARS } from './lib/settings'
import { SetupNotice } from './components/SetupNotice'
import { SignIn } from './components/SignIn'
import { JournalScreen } from './features/journal/JournalScreen'
import { ReflectionsScreen } from './features/reflections/ReflectionsScreen'

type Surface = 'journal' | 'reflections'

export function App() {
  const { session, loading } = useSession()
  const { settings } = useSettings()
  const resolvedTheme = useResolvedTheme(settings)
  const [surface, setSurface] = useState<Surface>('journal')
  // Cross-surface intents: open one entry (from a quote) or filter to a set
  // (from a topic). JournalScreen consumes and clears them.
  const [jumpEntryId, setJumpEntryId] = useState<string | null>(null)
  const [restrictIds, setRestrictIds] = useState<string[] | null>(null)

  // Apply per-device appearance (theme + editor typography) to CSS custom props.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
    root.style.setProperty('--editor-line-height', String(settings.lineHeight))
    root.style.setProperty('--editor-max-width', `${settings.maxWidth}rem`)
    // The writing/reading face — one token reskins both editor and reader.
    // Reflections keeps Fraunces/Newsreader regardless (don't touch those tokens).
    root.style.setProperty('--font-editor', EDITOR_FONT_VARS[settings.editorFont])
  }, [resolvedTheme, settings.fontSize, settings.lineHeight, settings.maxWidth, settings.editorFont])

  // Before keys exist, the app still boots and tells you what to configure.
  if (!isSupabaseConfigured) return <SetupNotice />

  if (loading) {
    return <div className="center-screen" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  }

  if (!session) return <SignIn />

  // Any authenticated Google account may use the app. Access is governed by the
  // Google OAuth consent screen (Testing mode) and per-row RLS (owner = auth.uid()).
  if (surface === 'reflections') {
    return (
      <ReflectionsScreen
        onBack={() => setSurface('journal')}
        onOpenEntry={(id) => {
          setRestrictIds(null)
          setJumpEntryId(id)
          setSurface('journal')
        }}
        onFilterEntries={(ids) => {
          setJumpEntryId(null)
          setRestrictIds(ids)
          setSurface('journal')
        }}
      />
    )
  }

  return (
    <JournalScreen
      userEmail={session.user.email ?? ''}
      onLookBack={() => setSurface('reflections')}
      jumpEntryId={jumpEntryId}
      onConsumeJump={() => setJumpEntryId(null)}
      restrictIds={restrictIds}
      onClearRestrict={() => setRestrictIds(null)}
    />
  )
}
