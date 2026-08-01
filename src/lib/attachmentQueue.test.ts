import { describe, expect, it } from 'vitest'
import { bodyHasPending, replacePendingRef } from './attachmentQueue'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const HASH = 'a'.repeat(64)

describe('bodyHasPending', () => {
  it('finds the placeholder for the given upload', () => {
    expect(bodyHasPending(`before\n\n![](attachment-pending:${A})\n\nafter`, A)).toBe(true)
  })

  it('does not match a different upload', () => {
    expect(bodyHasPending(`![](attachment-pending:${B})`, A)).toBe(false)
  })

  it('is false for a body with no placeholders', () => {
    expect(bodyHasPending('just prose', A)).toBe(false)
  })

  it('is not confused by an already-resolved attachment ref', () => {
    expect(bodyHasPending(`![](attachment:${HASH}.jpg)`, A)).toBe(false)
  })

  it('survives repeated calls — the shared regex is stateful (lastIndex)', () => {
    const body = `![](attachment-pending:${A})`
    expect(bodyHasPending(body, A)).toBe(true)
    expect(bodyHasPending(body, A)).toBe(true)
    expect(bodyHasPending(body, A)).toBe(true)
  })
})

describe('replacePendingRef', () => {
  it('swaps the placeholder for the real ref', () => {
    const body = `morning\n\n![](attachment-pending:${A})\n\nevening`
    expect(replacePendingRef(body, A, { hash: HASH, ext: 'jpg' })).toBe(
      `morning\n\n![](attachment:${HASH}.jpg)\n\nevening`,
    )
  })

  it('keeps a caption written while the photo was queued', () => {
    const body = `![the old oak](attachment-pending:${A})`
    expect(replacePendingRef(body, A, { hash: HASH, ext: 'png' })).toBe(
      `![the old oak](attachment:${HASH}.png)`,
    )
  })

  it('leaves other pending photos alone', () => {
    const body = `![](attachment-pending:${A})\n\n![](attachment-pending:${B})`
    const out = replacePendingRef(body, A, { hash: HASH, ext: 'jpg' })
    expect(out).toContain(`attachment:${HASH}.jpg`)
    expect(out).toContain(`attachment-pending:${B}`)
  })

  it('removes the placeholder when the upload is abandoned', () => {
    const body = `kept\n\n![](attachment-pending:${A})\n\nalso kept`
    expect(replacePendingRef(body, A, null)).toBe('kept\n\n\n\nalso kept')
  })

  it('leaves a body with no matching placeholder byte-identical', () => {
    // rewriteEntryBodies skips an unchanged body, so this is what stops the
    // drain queueing a pointless write against every entry in the journal.
    const body = `prose\n\n![](attachment:${HASH}.jpg)\n\n![](attachment-pending:${B})`
    expect(replacePendingRef(body, A, { hash: HASH, ext: 'jpg' })).toBe(body)
  })

  it('handles several placeholders for the same upload', () => {
    const body = `![](attachment-pending:${A})\n\n![](attachment-pending:${A})`
    const out = replacePendingRef(body, A, { hash: HASH, ext: 'jpg' })
    expect(out).toBe(`![](attachment:${HASH}.jpg)\n\n![](attachment:${HASH}.jpg)`)
  })
})
