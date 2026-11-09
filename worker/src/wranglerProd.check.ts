// Run: node --experimental-strip-types worker/src/wranglerProd.check.ts
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HYPERDRIVE_ID_PLACEHOLDER,
  PROD_ENV_NAME,
  asWranglerFile,
  parseJsonc,
  productionEnvProblems,
} from './wranglerProd.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const wranglerText = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
const config = asWranglerFile(parseJsonc(wranglerText))

ok(wranglerText.includes('HYPERDRIVE_ID_PLACEHOLDER'), 'placeholder is named HYPERDRIVE_ID_PLACEHOLDER')
ok(
  config.hyperdrive?.[0]?.id === HYPERDRIVE_ID_PLACEHOLDER,
  'top-level Hyperdrive id is the named placeholder',
)
ok(
  config.env?.production?.hyperdrive?.[0]?.id === HYPERDRIVE_ID_PLACEHOLDER,
  'production Hyperdrive id is the named placeholder',
)
ok(
  (config.env?.preview?.hyperdrive ?? []).length === 0,
  'preview hyperdrive array is empty',
)
ok(config.env?.preview?.name === 'dayspring-preview', 'preview worker name is dayspring-preview')
ok(config.env?.production?.name === 'dayspring', 'production worker name is dayspring')

const liveProblems = productionEnvProblems(config)
ok(liveProblems.length === 0, `committed production env is clean (${liveProblems.join('; ')})`)

ok(
  productionEnvProblems({
    vars: { OPENAI_MODEL: 'gpt-5.4-nano' },
    env: {
      production: {
        name: 'dayspring',
        vars: { BETTER_AUTH_URL: 'http://localhost:8787' },
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('localhost')),
  'localhost in production BETTER_AUTH_URL fails',
)

ok(
  productionEnvProblems({
    env: {
      production: {
        name: 'dayspring',
        vars: { BETTER_AUTH_URL: 'https://dayspring-preview.example.workers.dev' },
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('workers.dev')),
  'workers.dev BETTER_AUTH_URL fails',
)

ok(
  productionEnvProblems({
    env: {
      production: {
        name: 'dayspring',
        vars: { DATABASE_URL: 'postgresql://neon.tech/db' },
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('DATABASE_URL')),
  'DATABASE_URL in vars fails',
)

ok(
  productionEnvProblems({
    env: {
      production: {
        name: 'dayspring',
        vars: { BETTER_AUTH_SECRET: 'x'.repeat(32) },
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('BETTER_AUTH_SECRET')),
  'BETTER_AUTH_SECRET in vars fails',
)

ok(
  productionEnvProblems({
    vars: { AI_GATEWAY_API_KEY: 'gw-test' },
    env: {
      production: {
        name: 'dayspring',
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('AI_GATEWAY_API_KEY')),
  'top-level secret inherited into production vars fails',
)

ok(
  productionEnvProblems({
    env: {
      production: {
        name: 'dayspring',
        vars: { ENVIRONMENT: 'local' },
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).some((p) => p.includes('ENVIRONMENT')),
  'ENVIRONMENT in production vars fails',
)

ok(
  productionEnvProblems({
    vars: {
      OPENAI_MODEL: 'gpt-5.4-nano',
      RESEND_FROM: 'Dayspring <hello@usedayspring.app>',
      WELCOME_DRIP_SENDS_ENABLED: 'false',
    },
    env: {
      production: {
        name: 'dayspring',
        hyperdrive: [{ binding: 'HYPERDRIVE', id: HYPERDRIVE_ID_PLACEHOLDER }],
      },
    },
  }).length === 0,
  'clean production env with placeholder passes',
)

ok(
  productionEnvProblems({ env: {} }).some((p) => p.includes('missing')),
  'missing production env fails',
)

const docs = readFileSync(join(root, 'docs/cloudflare-migration/production.md'), 'utf8')
ok(docs.includes('--data @'), 'docs create Hyperdrive via curl --data @file')
ok(docs.includes('hyperdrive/configs'), 'docs POST the Hyperdrive configs API')
ok(docs.includes('"sslmode": "require"'), 'docs set origin sslmode require')
ok(!/npx wrangler hyperdrive create/.test(docs), 'docs do not run wrangler hyperdrive create')
ok(!/--origin-password\s+"\$/.test(docs), 'docs do not expand PGPASSWORD onto wrangler argv')
ok(
  !/--connection-string=/.test(docs) && !/--connection-string "/.test(docs),
  'docs do not pass a connection string on argv',
)
ok(docs.includes('-pooler'), 'docs forbid the Neon pooler host')
ok(docs.includes('PGPASSWORD'), 'docs pass psql the password via PGPASSWORD')
ok(docs.includes('AI_GATEWAY_API_KEY') && docs.includes('AI_GATEWAY_ZDR'), 'docs list AI Gateway names')
ok(!/^\| `OPENAI_API_KEY`/m.test(docs), 'production.md does not list OPENAI_API_KEY as a Worker secret')
ok(docs.includes('BETTER_AUTH_SECRET') && docs.includes('CRON_SECRET'), 'docs list Better Auth and cron secrets')
ok(!/postgresql:\/\/[^/\s]+:[^@\s]+@/.test(docs), 'docs do not embed a user:password URL')

mkdirSync(join(root, 'dist'), { recursive: true })
const indexHtml = join(root, 'dist/index.html')
try {
  readFileSync(indexHtml)
} catch {
  writeFileSync(indexHtml, '<!doctype html><title>dayspring</title>\n')
}

const wranglerBin = join(root, 'node_modules/.bin/wrangler')
const dryRun = spawnSync(wranglerBin, ['deploy', '--env', PROD_ENV_NAME, '--dry-run'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, WRANGLER_LOG: 'error' },
})
ok(dryRun.status === 0, `wrangler deploy --env ${PROD_ENV_NAME} --dry-run exits 0`)
if (dryRun.status !== 0) {
  const output = `${dryRun.stdout ?? ''}\n${dryRun.stderr ?? ''}`
  fails.push(output.slice(0, 2000))
}

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('wranglerProd: ok')
