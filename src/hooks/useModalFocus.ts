import { useLayoutEffect, type RefObject } from 'react'

/**
 * A layer that takes the keyboard (DESIGN_PRINCIPLES N7): while it is open,
 * everything behind it is `inert` — not focusable, not clickable, not read
 * out — focus moves into it, and when it closes focus goes back to whatever
 * had it before, the way a Mac sheet or the Settings window hands the
 * keyboard back to the document.
 *
 * `aria-modal` alone promised this to assistive tech and delivered none of
 * it: Tab walked out of Settings into the editor behind the glass.
 *
 * The overlays render in the app's own tree, beside the shell rather than
 * above it, so "behind" is computed: every sibling of the layer, and of each
 * of its ancestors up to <body>, except the branch that holds the layer.
 * Only elements this hook made inert are released, so stacked layers unwind
 * cleanly. A portal opened from INSIDE the layer later (a menu) is a new
 * <body> child and stays live.
 *
 * `layerRef` is the layer's outermost element (its scrim); `focusRef` is what
 * takes focus on open — the dialog itself, with tabIndex -1, so no control is
 * pre-selected and Tab lands on the first one. `active` goes false when the
 * layer starts to leave (usePresence's 'closing'): the app behind comes back
 * and focus returns at once, not after the exit animation.
 */
export function useModalFocus(
  layerRef: RefObject<HTMLElement | null>,
  focusRef: RefObject<HTMLElement | null> = layerRef,
  active = true,
): void {
  useLayoutEffect(() => {
    if (!active) return
    const layer = layerRef.current
    if (!layer) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const made: Element[] = []
    for (let node: Element | null = layer; node && node !== document.body; node = node.parentElement) {
      const parent: Element | null = node.parentElement
      if (!parent) break
      for (const sib of Array.from(parent.children)) {
        if (sib === node || sib.hasAttribute('inert')) continue
        if (sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE') continue
        sib.setAttribute('inert', '')
        made.push(sib)
      }
    }

    const target = focusRef.current ?? layer
    if (!target.contains(document.activeElement)) target.focus({ preventScroll: true })

    return () => {
      for (const el of made) el.removeAttribute('inert')
      // Only if focus is still ours to hand back — something the layer did on
      // its way out (opening another layer) keeps what it chose.
      const now = document.activeElement
      const ours = !now || now === document.body || layer.contains(now) || !now.isConnected
      if (ours && opener && opener.isConnected && opener !== document.body) {
        opener.focus({ preventScroll: true })
      }
    }
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
