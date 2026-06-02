import { readFileSync } from 'node:fs'
for (const line of (() => { try { return readFileSync('.env', 'utf8').split('\n') } catch { return [] } })()) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i < 0) continue
  const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (k && process.env[k] === undefined) process.env[k] = v
}
const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const sb = supabaseAdmin()
const E = 'id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id'
const I = 'id, owner, entry_id, type, content, metadata, created_at, resolved_at, thread_id'
const T = 'id, owner, title, carries, planted_at, last_touch_at, seed_item_id, created_at'
{
  const t = Date.now()
  const { data, error } = await sb.from('entries').select(E).order('created_at', { ascending: false }).limit(1000)
  console.log('entries ENTRY_COLUMNS x1000:', error ? 'FAIL ' + error.code + ' ' + error.message : `OK ${data?.length} rows in ${Date.now() - t}ms`)
}
{ const { error } = await sb.from('spiritual_items').select(I).limit(10); console.log('spiritual_items ITEM_COLUMNS:', error ? 'FAIL ' + error.message : 'OK') }
{ const { error } = await sb.from('prayer_threads').select(T).limit(10); console.log('prayer_threads THREAD_COLUMNS:', error ? 'FAIL ' + error.message : 'OK') }
{ const { count, error } = await sb.from('entries').select('id', { count: 'exact', head: true }).neq('source', 'native'); console.log('imported count(id) head:', error ? 'FAIL ' + error.message : `OK count=${count}`) }
