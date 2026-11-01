// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ tauri: false }))
vi.mock('@/lib/platform', () => ({ isTauri: () => platform.tauri }))

const { untilHandoffSettles } = await import('./handoff')

const settled = async (p: Promise<void>) => {
  let done = false
  void p.then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

describe('untilHandoffSettles', () => {
  // The system browser has the checkout; the app is still here.
  it('is over at once in the app', async () => {
    platform.tauri = true
    expect(await settled(untilHandoffSettles())).toBe(true)
  })

  // The tab itself is navigating: keep the button saying so until it comes back.
  it('waits on the web for the page to come back', async () => {
    platform.tauri = false
    const back = untilHandoffSettles()
    expect(await settled(back)).toBe(false)
    window.dispatchEvent(new Event('pageshow'))
    expect(await settled(back)).toBe(true)
  })

  it('also lets go when focus returns', async () => {
    platform.tauri = false
    const back = untilHandoffSettles()
    window.dispatchEvent(new Event('focus'))
    expect(await settled(back)).toBe(true)
  })
})
