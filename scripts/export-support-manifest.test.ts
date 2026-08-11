import { describe, it, expect, beforeAll } from 'vitest'
import { buildManifest, slugify, type SupportManifest } from './export-support-manifest'

/**
 * The manifest is published to usedayspring.app/help. A refactor that made an
 * extractor return nothing wouldn't break the app — it would quietly empty a
 * reference table on a public page, or worse, publish a wrong number as fact.
 * These tests are the tripwire for that.
 */
describe('support manifest', () => {
  let manifest: SupportManifest

  beforeAll(async () => {
    // 'master' deliberately: it's the channel that enforces "every capability's
    // implementing module exists", so the suite fails on a rename.
    manifest = await buildManifest('master')
  })

  it('extracts every category', () => {
    // Not a loop over Object.keys — that would pass if a category vanished.
    // The list is spelled out so removing one has to be a deliberate edit here.
    const expected = [
      'shortcuts',
      'slashCommands',
      'settings',
      'themes',
      'fonts',
      'highlightColors',
      'practices',
      'importers',
      'flags',
      'surfaces',
      'capabilities',
    ]
    expect(Object.keys(manifest.categories).sort()).toEqual([...expected].sort())
    for (const key of expected) {
      expect(manifest.categories[key]!.length, `${key} is empty`).toBeGreaterThan(0)
    }
  })

  it('gives every entry a unique id', () => {
    const ids = Object.values(manifest.categories).flatMap((entries) => entries.map((e) => e.id))
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes, `duplicate ids: ${dupes.join(', ')}`).toEqual([])
  })

  it('publishes the defaults a new user actually gets, not migrated ones', () => {
    // migrateSettings({}) applies the v3 font bump and returns 28. The help site
    // must publish 24 — what someone installing today sees.
    const fontSize = manifest.categories.settings!.find((s) => s.key === 'fontSize')
    expect(fontSize?.default).toBe(manifest.values['editor.font-size-default'])
    expect(fontSize?.default).toBe(24)
  })

  it('resolves flags as a default install sees them, ignoring any local .env', () => {
    const byKey = Object.fromEntries(manifest.categories.flags!.map((f) => [f.key, f.defaultOn]))
    // altar has graduated — on for everyone.
    expect(byKey.altar).toBe(true)
    // These are off by default. A developer's own VITE_FF_* must not leak in and
    // advertise an unshipped surface on the marketing site.
    expect(byKey.threadsRopes).toBe(false)
    expect(byKey.concordance).toBe(false)
  })

  it('carries the billing facts the help site quotes verbatim', () => {
    expect(manifest.values['billing.trial-days']).toBe(14)
    expect(manifest.values['billing.grace-days']).toBe(3)
    expect(manifest.values['billing.extension-days']).toBe(7)
    // Stripe list prices — never rendered on the Apple path, but published so
    // the pricing article can't hand-type a figure that later changes.
    expect(manifest.values['billing.web.monthly']).toMatch(/^\$\d/)
    expect(manifest.values['billing.web.annual']).toMatch(/^\$\d/)
  })

  it('renders shortcuts for both platforms', () => {
    const focus = manifest.categories.shortcuts!.find((s) => s.id === 'shortcut.toggle-focus-mode')
    expect(focus).toBeDefined()
    expect(focus!.mac).toBe('⌘⏎')
    expect(focus!.pc).toBe('Ctrl + Enter')
  })

  it('marks the touch-only capabilities', () => {
    // Voice dictation and page scan live in the keyboard accessory bar, so they
    // have no desktop entry point. Docs claiming otherwise would be wrong.
    const touchOnly = manifest.categories
      .capabilities!.filter((c) => c.touchOnly)
      .map((c) => c.id)
      .sort()
    expect(touchOnly).toEqual(['capability.page-scan', 'capability.voice-dictation'])
  })
})

describe('slugify', () => {
  it('splits camelCase so ids read as words', () => {
    expect(slugify('fontSize')).toBe('font-size')
    expect(slugify('threadsRopes')).toBe('threads-ropes')
  })

  it('normalises labels with punctuation', () => {
    expect(slugify('Find a word, or ask a question')).toBe('find-a-word-or-ask-a-question')
    expect(slugify('Wesley’s Questions')).toBe('wesleys-questions')
  })
})
