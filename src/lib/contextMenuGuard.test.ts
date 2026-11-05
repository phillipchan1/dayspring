// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { allowsNativeContextMenu } from './contextMenuGuard'

describe('allowsNativeContextMenu', () => {
  it('lets the system menu through where it is the right one', () => {
    document.body.innerHTML = `
      <div class="cm-editor"><div class="cm-content"><span id="word">grace</span></div></div>
      <input id="email" type="email" />
      <textarea id="draft"></textarea>
      <div data-entry-row><span id="row">An entry</span></div>
      <figure data-native-context-menu><img id="photo" /></figure>
      <div contenteditable="true" id="ce"></div>`
    for (const id of ['word', 'email', 'draft', 'row', 'photo']) {
      expect([id, allowsNativeContextMenu(document.getElementById(id))]).toEqual([id, true])
    }
  })

  it('blocks it on chrome, buttons and non-text inputs', () => {
    document.body.innerHTML = `
      <nav class="rail"><button id="btn">Pages</button><span id="label">Return</span></nav>
      <input id="check" type="checkbox" />`
    for (const id of ['btn', 'label', 'check']) {
      expect([id, allowsNativeContextMenu(document.getElementById(id))]).toEqual([id, false])
    }
    expect(allowsNativeContextMenu(null)).toBe(false)
  })
})
