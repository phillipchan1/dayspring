import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openWireSql, type WireSql } from '../testPg.ts'
import { createPgRestClient, type PgRestClient } from './pgrest.ts'

const A = 'pgrest-user-a'
const B = 'pgrest-user-b'
const TOKEN = 'session-token-a'

let wire: WireSql
let sb: PgRestClient

beforeAll(async () => {
  wire = await openWireSql()
  const { sql } = wire
  await sql`DELETE FROM "user" WHERE id IN (${A}, ${B})`
  await sql`INSERT INTO "user" (id, name, email, image, created_at) VALUES
    (${A}, 'Ann', 'ann@example.test', 'https://img.test/a.png', '2026-01-01T00:00:00Z'),
    (${B}, 'Bob', 'bob@example.test', NULL, '2026-01-02T00:00:00Z')`
  await sql`INSERT INTO account (id, account_id, provider_id, user_id) VALUES ('acc-a', 'g-1', 'google', ${A})`
  sb = createPgRestClient(sql, { resolveToken: async (t) => (t === TOKEN ? A : null) })
}, 60_000)

afterAll(async () => {
  if (!wire) return
  await wire.sql`DELETE FROM "user" WHERE id IN (${A}, ${B})`.catch(() => {})
  await wire.close()
})

describe('pgrest shim (supabase-js surface over postgres.js)', () => {
  it('insert returns rows with jsonb as objects and arrays as arrays', async () => {
    const { data, error } = await sb.from('entries').insert([
      { owner: A, body_markdown: 'first <!-- ritual:x -->', title: 'One', tags: ['a', 'b'], circumstances: { place: 'home', n: 1 }, created_at: '2026-02-01T10:00:00.000Z' },
      { owner: A, body_markdown: 'second', title: 'Two', tags: [], circumstances: {}, created_at: '2026-02-02T10:00:00.000Z' },
      { owner: B, body_markdown: 'bob', title: null, tags: [], circumstances: {}, created_at: '2026-02-03T10:00:00.000Z' },
    ]).select('id, owner, title, tags, circumstances, created_at')
    expect(error).toBeNull()
    const rows = data as Array<Record<string, unknown>>
    expect(rows).toHaveLength(3)
    expect(rows[0].circumstances).toEqual({ place: 'home', n: 1 })
    expect(rows[0].tags).toEqual(['a', 'b'])
    expect(typeof rows[0].created_at).toBe('string')
    expect(new Date(String(rows[0].created_at)).toISOString()).toBe('2026-02-01T10:00:00.000Z')
    const stored = await wire.sql<{ t: string }[]>`SELECT jsonb_typeof(circumstances) AS t FROM entries WHERE owner = ${A} AND title = 'One'`
    expect(stored[0].t).toBe('object')
  })

  it('select filters, order, range, count, head, single, maybeSingle', async () => {
    const all = await sb.from('entries').select('title').eq('owner', A).order('created_at', { ascending: false })
    expect((all.data as Array<{ title: string }>).map((r) => r.title)).toEqual(['Two', 'One'])
    const ranged = await sb.from('entries').select('title').eq('owner', A).order('created_at').range(1, 1)
    expect(ranged.data).toEqual([{ title: 'Two' }])
    const counted = await sb.from('entries').select('id', { count: 'exact', head: true }).eq('owner', A)
    expect(counted.count).toBe(2)
    expect(counted.data).toBeNull()
    const inList = await sb.from('entries').select('title').in('owner', [A, B]).is('title', null)
    expect(inList.data).toEqual([{ title: null }])
    const notNull = await sb.from('entries').select('title').not('title', 'is', null).eq('owner', A).gte('created_at', '2026-02-02T00:00:00Z')
    expect(notNull.data).toEqual([{ title: 'Two' }])
    const like = await sb.from('entries').select('title').like('body_markdown', '%ritual:%')
    expect(like.data).toEqual([{ title: 'One' }])
    const one = await sb.from('entries').select('title').eq('owner', B).single()
    expect(one.data).toEqual({ title: null })
    const many = await sb.from('entries').select('title').eq('owner', A).single()
    expect(many.error?.code).toBe('PGRST116')
    const none = await sb.from('entries').select('title').eq('owner', 'nobody').maybeSingle()
    expect(none).toMatchObject({ data: null, error: null })
    const notIn = await sb.from('entries').select('title').eq('owner', A).not('title', 'in', '(One)')
    expect(notIn.data).toEqual([{ title: 'Two' }])
    const matched = await sb.from('entries').select('title').match({ owner: A, title: 'One' })
    expect(matched.data).toEqual([{ title: 'One' }])
  })

  it('or() with JSON paths, like, and is.null', async () => {
    await sb.from('processing_jobs').insert([
      { owner: A, kind: 'gather', status: 'done', cursor: { origin: 'write' } },
      { owner: A, kind: 'gather', status: 'done', cursor: { origin: 'import' } },
      { owner: A, kind: 'synthesize', status: 'done', cursor: {} },
    ])
    const r = await sb.from('processing_jobs').select('kind, cursor').eq('owner', A).or('kind.neq.gather,cursor->>origin.eq.import').order('kind')
    expect(r.error).toBeNull()
    expect((r.data as Array<{ kind: string }>).map((x) => x.kind)).toEqual(['gather', 'synthesize'])
    const r2 = await sb.from('entries').select('title').eq('owner', A).or('body_markdown.like.%<!-- ritual:%,title.is.null')
    expect(r2.data).toEqual([{ title: 'One' }])
  })

  it('update / upsert / delete with returning', async () => {
    const up = await sb.from('entries').update({ mood: 'calm', circumstances: { weather: 'rain' } }).eq('owner', A).eq('title', 'Two').select('mood, circumstances')
    expect(up.data).toEqual([{ mood: 'calm', circumstances: { weather: 'rain' } }])
    const prof = await sb.from('profiles').upsert({ owner: A, settings: { theme: 'dawn' }, feature_flags: ['x'] }, { onConflict: 'owner' }).select('owner, settings, feature_flags').single()
    expect(prof.data).toEqual({ owner: A, settings: { theme: 'dawn' }, feature_flags: ['x'] })
    const again = await sb.from('profiles').upsert({ owner: A, settings: { theme: 'noon' } }, { onConflict: 'owner' }).select('settings').single()
    expect(again.data).toEqual({ settings: { theme: 'noon' } })
    const ignored = await sb.from('profiles').upsert({ owner: A, settings: { theme: 'x' } }, { onConflict: 'owner', ignoreDuplicates: true })
    expect(ignored.error).toBeNull()
    expect((await sb.from('profiles').select('settings').eq('owner', A).single()).data).toEqual({ settings: { theme: 'noon' } })
    const del = await sb.from('processing_jobs').delete({ count: 'exact' }).eq('owner', A).eq('kind', 'synthesize')
    expect(del.error).toBeNull()
    expect(del.count).toBe(1)
    const bad = await sb.from('entries').select('nope').eq('owner', A)
    expect(bad.error?.code).toBe('42703')
    await expect(sb.from('entries').select('nope').throwOnError()).rejects.toThrow(/nope/)
  })

  it('embeds a many-to-one relation by <singular>_id', async () => {
    const entry = (await sb.from('entries').select('id').eq('owner', A).eq('title', 'One').single()).data as { id: string }
    const thread = (await sb.from('threads').insert({ owner: A, title: 'T' }).select('id').single()).data as { id: string }
    const item = (await sb.from('spiritual_items').insert({ owner: A, entry_id: entry.id, type: 'prayer', content: 'p', embedding: [0.1, 0.2] }).select('id').single()).data as { id: string }
    await sb.from('thread_members').insert({ thread_id: thread.id, spiritual_item_id: item.id })
    const r = await sb.from('thread_members').select('thread_id, spiritual_item_id, spiritual_items(entry_id, embedding)').eq('thread_id', thread.id)
    expect(r.error).toBeNull()
    expect(r.data).toEqual([{ thread_id: thread.id, spiritual_item_id: item.id, spiritual_items: { entry_id: entry.id, embedding: '[0.1,0.2]' } }])
  })

  it('rpc: set-returning, scalar, defaults, jsonb args', async () => {
    await sb.from('processing_jobs').insert({ owner: B, kind: 'synthesize', status: 'queued' })
    const claimed = await sb.rpc('claim_processing_jobs', { k: 5 })
    expect(claimed.error).toBeNull()
    expect((claimed.data as Array<{ owner: string; status: string }>).some((j) => j.owner === B && j.status === 'running')).toBe(true)
    const pending = await sb.rpc('gather_pending_count', { p_owner: A, p_settle: '0 minutes' })
    expect(pending.error).toBeNull()
    expect(typeof pending.data === 'number' || typeof pending.data === 'string').toBe(true)
    const lex = await sb.rpc('match_entries_lexical', { owner_id: A, terms: ['ritual'], match_count: 5 })
    expect(lex.error).toBeNull()
    expect((lex.data as unknown[]).length).toBe(1)
    const stamp = await sb.rpc('gather_stamp', { p_owner: A, p_rows: [], p_max_attempts: 3 })
    expect(stamp.error).toBeNull()
    const missing = await sb.rpc('no_such_fn', {})
    expect(missing.error).not.toBeNull()
  })

  it('auth: getUser by Better Auth token, admin getUserById and listUsers', async () => {
    const me = await sb.auth.getUser(TOKEN)
    expect(me.error).toBeNull()
    expect(me.data.user).toMatchObject({
      id: A,
      email: 'ann@example.test',
      user_metadata: { name: 'Ann', full_name: 'Ann', avatar_url: 'https://img.test/a.png' },
    })
    expect(me.data.user?.identities).toEqual([{ provider: 'google', id: 'g-1', user_id: A }])
    const anon = await sb.auth.getUser('forged')
    expect(anon.data.user).toBeNull()
    expect(anon.error).not.toBeNull()
    const byId = await sb.auth.admin.getUserById(B)
    expect(byId.data.user?.email).toBe('bob@example.test')
    const page = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    expect(page.error).toBeNull()
    const ids = page.data.users.map((u) => u.id)
    expect(ids).toEqual(expect.arrayContaining([A, B]))
  })
})
