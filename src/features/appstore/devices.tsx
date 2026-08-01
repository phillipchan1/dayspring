/**
 * The cross-device shot's two panes.
 *
 * Both layouts are pure `JournalViewProps` consumers — state lives in
 * JournalScreen — so a pane is this literal plus a `mainSlot`. `useIsMobile()` is
 * a `(max-width: 767px)` media query, so which layout you get is decided purely
 * by the iframe's width: the desktop pane is rendered at 1280pt and picks up the
 * three-column shell (rail · entries · canvas), the phone pane at 420pt.
 */

import { DesktopJournal } from '@/features/journal/DesktopJournal'
import { MobileJournal } from '@/features/journal/MobileJournal'
import { Editor } from '@/editor/Editor'
import { VoiceCapture } from '@/features/capture/VoiceCapture'
import { settingsStore } from '@/lib/settings'
import type { JournalViewProps } from '@/features/journal/journalViewProps'
import { MOCK_ACTIVE_ENTRY, MOCK_DOC, MOCK_ENTRIES } from './mock'

export type DevicePane = 'desktop' | 'phone'

/** True device viewports for each pane, in CSS points. */
export const PANE_VIEWPORT: Record<DevicePane, { width: number; height: number }> = {
  // Comfortably past the 767px breakpoint, and a realistic app window. Taller
  // and narrower than a 16:10 laptop on purpose: the frame is portrait, and a
  // wide-short window leaves the composite floating in dead space it cannot grow
  // into (width is the binding constraint, so it can't simply be scaled up).
  desktop: { width: 1120, height: 880 },
  phone: { width: 420, height: 860 },
}

const noop = () => {}

/** Shared with the iPad shots, which render the same shell around a surface. */
export function journalProps(
  mainSlot: React.ReactNode,
  active?: Partial<Pick<JournalViewProps, 'reflectionsActive' | 'altarActive' | 'scriptureActive'>>,
): JournalViewProps {
  return {
    userEmail: 'you@example.com',
    entries: MOCK_ENTRIES,
    activeId: MOCK_ACTIVE_ENTRY.id,
    words: MOCK_ACTIVE_ENTRY.word_count,
    status: 'saved',
    lastSavedAt: Date.now(),
    saveError: null,
    onSelect: noop,
    onEditEntry: noop,
    bulkActive: false,
    bulkCount: 0,
    rangeSelectActive: false,
    onEntryMenuAction: noop,
    onDeleteEntries: noop,
    onNew: noop,
    isNewEntry: false,
    query: '',
    onQueryChange: noop,
    onLookBack: noop,
    onScripture: noop,
    onAltar: noop,
    altarEnabled: true,
    // The listing captures show the shipped navigation — the Well is hidden.
    wellEnabled: false,
    onOpenSettings: noop,
    onSync: noop,
    settings: settingsStore.get(),
    updateSettings: noop,
    focus: { active: false, enter: noop, exit: noop, toggle: noop },
    sidebarOpen: false,
    onToggleSidebar: noop,
    // The entries panel is the clearest "this is the desktop app" signal, so it
    // stays open; the phone has no equivalent and ignores this.
    entriesOpen: true,
    onToggleEntries: noop,
    mainSlot,
    reflectionsActive: false,
    altarActive: false,
    scriptureActive: false,
    wellActive: false,
    ...active,
    onFindOrAsk: noop,
    entryReturn: null,
    onReturnFromEntry: noop,
  }
}

export function editorSlot() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          docKey={MOCK_ACTIVE_ENTRY.id}
          initialDoc={MOCK_DOC}
          onChange={noop}
          placeholder="Title"
          autofocus={false}
          titleStyling
          slashEnabled
        />
      </div>
    </div>
  )
}

export function renderDevicePane(pane: DevicePane) {
  if (pane === 'desktop') return <DesktopJournal {...journalProps(editorSlot())} />

  // The phone pane carries the dictation claim, so it shows the voice sheet
  // rather than a second copy of the editor. VoiceCapture auto-starts on mount
  // and needs a microphone; the capture script passes Chrome's fake-media-device
  // flags so it reaches its recording state instead of an error.
  return (
    <>
      <MobileJournal {...journalProps(editorSlot())} />
      <VoiceCapture onInsert={noop} onClose={noop} />
    </>
  )
}
