// The contract of the offline snapshot: live answers always win, a failure falls
// back to the last one, and one account never sees another's.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, { key: string; owner: string; value: unknown; at: number }>()
let owner: string | null = 'owner-a'

vi.mock('./db', () => ({
  snapshotGet: vi.fn(async (key: string) => store.get(key)),
  snapshotPut: vi.fn(async (row: { key: string; owner: string; value: unknown; at: number }) => {
    store.set(row.key, row)
  }),
  snapshotPrune: vi.fn(async () => {}),
}))
vi.mock('./localData', () => ({ readCacheOwner: () => owner }))

import { CacheOwnerChangedError } from './asyncCache'
import { snapshotPrune, snapshotPut } from './db'
import { resetOfflineSnapshotForTests, withOfflineSnapshot } from './offlineSnapshot'

const settle = () => new Promise((r) => setTimeout(r, 0))
const offline = () => Promise.reject(new TypeError('Failed to fetch'))

beforeEach(() => {
  store.clear()
  owner = 'owner-a'
  vi.mocked(snapshotPut).mockClear()
  vi.mocked(snapshotPrune).mockClear()
  resetOfflineSnapshotForTests()
})

describe('withOfflineSnapshot', () => {
  it('returns the live answer and keeps a copy', async () => {
    expect(await withOfflineSnapshot('altar', async () => ({ threads: 4 }))).toEqual({ threads: 4 })
    await settle()
    expect(store.get('altar')).toMatchObject({ owner: 'owner-a', value: { threads: 4 } })
  })

  it('serves the last answer when the read fails', async () => {
    await withOfflineSnapshot('altar', async () => ({ threads: 4 }))
    await settle()
    expect(await withOfflineSnapshot('altar', offline)).toEqual({ threads: 4 })
  })

  it('never prefers a snapshot to a live answer', async () => {
    await withOfflineSnapshot('altar', async () => ({ threads: 4 }))
    await settle()
    expect(await withOfflineSnapshot('altar', async () => ({ threads: 5 }))).toEqual({ threads: 5 })
    await settle()
    expect(store.get('altar')?.value).toEqual({ threads: 5 })
  })

  it('with nothing kept, the original error reaches the surface', async () => {
    await expect(withOfflineSnapshot('altar', offline)).rejects.toThrow('Failed to fetch')
  })

  it('refuses another owner\'s snapshot', async () => {
    await withOfflineSnapshot('altar', async () => ({ threads: 4 }))
    await settle()
    owner = 'owner-b'
    await expect(withOfflineSnapshot('altar', offline)).rejects.toThrow('Failed to fetch')
  })

  it('an owner change mid-read is not a network failure: no fallback', async () => {
    await withOfflineSnapshot('altar', async () => ({ threads: 4 }))
    await settle()
    await expect(
      withOfflineSnapshot('altar', () => Promise.reject(new CacheOwnerChangedError())),
    ).rejects.toBeInstanceOf(CacheOwnerChangedError)
  })

  it('does not keep an answer the read says is degraded', async () => {
    await withOfflineSnapshot('ascent', async () => ({ weekly: ['real'] }))
    await settle()
    await withOfflineSnapshot('ascent', async () => ({ weekly: [] as string[] }), (v) => v.weekly.length > 0)
    await settle()
    expect(store.get('ascent')?.value).toEqual({ weekly: ['real'] })
  })

  it('ignores a snapshot too old to pass off as current', async () => {
    store.set('altar', { key: 'altar', owner: 'owner-a', value: { threads: 1 }, at: Date.now() - 91 * 86_400_000 })
    await expect(withOfflineSnapshot('altar', offline)).rejects.toThrow('Failed to fetch')
  })

  it('a snapshot that cannot be stored never fails the read', async () => {
    vi.mocked(snapshotPut).mockRejectedValueOnce(new Error('DataCloneError'))
    expect(await withOfflineSnapshot('altar', async () => 'ok')).toBe('ok')
  })

  it('signed out (no cache owner): nothing is kept', async () => {
    owner = null
    await withOfflineSnapshot('altar', async () => 'x')
    await settle()
    expect(snapshotPut).not.toHaveBeenCalled()
  })

  it('prunes once per session, not on every write', async () => {
    await withOfflineSnapshot('a', async () => 1)
    await withOfflineSnapshot('b', async () => 2)
    await settle()
    expect(snapshotPrune).toHaveBeenCalledTimes(1)
  })
})
