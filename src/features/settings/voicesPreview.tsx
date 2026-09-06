import { createRoot } from 'react-dom/client'
import { Editor } from '@/editor/Editor'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { VOICES, getVoice, type VoiceId } from '@/lib/voices'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'

/**
 * Dev-only: `?__preview=voices` mounts the REAL editor for each voice, so the
 * pairing, the heading scale, the marking tones and the ornament can be checked
 * on the actual writing surface rather than in a mock of it.
 *
 *   ?__preview=voices                       the six voices, light where they have one
 *   ?__preview=voices&voice=vellum          one voice, full width
 *   ?__preview=voices&voice=vellum&mode=dark
 *
 * The document below is one entry carrying every element a voice touches: a
 * title, a subhead, a scripture block, a marking, a thematic break, a quote and
 * a highlight. Same text in all six, so the comparison is about the setting.
 */

// Built with the real serializer rather than hand-written fences — a spiritual
// block is `dayspring-<kind> <uuid>`, and a fence that misses that renders as a
// plain code block, which is exactly the mono-face bug the decoration exists to
// avoid. Fixed ids so the doc is stable across reloads.
const SCRIPTURE = formatSpiritualBlock(
  'scripture',
  '00000000-0000-4000-8000-000000000001',
  'I remain confident of this: I will see the goodness of the LORD in the land of the living. Wait for the LORD; be strong and take heart and wait for the LORD.',
  'Psalm 27:13-14',
)
const PRAYER = formatSpiritualBlock(
  'prayer',
  '00000000-0000-4000-8000-000000000002',
  'For the scan on the twelfth. For the patience not to fill the waiting with noise.',
)

const DOC = `The long way round

Took the long way home again. Third time this week. I keep telling myself it is the roadworks on Kingsway, but tonight I sat at the lookout for eleven minutes with the engine off, and that was not roadworks.

## What I did instead of calling him

Cleared the gutters. Answered eleven emails that could have waited until Monday. ==Filled the whole evening with things that make a noise.==

> Waiting is not the absence of the thing. It is the shape the thing takes before you are able to see it.

${SCRIPTURE}

${PRAYER}

---

Went back out at ten and stood in the drive until I was cold. Nothing happened. I am writing it down anyway, because the last time I was here I did not, and I have no idea now what that week was like.
`

function stamp(theme: ThemeId): void {
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family
}

/** One voice on its own ground. `<App/>` is not mounting, so the panel stamps
 *  data-theme itself — same as features/applock/preview.tsx. */
function Panel({ voice, mode }: { voice: VoiceId; mode: 'light' | 'dark' }) {
  const v = getVoice(voice)
  const theme = (mode === 'light' ? v.light : v.dark) ?? v.dark
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'
  return (
    <div
      data-theme={theme}
      data-appearance={family}
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        colorScheme: family,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 2rem 3rem',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-label)',
          fontSize: '0.6rem',
          letterSpacing: 'var(--label-track)',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: '1.5rem',
        }}
      >
        {v.label} · {theme} · {mode}
      </div>
      <div className="journal-write">
        <Editor
          docKey={`voices-${voice}-${mode}`}
          initialDoc={DOC}
          onChange={() => {}}
          autofocus={false}
        />
      </div>
    </div>
  )
}

export function renderVoicesPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('voice')
  const one = VOICES.find((v) => v.id === wanted)
  const mode: 'light' | 'dark' = params.get('mode') === 'dark' ? 'dark' : 'light'

  // The page's own chrome has to sit on something; use the voice being shown,
  // or Dawn for the contact sheet.
  stamp(one ? ((mode === 'light' ? one.light : one.dark) ?? one.dark) : 'dawn')

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  const panels = one
    ? [{ voice: one.id, mode }]
    : VOICES.flatMap((v) =>
        (v.light ? (['light', 'dark'] as const) : (['dark'] as const)).map((m) => ({
          voice: v.id,
          mode: m,
        })),
      )

  createRoot(el).render(
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '3rem 1.5rem 8rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: one ? '1fr' : 'repeat(auto-fit, minmax(min(100%, 34rem), 1fr))',
          maxWidth: one ? '46rem' : '96rem',
          margin: '0 auto',
        }}
      >
        {panels.map((p) => (
          <Panel key={`${p.voice}-${p.mode}`} voice={p.voice} mode={p.mode} />
        ))}
      </div>
    </div>,
  )
}
