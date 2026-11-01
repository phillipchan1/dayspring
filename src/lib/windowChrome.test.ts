// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeTopLayerOrHide,
  cssColorToHex,
  isInteractive,
  openLayerCount,
  pressEscape,
  syncNativeAppearance,
} from './windowChrome'

/** jsdom lays nothing out; give an element a box so it counts as shown. */
function shown<T extends HTMLElement>(el: T): T {
  el.getClientRects = () => [{} as DOMRect] as unknown as DOMRectList
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('cssColorToHex', () => {
  it('reads the forms getComputedStyle hands back', () => {
    expect(cssColorToHex('rgb(224, 166, 78)')).toBe('#e0a64e')
    expect(cssColorToHex('rgba(20, 22, 29, 0.5)')).toBe('#14161d')
    expect(cssColorToHex('rgb(224 166 78)')).toBe('#e0a64e')
    expect(cssColorToHex('color(srgb 0.8784 0.651 0.3059)')).toBe('#e0a64e')
    expect(cssColorToHex('#FBF6EE')).toBe('#fbf6ee')
  })

  it('gives up on anything else rather than guess', () => {
    expect(cssColorToHex('')).toBeNull()
    expect(cssColorToHex('transparent')).toBeNull()
    expect(cssColorToHex('var(--accent)')).toBeNull()
  })
})

describe('the top layer', () => {
  it('counts the open dialogs, sheets and menus, not hidden ones', () => {
    expect(openLayerCount()).toBe(0)
    const dialog = shown(document.createElement('div'))
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    const menu = shown(document.createElement('div'))
    menu.setAttribute('role', 'menu')
    document.body.appendChild(menu)
    const unmounted = document.createElement('div')
    unmounted.setAttribute('aria-modal', 'true')
    document.body.appendChild(unmounted)
    expect(openLayerCount()).toBe(2)
  })

  it('presses Escape on the focused element', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const onKey = vi.fn((e: KeyboardEvent) => e.preventDefault())
    input.addEventListener('keydown', onKey)
    expect(pressEscape()).toBe(true)
    expect(onKey.mock.calls[0]![0]).toMatchObject({ key: 'Escape', keyCode: 27 })
  })

  it('hides the window when nothing is open', async () => {
    await expect(closeTopLayerOrHide()).resolves.toBe(true)
  })

  it('closes the open layer instead of hiding', async () => {
    const sheet = shown(document.createElement('div'))
    sheet.setAttribute('aria-modal', 'true')
    document.body.appendChild(sheet)
    const close = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      sheet.remove()
    }
    window.addEventListener('keydown', close, true)
    await expect(closeTopLayerOrHide()).resolves.toBe(false)
    window.removeEventListener('keydown', close, true)
  })

  it('hides anyway when Escape closed nothing', async () => {
    const stuck = shown(document.createElement('div'))
    stuck.setAttribute('role', 'dialog')
    document.body.appendChild(stuck)
    await expect(closeTopLayerOrHide()).resolves.toBe(true)
  })
})

describe('isInteractive', () => {
  it('keeps controls, fields, the editor and scrims out of the drag strip', () => {
    document.body.innerHTML = `
      <header class="frame-bar"><span id="label">Pages</span><button id="b"><span id="in">x</span></button></header>
      <div class="cm-editor"><div id="cm"></div></div>
      <div class="command-popover__scrim" id="scrim"></div>
      <input id="i" />`
    const el = (id: string) => document.getElementById(id)
    expect(isInteractive(el('label'))).toBe(false)
    expect(isInteractive(el('in'))).toBe(true)
    expect(isInteractive(el('cm'))).toBe(true)
    expect(isInteractive(el('scrim'))).toBe(true)
    expect(isInteractive(el('i'))).toBe(true)
    expect(isInteractive(null)).toBe(true)
  })
})

describe('syncNativeAppearance', () => {
  it('is a no-op on the web', () => {
    expect(() => syncNativeAppearance('dark')).not.toThrow()
  })
})
