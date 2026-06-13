// Owner resolution for the local backfill / diagnostic scripts. Replaces the
// retired single-tenant APP_OWNER_ID env var (a relic from before the app went
// multi-tenant). Pass the owner explicitly so a script can never silently run
// against the wrong account:
//
//   tsx scripts/<name>.ts --owner <uuid|email>   one owner
//   tsx scripts/<name>.ts --all                  every owner in profiles
//
// With no flag, if the DB has exactly one profile it's used (single-dev
// convenience); with several, the script errors and lists them so you choose.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function flag(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1]
  return undefined
}

async function emailToOwner(email: string): Promise<string> {
  const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
  if (!u) throw new Error(`No auth user with email ${email}`)
  return u.id
}

async function allProfileOwners(): Promise<string[]> {
  const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
  const { data, error } = await supabaseAdmin().from('profiles').select('owner')
  if (error) throw error
  return (data ?? []).map((r: { owner: string }) => r.owner)
}

/** Every owner the script should run for (honors --all / --owner, else all profiles). */
export async function resolveOwners(argv: string[] = process.argv): Promise<string[]> {
  if (argv.includes('--all')) return allProfileOwners()
  const one = flag(argv, 'owner')
  if (one) return [UUID_RE.test(one) ? one : await emailToOwner(one)]
  const owners = await allProfileOwners()
  if (owners.length === 0) throw new Error('No profiles found. Pass --owner <uuid|email>.')
  return owners
}

/** Exactly one owner — for scripts that operate on a single account. */
export async function requireOwner(argv: string[] = process.argv): Promise<string> {
  const one = flag(argv, 'owner')
  if (one) return UUID_RE.test(one) ? one : await emailToOwner(one)
  const owners = await allProfileOwners()
  if (owners.length === 1) return owners[0]!
  if (owners.length === 0) throw new Error('No profiles found. Pass --owner <uuid|email>.')
  throw new Error(
    `Multiple owners exist — pass --owner <uuid|email> (or --all where supported):\n` +
      owners.map((o) => `  ${o}`).join('\n'),
  )
}
