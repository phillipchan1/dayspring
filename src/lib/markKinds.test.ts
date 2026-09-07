import { describe, expect, it } from 'vitest'
import { MARK_KIND, MARK_KINDS, MARKED_LINE_KINDS, kindForCommand } from './markKinds'
import { formatSpiritualBlock, isSpiritualFenceLine, parseSpiritualBlocks } from './spiritualBlocks'

const UUID = '0123abcd-0123-0123-0123-0123456789ab'

describe('the closed set of kinds', () => {
  it('holds the eight, and only the eight', () => {
    expect(MARK_KINDS.map((k) => k.kind)).toEqual([
      'gift',
      'scripture',
      'prayer',
      'desire',
      'sense',
      'learned',
      'story',
      'absence',
    ])
  })

  // Every column of the table has to be unique or two kinds collide somewhere:
  // two fences and the parser can't tell them apart, two commands and the
  // palette fires the wrong capture.
  it('gives every kind its own fence and its own command', () => {
    expect(new Set(MARK_KINDS.map((k) => k.fence)).size).toBe(MARK_KINDS.length)
    expect(new Set(MARK_KINDS.map((k) => k.command)).size).toBe(MARK_KINDS.length)
  })

  it('round-trips every kind through the fence', () => {
    for (const meta of MARK_KINDS) {
      const md = formatSpiritualBlock(meta.kind, UUID, 'the writer’s own sentence')
      expect(isSpiritualFenceLine(md.split('\n')[0]!)).toBe(true)
      expect(parseSpiritualBlocks(md)[0]).toMatchObject({
        type: meta.kind,
        id: UUID,
        content: 'the writer’s own sentence',
      })
    }
  })

  it('resolves every command back to its kind', () => {
    for (const meta of MARK_KINDS) expect(kindForCommand(meta.command)).toBe(meta.kind)
    expect(kindForCommand('ritual')).toBeNull()
    expect(kindForCommand('')).toBeNull()
  })

  // Scripture is the only kind that stays a set-apart block: it is the only one
  // whose words are not the writer's own.
  it('marks every kind but scripture as a line', () => {
    expect(MARKED_LINE_KINDS.map((k) => k.kind)).not.toContain('scripture')
    expect(MARKED_LINE_KINDS).toHaveLength(MARK_KINDS.length - 1)
  })

  /*
   * Principle 1 forbids vertical valence. "Growth" is the word that smuggles it
   * back in — it implies a direction, and a direction beside someone's
   * spiritual life is a grade. The rendered word is "Learned", and the gloss is
   * a description of what the writer did rather than a claim about where they
   * are now.
   */
  it('never renders Learned as Growth, or any kind as a direction', () => {
    expect(MARK_KIND.learned.label).toBe('Learned')
    const banned = /growth|progress|improve|better|level|streak|score/i
    for (const meta of MARK_KINDS) {
      expect(meta.label).not.toMatch(banned)
      expect(meta.gloss).not.toMatch(banned)
    }
  })

  // The tradition takes the dark night seriously. Absence is declared only, and
  // it is the one kind with no hue of its own — a colour would be the first step
  // toward reading it as a state to be in less of.
  it('keeps Absence tonally neutral and never a verdict', () => {
    expect(MARK_KIND.absence.gloss).toBe('Where He seemed far.')
    expect(MARK_KIND.absence.tone).toBe('var(--k-absence)')
  })

  // A prayer written four years ago still opens with /pray. Renaming a command
  // to match a table is the tail wagging the dog.
  it('keeps /pray as prayer’s command', () => {
    expect(MARK_KIND.prayer.command).toBe('pray')
    expect(MARK_KIND.prayer.fence).toBe('dayspring-pray')
  })

  it('leaves an unknown fence unparsed rather than guessing a kind', () => {
    const md = '```dayspring-lament ' + UUID + '\nnot a kind\n```'
    expect(parseSpiritualBlocks(md)).toEqual([])
  })
})
