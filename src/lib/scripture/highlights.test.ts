// What Lamp counts from a scripture ritual page.
//
// The passage fence lights the CHAPTER (where the writer has been); each quote
// they drew out of it lights its VERSE (what caught them). Both are derived
// from the page's own markdown, so the editor's save and the gather engine,
// which share refRows.ts, agree on every page.

import { describe, expect, it } from 'vitest'
import { fenceReferences, highlightRefs } from './highlights'
import { dedupeByOsis, planScriptureRefs, scriptureRefsOf } from './refRows'
import { parseReferences } from './parse'

const FENCE_ID = '7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44'
const fence = (reference: string, text = 'Some verse text goes here.') =>
  ['```dayspring-scripture ' + FENCE_ID, text, reference, '```'].join('\n')

/** A scripture ritual page, the way the composer stores it. */
function ritual(name: string, passage: string, ...answers: string[]): string {
  return [
    `<!-- ritual:name:${name} -->`,
    '<!-- ritual:section:Read -->',
    passage,
    ...answers.flatMap((a, i) => [`<!-- ritual:section:Reflect ${i + 1} -->`, a]),
    '<!-- ritual:end -->',
  ].join('\n')
}

const osis = (refs: { osis_ref: string }[]) => refs.map((r) => r.osis_ref)
const lit = (markdown: string) => [...dedupeByOsis(scriptureRefsOf(markdown)).keys()]

describe('highlightRefs', () => {
  it('counts only the verses highlighted — Proverbs 3, verses 5 and 6', () => {
    const page = ritual('Open Reading', fence('Proverbs 3 · ESV'), '> Trust in the LORD (vv. 5–6)\n\nI keep leaning on my own.')
    expect(osis(highlightRefs(page))).toEqual(['Prov.3.5-Prov.3.6'])
  })

  it('counts every highlight in one page, each as its own verse', () => {
    const page = ritual(
      'Lectio Divina',
      fence('John 15 · ESV'),
      '> Remain in me (v. 4)\n\nI stay.',
      '> apart from me you can do nothing (v. 5)\n\n> abide in my love (v. 9)',
    )
    expect(osis(highlightRefs(page))).toEqual(['John.15.4', 'John.15.5', 'John.15.9'])
  })

  it('reads a quote across two verses as one range', () => {
    const page = ritual('SOAP', fence('Psalm 23 · ESV'), '> he leads me beside still waters (vv. 2–3)')
    expect(osis(highlightRefs(page))).toEqual(['Ps.23.2-Ps.23.3'])
  })

  it('takes the book and chapter from the passage, whatever range it names', () => {
    const page = ritual('SOAP', fence('John 15:4–5 · ESV'), '> Remain in me (v. 4)')
    expect(osis(highlightRefs(page))).toEqual(['John.15.4'])
  })

  it('works for the books whose names are also words', () => {
    for (const [reference, expected] of [
      ['Mark 4', 'Mark.4.39'],
      ['Acts 2', 'Acts.2.39'],
      ['Job 38', 'Job.38.39'],
      ['Revelation 21', 'Rev.21.39'],
    ] as const) {
      const page = ritual('Open Reading', fence(`${reference} · ESV`), '> a phrase (v. 39)')
      expect(osis(highlightRefs(page))).toEqual([expected])
    }
  })

  it('reads a passage taken from the writer’s own Bible (a bare reference fence)', () => {
    const page = ritual('Open Reading', ['```dayspring-scripture ' + FENCE_ID, 'Mark 4', '```'].join('\n'), '> a phrase (v. 39)')
    expect(osis(highlightRefs(page))).toEqual(['Mark.4.39'])
  })

  it('points at the quote itself, so the excerpt is cut from the reflection beside it', () => {
    const page = ritual('SOAP', fence('John 15 · ESV'), 'Before.\n\n> Remain in me (v. 4)\n\nAfter.')
    const [ref] = highlightRefs(page)
    expect(page.slice(ref!.char_start, ref!.char_end)).toBe('Remain in me (v. 4)')
  })

  it('places nothing it cannot place', () => {
    // Lectio’s older caught word has no verse number.
    expect(highlightRefs(ritual('Lectio Divina', fence('John 15 · ESV'), '> I am the vine'))).toEqual([])
    // An empty quote highlights nothing.
    expect(highlightRefs(ritual('SOAP', fence('John 15 · ESV'), '> (v. 4)'))).toEqual([])
    // A passage that crosses a chapter has no chapter for the number to belong to.
    expect(highlightRefs(ritual('SOAP', fence('Romans 8:28–9:2 · ESV'), '> a phrase (v. 30)'))).toEqual([])
    // A reference we cannot read is not a book to hang a verse on.
    expect(highlightRefs(ritual('SOAP', fence('somewhere in there'), '> a phrase (v. 4)'))).toEqual([])
  })

  it('ignores a verse-numbered quote outside a scripture ritual', () => {
    expect(highlightRefs('Be still.\n\n> Be still (v. 10)\n\nAnd I was.')).toEqual([])
    const examen = ritual('The Daily Examen', fence('John 15 · ESV'), '> Remain in me (v. 4)')
    expect(highlightRefs(examen)).toEqual([])
  })

  it('ignores a quote after the ritual ends, and a quote inside a fence', () => {
    const page =
      ritual('SOAP', fence('John 15 · ESV'), 'plain') +
      '\n\n> Remain in me (v. 4)\n\n```dayspring-pray 2d4e6f80-1a3b-4c5d-8e7f-9a0b1c2d3e4f\n> not scripture (v. 9)\n```'
    expect(highlightRefs(page)).toEqual([])
  })

  it('belongs a quote to the ritual it sits in, when a page holds two', () => {
    const page = [
      ritual('SOAP', fence('John 15 · ESV'), '> Remain in me (v. 4)'),
      ritual('Open Reading', fence('Psalm 23 · ESV'), '> I shall not want (v. 1)'),
    ].join('\n\n')
    expect(osis(highlightRefs(page))).toEqual(['John.15.4', 'Ps.23.1'])
  })

  it('reads the passage as the first fence, not a cross-reference added later', () => {
    const crossRef = ['```dayspring-scripture 11111111-2222-3333-4444-555555555555', 'text', 'Romans 8:28 · ESV', '```'].join('\n')
    const page = ritual('SOAP', fence('John 15 · ESV'), crossRef + '\n\n> Remain in me (v. 4)')
    expect(osis(highlightRefs(page))).toEqual(['John.15.4'])
  })

  it('still reads the legacy practice: tokens', () => {
    const page = ritual('SOAP', fence('John 15 · ESV'), '> Remain in me (v. 4)').replaceAll('ritual:', 'practice:')
    expect(osis(highlightRefs(page))).toEqual(['John.15.4'])
  })
})

