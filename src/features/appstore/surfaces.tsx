/**
 * ONE IDEA PER SHOT.
 *
 * A whole phone screen is unreadable at gallery-thumbnail size — the eye has
 * nothing to land on and the app chrome (header, tab bar, FAB) is noise a
 * browser has to decode before they get to the point. So each shot renders a
 * single shipped component, at device width, with no shell around it, and
 * ShotFrame scales it up until it reads at a glance.
 *
 * These are still the real components with the real CSS. What changes is the
 * framing, not the fidelity.
 */

import { Summit } from '@/features/ascent/Summit'
import { ALTITUDES } from '@/features/ascent/ascent.config'
import '@/features/ascent/Ascent.css'
import { ScriptureView } from '@/features/scripture/ScriptureView'
import { AltarView } from '@/features/altar/AltarView'
import { EntryList } from '@/features/journal/EntryList'
import { Editor } from '@/editor/Editor'
import { CommandToolbar } from '@/editor/CommandToolbar'
import { PracticeLibrary } from '@/editor/practices/PracticeLibrary'
import type { Shot } from './shots'
import {
  MOCK_ACTIVE_ENTRY,
  MOCK_DOC,
  MOCK_ENTRIES,
  SUMMIT_SCRIPTURE,
  SUMMIT_WORDS,
} from './mock'

const noop = () => {}

/**
 * The alternate-surface CSS context, minus the chrome. `.journal-canvas` and
 * `.journal-canvas__content` are what MobileJournal wraps a surface in; the
 * header, tab bar and FAB it also renders are deliberately absent.
 */
function Canvas({ children, pad = false }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <div className="app-shell" style={{ flexDirection: 'column', height: '100dvh' }}>
      <div className="journal-canvas journal-canvas--reflections" style={{ flex: 1, minHeight: 0 }}>
        <div
          className="journal-canvas__content"
          style={{ padding: pad ? '1.25rem 1rem' : 0, overflow: 'hidden', height: '100%' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function EditorSnippet({ doc, toolbar }: { doc: string; toolbar: boolean }) {
  return (
    <div className="app-shell" style={{ flexDirection: 'column', height: '100dvh' }}>
      <div className="journal-canvas" style={{ flex: 1, minHeight: 0 }}>
        {/*
          Structure copied from JournalScreen's editor slot, and the nesting is
          load-bearing: `.command-toolbar` carries `margin: 0 -1rem -1.25rem` to
          cancel this canvas padding and bleed to the screen edges. Rendered as a
          sibling of the padded box instead, those negative margins push it
          outside the card and shave the first label and the row's baseline.
        */}
        <div
          className="journal-canvas__content"
          style={{ padding: '1.5rem 1rem 1.25rem', overflow: 'hidden', height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Editor
                docKey={MOCK_ACTIVE_ENTRY.id}
                initialDoc={doc}
                onChange={noop}
                placeholder="Title"
                autofocus={false}
                titleStyling
                slashEnabled
              />
            </div>
            {/*
              The keyboard-accessory bar, not the `/` palette. On a phone this is
              the capture UI — the palette belongs to a hardware keyboard — and
              it is all capture: no Heading / Bold / Italic rows competing with
              the point. It normally appears with the on-screen keyboard, which a
              headless capture cannot raise, so it is rendered directly.
              `onDismissKeyboard` is left off: its trailing "Done" chevron is a
              keyboard affordance with no keyboard here, and it costs the width
              that "Scripture" needs.
            */}
            {toolbar && <CommandToolbar onCommand={noop} onVoice={noop} onScan={noop} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export function renderSurface(shot: Shot) {
  switch (shot.surface) {
    case 'ascent': {
      // Summit alone — the mountain and the one verbatim line of the year. Not
      // AscentView: the climb rail, altitude header and lens row are context a
      // first-time viewer has no way to read.
      //
      // The `.ascent` wrapper is not decoration. It defines --ascent-rock-top /
      // --ascent-rock-bottom, so without it the mountain's gradient resolves to
      // nothing and the peak renders as a black triangle.
      const summit = ALTITUDES[ALTITUDES.length - 1]!
      return (
        <Canvas>
          <div
            className="ascent"
            style={{ '--a0': summit.air[0], '--a1': summit.air[1] } as React.CSSProperties}
          >
            <div className="ascent-air" aria-hidden />
            <div className="ascent-scroll">
              <main className="ascent-main">
                <Summit words={SUMMIT_WORDS} scripture={SUMMIT_SCRIPTURE} onScriptureDrill={noop} />
              </main>
            </div>
          </div>
        </Canvas>
      )
    }

    case 'rituals':
      // The library is entirely static (PRACTICES in practicesData) and portals
      // full-screen, so inside the card it simply fills it. Naming real forms —
      // the Examen, Lectio Divina, Ignatian Discernment — is what makes the
      // "two thousand years of the praying church" claim land as substance
      // rather than atmosphere.
      return (
        <Canvas>
          <PracticeLibrary
            onBegin={noop}
            onClose={noop}
            skipPreview={false}
            onToggleSkipPreview={noop}
          />
        </Canvas>
      )

    case 'altar':
      return (
        <Canvas>
          <AltarView onOpenEntry={noop} />
        </Canvas>
      )

    case 'lamp':
      return (
        <Canvas>
          <ScriptureView onOpenEntry={noop} />
        </Canvas>
      )

    case 'history':
      return (
        <Canvas>
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <EntryList
              entries={MOCK_ENTRIES}
              activeId={null}
              onSelect={noop}
              onEditEntry={noop}
              onMenuAction={noop}
              onDeleteEntries={noop}
              query=""
              onQueryChange={noop}
              fullWidth
            />
          </div>
        </Canvas>
      )

    case 'capture':
    default:
      // MOCK_DOC, not MOCK_DOC_CAPTURE: this shot now has to carry the blocks
      // too, so it shows the scripture and prayer widgets *and* the bar that
      // inserts them.
      return <EditorSnippet doc={MOCK_DOC} toolbar />
  }
}
