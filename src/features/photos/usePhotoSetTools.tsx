import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { EditorHandle } from '@/editor/Editor'
import type { AttachmentEditTarget, PhotoSetAction } from '@/editor/attachmentImageExtension'
import { findAttachmentByKey } from '@/editor/attachmentInsert'
import { photoPlacement, type PhotoEdit } from '@/lib/photoSet'
import {
  arrangeAddAfter,
  arrangeRefs,
  arrangeRun,
  openArrangeSession,
  planArrangeMove,
  planArrangeRemove,
  type ArrangeSession,
} from './arrangeSession'
import { PhotoArrange } from './PhotoArrange'
import type { ViewerRef } from './viewerSession'

interface Options {
  /**
   * Put picked photos into the text after the photo at `afterFrom`. Defaults
   * to the editor's own upload; the dev harness draws stand-ins instead.
   */
  addFiles?: (editor: EditorHandle, afterFrom: number, files: File[]) => void | Promise<void>
}

const sameRefs = (a: readonly ViewerRef[], b: readonly ViewerRef[]) =>
  a.length === b.length &&
  a.every((r, i) => r.hash === b[i]!.hash && r.pendingId === b[i]!.pendingId && r.alt === b[i]!.alt)

/**
 * Adding to a set and arranging it, from wherever the writer asked: the tools
 * over a set, or a photo's menu. Owns the photo picker (kept mounted, since on
 * iOS the menu that asked for it can be gone before it returns) and the
 * arrange sheet. `editor` is read at each use: inside a ritual it is the
 * answer's own editor.
 */
export function usePhotoSetTools(editor: () => EditorHandle | null, options: Options = {}) {
  const [arrange, setArrange] = useState<{ session: ArrangeSession; refs: ViewerRef[] } | null>(null)
  const arrangeRef = useRef(arrange)
  arrangeRef.current = arrange
  const pickRef = useRef<HTMLInputElement>(null)
  /** The photo the picker was opened from: where it was, and which photo it is. */
  const pickFor = useRef<{ from: number; key: string } | null>(null)
  const addFilesRef = useRef(options.addFiles)
  addFilesRef.current = options.addFiles

  /** Read the set again from the live text. Closes the sheet once the set is gone. */
  const refresh = useCallback(() => {
    const doc = editor()?.getDoc()
    if (doc === undefined) return
    setArrange((current) => {
      if (!current) return current
      const refs = arrangeRefs(doc, current.session)
      if (refs.length === 0) return null
      return sameRefs(refs, current.refs) ? current : { ...current, refs }
    })
  }, [editor])

  const add = useCallback(
    (afterFrom: number, files: File[]) => {
      const ed = editor()
      if (!ed || files.length === 0) return
      if (addFilesRef.current) void Promise.resolve(addFilesRef.current(ed, afterFrom, files)).then(refresh)
      else ed.addPhotosBeside(afterFrom, true, files)
      // Their placeholders are in the text already; the sheet watches them land.
      refresh()
    },
    [editor, refresh],
  )

  const apply = useCallback(
    (edit: PhotoEdit | null) => {
      const ed = editor()
      if (!ed || !edit) return
      ed.replaceRange(edit.from, edit.to, edit.insert, { focus: false })
      refresh()
    },
    [editor, refresh],
  )

  const openArrange = useCallback(
    (target: AttachmentEditTarget) => {
      const doc = editor()?.getDoc() ?? ''
      const session = openArrangeSession(doc, target.from)
      if (session) setArrange({ session, refs: arrangeRefs(doc, session) })
    },
    [editor],
  )

  const pickPhotos = useCallback((target: AttachmentEditTarget) => {
    pickFor.current = { from: target.from, key: `${target.hash}.${target.ext}` }
    pickRef.current?.click()
  }, [])

  const onSetAction = useCallback(
    (action: PhotoSetAction, target: AttachmentEditTarget) => {
      if (action === 'add') pickPhotos(target)
      else openArrange(target)
    },
    [openArrange, pickPhotos],
  )

  const close = useCallback(() => {
    const current = arrangeRef.current
    setArrange(null)
    if (!current) return
    requestAnimationFrame(() => {
      const ed = editor()
      if (!ed) return
      const run = arrangeRun(ed.getDoc(), current.session)
      ed.focusAt(run ? run.to : current.session.runLineFrom)
    })
  }, [editor])

  const element: ReactNode = (
    <>
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          const asked = pickFor.current
          pickFor.current = null
          const doc = editor()?.getDoc()
          if (!asked || doc === undefined || files.length === 0) return
          // The text may have moved while the picker was up; the photo is found
          // where it was, or else by which photo it is.
          const from = photoPlacement(doc, asked.from)
            ? asked.from
            : findAttachmentByKey(doc, asked.key)?.from
          const here = from === undefined ? null : photoPlacement(doc, from)
          if (here) add(here.run.refs[here.run.refs.length - 1]!.from, files)
        }}
      />
      {arrange && (
        <PhotoArrange
          refs={arrange.refs}
          onMove={(from, to) => {
            const doc = editor()?.getDoc()
            if (doc !== undefined) apply(planArrangeMove(doc, arrange.session, from, to))
          }}
          onRemove={(index) => {
            const doc = editor()?.getDoc()
            if (doc !== undefined) apply(planArrangeRemove(doc, arrange.session, index))
          }}
          onAdd={(files) => {
            const after = arrangeAddAfter(editor()?.getDoc() ?? '', arrange.session)
            if (after !== null) add(after, files)
          }}
          onRefresh={refresh}
          onClose={close}
        />
      )}
    </>
  )

  return { onSetAction, openArrange, pickPhotos, element }
}
