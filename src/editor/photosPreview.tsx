import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Editor, type EditorHandle } from './Editor'
import {
  primeAttachmentPreview,
  type AttachmentEditTarget,
  type ImageMenuPoint,
} from './attachmentImageExtension'
import { ImageContextMenu, type PhotoArrangement } from '@/features/journal/ImageContextMenu'
import { hydrateReadAttachments } from '@/features/pages/readAttachments'
import '@/features/pages/Pages.css'
import type { AttachmentPhotoMeta } from '@/lib/attachmentCaption'
import { formatAttachmentMarkdown } from '@/lib/attachments'
import { renderMarkdown } from '@/lib/markdown'
import {
  planJoinAbove,
  planMakeFirst,
  planMoveWithin,
  planRemovePhoto,
  planTakeOut,
} from '@/lib/photoSet'
import { EditorPhotoViewer } from '@/features/photos/EditorPhotoViewer'
import { PhotoViewer } from '@/features/photos/PhotoViewer'
import {
  openViewerSession,
  planViewerCaption,
  type ViewerSession,
} from '@/features/photos/viewerSession'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ReadLookPhoto } from '@/features/pages/readAttachments'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'

/**
 * Dev-only: `?__preview=photos` mounts the real editor and the real reader over
 * an entry that holds photo sets, with drawn stand-in photos, so "photos,
 * together" can be looked at without an account or a network.
 *
 * What to check, in the order it tends to break:
 *
 * 1. **Touching photo lines are one block of rows.** Every photo whole, rows
 *    filling the column, in both the writing and the reading half.
 * 2. **No lone photo on the last row.** The set of three gives its first photo
 *    a row to itself rather than stranding the third.
 * 3. **The menu acts on the photo you clicked**, not on the block: "Take out of
 *    the set", "Make this the first photo", and — on the two stacked the old
 *    way — "Put with the photos above". The stored text is printed underneath;
 *    watch which blank lines move.
 * 4. **The caret can get past a set.** Arrow down through the entry; a click
 *    under the block lands on the line under the block.
 * 5. **Look, and caption.** "Look at these" opens the viewer on that photo;
 *    "Edit caption…" on a set opens it with the caption ready, and Return goes
 *    to the next photo. Each caption lands in the stored text as it is kept.
 * 6. **Dragging.** A photo dropped on another photo sits beside it, in its set;
 *    dropped on a line of writing it stands alone again.
 * 7. **Reading.** A photo in the reading half opens the same viewer, with no
 *    caption field.
 *
 *   &theme=ink     any palette; defaults to dawn
 *   &col=63        the writing column's width in rem; defaults to 42
 *   &part=write    only the editor      &part=read    only the reader
 *
 * Narrow the window (or use a phone-sized viewport) to see the lower phone rows.
 */

const SHAPES: ReadonlyArray<{ w: number; h: number; from: string; to: string; taken: string; alt?: string }> = [
  { w: 4, h: 3, from: '#5d6f9c', to: '#f7c79a', taken: '2026-09-20T07:02' },
  { w: 16, h: 9, from: '#a9b8c6', to: '#2f4b5e', taken: '2026-09-20T07:11', alt: 'The lighthouse steps' },
  { w: 4, h: 3, from: '#9fb5c9', to: '#b99a74', taken: '2026-09-20T07:19' },
  { w: 3, h: 2, from: '#c9d6d8', to: '#2f4b35', taken: '2026-09-20T07:34' },
  { w: 3, h: 4, from: '#c8d9b4', to: '#3e5a37', taken: '2026-09-20T07:48' },
  { w: 4, h: 3, from: '#6b4a33', to: '#c28a4a', taken: '2026-09-20T12:31', alt: 'Lunch at the Station House' },
  { w: 4, h: 5, from: '#7d9a62', to: '#e8a0a8', taken: '2026-09-20T13:05' },
  { w: 3, h: 2, from: '#6f9fcf', to: '#6c7280', taken: '2026-09-20T15:40' },
  { w: 9, h: 19.5, from: '#fbf7f0', to: '#8a7c69', taken: '2026-09-20T16:02' },
  { w: 1, h: 1, from: '#4a3322', to: '#efe4cf', taken: '2026-09-20T20:14' },
  { w: 3, h: 4, from: '#15100b', to: '#ffaa50', taken: '2026-09-20T21:30' },
]

const HEX = '0123456789ab'
const hashOf = (i: number) => HEX[i]!.repeat(64)
const ref = (i: number) => formatAttachmentMarkdown(hashOf(i), 'jpg', SHAPES[i]!.alt ?? '')

function drawPhoto(i: number): { url: string; meta: AttachmentPhotoMeta } {
  const shape = SHAPES[i]!
  const long = 720
  const width = shape.w >= shape.h ? long : Math.round((long * shape.w) / shape.h)
  const height = shape.w >= shape.h ? Math.round((long * shape.h) / shape.w) : long
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const wash = ctx.createLinearGradient(0, 0, 0, height)
  wash.addColorStop(0, shape.from)
  wash.addColorStop(1, shape.to)
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)
  // The number is the point: it shows order, and that nothing has been cropped.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = `600 ${Math.round(Math.min(width, height) * 0.3)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(i + 1), width / 2, height / 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.lineWidth = 6
  ctx.strokeRect(12, 12, width - 24, height - 24)
  return {
    url: canvas.toDataURL('image/jpeg', 0.82),
    meta: { width, height, color: shape.from, takenAt: new Date(shape.taken).toISOString() },
  }
}

