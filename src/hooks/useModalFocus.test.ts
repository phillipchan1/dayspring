// @vitest-environment jsdom
import { act, createElement, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useModalFocus } from './useModalFocus'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Layer() {
  const layer = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useModalFocus(layer, dialog)
  return createElement(
    'div',
    { ref: layer, id: 'layer' },
    createElement('div', { ref: dialog, id: 'dialog', tabIndex: -1 }, createElement('button', { id: 'inside' }, 'ok')),
  )
}

let setOpen: (v: boolean) => void = () => {}
function App() {
  const [open, set] = useState(false)
  setOpen = set
  return createElement(
    'div',
    { id: 'app' },
    createElement('main', { id: 'shell' }, createElement('button', { id: 'opener' }, 'Settings')),
    open ? createElement(Layer) : null,
  )
}

describe('useModalFocus', () => {
  it('makes the app behind inert, moves focus in, and hands it back on close', () => {
    const host = document.createElement('div')
    const elsewhere = document.createElement('aside')
    document.body.append(host, elsewhere)
    const root = createRoot(host)
    act(() => root.render(createElement(App)))

    const opener = document.getElementById('opener') as HTMLButtonElement
    opener.focus()
    act(() => setOpen(true))

    expect(document.getElementById('shell')!.hasAttribute('inert')).toBe(true)
    expect(elsewhere.hasAttribute('inert')).toBe(true)
    expect(document.getElementById('layer')!.hasAttribute('inert')).toBe(false)
    expect(document.activeElement?.id).toBe('dialog')

    act(() => setOpen(false))
    expect(document.getElementById('shell')!.hasAttribute('inert')).toBe(false)
    expect(elsewhere.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)

    act(() => root.unmount())
    host.remove()
    elsewhere.remove()
  })

  it('leaves alone what was already inert', () => {
    const host = document.createElement('div')
    const already = document.createElement('section')
    already.setAttribute('inert', '')
    document.body.append(host, already)
    const root = createRoot(host)
    act(() => root.render(createElement(App)))
    act(() => setOpen(true))
    act(() => setOpen(false))
    expect(already.hasAttribute('inert')).toBe(true)
    act(() => root.unmount())
    host.remove()
    already.remove()
  })

  it('lets go the moment the layer starts closing, while it is still on screen', async () => {
    let setActive: (v: boolean) => void = () => {}
    function Closing() {
      const [active, set] = useState(true)
      setActive = set
      const layer = useRef<HTMLDivElement>(null)
      useModalFocus(layer, layer, active)
      return createElement('div', { ref: layer, id: 'closing-layer', tabIndex: -1 })
    }
    const host = document.createElement('div')
    const shell = document.createElement('main')
    const opener = document.createElement('button')
    shell.append(opener)
    document.body.append(shell, host)
    opener.focus()
    const root = createRoot(host)
    act(() => root.render(createElement(Closing)))
    expect(shell.hasAttribute('inert')).toBe(true)
    // Async: focus is handed back after React's commit (see the hook).
    await act(async () => setActive(false))
    expect(document.getElementById('closing-layer')).toBeTruthy()
    expect(shell.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
    act(() => root.unmount())
    host.remove()
    shell.remove()
  })
})