describe('fenceReferences', () => {
  it('counts a whole-chapter fence the prose parser refuses', () => {
    for (const [reference, expected] of [
      ['Mark 4', 'Mark.4'],
      ['Acts 2', 'Acts.2'],
      ['Job 38', 'Job.38'],
      ['Revelation 21', 'Rev.21'],
      ['Proverbs 3', 'Prov.3'],
      ['Judges 6', 'Judg.6'],
      ['Numbers 13', 'Num.13'],
    ] as const) {
      const page = fence(`${reference} · ESV`)
      expect(osis(parseReferences(page))).toEqual([]) // the prose parser would stay silent
      expect(osis(fenceReferences(page))).toEqual([expected])
    }
  })

  it('keeps offsets relative to the whole page', () => {
    const page = 'Morning.\n\n' + fence('Mark 4 · ESV')
    const [ref] = fenceReferences(page)
    expect(page.slice(ref!.char_start, ref!.char_end)).toBe('Mark 4')
  })

  it('reads a fence that is only a reference', () => {
    const page = ['```dayspring-scripture ' + FENCE_ID, 'Acts 2', '```'].join('\n')
    expect(osis(fenceReferences(page))).toEqual(['Acts.2'])
  })

  it('does not become a way into prose', () => {
    expect(fenceReferences('Met Mark 5 minutes late.')).toEqual([])
    expect(osis(scriptureRefsOf('Met Mark 5 minutes late.'))).toEqual([])
    expect(osis(scriptureRefsOf('Read john 3 today.'))).toEqual(['John.3'])
  })
})

describe('what Lamp holds for a ritual page — both grains', () => {
  const page = ritual(
    'Open Reading',
    fence('Proverbs 3 · ESV'),
    '> Trust in the LORD with all your heart (v. 5)\n\n> he will make straight your paths (v. 6)\n\nI keep leaning on my own.',
  )

  it('lights the chapter AND the verses', () => {
    expect(lit(page)).toEqual(['Prov.3.5', 'Prov.3.6', 'Prov.3'])
  })

  it('lights only the chapter when nothing was highlighted', () => {
    expect(lit(ritual('Open Reading', fence('Proverbs 3 · ESV'), 'Nothing stood out today.'))).toEqual(['Prov.3'])
  })

  it('keeps the highlight’s own position when it names the same verses as the passage', () => {
    const p = ritual('SOAP', fence('John 15:4 · ESV'), '> Remain in me (v. 4)')
    const refs = [...dedupeByOsis(scriptureRefsOf(p)).values()]
    expect(osis(refs)).toEqual(['John.15.4'])
    expect(p.slice(refs[0]!.char_start, refs[0]!.char_end)).toBe('Remain in me (v. 4)')
  })

  it('plans inserts for the verses and the chapter, and removes a verse whose quote is gone', () => {
    const toInsert = planScriptureRefs('e1', '2026-10-02T00:00:00Z', page, [], 'inline').toInsert
    expect(osis(toInsert)).toEqual(['Prov.3.5', 'Prov.3.6', 'Prov.3'])

    // The writer deletes the second quote and saves again.
    const edited = page.replace('\n\n> he will make straight your paths (v. 6)', '')
    const existing = toInsert.map((r, i) => ({ id: `r${i}`, osis_ref: r.osis_ref, source: 'inline' }))
    const plan = planScriptureRefs('e1', '2026-10-02T00:00:00Z', edited, existing, 'inline')
    expect(plan.toInsert).toEqual([])
    expect(plan.toDelete).toEqual(['r1']) // Prov.3.6 — the chapter and Prov.3.5 stand
  })

  it('never removes a ref the writer confirmed by hand', () => {
    const plan = planScriptureRefs('e1', '2026-10-02T00:00:00Z', 'Nothing here.', [{ id: 'm', osis_ref: 'Prov.3.5', source: 'manual' }], 'inline')
    expect(plan.toDelete).toEqual([])
  })
})
