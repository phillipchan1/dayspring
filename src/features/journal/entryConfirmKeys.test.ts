import { describe, expect, it } from 'vitest'
import { confirmKeyAction } from './EntryContextMenu'

const k = (key: string, mods: { metaKey?: boolean; ctrlKey?: boolean } = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  ...mods,
})

describe('delete confirm keys', () => {
  it('Return is Cancel — the default button of a destructive alert', () => {
    expect(confirmKeyAction(k('Enter'))).toBe('cancel')
  })
  it('Esc cancels', () => {
    expect(confirmKeyAction(k('Escape'))).toBe('cancel')
  })
  it('⌘⌫ confirms', () => {
    expect(confirmKeyAction(k('Backspace', { metaKey: true }))).toBe('confirm')
  })
  it('a held ⌘⌫ — the press that opened the confirm, repeating — does not confirm', () => {
    expect(confirmKeyAction({ ...k('Backspace', { metaKey: true }), repeat: true })).toBeNull()
  })
  it('a bare ⌫ does nothing', () => {
    expect(confirmKeyAction(k('Backspace'))).toBeNull()
  })
})
