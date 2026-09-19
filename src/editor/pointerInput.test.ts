// @vitest-environment jsdom
import { EditorState, Prec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { beforeEach, describe, expect, it } from 'vitest'
import { editorTap, TAP_HOLD_MS, TAP_SLOP, type TapContext } from './pointerInput'

/**
 * jsdom has no PointerEvent. The handlers only read pointerId, pointerType,
 * button and the client coords, so a MouseEvent carrying those is a faithful
 * stand-in — and keeps the test honest about which fields are actually used.
 */
function pointer(
  type: string,
  init: {
    pointerType?: string
    pointerId?: number
    x?: number
    y?: number
    button?: number
  } = {},
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    button: init.button ?? 0,
  })
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' })
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 })
  return event
}

let clock = 1000
const now = () => clock

interface Harness {
  view: EditorView
  taps: TapContext[]
  claims: TapContext[]
  /**
   * Event types that reached a handler sitting *below* `editorTap`.
   *
   * This is the property that matters for replay suppression: not "was
   * preventDefault called" — CodeMirror's own mouse handling calls that too —
   * but "did anything downstream get a second crack at a gesture we already
   * served".
   */
  downstream: string[]
  /** Dispatch a real event into the editor; true when `editorTap` took it. */
  send: (type: string, init?: Parameters<typeof pointer>[1]) => boolean
}

function harness(
  opts: {
    claims?: (ctx: TapContext) => boolean
    onTap?: (ctx: TapContext) => boolean
  } = {},
): Harness {
  const taps: TapContext[] = []
  const claims: TapContext[] = []
  const extension = editorTap(
    {
      claims: (ctx) => {
        claims.push(ctx)
        return opts.claims ? opts.claims(ctx) : true
      },
      onTap: (ctx) => {
        taps.push(ctx)
        return opts.onTap ? opts.onTap(ctx) : true
      },
    },
    now,
  )
  const downstream: string[] = []
  const probe = Prec.low(
    EditorView.domEventHandlers({
      mousedown: (e) => {
        downstream.push(e.type)
        return false
      },
      mouseup: (e) => {
        downstream.push(e.type)
        return false
      },
      click: (e) => {
        downstream.push(e.type)
        return false
      },
      pointerdown: (e) => {
        downstream.push(e.type)
        return false
      },
      pointerup: (e) => {
        downstream.push(e.type)
        return false
      },
    }),
  )
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    state: EditorState.create({ doc: 'one\ntwo', extensions: [extension, probe] }),
    parent,
  })

  const send = (type: string, init?: Parameters<typeof pointer>[1]) => {
    const before = downstream.length
    view.contentDOM.dispatchEvent(pointer(type, init))
    // `editorTap` returning true makes CodeMirror break the handler chain, so
    // the probe below it is the observable.
    return downstream.length === before
  }
  return { view, taps, claims, downstream, send }
}

beforeEach(() => {
  clock = 1000
})

describe('editorTap', () => {
  it('fires on press for a mouse — pressing is what a mouse means', () => {
    const h = harness()
    expect(h.send('pointerdown', { pointerType: 'mouse' })).toBe(true)
    expect(h.taps).toHaveLength(1)
    expect(h.taps[0]!.pointerType).toBe('mouse')
    h.view.destroy()
  })

  it('waits for release on a touch, then fires once', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    expect(h.taps).toHaveLength(0)
    clock += 80
    expect(h.send('pointerup', { pointerType: 'touch', x: 41, y: 40 })).toBe(true)
    expect(h.taps).toHaveLength(1)
    h.view.destroy()
  })

  it('ignores a press it does not claim, and never asks it to tap', () => {
    const h = harness({ claims: () => false })
    expect(h.send('pointerdown', { pointerType: 'touch' })).toBe(false)
    expect(h.send('pointerup', { pointerType: 'touch' })).toBe(false)
    expect(h.claims).toHaveLength(1)
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('a moved finger is a scroll, not a tap', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointermove', { pointerType: 'touch', x: 40, y: 40 + TAP_SLOP + 1 })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 + TAP_SLOP + 1 })
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('a small wobble still counts as a tap', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointermove', { pointerType: 'touch', x: 40, y: 40 + TAP_SLOP - 1 })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 + TAP_SLOP - 1 })
    expect(h.taps).toHaveLength(1)
    h.view.destroy()
  })

  it('a held press belongs to the system — the callout, not us', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    clock += TAP_HOLD_MS + 1
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('a cancelled gesture leaves nothing behind', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointercancel', { pointerType: 'touch' })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('a second finger does not complete the first finger’s tap', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', pointerId: 1, x: 40, y: 40 })
    h.send('pointerup', { pointerType: 'touch', pointerId: 2, x: 40, y: 40 })
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('swallows WebKit’s compatibility replay of a served touch', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })
    expect(h.taps).toHaveLength(1)

    // The burst WebKit sends ~300ms later for a tap it considers unhandled.
    clock += 300
    expect(h.send('mousedown', { x: 40, y: 40 })).toBe(true)
    expect(h.send('mouseup', { x: 40, y: 40 })).toBe(true)
    expect(h.send('click', { x: 40, y: 40 })).toBe(true)
    expect(h.taps).toHaveLength(1)
    h.view.destroy()
  })

  it('does not swallow a real mouse press that merely follows a touch', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })
    // Far too late to be the replay: a person clicking a moment afterwards.
    clock += 2000
    expect(h.send('mousedown', { x: 40, y: 40 })).toBe(false)
    h.view.destroy()
  })

  it('does not swallow a mouse press somewhere else on the page', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })
    clock += 300
    expect(h.send('mousedown', { x: 400, y: 400 })).toBe(false)
    h.view.destroy()
  })

  it('leaves the replay alone when the tap was not consumed', () => {
    const h = harness({ onTap: () => false })
    h.send('pointerdown', { pointerType: 'touch', x: 40, y: 40 })
    expect(h.send('pointerup', { pointerType: 'touch', x: 40, y: 40 })).toBe(false)
    clock += 300
    expect(h.send('mousedown', { x: 40, y: 40 })).toBe(false)
    h.view.destroy()
  })

  it('leaves a mouse’s secondary button to the context menu', () => {
    const h = harness()
    expect(h.send('pointerdown', { pointerType: 'mouse', button: 2 })).toBe(false)
    expect(h.claims).toHaveLength(0)
    expect(h.taps).toHaveLength(0)
    h.view.destroy()
  })

  it('reports the pointer that pressed, so handlers can ask', () => {
    const h = harness()
    h.send('pointerdown', { pointerType: 'pen', x: 5, y: 6 })
    h.send('pointerup', { pointerType: 'pen', x: 5, y: 6 })
    expect(h.taps[0]!.pointerType).toBe('pen')
    expect(h.claims[0]!.pointerType).toBe('pen')
    h.view.destroy()
  })
})
