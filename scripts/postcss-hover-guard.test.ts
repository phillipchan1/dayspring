import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { hoverGuard } from './postcss-hover-guard.ts'

const run = (css: string) => postcss([hoverGuard()]).process(css, { from: undefined }).css

/** Whitespace-insensitive, so the assertions read like the CSS they expect. */
const squash = (css: string) =>
  css.replace(/\s*([{}])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim()

describe('hoverGuard', () => {
  it('wraps a bare :hover rule in (hover: hover)', () => {
    expect(squash(run('.a:hover { color: red }'))).toBe(
      '@media (hover: hover) { .a:hover { color: red } }',
    )
  })

  it('leaves rules without :hover alone', () => {
    expect(squash(run('.a { color: red } .a:active { color: blue }'))).toBe(
      '.a { color: red } .a:active { color: blue }',
    )
  })

  it('leaves a rule that is already inside a hover query alone', () => {
    const css = '@media (hover: hover) and (pointer: fine) { .a:hover { color: red } }'
    expect(squash(run(css))).toBe(squash(css))
  })

  it('splits a mixed list, so a focus ring still shows on touch', () => {
    expect(squash(run('.a:hover, .a:focus-visible { color: red }'))).toBe(
      '.a:focus-visible { color: red } @media (hover: hover) { .a:hover { color: red } }',
    )
  })

  it('guards a hover nested in another at-rule', () => {
    expect(squash(run('@media (min-width: 768px) { .a:hover { color: red } }'))).toBe(
      '@media (min-width: 768px) { @media (hover: hover) { .a:hover { color: red } } }',
    )
  })

  it('does not split commas inside :is()', () => {
    expect(squash(run(':is(.a, .b):hover { color: red }'))).toBe(
      '@media (hover: hover) { :is(.a, .b):hover { color: red } }',
    )
  })
})
