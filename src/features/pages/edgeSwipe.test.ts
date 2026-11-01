import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EDGE_PX, PUSH_MS, fromLeadingEdge } from './edgeSwipe'

describe('fromLeadingEdge', () => {
  it('takes a touch inside the leading strip', () => {
    expect(fromLeadingEdge(0)).toBe(true)
    expect(fromLeadingEdge(12)).toBe(true)
    expect(fromLeadingEdge(EDGE_PX)).toBe(true)
  })

  it('leaves the rest of the view its own touches — the prose stays selectable', () => {
    expect(fromLeadingEdge(EDGE_PX + 1)).toBe(false)
    expect(fromLeadingEdge(180)).toBe(false)
  })

  it('ignores a touch that began left of the surface (a panel narrower than the screen)', () => {
    expect(fromLeadingEdge(-4)).toBe(false)
  })

  it('is about the width of UIKit’s edge pan', () => {
    expect(EDGE_PX).toBeGreaterThanOrEqual(20)
    expect(EDGE_PX).toBeLessThanOrEqual(30)
  })
})

describe('PUSH_MS', () => {
  it('is --dur-push: the view stays mounted exactly as long as its exit transition runs', () => {
    const themes = readFileSync(resolve(__dirname, '../../styles/themes.css'), 'utf8')
    const m = themes.match(/--dur-push:\s*(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(PUSH_MS)
  })
})
