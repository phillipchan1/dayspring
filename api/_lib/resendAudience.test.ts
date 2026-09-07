import { describe, expect, it } from 'vitest'
import {
  accountContactsFromAuthUsers,
  nameFromAuthMetadata,
  planAudienceSync,
  removeAccountContact,
  syncAccountAudience,
  upsertAccountContact,
  type ResendRequest,
  type ResendResponse,
  type ResendTransport,
} from './resendAudience.js'

function fakeTransport(handler: (req: ResendRequest) => ResendResponse | Promise<ResendResponse>): {
  transport: ResendTransport
  calls: ResendRequest[]
} {
  const calls: ResendRequest[] = []
  return {
    calls,
    transport: async (req) => {
      calls.push(req)
      return handler(req)
    },
  }
}

describe('nameFromAuthMetadata', () => {
  it('reads Google-style full_name', () => {
    expect(nameFromAuthMetadata({ full_name: 'Ada Lovelace' })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
  })

  it('reads Apple-style full_name object', () => {
    expect(
      nameFromAuthMetadata({ full_name: { givenName: 'Ada', familyName: 'Lovelace' } }),
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('prefers given_name / family_name', () => {
    expect(
      nameFromAuthMetadata({ given_name: 'Ada', family_name: 'Lovelace', name: 'Ignored' }),
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
  })

  it('returns empty when nothing usable is present', () => {
    expect(nameFromAuthMetadata({})).toEqual({})
    expect(nameFromAuthMetadata(undefined)).toEqual({})
  })
})

describe('accountContactsFromAuthUsers', () => {
  it('drops users without email and lowercases the rest', () => {
    expect(
      accountContactsFromAuthUsers([
        { email: 'A@Example.com', user_metadata: { full_name: 'Ada Lovelace' } },
        { email: null },
        { email: '  ' },
        { email: 'a@example.com', user_metadata: { full_name: 'Duplicate' } },
      ]),
    ).toEqual([{ email: 'a@example.com', firstName: 'Ada', lastName: 'Lovelace' }])
  })
})

describe('planAudienceSync', () => {
  it('upserts every current account and drops leftovers', () => {
    const plan = planAudienceSync(
      [{ email: 'ada@example.com' }, { email: 'Alan@Example.com' }],
      ['ada@example.com', 'gone@example.com'],
    )
    expect(plan.upsert.map((c) => c.email).sort()).toEqual(['ada@example.com', 'alan@example.com'])
    expect(plan.remove).toEqual(['gone@example.com'])
  })

  it('does not remove anyone who still has an account', () => {
    const plan = planAudienceSync([{ email: 'ada@example.com' }], ['ada@example.com'])
    expect(plan.remove).toEqual([])
  })
})

describe('upsertAccountContact', () => {
  it('creates a subscribed contact on the accounts segment', async () => {
    const { transport, calls } = fakeTransport(() => ({ status: 200, json: { id: 'c1' } }))
    await expect(
      upsertAccountContact(transport, { email: 'Ada@Example.com', firstName: 'Ada' }, 'seg_1'),
    ).resolves.toBe('created')

    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/contacts',
      body: {
        email: 'ada@example.com',
        first_name: 'Ada',
        unsubscribed: false,
        segments: [{ id: 'seg_1' }],
      },
    })
  })

  it('updates an existing contact without touching unsubscribed', async () => {
    const { transport, calls } = fakeTransport((req) => {
      if (req.method === 'POST' && req.path === '/contacts') {
        return { status: 409, json: { message: 'Contact already exists' } }
      }
      return { status: 200, json: {} }
    })

    await expect(
      upsertAccountContact(
        transport,
        { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
        'seg_1',
      ),
    ).resolves.toBe('updated')

    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.path).toBe('/contacts/ada%40example.com')
    expect(patch?.body).toEqual({ first_name: 'Ada', last_name: 'Lovelace' })
    expect(JSON.stringify(patch?.body)).not.toContain('unsubscribed')

    const add = calls.find((c) => c.path.includes('/segments/'))
    expect(add).toEqual({
      method: 'POST',
      path: '/contacts/ada%40example.com/segments/seg_1',
    })
  })
})

describe('removeAccountContact', () => {
  it('treats a missing contact as already gone', async () => {
    const { transport } = fakeTransport(() => ({ status: 404, json: { message: 'not found' } }))
    await expect(removeAccountContact(transport, 'gone@example.com')).resolves.toBeUndefined()
  })
})

describe('syncAccountAudience', () => {
  it('creates the named segment, upserts accounts, and deletes leftovers', async () => {
    const segmentContacts = [{ id: 'old', email: 'gone@example.com' }]
    const { transport } = fakeTransport((req) => {
      if (req.path.startsWith('/segments/seg_new/contacts')) {
        return { status: 200, json: { data: segmentContacts, has_more: false } }
      }
      if (req.path.startsWith('/segments') && req.method === 'GET') {
        return { status: 200, json: { data: [], has_more: false } }
      }
      if (req.path === '/segments' && req.method === 'POST') {
        return { status: 200, json: { id: 'seg_new', name: 'Dayspring accounts' } }
      }
      if (req.method === 'POST' && req.path === '/contacts') {
        return { status: 200, json: { id: 'c1' } }
      }
      if (req.method === 'DELETE') {
        return { status: 200, json: { deleted: true } }
      }
      return { status: 500, json: { message: `unexpected ${req.method} ${req.path}` } }
    })

    const result = await syncAccountAudience(
      transport,
      [{ email: 'ada@example.com', firstName: 'Ada' }],
      { segmentName: 'Dayspring accounts' },
    )

    expect(result.segmentId).toBe('seg_new')
    expect(result.upserted).toBe(1)
    expect(result.removed).toBe(1)
    expect(result.errors).toEqual([])
  })
})
