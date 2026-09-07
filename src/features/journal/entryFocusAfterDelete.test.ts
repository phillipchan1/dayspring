import { describe, expect, it } from 'vitest'
import { nextEntryIdAfterDelete } from './entryFocusAfterDelete'

const order = ['a', 'b', 'c', 'd'] as const

describe('nextEntryIdAfterDelete', () => {
  describe('Finder-style: the remaining id after the first deleted, else the one before', () => {
    it('lands on the next remaining page after a single delete in the middle', () => {
      expect(nextEntryIdAfterDelete(order, ['b'])).toBe('c')
    })

    it('lands on the next remaining page after deleting the first', () => {
      expect(nextEntryIdAfterDelete(order, ['a'])).toBe('b')
    })

    it('skips a run of deleted pages and lands on the first remaining after the gap', () => {
      // First deleted in order is b; c is also gone, so the eye stays on d.
      expect(nextEntryIdAfterDelete(order, ['b', 'c'])).toBe('d')
    })

    it('anchors on the first deleted in the wall order, not the deletedIds array order', () => {
      expect(nextEntryIdAfterDelete(order, ['c', 'b'])).toBe('d')
    })

    it('falls back to the page before when nothing remains after the first deleted', () => {
      expect(nextEntryIdAfterDelete(order, ['d'])).toBe('c')
    })

    it('walks back past a trailing deleted run to the last remaining before the gap', () => {
      expect(nextEntryIdAfterDelete(order, ['c', 'd'])).toBe('b')
    })

    it('lands on the only survivor when the other of two is deleted', () => {
      expect(nextEntryIdAfterDelete(['a', 'b'], ['a'])).toBe('b')
      expect(nextEntryIdAfterDelete(['a', 'b'], ['b'])).toBe('a')
    })
  })

  describe('empty order or all deleted', () => {
    it('returns null when the order is empty', () => {
      expect(nextEntryIdAfterDelete([], [])).toBeNull()
      expect(nextEntryIdAfterDelete([], ['a'])).toBeNull()
    })

    it('returns null when every id in the order is deleted', () => {
      expect(nextEntryIdAfterDelete(['a'], ['a'])).toBeNull()
      expect(nextEntryIdAfterDelete(order, [...order])).toBeNull()
    })
  })

  // Source, not the brief: if no order id is in deletedIds, findIndex is -1
  // and the function returns the first remaining id rather than null.
  describe('when nothing in the order was deleted', () => {
    it('returns the first remaining id if deletedIds is empty', () => {
      expect(nextEntryIdAfterDelete(order, [])).toBe('a')
    })

    it('returns the first remaining id if deleted ids are not in the order', () => {
      expect(nextEntryIdAfterDelete(order, ['z'])).toBe('a')
    })
  })
})
