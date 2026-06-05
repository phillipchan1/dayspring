// Inline image rendering for `attachment:<sha256>.<ext>` refs.
//
// The import pipeline stores images in Supabase Storage and writes stable
// `![alt](attachment:<sha256>.<ext>)` refs into entry bodies. This extension
// intercepts those refs and renders them as inline `<img>` elements with
// signed URLs, replacing the raw markdown syntax.
//
// URL resolution is lazy and cached. A subtle placeholder renders while the
// signed URL is in flight. Images stay rendered regardless of cursor position.

import {
  Decoration,
  EditorView,
  WidgetType,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
  type PluginValue,
} from '@codemirror/view'
import { RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state'
import { supabase } from '@/lib/supabase'
import { resolveAttachmentUrl } from '@/lib/attachments'

const ATTACHMENT_RE = /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)\)/g

// Effects & caches are module-level so they survive between view instances
// (e.g. navigating between entries doesn't re-fetch already-known URLs).
const urlResolved = StateEffect.define<void>()
const resolvedUrls = new Map<string, string>() // '<hash>.<ext>' → signed URL
const inFlight = new Set<string>()

// Fetched once per session; null until the first successful auth check.
let cachedOwnerId: string | null = null

async function getOwnerId(): Promise<string | null> {
  if (cachedOwnerId) return cachedOwnerId
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  cachedOwnerId = data.user?.id ?? null
  return cachedOwnerId
}

// ── Widget ────────────────────────────────────────────────────────────────────

class AttachmentImageWidget extends WidgetType {
  /** cacheKey = '<hash>.<ext>' */
  constructor(
    readonly alt: string,
    readonly cacheKey: string,
  ) {
    super()
  }

  eq(other: AttachmentImageWidget): boolean {
    // Widgets with the same key and same resolved URL are equal → no DOM churn.
    return (
      other.cacheKey === this.cacheKey &&
      resolvedUrls.get(other.cacheKey) === resolvedUrls.get(this.cacheKey)
    )
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-attachment'
    wrap.contentEditable = 'false'

    const url = resolvedUrls.get(this.cacheKey)
    if (url) {
      const img = document.createElement('img')
      img.src = url
      img.alt = this.alt
      img.className = 'cm-attachment__img'
      img.loading = 'lazy'
      img.draggable = false
      wrap.append(img)
    } else {
      const ph = document.createElement('span')
      ph.className = 'cm-attachment__placeholder'
      ph.setAttribute('aria-hidden', 'true')
      wrap.append(ph)
    }

    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

// ── Decoration builder ────────────────────────────────────────────────────────

function buildDecos(text: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    const [full, alt, hash, ext] = m
    builder.add(
      m.index,
      m.index + full!.length,
      Decoration.replace({
        widget: new AttachmentImageWidget(alt ?? '', `${hash!}.${ext!}`),
      }),
    )
  }
  return builder.finish()
}

// ── ViewPlugin ────────────────────────────────────────────────────────────────

interface AttachmentPluginValue extends PluginValue {
  decorations: DecorationSet
}

function makePlugin(): Extension {
  return ViewPlugin.define<AttachmentPluginValue>(
    (view) => {
      const state: AttachmentPluginValue = {
        decorations: buildDecos(view.state.doc.toString()),
        update(update: ViewUpdate) {
          // Rebuild on doc change or when a resolved URL dispatches an effect.
          const hasEffect = update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(urlResolved)),
          )
          if (update.docChanged || hasEffect) {
            state.decorations = buildDecos(update.state.doc.toString())
          }
          if (update.docChanged) {
            fetchMissingUrls(update.view)
          }
        },
      }
      fetchMissingUrls(view)
      return state
    },
    { decorations: (v) => v.decorations },
  )
}

function fetchMissingUrls(view: EditorView): void {
  if (!supabase) return
  const text = view.state.doc.toString()
  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    const [, , hash, ext] = m
    const key = `${hash!}.${ext!}`
    if (resolvedUrls.has(key) || inFlight.has(key)) continue
    inFlight.add(key)
    getOwnerId().then((ownerId) => {
      if (!ownerId || !supabase) {
        inFlight.delete(key)
        return
      }
      return resolveAttachmentUrl(supabase, ownerId, hash!, ext!)
    }).then((url) => {
      inFlight.delete(key)
      if (!url || resolvedUrls.has(key)) return
      resolvedUrls.set(key, url)
      if (!view.isDestroyed) {
        view.dispatch({ effects: urlResolved.of(undefined) })
      }
    }).catch(() => {
      inFlight.delete(key)
    })
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
// Keyframe animations live in global.css (cm-attachment-fadein, cm-attachment-pulse).

const attachmentTheme = EditorView.theme({
  // Outer span sits inline in the line flow.
  '.cm-attachment': {
    display: 'inline-block',
    verticalAlign: 'middle',
    lineHeight: '1',
  },
  // The image: full-column, rounded, with the app's warm elevation shadow.
  '.cm-attachment__img': {
    display: 'block',
    maxWidth: '100%',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-2)',
    margin: '0.6rem 0',
    background: 'var(--bg-input)',
    animation: 'cm-attachment-fadein 220ms ease both',
  },
  // Skeleton placeholder while the signed URL resolves.
  '.cm-attachment__placeholder': {
    display: 'inline-block',
    width: '180px',
    height: '120px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    opacity: '0.6',
    verticalAlign: 'middle',
    animation: 'cm-attachment-pulse 1.4s ease-in-out infinite',
  },
})

// ── Export ────────────────────────────────────────────────────────────────────

/** Drop this into the Editor extension list — no configuration needed. */
export const attachmentImageExtension: Extension = [makePlugin(), attachmentTheme]
