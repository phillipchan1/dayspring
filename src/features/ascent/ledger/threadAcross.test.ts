import { describe, expect, it } from 'vitest'
import type { LedgerLine } from './build'
import { chapters } from './ThreadAcross'
import type { Volume } from '@/features/volumes/volumes'

const vol = (n: number, ids: string[]): Volume => ({ n, firstId: ids[0]!, lastId: ids[ids.length - 1]!, from: '2026-01-01', to: '2026-02-01', closed: true, ids })
const line = (entryId: string): LedgerLine => ({ entryId, date: '2026-01-01', month: 0, text: entryId, kind: 'story', flag: null, refs: [], with: [] })

describe('chapters', () => {
  it('groups a thread by the volumes it ran through, keeping the volumes it skipped', () => {
    const volumes = [vol(1, ['a', 'b']), vol(2, ['c']), vol(3, ['d']), vol(4, ['e', 'f'])]
    const parts = chapters([line('a'), line('b'), line('e')], volumes)
    expect(parts.map((p) => (p.type === 'gap' ? `gap ${p.from.n}-${p.to.n}` : `v${p.volume.n}:${p.lines.length}`))).toEqual(['v1:2', 'gap 2-3', 'v4:1'])
  })
})
