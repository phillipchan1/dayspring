import { describe, expect, it } from 'vitest'
import { openViewerSession, planViewerCaption, viewerSessionEnd } from './viewerSession'

const ref = (c: string, alt = '', size = '') => `![${alt}](attachment:${c.repeat(64)}.jpg${size})`
const A = ref('a')
const B = ref('b', 'The steps')
const C = ref('c', '', '?size=f')
const PENDING = '![](attachment-pending:11111111-2222-3333-4444-555555555555)'

const apply = (doc: string, edit: { from: number; to: number; insert: string }) =>
  doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to)

describe('the viewer over the editor', () => {
  const doc = `words\n\n${A}\n${B}\n${C}\n\nend`

  it('opens on the photo that was chosen, with its set around it', () => {
    const session = openViewerSession(doc, doc.indexOf(B), true)!
    expect(session.index).toBe(1)
    expect(session.captioning).toBe(true)
    expect(session.refs.map((r) => r.alt)).toEqual(['', 'The steps', ''])
    expect(session.runLineFrom).toBe(doc.indexOf(A))
  })

  it('opens a lone photo as a set of one', () => {
    const lone = `words\n\n${A}\n\nend`
    expect(openViewerSession(lone, lone.indexOf(A), false)!.refs).toHaveLength(1)
    expect(openViewerSession(lone, 0, false)).toBeNull()
  })

  it('writes a caption onto the right line, keeping the photo and its size', () => {
    const session = openViewerSession(doc, doc.indexOf(A), true)!
    const next = apply(doc, planViewerCaption(doc, session, 2, 'Through the trees')!)
    expect(next).toBe(`words\n\n${A}\n${B}\n${ref('c', 'Through the trees', '?size=f')}\n\nend`)
  })

  it('still finds each photo after an earlier caption changed the text', () => {
    // A pass through the set: every caption lengthens a line above the next one.
    const session = openViewerSession(doc, doc.indexOf(A), true)!
    let text = apply(doc, planViewerCaption(doc, session, 0, 'Before light')!)
    text = apply(text, planViewerCaption(text, session, 1, 'The lighthouse steps')!)
    text = apply(text, planViewerCaption(text, session, 2, 'Through the trees')!)
    expect(text).toBe(
      `words\n\n${ref('a', 'Before light')}\n${ref('b', 'The lighthouse steps')}\n${ref('c', 'Through the trees', '?size=f')}\n\nend`,
    )
    expect(viewerSessionEnd(text, session)).toBe(text.indexOf('\n\nend'))
  })

  it('captions a photo that is still uploading', () => {
    const uploading = `${A}\n${PENDING}`
    const session = openViewerSession(uploading, 0, true)!
    expect(apply(uploading, planViewerCaption(uploading, session, 1, 'Still arriving')!)).toBe(
      `${A}\n![Still arriving](attachment-pending:11111111-2222-3333-4444-555555555555)`,
    )
  })

  it('has nothing to write when the set is gone', () => {
    const session = openViewerSession(doc, doc.indexOf(A), true)!
    expect(planViewerCaption('just words', session, 0, 'x')).toBeNull()
  })
})
