import { describe, expect, it } from 'vitest'
import {
  coverage,
  findDuplicates,
  isPreservedVersionId,
  normalize,
  type DupeRow,
} from './dedupeEntries.lib.js'

let seq = 0
function row(body: string, over: Partial<DupeRow> = {}): DupeRow {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    owner: 'owner-1',
    created_at: '2026-08-23T09:00:00.000Z',
    updated_at: '2026-08-23T09:00:00.000Z',
    body_markdown: body,
    word_count: body.trim().split(/\s+/).length,
    source: 'native',
    ...over,
  }
}

// The morning entry at the centre of the bug, in the two states the server and
// the editor held: the writer fixed "todya" and kept going.
const PUSHED =
  'Lord, I am weary todya. The week has been long and I have not stopped to breathe. Meet me here.'
const KEPT =
  'Lord, I am weary today. The week has been long and I have not stopped to breathe. Meet me here. ' +
  'And thank you for the small mercies I keep forgetting to count.'

describe('coverage', () => {
  it('is asymmetric: it measures what would be lost, not how alike two texts are', () => {
    // Every word pair of the smaller survives in the larger, so deleting the
    // smaller loses nothing — however much was appended to the larger.
    const small = 'the week has been long'
    const large = `${small} and I have not stopped to breathe and I am still going`
    expect(coverage(small, large)).toBe(1)
    expect(coverage(large, small)).toBeLessThan(0.6)
  })

  it('stays high across one edit inside otherwise identical prose', () => {
    expect(coverage(normalize(PUSHED), normalize(KEPT))).toBeGreaterThan(0.8)
  })

  it('is near zero for two unrelated entries written the same day', () => {
    const a = 'Met with Daniel about the move and we prayed together over the decision.'
    const b = 'Rain all afternoon. I read Psalm 62 twice and could not settle my mind.'
    expect(coverage(a, b)).toBeLessThan(0.1)
  })
})

describe('findDuplicates — contained (the autosave torn-state shape)', () => {
  it('pairs an exact copy and drops one of them', () => {
    const body = 'I keep circling the same worry and cannot put it down. Help me leave it here.'
    const { contained, near } = findDuplicates([row(body), row(body)])
    expect(near).toHaveLength(0)
    expect(contained).toHaveLength(1)
    expect(contained[0]!.kind).toBe('contained')
  })

  it('pairs a prefix with its extension and keeps the longer body', () => {
    const short = row('I keep circling the same worry and cannot put it down.')
    const long = row('I keep circling the same worry and cannot put it down. Help me leave it here.')
    const { contained } = findDuplicates([short, long])
    expect(contained[0]!.drop.id).toBe(short.id)
    expect(contained[0]!.keep.id).toBe(long.id)
  })

  it('ignores whitespace reflow between the two', () => {
    const body = 'I keep circling the same worry and cannot put it down.'
    const { contained } = findDuplicates([row(body), row(body.replace(/ /g, '\n\n'))])
    expect(contained).toHaveLength(1)
  })
})

describe('findDuplicates — near (the conflict-fork shape)', () => {
  it('finds the fork that the contained test cannot see', () => {
    const { contained, near } = findDuplicates([row(PUSHED), row(KEPT)])
    // Neither body contains the other: they differ by the fixed typo.
    expect(contained).toHaveLength(0)
    expect(near).toHaveLength(1)
    expect(near[0]!.drop.body_markdown).toBe(PUSHED)
    expect(near[0]!.coverage).toBeGreaterThan(0.8)
  })

  it('needs enough prose to mean anything — a short ritual line is not a fork', () => {
    const { contained, near } = findDuplicates([
      row('Thank you for today, Lord.'),
      row('Thank you for tonight, Lord.'),
    ])
    expect(contained).toHaveLength(0)
    expect(near).toHaveLength(0)
  })

  it('leaves two genuinely different entries from the same day alone', () => {
    const { contained, near } = findDuplicates([
      row('Met with Daniel about the move today and we prayed together over the decision at length.'),
      row('Rain all afternoon. I read Psalm 62 twice over and still could not settle my mind at all.'),
    ])
    expect(contained).toHaveLength(0)
    expect(near).toHaveLength(0)
  })
})

describe('findDuplicates — what it must never do', () => {
  const body = 'I keep circling the same worry and cannot put it down. Help me leave it here.'

  it('does not pair across calendar days', () => {
    const a = row(body)
    const b = row(body, { created_at: '2026-08-24T09:00:00.000Z' })
    expect(findDuplicates([a, b]).contained).toHaveLength(0)
  })

  it('does not pair across owners', () => {
    const a = row(body)
    const b = row(body, { owner: 'owner-2' })
    expect(findDuplicates([a, b]).contained).toHaveLength(0)
  })

  it('drops the native copy, never the imported twin', () => {
    // Deleting an imported row would also break the import's external_id dedup,
    // so a re-import would silently bring it back.
    const imported = row(`${body} And one more line.`, { source: 'day_one' })
    const native = row(body)
    expect(findDuplicates([imported, native]).contained[0]!.drop.id).toBe(native.id)
  })

  it('walks away rather than drop a native row holding text its imported twin lacks', () => {
    const imported = row('I keep circling the same worry.', { source: 'day_one' })
    const native = row(body)
    expect(findDuplicates([imported, native]).contained).toHaveLength(0)
  })

  it('walks away when both rows are imported', () => {
    const a = row(body, { source: 'day_one' })
    const b = row(body, { source: 'diarly' })
    expect(findDuplicates([a, b]).contained).toHaveLength(0)
  })

  it('claims each row once, so three copies can never all be deleted', () => {
    const { contained } = findDuplicates([row(body), row(body), row(body)])
    expect(contained).toHaveLength(1)
    const ids = new Set(contained.flatMap((p) => [p.keep.id, p.drop.id]))
    expect(ids.size).toBe(2)
  })
})

describe('isPreservedVersionId', () => {
  it('recognises a preserved version (UUIDv5) and not an ordinary row (v4)', () => {
    expect(isPreservedVersionId('3f9b1c74-6a2e-5d51-9c88-0b7e5a2f41d3')).toBe(true)
    expect(isPreservedVersionId('3f9b1c74-6a2e-4d51-9c88-0b7e5a2f41d3')).toBe(false)
  })
})
