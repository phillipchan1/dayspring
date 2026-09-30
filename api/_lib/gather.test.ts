import { afterEach, describe, expect, it, vi } from 'vitest'
import { callModel } from './openai.js'
import { chunkWriterWords, gatherHarvest } from './gather.js'
import { writerWords } from './writerWords.js'

vi.mock('./openai.js', () => ({ callModel: vi.fn() }))

const scriptureBody = [
  '<!-- ritual:name:Lectio Divina -->',
  '<!-- ritual:section:Read -->',
  '```dayspring-scripture 7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44',
  'Father, glorify your name.',
  'John 12:28 · ESV',
  '```',
  '<!-- ritual:section:Meditate -->',
  '> Father, glorify your name',
  '',
  'Lord, glorify it in me today, even here.',
  '<!-- ritual:end -->',
].join('\n')

function gateName(call: unknown[]): boolean {
  return call[3] === 'gather_gate'
}

function spanName(call: unknown[]): boolean {
  return call[3] === 'altar_harvest'
}

function inputIds(call: unknown[]): string[] {
  const input = call[1] as { entries?: { id: string }[] }
  return (input.entries ?? []).map((e) => e.id)
}

describe('chunkWriterWords', () => {
  it('keeps short entries whole and emits contiguous writerWords substrings', () => {
    expect(chunkWriterWords('Lord, help.', 4000)).toEqual(['Lord, help.'])
    const body = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(' ')
    const source = writerWords(body)
    const chunks = chunkWriterWords(body, 300)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(300)
      expect(source.includes(c)).toBe(true)
    }
    expect(chunks.join(' ')).toBe(source)
  })

  it('allows one over-long sentence to exceed 4000 chars', () => {
    const long = `${'word '.repeat(1200).trim()}.`
    expect(long.length).toBeGreaterThan(4000)
    const chunks = chunkWriterWords(long, 4000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.length).toBeGreaterThan(4000)
    expect(writerWords(long).includes(chunks[0]!)).toBe(true)
  })

  it('strips Scripture fences before chunking', () => {
    const chunks = chunkWriterWords(scriptureBody, 4000)
    const joined = chunks.join('\n')
    expect(joined).toContain('Lord, glorify it in me today, even here.')
    expect(joined).not.toContain('glorify your name')
    expect(joined).not.toContain('John 12:28')
    expect(writerWords(scriptureBody)).toBe(chunks[0])
  })
})

describe('gatherHarvest', () => {
  afterEach(() => {
    vi.mocked(callModel).mockReset()
  })

  it('gates 6 chunks per call and span-harvests 3 per call', async () => {
    const entries = Array.from({ length: 13 }, (_, i) => ({
      id: `e${i}`,
      body: `Lord, be near number ${i} tonight.`,
    }))
    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      const ids = ((input as { entries?: { id: string; text?: string }[] }).entries ?? []).map((e) => e.id)
      if (name === 'gather_gate') {
        return { entries: ids.map((id) => ({ id, contains_prayer: true, contains_sense: false })) }
      }
      return {
        entries: ids.map((id, i) => {
          const text = (input as { entries: { text: string }[] }).entries[i]!.text
          return { id, prayers: [{ type: 'prayer', text }] }
        }),
      }
    })

    const res = await gatherHarvest(entries)
    const gates = vi.mocked(callModel).mock.calls.filter(gateName)
    const spans = vi.mocked(callModel).mock.calls.filter(spanName)
    expect(gates).toHaveLength(3) // 6+6+1
    for (const c of gates) expect(inputIds(c).length).toBeLessThanOrEqual(6)
    expect(inputIds(gates[0]!).length).toBe(6)
    expect(spans).toHaveLength(5) // 3+3+3+3+1
    for (const c of spans) expect(inputIds(c).length).toBeLessThanOrEqual(3)
    expect(res.byEntry.size).toBe(13)
    expect(res.failed).toEqual([])
  })

  it('fails open to span harvest when the gate throws', async () => {
    const entries = [
      { id: 'a', body: 'Please just let her be okay tonight.' },
      { id: 'b', body: 'Groceries, laundry, errands.' },
    ]
    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      if (name === 'gather_gate') throw new Error('down')
      const ids = ((input as { entries?: { id: string; text?: string }[] }).entries ?? []).map((e) => e)
      return {
        entries: ids.map((e) =>
          e.id === 'a'
            ? { id: e.id, prayers: [{ type: 'prayer', text: 'Please just let her be okay tonight.' }] }
            : { id: e.id, prayers: [] },
        ),
      }
    })
    const res = await gatherHarvest(entries)
    expect(vi.mocked(callModel).mock.calls.some(spanName)).toBe(true)
    expect(res.byEntry.get('a')?.[0]?.text).toBe('Please just let her be okay tonight.')
    expect(res.failed).toEqual([])
  })

  it('fails open when a gate id is unanswered', async () => {
    const entries = [{ id: 'a', body: 'Please just let her be okay tonight.' }]
    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      if (name === 'gather_gate') return { entries: [] }
      return {
        entries: [
          { id: 'a', prayers: [{ type: 'prayer', text: 'Please just let her be okay tonight.' }] },
        ],
      }
    })
    const res = await gatherHarvest(entries)
    expect(res.byEntry.get('a')?.[0]?.text).toBe('Please just let her be okay tonight.')
  })

  it('caps five passages per entry across chunks and drops non-verbatim spans', async () => {
    const body = Array.from(
      { length: 280 },
      (_, i) => `Sentence number ${String(i).padStart(3, '0')} is here with extra padding words.`,
    ).join(' ')
    const chunks = chunkWriterWords(body, 4000)
    expect(chunks.length).toBeGreaterThan(1)

    vi.mocked(callModel).mockImplementation(async (_sys, input, _schema, name) => {
      const batch = (input as { entries: { id: string; text: string }[] }).entries
      if (name === 'gather_gate') {
        return { entries: batch.map((e) => ({ id: e.id, contains_prayer: true, contains_sense: false })) }
      }
      return {
        entries: batch.map((e) => {
          const sents = e.text.match(/Sentence number \d+ is here with extra padding words\./g) ?? []
          return {
            id: e.id,
            prayers: [
              ...sents.slice(0, 4).map((text) => ({ type: 'prayer' as const, text })),
              { type: 'prayer' as const, text: 'this was never written' },
            ],
          }
        }),
      }
    })

    const res = await gatherHarvest([{ id: 'long', body }])
    const kept = res.byEntry.get('long') ?? []
    expect(kept.length).toBeLessThanOrEqual(5)
    expect(kept.every((p) => body.includes(p.text))).toBe(true)
    expect(kept.some((p) => p.text === 'this was never written')).toBe(false)
  })
})
