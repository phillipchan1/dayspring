import { describe, expect, it } from 'vitest'
import {
  decideSave,
  draftSession,
  observeText,
  persistedSession,
  savedSession,
} from './saveSession'

describe('saveSession', () => {
  it('creates a draft that started blank, reusing its pre-allocated id', () => {
    const s = draftSession('', 'draft-1')
    expect(decideSave(s, 'morning lord jesus')).toEqual({ action: 'create', id: 'draft-1' })
  })

  it('REGRESSION (duplicate entries): a draft holding text it did not start from is blocked', () => {
    // The torn navigation state: entryId became null while the editor still
    // held an existing entry's body. Four shipped fixes each patched one path
    // into this state; this is the backstop that makes it unsaveable.
    const torn = draftSession('okay finished trading sessin\n\ntook a B setup…', 'draft-1')
    expect(decideSave(torn, 'okay finished trading sessin\n\ntook a B setup…')).toEqual({
      action: 'blocked',
    })
    // Even with further typing appended, still blocked — saving would mint a
    // near-duplicate of the entry the text came from.
    expect(decideSave(torn, 'okay finished trading sessin\n\ntook a B setup… more')).toEqual({
      action: 'blocked',
    })
  })

  it('a blocked draft earns create rights once the editor is cleared', () => {
    let s = draftSession('stale body from another entry', 'draft-1')
    expect(decideSave(s, 'stale body from another entry')).toEqual({ action: 'blocked' })
    s = observeText(s, '') // parent cleared the editor (e.g. real new-entry flow)
    expect(decideSave(s, 'fresh words')).toEqual({ action: 'create', id: 'draft-1' })
  })

  it('REGRESSION (double-create race): every create decision for one session targets the same id', () => {
    // Two flushes racing (debounce timer + visibilitychange) both see an
    // unsaved draft. Both must converge on the same row id so the second is an
    // upsert of the first, never a second insert.
    const s = draftSession('', 'draft-1')
    const first = decideSave(s, 'hello')
    const second = decideSave(s, 'hello world')
    expect(first).toEqual({ action: 'create', id: 'draft-1' })
    expect(second).toEqual({ action: 'create', id: 'draft-1' })
  })

  it('after a successful create, the session updates the same row', () => {
    let s = draftSession('', 'draft-1')
    expect(decideSave(s, 'hello')).toEqual({ action: 'create', id: 'draft-1' })
    s = savedSession(s, 'hello')
    expect(decideSave(s, 'hello')).toEqual({ action: 'none' })
    expect(decideSave(s, 'hello world')).toEqual({ action: 'update', id: 'draft-1' })
  })

  it('never creates empty rows, but persists clearing an existing entry', () => {
    expect(decideSave(draftSession('', 'draft-1'), '   \n')).toEqual({ action: 'none' })
    const existing = persistedSession('row-9', 'old body')
    expect(decideSave(existing, '')).toEqual({ action: 'update', id: 'row-9' })
  })

  it('does nothing when text matches the last persisted text', () => {
    expect(decideSave(persistedSession('row-9', 'same'), 'same')).toEqual({ action: 'none' })
    expect(decideSave(draftSession('', 'draft-1'), '')).toEqual({ action: 'none' })
  })

  it('observeText never grants create rights to non-blank inherited text', () => {
    let s = draftSession('inherited body', 'draft-1')
    s = observeText(s, 'inherited body')
    s = observeText(s, 'inherited body plus typing')
    expect(decideSave(s, 'inherited body plus typing')).toEqual({ action: 'blocked' })
  })

  it('full duplicate scenario: tear → device switch flush is refused end-to-end', () => {
    // 1. User reads entry A, navigation tears identity from text:
    let s = draftSession('entry A body', 'draft-1')
    // 2. User cmd-tabs to the other device → visibilitychange flush:
    expect(decideSave(s, 'entry A body')).toEqual({ action: 'blocked' }) // was: duplicate of A
    // 3. User explicitly starts a new entry (editor cleared), writes, saves:
    s = observeText(s, '')
    expect(decideSave(s, 'tonight: grateful')).toEqual({ action: 'create', id: 'draft-1' })
    s = savedSession(s, 'tonight: grateful')
    // 4. Late stale-closure flush re-fires with the same text → no-op:
    expect(decideSave(s, 'tonight: grateful')).toEqual({ action: 'none' })
  })
})
