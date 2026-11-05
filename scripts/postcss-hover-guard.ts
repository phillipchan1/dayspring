import type { AtRule, Container, Plugin, Rule } from 'postcss'

/**
 * Hover is a pointer luxury (DESIGN_PRINCIPLES N2).
 *
 * iOS and iPadOS synthesize `:hover` on tap and then hold it until the next
 * tap somewhere else, so a hover tint written for the Mac sticks after the
 * finger lifts: a B button looks "on", a wall card stays lifted after you come
 * back from the reader, a Settings row stays lit. The fix is to put every
 * `:hover` inside `@media (hover: hover)`. The app had ~380 hover rules and ~25
 * of them were guarded; rather than hand-wrap them (and rely on every future
 * rule remembering to), the build wraps them.
 *
 * - A rule already inside an at-rule that mentions `hover` is left alone.
 * - A selector list that mixes hover and non-hover selectors is split, so
 *   `.x:hover, .x:focus-visible { … }` keeps its focus ring on touch devices.
 * - Press feedback belongs in `:active`, which this never touches.
 *
 * Runs on every CSS file Vite processes, in dev and in the build. Styles set
 * from TypeScript (CodeMirror themes) are not CSS files and must guard their
 * own hovers.
 */

const HOVER = /:hover\b/
const MEDIA = '(hover: hover)'

function insideHoverQuery(rule: Rule): boolean {
  for (let p: Container | undefined = rule.parent; p; p = p.parent as Container | undefined) {
    if (p.type === 'atrule' && /\bhover\b/.test((p as AtRule).params)) return true
  }
  return false
}

export function hoverGuard(): Plugin {
  return {
    postcssPlugin: 'dayspring-hover-guard',
    OnceExit(root, { AtRule }) {
      root.walkRules((rule) => {
        if (!HOVER.test(rule.selector) || insideHoverQuery(rule)) return
        const hover = rule.selectors.filter((s) => HOVER.test(s))
        const rest = rule.selectors.filter((s) => !HOVER.test(s))
        const media = new AtRule({ name: 'media', params: MEDIA })
        if (rest.length === 0) {
          rule.replaceWith(media)
          media.append(rule)
        } else {
          media.append(rule.clone({ selectors: hover }))
          rule.selectors = rest
          rule.after(media)
        }
      })
    },
  }
}
hoverGuard.postcss = true as const
