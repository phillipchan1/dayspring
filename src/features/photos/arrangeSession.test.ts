import { describe, expect, it } from 'vitest'
import type { PhotoEdit } from '@/lib/photoSet'
import {
  arrangeAddAfter,
  arrangeRefs,
  openArrangeSession,
  planArrangeMove,
  planArrangeRemove,
} from './arrangeSession'

const ref = (c: string, alt = '') => `![${alt}](attachment:${c.repeat(64)}.jpg)`
const A = ref('a')
const B = ref('b', 'The steps')
const C = ref('c')
const apply = (doc: string, edit: PhotoEdit) => doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to)

describe('arrange session', () => {
  const doc = `Before\n\n${A}\n${B}\n${C}\n\nAfter`
  const session = openArrangeSession(doc, doc.indexOf(B))!

  it('opens on the whole set, from any photo in it', () => {
    expect(arrangeRefs(doc, session).map((r) => r.hash?.[0])).toEqual(['a', 'b', 'c'])
    expect(arrangeRefs(doc, session)[1]!.alt).toBe('The steps')
    expect(openArrangeSession(doc, doc.indexOf('Before'))).toBeNull()
  })

  it('moves a photo, and still finds the set afterwards', () => {
    const moved = apply(doc, planArrangeMove(doc, session, 2, 0)!)
    expect(moved).toBe(`Before\n\n${C}\n${A}\n${B}\n\nAfter`)
    expect(arrangeRefs(moved, session).map((r) => r.hash?.[0])).toEqual(['c', 'a', 'b'])
  })

  it('removes the first photo without losing the set', () => {
    const removed = apply(doc, planArrangeRemove(doc, session, 0)!)
    expect(removed).toBe(`Before\n\n${B}\n${C}\n\nAfter`)
    expect(arrangeRefs(removed, session)).toHaveLength(2)
  })

  it('is empty once the last photo is gone', () => {
    let next = doc
    for (let i = 0; i < 3; i++) next = apply(next, planArrangeRemove(next, session, 0)!)
    expect(arrangeRefs(next, session)).toEqual([])
    expect(arrangeAddAfter(next, session)).toBeNull()
  })

  it('adds after the last photo', () => {
    expect(arrangeAddAfter(doc, session)).toBe(doc.indexOf(C))
  })
})
