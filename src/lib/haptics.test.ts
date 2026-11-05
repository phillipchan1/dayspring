// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }))

const platform = { mobile: false }
vi.mock('./platform', () => ({ isMobileTauri: () => platform.mobile }))

import { haptic, hapticCommand } from './haptics'

afterEach(() => {
  invoke.mockReset()
  platform.mobile = false
})

describe('haptic', () => {
  it('does nothing on the web (and the Mac)', () => {
    haptic('success')
    haptic('selection')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('returns nothing the caller could wait on', () => {
    expect(haptic('light')).toBeUndefined()
  })

  it('fires the plugin command on a phone', () => {
    platform.mobile = true
    invoke.mockResolvedValue(undefined)
    haptic('medium')
    expect(invoke).toHaveBeenCalledWith('plugin:haptics|impact_feedback', { style: 'medium' })
  })

  it('never throws, even when the bridge does', () => {
    platform.mobile = true
    invoke.mockImplementation(() => {
      throw new Error('no bridge')
    })
    expect(() => haptic('error')).not.toThrow()
    invoke.mockRejectedValue(new Error('no plugin'))
    expect(() => haptic('warning')).not.toThrow()
  })
})

describe('hapticCommand', () => {
  it('maps each kind to the plugin call the audit names', () => {
    expect(hapticCommand('selection')).toEqual({ cmd: 'plugin:haptics|selection_feedback' })
    expect(hapticCommand('light')).toEqual({
      cmd: 'plugin:haptics|impact_feedback',
      args: { style: 'light' },
    })
    expect(hapticCommand('success')).toEqual({
      cmd: 'plugin:haptics|notification_feedback',
      args: { type: 'success' },
    })
    expect(hapticCommand('error')).toEqual({
      cmd: 'plugin:haptics|notification_feedback',
      args: { type: 'error' },
    })
  })
})
