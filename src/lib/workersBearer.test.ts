import { afterEach, describe, expect, it } from 'vitest'
import {
  captureSignedBearer,
  clearWorkersBearer,
  isSignedWorkersBearer,
  readWorkersBearer,
  rememberWorkersBearer,
  WORKERS_BEARER_KEY,
} from './workersBearer'
import { getWorkersToken } from './authClient'

afterEach(() => {
  clearWorkersBearer()
})

describe('signed Workers bearer', () => {
  it('rejects a raw DB session token', () => {
    expect(isSignedWorkersBearer('raw-session-token')).toBe(false)
    rememberWorkersBearer('raw-session-token')
    expect(readWorkersBearer()).toBeNull()
    expect(localStorage.getItem(WORKERS_BEARER_KEY)).toBeNull()
  })

  it('stores the signed set-auth-token form', () => {
    const signed = 'sessiontoken.hmac-signature'
    rememberWorkersBearer(signed)
    expect(isSignedWorkersBearer(signed)).toBe(true)
    expect(readWorkersBearer()).toBe(signed)
  })

  it('captures set-auth-token and ignores session.token-shaped values', () => {
    const headers = new Headers({ 'set-auth-token': 'abc.def' })
    expect(captureSignedBearer(headers)).toBe('abc.def')
    expect(readWorkersBearer()).toBe('abc.def')
    expect(captureSignedBearer(new Headers({ 'set-auth-token': 'unsigned' }))).toBeNull()
    expect(readWorkersBearer()).toBeNull()
  })

  it('getWorkersToken returns only the signed stored bearer', async () => {
    expect(await getWorkersToken()).toBeNull()
    rememberWorkersBearer('tok.sig')
    expect(await getWorkersToken()).toBe('tok.sig')
  })
})
