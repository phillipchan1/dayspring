import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guideline 5.1.1(v): the guest Sign-in overlay must leave writing reachable.
 * "← Back to journal" and the theme toggle both used to pin top-left; the
 * toggle (z-index 20) covered the escape hatch (TF 1.0.984). A source
 * tripwire so they cannot share that corner again.
 */
describe('guest SignIn overlay layout', () => {
  const signInTsx = readFileSync(resolve(__dirname, 'SignIn.tsx'), 'utf8')
  const signInCss = readFileSync(resolve(__dirname, 'SignIn.css'), 'utf8')
  const toggleCss = readFileSync(resolve(__dirname, 'ThemeToggle.css'), 'utf8')

  it('does not pin overlay dismiss and theme toggle to the same fixed corner', () => {
    expect(signInTsx).toMatch(
      /className=\{\s*onDismiss\s*\?[\s\S]*?theme-toggle--fixed-end/,
    )
    expect(signInCss).toMatch(/\.signin__dismiss\s*\{[^}]*\bleft\s*:/s)
    expect(signInCss).not.toMatch(/\.signin__dismiss\s*\{[^}]*\bright\s*:/s)
    expect(toggleCss).toMatch(/\.theme-toggle--fixed-end\s*\{[^}]*\bleft\s*:\s*auto/s)
    expect(toggleCss).toMatch(/\.theme-toggle--fixed-end\s*\{[^}]*\bright\s*:/s)
  })
})
