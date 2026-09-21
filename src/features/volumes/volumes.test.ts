import { describe, expect, it } from 'vitest'
import { computeVolumes, volumeTitle } from './volumes'

const page = (id: string, date: string, words: number) => ({ id, created_at: `${date}T12:00:00Z`, word_count: words })

describe('computeVolumes', () => {
  const pages = [
    page('a', '2026-01-01', 400),
    page('b', '2026-01-05', 700), // crosses 1000 → closes volume 1
    page('c', '2026-02-01', 300),
    page('d', '2026-03-01', 800), // crosses 1000 → closes volume 2
    page('e', '2026-04-01', 100), // being written
  ]

  it('closes a volume on the page that carries it over the threshold', () => {
    const { volumes, closings } = computeVolumes(pages, [], 1000)
    expect(volumes.map((v) => [v.n, v.ids.join(''), v.closed])).toEqual([
      [1, 'ab', true],
      [2, 'cd', true],
      [3, 'e', false],
    ])
    expect(closings).toEqual(['b', 'd'])
    expect(volumes[1]!.from).toBe('2026-02-01')
    expect(volumes[1]!.to).toBe('2026-03-01')
  })

  it('keeps a recorded closing even after old pages are edited', () => {
    // Page a was trimmed to 10 words. Without the record, volume 1 would now
    // run on to d; with it, the volume that went on the shelf stays shut.
    const edited = pages.map((p) => (p.id === 'a' ? { ...p, word_count: 10 } : p))
    const { volumes } = computeVolumes(edited, ['b', 'd'], 1000)
    expect(volumes.map((v) => v.ids.join(''))).toEqual(['ab', 'cd', 'e'])
  })

  it('lets a volume run on when its recorded last page was deleted', () => {
    const { volumes } = computeVolumes(pages.filter((p) => p.id !== 'b'), ['b'], 1000)
    expect(volumes[0]!.ids).toEqual(['a', 'c', 'd'])
  })

  it('never names a volume itself', () => {
    const { volumes } = computeVolumes(pages, [], 1000)
    expect(volumeTitle(volumes[0]!, undefined)).toBe('Volume 1')
    expect(volumeTitle(volumes[0]!, { a: 'The waiting room' })).toBe('The waiting room')
  })
})
