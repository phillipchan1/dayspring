import { afterEach, describe, expect, it, vi } from 'vitest'
import { interpret, literalFallback } from './interpret'

vi.mock('@/lib/api', () => ({ apiPost: vi.fn() }))
const { apiPost } = await import('@/lib/api')
const mocked = apiPost as unknown as ReturnType<typeof vi.fn>

afterEach(() => mocked.mockReset())

describe('literalFallback', () => {
  // Splitting into words would light every page carrying "the".
  it('keeps the phrase whole', () => {
    expect(literalFallback('the long way home').terms).toEqual(['the long way home'])
  })

  it('lights nothing for a stray character', () => {
    expect(literalFallback('a').terms).toEqual([])
  })

  it('orders by date, which is what the wall does without any of this', () => {
    expect(literalFallback('anything').arrange).toBe('date')
  })
})

describe('interpret', () => {
  it('passes through terms and facets the server chose', async () => {
    mocked.mockResolvedValue({
      terms: ['Chicago', 'Chi-town'],
      facets: ['highlight'],
      months: [5],
      from: null,
      to: null,
      arrange: 'by-year',
    })
    const r = await interpret('times I talked about Chicago every year')
    expect(r.terms).toEqual(['Chicago', 'Chi-town'])
    expect(r.facets).toEqual(['highlight'])
    expect(r.arrange).toBe('by-year')
  })

  // The wall has to keep working when the network doesn't — that is the whole
  // reason matching lives in the client.
  it('falls back to the literal phrase when the call fails', async () => {
    mocked.mockRejectedValue(new Error('offline'))
    const r = await interpret('times I talked about Chicago')
    expect(r.terms).toEqual(['times I talked about Chicago'])
    expect(r.arrange).toBe('date')
  })

  // An interpretation that lights nothing is worse than no interpretation: the
  // sentence itself is at least something the writer typed.
  it('falls back when the server understood nothing to light', async () => {
    mocked.mockResolvedValue({ terms: [], facets: [], months: [], from: null, to: null, arrange: 'date' })
    const r = await interpret('the long way home')
    expect(r.terms).toEqual(['the long way home'])
  })

  it('drops junk rather than passing it to the wall', async () => {
    mocked.mockResolvedValue({
      terms: ['Chicago', 42, null],
      facets: ['highlight', 7],
      months: ['June'],
      from: 5,
      to: null,
      arrange: 'by-vibes',
    })
    const r = await interpret('a question')
    expect(r.terms).toEqual(['Chicago'])
    expect(r.facets).toEqual(['highlight'])
    expect(r.months).toEqual([])
    expect(r.from).toBeNull()
    expect(r.arrange).toBe('date')
  })

  it('does not go to the server for an empty question', async () => {
    await interpret('   ')
    expect(mocked).not.toHaveBeenCalled()
  })
})
