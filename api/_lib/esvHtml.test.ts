import { describe, expect, it } from 'vitest'
import { parseChapterHtml } from './esvHtml.js'

// Short excerpts of Crossway's HTML exactly as the API sends it — including
// the words-of-Christ spans that do not close where they open.

const PSALM_3 = `<h4 id="p19003001_06-1" class="psalm-title">A Psalm of David, when he fled from Absalom his son.</h4>
<p class="block-indent"><span class="begin-line-group"></span>
<span id="p19003001_06-1" class="line"><b class="verse-num" id="v19003001-1">1&nbsp;</b>&nbsp;&nbsp;O LORD, how many are my foes!</span><br /><span id="p19003001_06-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;Many are rising against me;</span><br /><span id="p19003002_06-1" class="line"><b class="verse-num inline" id="v19003002-1">2&nbsp;</b>&nbsp;&nbsp;many are saying of my soul,</span><br /><span id="p19003002_06-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;“There is no salvation for him in God.” <span class="selah">Selah</span></span><br /><span class="end-line-group"></span>
<span class="begin-line-group"></span>
<span id="p19003003_06-1" class="line"><b class="verse-num inline" id="v19003003-1">3&nbsp;</b>&nbsp;&nbsp;But you, O LORD, are a shield about me,</span><br /><span id="p19003003_06-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;my glory, and the lifter of my head.</span><br /><span class="end-line-group"></span>
</p>`

const JEREMIAH_2 = `<p class="block-indent"><span class="begin-line-group"></span>
<span id="p24002003_01-1" class="line"><b class="verse-num inline" id="v24002003-1">3&nbsp;</b>&nbsp;&nbsp;Israel was holy to the LORD,</span><br /><span id="p24002003_01-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;the firstfruits of his harvest.</span><br /><span id="p24002003_01-1" class="declares line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;declares the LORD.”</span><br /><span class="end-line-group"></span>
</p><p id="p24002003_01-1"><b class="verse-num" id="v24002004-1">4&nbsp;</b>Hear the word of the LORD, O house of Jacob. <b class="verse-num" id="v24002005-1">5&nbsp;</b>Thus says the LORD:</p>
<p class="block-indent"><span class="begin-line-group"></span>
<span id="p24002005_01-1" class="line">&nbsp;&nbsp;“What wrong did your fathers find in me</span><br /><span id="p24002005_01-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;that they went far from me,</span><br /></p><span class="end-line-group"></span>`

const MATTHEW_6 = `<p id="p40006009_01-1" class="virtual"><b class="verse-num woc" id="v40006009-1">9&nbsp;</b><span class="woc">Pray then like this:</span></p>
<p class="block-indent"><span class="begin-line-group"></span>
<span id="p40006009_01-1" class="line">&nbsp;&nbsp;<span class="woc">“Our Father in heaven,</span><br /><span id="p40006009_01-1" class="line"><span class="woc">&nbsp;&nbsp;hallowed be your name.</span></span><br /><span id="p40006013_01-1" class="line"><b class="verse-num inline woc" id="v40006013-1">13&nbsp;</b>&nbsp;&nbsp;<span class="woc">And lead us not into temptation,</span><br /><span id="p40006013_01-1" class="indent line"><span class="woc">&nbsp;&nbsp;&nbsp;&nbsp;but deliver us from evil.</span><br /></span><span class="end-line-group"></span>
</span></span></span></p><p id="p40006013_01-1" class="same-paragraph"><b class="verse-num woc" id="v40006014-1">14&nbsp;</b><span class="woc">For if you forgive others their trespasses,</span></p>
<p id="p40006016_01-1"><b class="verse-num woc" id="v40006016-1">16&nbsp;</b><span class="woc">“And when you fast,</span></p>`

const SONG_1 = `<p class="block-indent"><h4 id="p22001001_06-1" class="speaker">She</h4>
<span class="begin-line-group"></span>
<span id="p22001004_06-1" class="line"><b class="verse-num inline" id="v22001004-1">4&nbsp;</b>&nbsp;&nbsp;Draw me after you; let us run.</span><br /><span class="end-line-group"></span>
<h4 id="p22001004_06-1" class="speaker">Others</h4>
<span class="begin-line-group"></span>
<span id="p22001004_06-1" class="line">&nbsp;&nbsp;We will exult and rejoice in you;</span><br /><span class="end-line-group"></span>
</p>`