const DOC = `Point Reyes, before light

We left before light and got to the lighthouse steps just as the fog lifted. The kids ran the whole way down.

${[0, 1, 2, 3, 4].map(ref).join('\n')}

Micah asked if God made the fog on purpose. I said I think He makes most things on purpose.

${ref(5)}

Three, which would leave one over:

${[6, 7, 8].map(ref).join('\n')}

Two stacked the old way, with a blank line between them:

${ref(9)}

${ref(10)}

Grateful tonight. Tired in the good way.
`

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function Reader({ markdown, photos }: { markdown: string; photos: Map<string, ReturnType<typeof drawPhoto>> }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [look, setLook] = useState<{ photos: ReadLookPhoto[]; index: number } | null>(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.innerHTML = renderMarkdown(markdown, { asTitle: true })
    return hydrateReadAttachments(
      el,
      markdown,
      { resolve: async (hash) => photos.get(hash) ?? { url: null, meta: null } },
      { onLook: (found, index) => setLook({ photos: found, index }) },
    )
  }, [markdown, photos])
  return (
    <>
      <div ref={bodyRef} className="pg-read1__body markdown-body" />
      {look && (
        <PhotoViewer
          photos={look.photos}
          index={look.index}
          onIndex={(index) => setLook((current) => (current ? { ...current, index } : current))}
          onClose={() => setLook(null)}
        />
      )}
    </>
  )
}

function Harness({ part, column }: { part: string | null; column: number }) {
  const [photos] = useState(() => {
    const drawn = new Map<string, ReturnType<typeof drawPhoto>>()
    SHAPES.forEach((_, i) => {
      const photo = drawPhoto(i)
      drawn.set(hashOf(i), photo)
      primeAttachmentPreview(`${hashOf(i)}.jpg`, photo.url, photo.meta)
    })
    return drawn
  })
  const editorRef = useRef<EditorHandle>(null)
  const [doc, setDoc] = useState(DOC)
  const [menu, setMenu] = useState<{ target: AttachmentEditTarget; point: ImageMenuPoint } | null>(null)
  const [viewer, setViewer] = useState<ViewerSession | null>(null)
  const isMobile = useIsMobile()

  const arrange = (target: AttachmentEditTarget, how: PhotoArrangement) => {
    const editor = editorRef.current
    if (!editor) return
    const text = editor.getDoc()
    const edit =
      how === 'join'
        ? planJoinAbove(text, target.from)
        : how === 'takeOut'
          ? planTakeOut(text, target.from)
          : how === 'makeFirst'
            ? planMakeFirst(text, target.from)
            : planMoveWithin(text, target.from, how === 'earlier' ? -1 : 1)
    if (!edit) return
    editor.replaceRange(edit.from, edit.to, edit.insert)
    requestAnimationFrame(() => editor.focusAt(edit.caret))
  }

  const label = { fontFamily: 'var(--font-ui, system-ui)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-faint)', margin: '2.5rem 0 0.75rem' }

  return (
    <div style={{ maxWidth: `${column}rem`, margin: '0 auto' }}>
      {part !== 'read' && (
        <>
          <p style={label}>Writing</p>
          <div className="journal-write">
            <Editor
              ref={editorRef}
              docKey="photos-preview"
              initialDoc={DOC}
              onChange={setDoc}
              autofocus={false}
              titleStyling
              onImageMenu={(target, point) => setMenu({ target, point })}
            />
          </div>
          <ImageContextMenu
            phase={menu ? { kind: 'menu', target: menu.target, point: menu.point } : { kind: 'closed' }}
            onClose={() => setMenu(null)}
            sheet={isMobile}
            onLook={(target) =>
              setViewer(openViewerSession(editorRef.current?.getDoc() ?? '', target.from, false))
            }
            onEditCaption={(target) =>
              setViewer(openViewerSession(editorRef.current?.getDoc() ?? '', target.from, true))
            }
            onReplaceFile={() => {}}
            onSetSize={(target, size) =>
              editorRef.current?.replaceRange(
                target.from,
                target.to,
                formatAttachmentMarkdown(target.hash, target.ext, target.alt, size),
              )
            }
            onArrange={arrange}
            onRemove={(target) => {
              const editor = editorRef.current
              if (!editor) return
              const edit = planRemovePhoto(editor.getDoc(), target.from, target.to)
              editor.replaceRange(edit.from, edit.to, edit.insert)
            }}
          />
          {viewer && (
            <EditorPhotoViewer
              session={viewer}
              onIndex={(index) => setViewer((current) => (current ? { ...current, index } : current))}
              onCaption={(index, caption) => {
                const editor = editorRef.current
                if (!editor) return
                const edit = planViewerCaption(editor.getDoc(), viewer, index, caption)
                if (!edit) return
                editor.replaceRange(edit.from, edit.to, edit.insert, { focus: false })
                setViewer((current) =>
                  current
                    ? {
                        ...current,
                        refs: current.refs.map((r, i) => (i === index ? { ...r, alt: caption } : r)),
                      }
                    : current,
                )
              }}
              onClose={() => setViewer(null)}
            />
          )}
        </>
      )}
      {part !== 'write' && (
        <>
          <p style={label}>Reading</p>
          <Reader markdown={doc} photos={photos} />
        </>
      )}
      {part === null && (
        <>
          <p style={label}>As stored</p>
          <pre
            data-stored
            style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-dim)' }}
          >
            {doc.replace(/([a-f0-9])\1{63}/g, '$1…')}
          </pre>
        </>
      )}
    </div>
  )
}

export function renderPhotosPreview(): void {
  const params = new URLSearchParams(window.location.search)
  const wanted = params.get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'dawn'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'light'

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  // The writing column is a setting (Settings → width), and a set has to look
  // right at every value of it.
  const column = Number(params.get('col')) || 42
  root.style.setProperty('--editor-max-width', `${column}rem`)

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '4vh 1.5rem 20vh' }}>
      <Harness part={params.get('part')} column={column} />
    </div>,
  )
}
