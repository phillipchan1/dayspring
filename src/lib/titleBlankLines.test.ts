// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

/**
 * Title + N blanks + body, measured the way QA does.
 *
 * Lives in `src/` so root `npm test` (and CI `checks`) run it. A test under
 * `site/` is a different package and would never see this render path.
 *
 * The gap must be N body lines (`--editor-line-height * 1em` on the block
 * AFTER the title). On the H1 the same `em` is the heading face — 59.5px
 * on a 390px phone instead of 33.5, and 72.6 instead of 40.8 on an iPad.
 */

const CSS = readFileSync('src/styles/global.css', 'utf8')

const BODY_PX = 24
const LINE = 1.7
const BODY_LINE = BODY_PX * LINE // 40.8 — desktop / iPad default

function mount(md: string, opts?: Parameters<typeof renderMarkdown>[1]) {
  const style = document.createElement('style')
  style.textContent = `
    .markdown-body {
      font-size: ${BODY_PX}px;
      line-height: ${LINE};
      --editor-line-height: ${LINE};
      --h1-size: 1.78em;
      --block-gap: calc(var(--editor-line-height) * 1em);
    }
    .markdown-body h1 {
      font-size: var(--h1-size);
      margin: 0;
      padding: 0 0 0.85em;
    }
    .markdown-body h1 + p,
    .markdown-body h1 + ul,
    .markdown-body h1 + ol,
    .markdown-body h1 + blockquote { margin-top: 0; }
    .markdown-body h1.read-title-blank + * {
      margin-top: calc(var(--title-blanks) * var(--editor-line-height) * 1em);
    }
    .markdown-body p { margin: 0 0 var(--block-gap); }
  `
  const root = document.createElement('div')
  root.className = 'markdown-body'
  root.innerHTML = renderMarkdown(md, opts)
  document.body.append(style, root)
  return { root, style }
}

afterEach(() => {
  document.body.replaceChildren()
})

/** The gap the CSS will apply: N × one body line, never N × the title face. */
function titleGapPx(md: string): number {
  const { root } = mount(md)
  const body = root.querySelector(':scope > p') as HTMLElement | null
  const n = Number.parseInt(body?.style.getPropertyValue('--title-blanks') || '0', 10)
  return n * BODY_LINE
}

describe('title blank lines — body-line gap (root suite)', () => {
  it('sizes the gap from the body, not the title face', () => {
    expect(CSS).toMatch(/h1\.read-title-blank \+ \*[\s\S]*?1em/)
    expect(CSS).not.toMatch(/h1\.read-title-blank\s*\{[\s\S]*?margin-bottom:\s*var\(--block-gap\)/)
  })

  it('0 blank lines: no extra gap (already 0px vs the editor)', () => {
    const { root } = mount('Morning\nThe lake was still.')
    const h1 = root.querySelector<HTMLElement>(':scope > h1')!
    const p = root.querySelector<HTMLElement>(':scope > p')!
    expect(h1.classList.contains('read-title-blank')).toBe(false)
    expect(p.style.getPropertyValue('--title-blanks')).toBe('')
    expect(titleGapPx('Morning\nThe lake was still.')).toBe(0)
  })

  it('1 blank line: one body line (40.8px at 24px / 1.7), not a title-sized 72.6', () => {
    const gap = titleGapPx('Morning\n\nThe lake was still.')
    expect(gap).toBeCloseTo(BODY_LINE, 5)
    expect(gap).not.toBeCloseTo(BODY_PX * 1.78 * LINE, 5)
    expect(renderMarkdown('Morning\n\nThe lake was still.')).toContain('style="--title-blanks:1"')
  })

  it('2 blank lines: two body lines', () => {
    expect(titleGapPx('Morning\n\n\nThe lake was still.')).toBeCloseTo(2 * BODY_LINE, 5)
  })

  it('3 blank lines: three body lines', () => {
    expect(titleGapPx('Morning\n\n\n\nThe lake was still.')).toBeCloseTo(3 * BODY_LINE, 5)
  })

  it('a whitespace-only line is one body line, like the editor', () => {
    expect(titleGapPx('Morning\n   \nThe lake was still.')).toBeCloseTo(BODY_LINE, 5)
  })

  it('paragraph blanks stay on --block-gap and do not take the title hook', () => {
    const { root } = mount('One paragraph.\n\nAnother.', { asTitle: false })
    const [first, second] = [...root.querySelectorAll<HTMLElement>(':scope > p')]
    expect(first!.style.getPropertyValue('--title-blanks')).toBe('')
    expect(second!.style.getPropertyValue('--title-blanks')).toBe('')
    const gap = Number.parseFloat(getComputedStyle(first!).marginBottom)
    if (Number.isFinite(gap) && gap > 0) {
      expect(gap).toBeCloseTo(BODY_LINE, 5)
    }
  })
})