describe('parseChapterHtml', () => {
  it('sets a psalm as lines and stanzas, under its title', () => {
    const [v1, v2, v3] = parseChapterHtml(PSALM_3)
    expect(v1).toEqual({
      n: 1,
      text: 'O LORD, how many are my foes! Many are rising against me;',
      parts: [
        {
          text: 'O LORD, how many are my foes!',
          at: 'stanza',
          indent: 1,
          head: { kind: 'title', text: 'A Psalm of David, when he fled from Absalom his son.' },
        },
        { text: 'Many are rising against me;', at: 'line', indent: 2 },
      ],
    })
    expect(v2!.parts[0]).toEqual({ text: 'many are saying of my soul,', at: 'line', indent: 1 })
    expect(v3!.parts[0]!.at).toBe('stanza')
  })

  it('keeps Selah as the last word of its line, and marks it', () => {
    const v2 = parseChapterHtml(PSALM_3)[1]!
    expect(v2.text.endsWith('in God.” Selah')).toBe(true)
    expect(v2.parts[1]).toMatchObject({ text: '“There is no salvation for him in God.” Selah', selah: true })
  })

  it('never lets the title into the verse text', () => {
    expect(parseChapterHtml(PSALM_3)[0]!.text).not.toContain('Absalom')
  })

  it('tells a poem from the prose that follows it', () => {
    const vs = parseChapterHtml(JEREMIAH_2)
    const byN = new Map(vs.map((v) => [v.n, v]))
    expect(byN.get(3)!.parts.map((p) => [p.at, p.indent])).toEqual([
      ['stanza', 1],
      ['line', 2],
      ['line', 3],
    ])
    expect(byN.get(4)!.parts).toEqual([{ text: 'Hear the word of the LORD, O house of Jacob.', at: 'para' }])
    expect(byN.get(5)!.parts).toEqual([
      { text: 'Thus says the LORD:', at: 'flow' },
      { text: '“What wrong did your fathers find in me', at: 'stanza', indent: 1 },
      { text: 'that they went far from me,', at: 'line', indent: 2 },
    ])
  })

  it('reads through words-of-Christ spans that do not nest', () => {
    const vs = parseChapterHtml(MATTHEW_6)
    const byN = new Map(vs.map((v) => [v.n, v]))
    expect(byN.get(9)!.parts.map((p) => p.text)).toEqual([
      'Pray then like this:',
      '“Our Father in heaven,',
      'hallowed be your name.',
    ])
    expect(byN.get(13)!.parts.map((p) => [p.at, p.indent])).toEqual([
      ['line', 1],
      ['line', 2],
    ])
  })

  it('resumes the paragraph a poem interrupted, and starts the next afresh', () => {
    const vs = parseChapterHtml(MATTHEW_6)
    expect(vs.find((v) => v.n === 14)!.parts[0]).toMatchObject({ at: 'para', resume: true })
    expect(vs.find((v) => v.n === 16)!.parts[0]).toEqual({ text: '“And when you fast,', at: 'para' })
  })

  it('hangs a speaker over the words they begin, even partway through a verse', () => {
    const [v4] = parseChapterHtml(SONG_1)
    expect(v4!.parts).toEqual([
      { text: 'Draw me after you; let us run.', at: 'stanza', indent: 1, head: { kind: 'speaker', text: 'She' } },
      { text: 'We will exult and rejoice in you;', at: 'stanza', indent: 1, head: { kind: 'speaker', text: 'Others' } },
    ])
  })

  it('keeps an acrostic letter over its stanza', () => {
    const html = `<h4 id="x" class="psalm-acrostic-title">Beth</h4>
<p class="block-indent"><span class="begin-line-group"></span>
<span class="line"><b class="verse-num inline" id="v19119009-1">9&nbsp;</b>&nbsp;&nbsp;How can a young man keep his way pure?</span><br /><span class="end-line-group"></span></p>`
    expect(parseChapterHtml(html)[0]!.parts[0]!.head).toEqual({ kind: 'acrostic', text: 'Beth' })
  })

  it('joins its parts into the flat text, always', () => {
    for (const html of [PSALM_3, JEREMIAH_2, MATTHEW_6, SONG_1]) {
      for (const v of parseChapterHtml(html)) expect(v.parts.map((p) => p.text).join(' ')).toBe(v.text)
    }
  })

  it('drops anything before the first verse number, and returns nothing without numbers', () => {
    expect(parseChapterHtml('<p>Draw near to God, and he will draw near to you.</p>')).toEqual([])
  })

  it('decodes entities', () => {
    const [v] = parseChapterHtml('<p><b class="verse-num">1&nbsp;</b>Bread &amp; wine&#8212;given.</p>')
    expect(v!.text).toBe('Bread & wine—given.')
  })
})
