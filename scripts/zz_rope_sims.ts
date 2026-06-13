import { readFileSync } from 'node:fs'
function loadDotEnv(): void {
  let raw = ''; try { raw = readFileSync('.env','utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq === -1) continue
    const key = t.slice(0,eq).trim(); let val = t.slice(eq+1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1,-1)
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()
const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { cosine } = await import('../api/_lib/embeddings.ts')
const sb = supabaseAdmin()
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()

function parseVec(v: unknown): number[] | null {
  if (!v) return null
  if (typeof v === 'string') { try { const a = JSON.parse(v); return Array.isArray(a) ? a : null } catch { return null } }
  return Array.isArray(v) ? v as number[] : null
}
function l2norm(v: number[]): number[] { let m=0; for(const x of v) m+=x*x; m=Math.sqrt(m); return m===0?v:v.map(x=>x/m) }
function centroid(vecs: number[][]): number[] { const n=vecs.length,d=vecs[0]!.length,out=new Array<number>(d).fill(0); for(const v of vecs) for(let i=0;i<d;i++) out[i]!+=v[i]!; return out.map(x=>x/n) }

const { data: threads } = await sb.from('threads').select('id,label_ai,member_entry_ids').eq('owner', owner).not('label_ai','is',null)
if (!threads?.length) { console.log('no threads'); process.exit(0) }

const threadCentroids: { label: string; cen: number[] }[] = []
for (const t of threads as { id:string; label_ai:string; member_entry_ids:string[] }[]) {
  const ids = (t.member_entry_ids ?? []).slice(0,20)
  if (!ids.length) continue
  const { data: entries } = await sb.from('entries').select('embedding').in('id', ids)
  const vecs = (entries ?? []).map((e: {embedding:unknown}) => parseVec(e.embedding)).filter((v): v is number[] => v !== null).map(l2norm)
  if (!vecs.length) continue
  threadCentroids.push({ label: (t.label_ai ?? '').slice(0,38), cen: l2norm(centroid(vecs)) })
}

console.log(`Pairwise similarities for ${threadCentroids.length} thread centroids:\n`)
const pairs: { sim: number; a: string; b: string }[] = []
for (let i = 0; i < threadCentroids.length; i++)
  for (let j = i+1; j < threadCentroids.length; j++)
    pairs.push({ sim: cosine(threadCentroids[i]!.cen, threadCentroids[j]!.cen), a: threadCentroids[i]!.label, b: threadCentroids[j]!.label })

pairs.sort((a,b) => b.sim - a.sim)
for (const p of pairs.slice(0,20)) console.log(`  ${p.sim.toFixed(3)}  ${p.a}  ×  ${p.b}`)
console.log(`\nMin: ${pairs.at(-1)?.sim.toFixed(3)}  Max: ${pairs[0]?.sim.toFixed(3)}`)
