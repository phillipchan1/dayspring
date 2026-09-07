import { describe, it, expect } from 'vitest'
import { pickCards, MAX_CARDS } from './pickCards'
import { RELEASES, CURRENT_RELEASE_ID, type Release } from './releases'

const card = (title: string) => ({ kicker: 'What changed', title, body: ['x'] })

const fixture: Release[] = [
  { id: 'r1', major: true, cards: [card('a')] },
  { id: 'r2', cards: [card('b')] }, // not major — never auto-shows
  { id: 'r3', major: true, land: 'pages', landLabel: 'Open Pages', cards: [card('c')] },
]

describe('pickCards', () => {
  it('shows every major release to someone who has never seen one', () => {
    const deck = pickCards(null, fixture)
    expect(deck?.cards.map((c) => c.title)).toEqual(['a', 'c'])
  })

  it('skips releases that were not marked major', () => {
    // 'b' belongs to r2, which has no `major` flag.
    expect(pickCards(null, fixture)?.cards.map((c) => c.title)).not.toContain('b')
  })

  it('shows only what came after the last one seen', () => {
    expect(pickCards('r1', fixture)?.cards.map((c) => c.title)).toEqual(['c'])
  })

  it('shows nothing to someone already caught up', () => {
    expect(pickCards('r3', fixture)).toBeNull()
  })

  it('catches you up past trailing non-major releases', () => {
    // Seen r1; r2 is minor and r3 is major, so the deck is r3's card and
    // closing it stamps r3 — r2 must never surface on its own afterwards.
    const deck = pickCards('r1', fixture)
    expect(deck?.seenId).toBe('r3')
  })

  it('stamps the newest id in the registry, not the newest major', () => {
    const trailingMinor: Release[] = [...fixture, { id: 'r4', cards: [card('d')] }]
    expect(pickCards('r1', trailingMinor)?.seenId).toBe('r4')
  })

  it('merges several unseen majors into one deck, oldest first', () => {
    const many: Release[] = [
      { id: 'a1', major: true, cards: [card('one')] },
      { id: 'a2', major: true, cards: [card('two')] },
    ]
    expect(pickCards(null, many)?.cards.map((c) => c.title)).toEqual(['one', 'two'])
  })

  it('caps the deck rather than showing two in a row', () => {
    const many: Release[] = [
      { id: 'a1', major: true, cards: [card('1'), card('2')] },
      { id: 'a2', major: true, cards: [card('3'), card('4')] },
    ]
    const deck = pickCards(null, many)
    expect(deck?.cards).toHaveLength(MAX_CARDS)
    expect(deck?.cards.map((c) => c.title)).toEqual(['1', '2', '3'])
  })

  it('takes the landing from the most recent major in the deck', () => {
    const deck = pickCards(null, fixture)
    expect(deck?.land).toBe('pages')
    expect(deck?.landLabel).toBe('Open Pages')
  })

  it('omits the landing when the release does not name one', () => {
    const deck = pickCards(null, [{ id: 'z', major: true, cards: [card('z')] }])
    expect(deck?.land).toBeUndefined()
  })

  it('shows nothing for an id it does not recognise (a downgrade)', () => {
    // A newer build stamped an id this registry has never heard of. Showing
    // everything again would re-open a deck the user already dismissed.
    expect(pickCards('2099-from-the-future', fixture)).toBeNull()
  })

  it('treats an empty string like never-seen, not like an unknown id', () => {
    expect(pickCards('', fixture)?.cards.map((c) => c.title)).toEqual(['a', 'c'])
  })

  it('shows nothing when the registry is empty', () => {
    expect(pickCards(null, [])).toBeNull()
  })

  describe('the real registry', () => {
    it('shows the Pages deck to an existing user who has never seen one', () => {
      const deck = pickCards(null)
      expect(deck).not.toBeNull()
      expect(deck!.cards.length).toBeGreaterThan(0)
      expect(deck!.cards.length).toBeLessThanOrEqual(MAX_CARDS)
    })

    it('shows nothing to a brand-new account stamped at onboarding', () => {
      // OnboardingFlow writes CURRENT_RELEASE_ID, so someone who just arrived is
      // never told what changed about an app they have not used.
      expect(pickCards(CURRENT_RELEASE_ID)).toBeNull()
    })

    it('never sermonises: no copy addresses the user’s own writing', () => {
      const banned = /\b(streak|score|unlock|supercharge|journey|AI-powered)\b/i
      for (const r of RELEASES) {
        for (const c of r.cards) {
          expect(c.title).not.toMatch(banned)
          for (const p of c.body) expect(p).not.toMatch(banned)
        }
      }
    })

    it('has no exclamation marks anywhere in the registry', () => {
      for (const r of RELEASES) {
        for (const c of r.cards) {
          expect(c.title).not.toContain('!')
          for (const p of c.body) expect(p).not.toContain('!')
        }
      }
    })

    it('keeps every release id unique', () => {
      const ids = RELEASES.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
