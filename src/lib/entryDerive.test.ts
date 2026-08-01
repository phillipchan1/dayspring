import { describe, expect, it } from 'vitest'

// repo ← attachmentQueue ← entryDerive → repo is a genuine import diamond, and
// the hooks are installed at boot from App.tsx. A circular-initialisation
// problem there is invisible to tsc and to the bundler — it surfaces as a blank
// screen on launch. Importing and running the registration is the cheapest thing
// that would actually catch it.
describe('boot wiring', () => {
  it('registers the repo hooks without throwing', async () => {
    const { registerEntryDerive } = await import('./entryDerive')
    expect(() => registerEntryDerive()).not.toThrow()
  })

  it('is idempotent — App re-runs it whenever the owner changes', async () => {
    const { registerEntryDerive } = await import('./entryDerive')
    registerEntryDerive()
    expect(() => registerEntryDerive()).not.toThrow()
  })

  it('leaves the repo usable after registration', async () => {
    const repo = await import('./repo')
    expect(typeof repo.flush).toBe('function')
    expect(typeof repo.setEntryDeriveHook).toBe('function')
    expect(typeof repo.setSideQueueHook).toBe('function')
  })
})
