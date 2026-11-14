# Switch step: Worker cron triggers (prepared, NOT applied)

`wrangler.jsonc` has no `triggers` block on purpose. Add it **only** in the switch
step, in the same change that turns Vercel's crons off.

## Cloudflare limits (developers.cloudflare.com/workers/platform/limits, read Nov 13 2026)

- **Cron Trigger wall time: 15 minutes** per invocation ("Duration" / "Wall time limits by invocation type").
- **Cron Trigger CPU: 30 s for an interval under 1 hour** (so `* * * * *`), 15 min for ≥ 1 hour intervals.
  Our ticks use ~100–300 ms CPU (prod tail, Nov 13), so this is not the constraint.
- HTTP + `ctx.waitUntil()`: work after the response is cancelled 30 s after the response.
  This is why a **kicked** tick (202 then waitUntil) runs under the ~18 s tick budget
  (`WORKER_TICK_PROFILE` in `api/_lib/processing.ts`). The cron tick uses the same budget,
  so a cron tick and a kicked tick behave the same.
- Cron Triggers per account (Workers Paid): 250. Six are used here.

## Triggers block (same 6 schedules as `vercel.json` `crons`, UTC)

Add it under `env.production` (triggers are not inherited by named envs):

```jsonc
"triggers": {
  "crons": [
    "0 8 * * *",   // /api/cron/synthesize
    "* * * * *",   // /api/cron/process-tick  ← backstop for the self-kick chain
    "0 9 * * *",   // /api/cron/remind        (mail; gated by WORKER_MAIL_CRONS)
    "15 9 * * *",  // /api/cron/sync-resend   (mail; gated by WORKER_MAIL_CRONS)
    "30 9 * * *",  // /api/cron/welcome-drip  (mail; gated by WORKER_MAIL_CRONS)
    "0 10 * * 1"   // /api/cron/echoes
  ]
},
```

`worker/src/vercel/routes.ts` `CRON_PATHS` already maps each schedule to its path.

## Steps at the switch (in order)

1. Backup taken, data copied, migrations 0001–0007 applied to Neon `dayspring_prod`.
   Do not copy `subjects` or `subject_markings`: they are unused legacy tables.
2. Record the current Worker version id (rollback target).
3. Turn off Vercel's crons: remove `crons` from `vercel.json` (or disable them in the
   project) and deploy Vercel. Confirm in the Vercel dashboard that no cron is scheduled.
4. In `wrangler.jsonc` `env.production`, add the triggers block above. Then deploy the Worker
   with `--env production`.
5. Set `WORKER_MAIL_CRONS=on` on the Worker in the same step (vars or a secret).
   The mail crons then send from the Worker only.
6. Verify: `GET /accounts/{id}/workers/scripts/dayspring/schedules` lists the 6 crons.
   Within 2 minutes, wrangler tail shows a scheduled `process-tick` with no errors.
7. Rollback: `wrangler rollback <version> --env production`, set `WORKER_MAIL_CRONS` off,
   and restore Vercel's `crons`.
