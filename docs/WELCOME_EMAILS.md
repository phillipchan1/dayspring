# Welcome emails: implementation spec

Five short emails over a new account's first two weeks, each teaching one thing.
Everything a person reads is finished and committed. This doc says how to wire
it up. It's written so someone who wasn't in the conversation (human or agent)
can build it from here.

| Where | What |
|---|---|
| `marketing/email/welcome/welcome-emails.mjs` | **Source of truth** for every subject, preview and word |
| `marketing/email/welcome/templates/` | Generated Resend Templates: `<key>.html`, `<key>.txt`, `manifest.json`. Upload these as-is |
| `site/public/email/welcome/` | The images. Served at `https://www.usedayspring.app/email/welcome/…` by the marketing site |
| `scripts/welcome-emails.test.ts` | Fails if a template breaks Resend's variable rules, loses its unsubscribe link, points at a missing image, or drifts from the source |
| `scripts/capture-welcome-emails.mjs` | Re-shoots the images from the real app (`npm run email:welcome:assets`) |
| `api/_lib/welcomeDrip.ts` | Enroll map, day-offset math, skip rules. Day 13 is not here |
| `api/_lib/welcomeDripRun.ts` | Supabase ledger + Resend send |
| `api/cron/welcome-drip.ts` | Daily send pass |
| `api/admin/welcome-drip-backfill.ts` | One-shot enroll of every auth user (dry-run default) |

Change copy in the source, then run `npm run email:welcome` and commit the regenerated `templates/`.

## Rules that aren't negotiable

