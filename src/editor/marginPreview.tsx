import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor, type EditorHandle } from './Editor'
import { marginNotes } from './marginNotes'
import { MarkMargin } from '@/features/journal/MarkMargin'
import { MarkPicker, type MarkPickerAnchor } from '@/features/journal/MarkPicker'
import { verbatimIn, type Proposal } from '@/lib/noticing'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import '@/features/scripture/ChapterPane.css'

/**
 * Dev-only: `?__preview=margin` mounts the real editor and the real margin over
 * a page carrying one of every kind, so the surface can be looked at without an
 * account. The editor is behind OAuth, which is why this exists at all.
 *
 *   ?__preview=margin            → closed, which is the default everywhere
 *   ?__preview=margin&open=1     → open
 *   ?__preview=margin&pencil=1   → open, with what the journal noticed
 *   ?__preview=margin&margin=0   → the bare page Settings → Show the margin gives
 *   ?__preview=margin&theme=ink  → any palette; defaults to dawn
 *
 * ⌥⌘M toggles, the same as in the app. The two things worth watching here are
 * the two the spec calls gates: the writing must not move by a pixel when the
 * margin opens or closes, and typing with it open must drop no frames.
 */

const KIND_TEXT: Record<string, string> = {
  gift: 'The cold coming up off the stones, and no one else awake for it.',
  prayer: "For Dad, and for Thursday. That I'd stop rehearsing the worst version of it.",
  desire: 'I want to stop needing the scan to come back clean before I can pray.',
  sense: "Something in me kept saying wait, and I don't think it was fear this time.\nIt might be the first quiet thing I've heard in weeks.",
  learned: 'The long way home is not a detour. Write that down again next week.',
  story: 'Marcus called at the exact moment I put the phone face down.',
  absence: 'Nothing this morning. Sat the twenty minutes anyway.',
}

/**
 * One page carrying one of every kind, so the whole set can be looked at at
 * once — that is the only way to tell whether eight hands read as eight things
 * or as noise.
 */
const DOC = [
  'Tuesday',
  '',
  'Down to the water while it was still dark. Just the sound of it.',
  formatSpiritualBlock('gift', kindId(0), KIND_TEXT.gift!),
  formatSpiritualBlock(
    'scripture',
    kindId(1),
    'And we know that all things work together for good to them that love God',
    'Romans 8:28',
  ),
  formatSpiritualBlock('prayer', kindId(2), KIND_TEXT.prayer!),
  formatSpiritualBlock('desire', kindId(3), KIND_TEXT.desire!),
  'Walked back the long way. Nothing resolved, which I think I expected.',
  formatSpiritualBlock('sense', kindId(4), KIND_TEXT.sense!),
  formatSpiritualBlock('learned', kindId(5), KIND_TEXT.learned!),
  formatSpiritualBlock('story', kindId(6), KIND_TEXT.story!),
  formatSpiritualBlock('absence', kindId(7), KIND_TEXT.absence!),
  'Then the ordinary rest of the morning, which is most of it.',
].join('\n')

/** Stable ids, so the harness renders identically on every reload. */
function kindId(n: number): string {
  return `0000000${n}-0000-4000-8000-000000000000`
}

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

/**
 * Stand-ins for what /api/spiritual/notice would return. Every quote here is a
 * verbatim substring of the page below — `verbatimIn` drops anything that isn't,
 * so a fixture that drifts from the document silently renders nothing, which is
 * exactly the behaviour worth being able to see.
 */
const PENCIL: Array<{ quote: string; kind: string }> = [
  { quote: 'Down to the water while it was still dark. Just the sound of it.', kind: 'story' },
  { quote: 'Then the ordinary rest of the morning, which is most of it.', kind: 'gift' },
]

function MarginPreview({
  startOpen,
  startPencil,
  margin,
}: {
  startOpen: boolean
  startPencil: boolean
  margin: boolean
}) {
  const [doc, setDoc] = useState(DOC)
  const [open, setOpen] = useState(startOpen)
  const [picker, setPicker] = useState<MarkPickerAnchor | null>(null)
  const [pencil, setPencil] = useState<Proposal[]>(startPencil ? verbatimIn(DOC, PENCIL) : [])
  const editorRef = useRef<EditorHandle>(null)
  const notes = useMemo(() => (open ? marginNotes(doc) : []), [open, doc])

  // The same binding JournalScreen registers, so the reflow gate ("open and
  // close with the cursor mid-paragraph; the text must not move") is testable
  // here without an account.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if ((e.key !== 'm' && e.key !== 'µ') || !e.metaKey || !e.altKey) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="journal-write" style={{ height: '100vh' }}>
      <div className="journal-write__editor">
        <div className={`journal-write__canvas${open ? ' journal-write__canvas--margin' : ''}`}>
          <Editor
            ref={editorRef}
            docKey="margin-preview"
            initialDoc={DOC}
            onChange={setDoc}
            autofocus={false}
            margin={margin}
            onOpenMargin={() => setOpen(true)}
            onMarkHere={setPicker}
          />
          {picker && (
            <MarkPicker
              anchor={picker}
              onPick={(kind) => {
                setPicker(null)
                // The harness has no account, so only the document edit runs —
                // which is the half worth looking at anyway.
                editorRef.current?.markLines(kind, crypto.randomUUID())
              }}
              onDismiss={() => setPicker(null)}
            />
          )}
          <MarkMargin
            open={open && margin}
            notes={notes}
            onClose={() => setOpen(false)}
            onReveal={(note) => editorRef.current?.revealPos(note.from)}
            pencil={verbatimIn(doc, pencil)}
            onKeep={(p) => {
              setPencil((cur) => cur.filter((x) => x.id !== p.id))
              editorRef.current?.markQuote(p.quote, p.kind, crypto.randomUUID())
            }}
            onNotThis={(p) => setPencil((cur) => cur.filter((x) => x.id !== p.id))}
          />
        </div>
      </div>
    </div>
  )
}

export function renderMarginPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family
  document.body.style.margin = '0'
  document.body.style.background = 'var(--bg)'

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  const pencil = params.get('pencil') === '1'
  createRoot(el).render(
    <MarginPreview
      startOpen={params.get('open') === '1' || pencil}
      startPencil={pencil}
      margin={params.get('margin') !== '0'}
    />,
  )
}
