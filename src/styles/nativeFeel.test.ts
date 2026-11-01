import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import postcss, { type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

/**
 * Tripwires for docs/product/DESIGN_PRINCIPLES.md — behave like the platform,
 * look like Dayspring. Each of these was a web-app tell found in the first
 * native-feel audit (docs/NATIVE_FEEL_AUDIT.md) and fixed app-wide; the test
 * exists so it cannot come back one stylesheet at a time.
 */

const SRC = resolve(__dirname, '..')
const ROOT = resolve(SRC, '..')

/** Marketing capture frames and dev previews are not the app. */
const NOT_THE_APP = /\/(ads|appstore|flagship)\/|preview\.(tsx|css)$|\.test\.tsx?$/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

const files = walk(SRC).filter((f) => !NOT_THE_APP.test(f))
const css = files.filter((f) => f.endsWith('.css'))
const code = files.filter((f) => /\.tsx?$/.test(f))
const rel = (f: string) => relative(ROOT, f)

function eachRule(visit: (rule: Rule, file: string) => void) {
  for (const file of css) {
    postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule) => visit(rule, file))
  }
}

/**
 * Text buttons drawn as hyperlinks — underlined, inline, in link colour. They
 * look like links, so they keep the link's hand. Anything else is a control.
 */
const LINK_STYLED = new Set([
  'a[href]',
  '.ascent-link',
  '.ledger-chip.is-link',
  '.altar-quiet__link',
  '.locked-soft__link',
  '.apple-terms__link',
  '.pf__link',
])

describe('native feel (DESIGN_PRINCIPLES)', () => {
  it('N1: controls take the arrow; only links show the pointing hand', () => {
    const offenders: string[] = []
    eachRule((rule, file) => {
      rule.walkDecls('cursor', (decl) => {
        if (decl.value !== 'pointer') return
        if (rule.selectors.every((s) => LINK_STYLED.has(s.trim()))) return
        offenders.push(`${rel(file)}:${decl.source?.start?.line} ${rule.selector}`)
      })
    })
    for (const file of code) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/cursor\s*:\s*['"]pointer['"]/.test(line)) offenders.push(`${rel(file)}:${i + 1}`)
        })
    }
    expect(offenders).toEqual([])
  })

  it('N1: the shell is not a document — nothing is selectable by default', () => {
    const body = postcss
      .parse(readFileSync(join(SRC, 'styles/global.css'), 'utf8'))
      .nodes.find((n): n is Rule => n.type === 'rule' && n.selector === 'body')
    const decls = Object.fromEntries(
      (body?.nodes ?? []).flatMap((n) => (n.type === 'decl' ? [[n.prop, n.value]] : [])),
    )
    expect(decls['user-select']).toBe('none')
    expect(decls['-webkit-user-select']).toBe('none')
    expect(decls['-webkit-touch-callout']).toBe('none')
    expect(decls['-webkit-tap-highlight-color']).toBe('transparent')
  })

  it('N1: no browser dialogs (alert / confirm / prompt) in the app', () => {
    const offenders = code.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          !/^\s*(\/\/|\/?\*)/.test(line) &&
          /\bwindow\.(alert|confirm|prompt)\s*\(|(^|[^\w.])(alert|prompt)\s*\(/.test(line)
            ? [`${rel(file)}:${i + 1}`]
            : [],
        ),
    )
    expect(offenders).toEqual([])
  })

  it('N2: every CSS :hover is guarded for touch at build time', () => {
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
    expect(vite).toMatch(/import \{ hoverGuard \} from '\.\/scripts\/postcss-hover-guard\.ts'/)
    expect(vite).toMatch(/postcss:\s*\{\s*plugins:\s*\[hoverGuard\(\)\]/)
  })

  it('N2: nothing levitates on hover — no hover rule moves an element up', () => {
    const offenders: string[] = []
    eachRule((rule, file) => {
      if (!/:hover\b/.test(rule.selector)) return
      rule.walkDecls('transform', (decl) => {
        if (/translateY\(\s*-/.test(decl.value)) {
          offenders.push(`${rel(file)}:${decl.source?.start?.line} ${rule.selector}`)
        }
      })
    })
    expect(offenders).toEqual([])
  })

  it('N3: no `transition: all`', () => {
    const offenders: string[] = []
    eachRule((rule, file) => {
      rule.walkDecls('transition', (decl) => {
        if (/(^|,)\s*all\b/.test(decl.value)) offenders.push(`${rel(file)}:${decl.source?.start?.line}`)
      })
    })
    expect(offenders).toEqual([])
  })
})