- **Teach, never nudge.** No email mentions how much or how little someone has written,
  and none is triggered by inactivity (PRINCIPLES #2: "you haven't written in 5 days" is
  exactly what's forbidden).
- **Never put journal content in an email.** No quotes, counts, names or subjects from
  their entries. Email isn't private enough.
- **Day 13 `trial` stays out of the enroll map.** The template is uploaded in Resend and
  listed in the manifest for copy, but it is not enrolled, not cron'd, and not backfilled
  (Product ASC hold).
- **Unsubscribe works on every email** and is respected by broadcasts too.
- **Default is silent.** `WELCOME_DRIP_SENDS_ENABLED` is off unless someone turns it on.
  Merging this code cannot start mailing production.

## Architecture: enroll + cron (not Resend Automations)

The app owns the sequence. Resend only receives `emails.send` with a published
`template.id`. There is no Automation, no custom event, and no contact-property
branch in Resend.

1. **Enrollment store** — `welcome_drip_enrollments` (Supabase). One row per user:
   `owner`, `enrolled_at` (UTC date, the day-offset anchor), `source`
   (`signup` | `backfill`), `status`, `steps` (which keys were sent or skipped).
2. **Enroll on signup** — `api/profile/ensure.ts` inserts a `signup` row the first
   time a profile is created. Idempotent. Day 0 is offered immediately; it still
   no-ops while the kill switch is off.
3. **Daily cron** — `GET /api/cron/welcome-drip` at 09:30 UTC (after
   `sync-resend`). For each active enrollment, any unrecorded step whose day
   offset has arrived is skip-evaluated, then sent or recorded skipped.
4. **Backfill** — `POST /api/admin/welcome-drip-backfill` enrolls every current
   `auth.users` row as **feature-discovery** (`source=backfill`), not a fake
   day-0. Skip-if-already-done is applied immediately. Default `dry_run=true`.

### The sequence (enroll map)

| Day | Template key | Resend template id | Sent to |
|---|---|---|---|
| 0 | `welcome` | `d798aca4-20ea-4967-8c67-072aa56fcef8` | new signups who have not written an entry. **Skipped on backfill.** |
| 1 | `slash` | `12e1146a-7ef7-4110-aa42-061b672d1550` | everyone who has not typed a `/` command |
| 3 | `journal` | `eefadd0c-50ed-4628-932c-2a21ace53d61` | people who have imported (`entries.source <> 'native'`) |
| 3 | `journal-import` | `650e248b-cfad-419a-9e2b-be4ff3ee3392` | everyone else — the default branch |
| 5 | `rituals` | `0396e918-c1ab-43e6-8257-60064a2c960d` | skipped if they have walked a ritual |
| 9 | `told-back` | `bcca64a9-693b-4c47-a953-9e3d95e27fe5` | everyone |
| 13 | `trial` | `4eef3200-a6f7-4c2f-b031-7aac3b3221d9` | **not enrolled** |

From: `The Dayspring team <hello@usedayspring.app>`. Variable `NAME` ← first
name from auth metadata, fallback `"there"`.

Every send:

```
POST https://api.resend.com/emails
{
  "from": "The Dayspring team <hello@usedayspring.app>",
  "to": ["<email>"],
  "reply_to": "hello@usedayspring.app",
  "template": { "id": "<uuid>", "variables": { "NAME": "Ada" } }
}
```

### Skip rules (real Supabase signals)

| Step | Skip when | Signal |
|---|---|---|
| `welcome` | backfill, or they already wrote | `source='backfill'` **or** any `entries` row |
| `slash` | they already used `/` | `spiritual_items.source = 'command'` |
| `journal` / `journal-import` | the other branch | `entries.source <> 'native'` → `journal`, else `journal-import` |
| `rituals` | they already walked a ritual | `entries.body_markdown` contains `<!-- ritual:` or the legacy `<!-- practice:name:` |
| `told-back` | never | manifest `sendTo: everyone`. There is no persisted "opened Ascent / Themes" flag |

Skips are recorded on the enrollment row so a step never double-sends. A failed
Resend call is **not** recorded — the next cron retries.

### Kill switch and env

| Var | Default | Role |
|---|---|---|
| `WELCOME_DRIP_SENDS_ENABLED` | **false** (unset = false) | Only `true` calls Resend. Enroll + skip evaluation still run. |
| `WELCOME_DRIP_FROM` | `The Dayspring team <hello@usedayspring.app>` | Override the From line |
| `RESEND_API_KEY` | unset | Required to actually deliver. Without it, due sends are held. |
| `CRON_SECRET` | required | Guards `/api/cron/welcome-drip` and `/api/admin/welcome-drip-backfill` |

`WELCOME_SERIES_ENABLED` from an earlier Automation draft is **not** read.

### Backfill: Vera dry-run on a throwaway

Against a preview or a throwaway Vercel project (kill switch still off):

```bash
# Counts only — no writes, no Resend.
curl -X POST "$URL/api/admin/welcome-drip-backfill" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Same, explicit.
curl -X POST "$URL/api/admin/welcome-drip-backfill?dry_run=true" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dry_run":true}'
```

Response shape:

```json
{
  "dry_run": true,
  "sends_enabled": false,
  "would_enroll": 12,
  "already_enrolled": 0,
  "would_send": { "welcome": 0, "slash": 8, "journal": 3, "journal-import": 9, "rituals": 7, "told-back": 12 },
  "would_skip": { "welcome": 12, "slash": 4, "journal": 9, "journal-import": 3, "rituals": 5, "told-back": 0 },
  "would_hold": { "welcome": 0, "slash": 0, "journal": 0, "journal-import": 0, "rituals": 0, "told-back": 0 }
}
```

`would_send` / `would_skip` are the feature-discovery plan (what would go out
once the kill switch is on). A write (`dry_run: false`) still only inserts
enrollments and records skips — it does not send. The daily cron is what mails,
and only after `WELCOME_DRIP_SENDS_ENABLED=true`.

There is **no** "launch day onward only" gate. Backfill is every current auth user.

### Before switching sends on (dashboard work, needs Phil)

- [ ] Apply `supabase/migrations/20260923120000_welcome_drip.sql` on the project
      the cron will hit.
- [ ] A verified sending domain in Resend (usedayspring.app) and the From address.
- [ ] **Sign in with Apple relay.** Register the sending domain, Resend's return-path
  subdomain (`send.usedayspring.app`) and the From address in the Apple Developer portal
  (Certificates, Identifiers & Profiles → Sign in with Apple for Email Communication).
  Without this, every `@privaterelay.appleid.com` user bounces.
- [ ] Send each Template to yourself with the Template's "Test email". Include one test to
  a contact with **no first name** and confirm it reads "Hi there,".
- [ ] Dry-run the backfill on a throwaway. Read `would_skip` / `would_hold`.
- [ ] Turn on `WELCOME_DRIP_SENDS_ENABLED` last, and only where you mean to mail.

### Known trade-offs

- **Send time.** Offsets are UTC calendar days from `enrolled_at`. The daily cron
  is 09:30 UTC, so a signup after that hour gets day 0 on the next pass (or
  immediately from `ensure` once sends are on). The original plan (7am in the
  writer's timezone) needs a custom sender and isn't worth it for now.
- **iPhone.** The site lists iOS as "Soon", so no email links to an iPhone app. When the
  App Store listing is live, add it to `welcome` and the "find it" lines.
- **Measuring.** Every app link carries `utm_medium=welcome&utm_campaign=<key>`. Judge the
  series by what people do after each email (`slash_used`, an import, `ritual_begun`), not
  by opens, which Apple Mail's privacy protection makes meaningless.
