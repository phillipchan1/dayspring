#!/usr/bin/env node
// Manual opt-out (mailto unsubscribes): add one address to Neon email_suppressions.
//   DATABASE_URL_FILE=/path/0600 node scripts/suppress-email.mjs someone@example.com [source]
// Idempotent. Equivalent SQL:
//   INSERT INTO public.email_suppressions (email, source) VALUES (lower(btrim('someone@example.com')), 'mailto') ON CONFLICT (email) DO NOTHING;
import { readFileSync } from 'node:fs'
const [email, source = 'mailto'] = process.argv.slice(2)
if (!email || !email.includes('@')) { console.error('usage: suppress-email.mjs <email> [source]'); process.exit(2) }
const url = process.env.DATABASE_URL_FILE ? readFileSync(process.env.DATABASE_URL_FILE, 'utf8').trim() : process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL_FILE (or DATABASE_URL) is required'); process.exit(2) }
const { default: postgres } = await import('postgres')
const sql = postgres(url, { max: 1, prepare: false, ssl: 'require', onnotice() {} })
const r = await sql`INSERT INTO public.email_suppressions (email, source) VALUES (lower(btrim(${email})), ${source}) ON CONFLICT (email) DO NOTHING`
console.log(r.count ? 'added' : 'already suppressed')
await sql.end({ timeout: 5 })
