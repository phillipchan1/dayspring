// Draws a set of photo tiles as rows — the DOM half of `layoutPhotoRows`.
//
// Shared by the editor's set widget and the reader's set figure so a set looks
// the same while it is being written and when it is read back.

import { PHOTO_ROW_GAP, PHOTO_ROW_MAX_HEIGHT, layoutPhotoRows, photoRatio } from './photoSet'

export interface PhotoRowItem {
  /** The tile. Its width and height are set here; everything inside is the caller's. */
  el: HTMLElement
  /** Width over height. Pass `photoRatio()` of nothing when it is not known yet. */
  ratio: number
  /** False while the ratio is a stand-in; the photo's own shape replaces it on load. */
  known: boolean
  /** The image inside the tile, if there is one to learn the shape from. */
  img?: HTMLImageElement | null
}

export interface PhotoRowsOptions {
  /** Class for each row wrapper. */
  rowClass: string
  /** Column width to lay out at before the container has been measured. */
  fallbackWidth?: number
  /** The rows changed height (the editor re-measures its block). */
  onLayout?: () => void
  /** A photo with no stored size has loaded and shown its real shape. */
  onLearnRatio?: (index: number, ratio: number) => void
}

export interface PhotoRowsHandle {
  /** Give the photos their real shapes once they are known, in one re-flow. */
  setRatios: (next: readonly (number | null)[]) => void
  destroy: () => void
}

/**
 * Lay `items` out as rows inside `container` and keep them laid out as the
 * column changes width. Tiles are moved between row wrappers, never recreated,
 * so a loaded image stays loaded through a re-flow.
 */
export function mountPhotoRows(
  container: HTMLElement,
  items: PhotoRowItem[],
  options: PhotoRowsOptions,
): PhotoRowsHandle {
  const ratios = items.map((item) => item.ratio)
  const known = items.map((item) => item.known)
  let width = 0
  let alive = true
  let mounted = false

  // The rows are laid out in pixels, and pixels have a minimum width. Left in
  // the flow they would hold the column open at whatever width they were laid
  // out for: the column could then never get narrower, so the measurement that
  // would re-flow them never came, and the page scrolled sideways instead. So
  // the rows sit out of the flow, on a stage whose height is set by hand. The
  // stage has no width of its own to insist on; it takes the column's.
  const doc = container.ownerDocument
  const stage = doc.createElement('div')
  stage.style.display = 'flex'
  stage.style.flexDirection = 'column'
  stage.style.gap = `${PHOTO_ROW_GAP}px`
  container.style.position = 'relative'
  // Until a narrower column has been measured the old rows are still too wide.
  container.style.overflow = 'hidden'
  container.replaceChildren(stage)

  // No width to measure yet (the surface is not laid out). The tiles still have
  // to be in the document, so they wait in one wrapping row that the browser
  // sizes by ratio; the first real measurement replaces it.
  const park = () => {
    const rowEl = doc.createElement('div')
    rowEl.className = options.rowClass
    rowEl.style.display = 'flex'
    rowEl.style.flexWrap = 'wrap'
    rowEl.style.gap = `${PHOTO_ROW_GAP}px`
    items.forEach((item, i) => {
      item.el.style.flex = `${ratios[i]} 1 ${Math.round(ratios[i]! * 140)}px`
      item.el.style.aspectRatio = String(ratios[i])
      rowEl.append(item.el)
    })
    stage.style.position = ''
    stage.style.inset = ''
    container.style.height = ''
    stage.replaceChildren(rowEl)
  }

  const apply = (next: number) => {
    if (!alive) return
    if (next <= 0) {
      if (width <= 0) park()
      return
    }
    width = next
    // The cap a lone photo has in the editor and the reader: min(56vh, 480px).
    const viewport = doc.defaultView?.innerHeight ?? 0
    const maxHeight = viewport > 0 ? Math.min(PHOTO_ROW_MAX_HEIGHT, viewport * 0.56) : PHOTO_ROW_MAX_HEIGHT
    const rows = layoutPhotoRows(ratios, width, maxHeight)
    const rowEls = rows.map((row) => {
      const rowEl = doc.createElement('div')
      rowEl.className = options.rowClass
      rowEl.style.display = 'flex'
      rowEl.style.gap = `${PHOTO_ROW_GAP}px`
      rowEl.style.justifyContent = row.justified ? 'flex-start' : 'center'
      for (let i = row.start; i < row.start + row.count; i++) {
        const tile = items[i]!.el
        tile.style.flex = ''
        tile.style.aspectRatio = ''
        // Floor to a hundredth so rounding can never push a full row past the column.
        tile.style.width = `${Math.floor(ratios[i]! * row.height * 100) / 100}px`
        tile.style.height = `${row.height}px`
        rowEl.append(tile)
      }
      return rowEl
    })
    stage.style.position = 'absolute'
    stage.style.inset = '0'
    const height = rows.reduce((sum, row) => sum + row.height, 0) + PHOTO_ROW_GAP * (rows.length - 1)
    container.style.height = `${height}px`
    stage.replaceChildren(...rowEls)
    // Not on the first pass: that one runs while the caller is still building.
    if (mounted) options.onLayout?.()
  }

  apply(container.clientWidth || options.fallbackWidth || 0)
  mounted = true

  items.forEach((item, index) => {
    if (item.known || !item.img) return
    const img = item.img
    const learn = () => {
      if (!alive || known[index] || !img.naturalWidth || !img.naturalHeight) return
      const ratio = photoRatio(img.naturalWidth, img.naturalHeight)
      if (Math.abs(ratio - ratios[index]!) < 0.01) return
      ratios[index] = ratio
      options.onLearnRatio?.(index, ratio)
      apply(width)
    }
    if (img.complete && img.naturalWidth > 0) learn()
    else img.addEventListener('load', learn, { once: true })
  })

  let observer: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0
      if (next > 0 && Math.abs(next - width) >= 0.5) apply(next)
    })
    observer.observe(container)
  }

  return {
    setRatios(next) {
      let changed = false
      next.forEach((ratio, index) => {
        if (ratio === null || index >= ratios.length) return
        known[index] = true
        if (ratios[index] !== ratio) {
          ratios[index] = ratio
          changed = true
        }
      })
      if (changed) apply(width)
    },
    destroy() {
      alive = false
      observer?.disconnect()
    },
  }
}
