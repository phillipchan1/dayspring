# Welcome emails: implementation spec

Six short emails over a new account's first two weeks, each teaching one thing.
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

Change copy in the source, then run `npm run email:welcome` and commit the regenerated `templates/`.

## Rules that aren't negotiable

- **Teach, never nudge.** No email mentions how much or how little someone has written,
  and none is triggered by inactivity (PRINCIPLES #2: "you haven't written in 5 days" is
  exactly what's forbidden).
- **Never put journal content in an email.** No quotes, counts, names or subjects from
  their entries. Email isn't private enough.
- **Only new accounts.** Existing accounts never enter the series.
- **Unsubscribe works on every email** and is respected by broadcasts too.

## Architecture: Resend Automations

Resend runs the sequence (delays, branches and sends) as an **Automation** triggered by
a custom event. There's no cron, no send ledger and no custom unsubscribe endpoint. The
app only does two things:

1. **Sends one event** when a new account is created.
2. **Keeps three contact properties current**, which the Automation branches on.

### The sequence

| Day | Template key | Sent to |
|---|---|---|
| 0 | `welcome` | everyone |
| 1 | `slash` | everyone |
| 3 | `journal-import` / `journal` | `journal` if `contact.properties.imported` = `"yes"`, otherwise `journal-import` (adds the "bring your old journal" paragraph) |
| 5 | `rituals` | skipped if `contact.properties.walked_ritual` = `"yes"` |
| 9 | `told-back` | everyone |
| 13 | `trial` | only if `contact.properties.plan` = `"trialing"`. Its subject says "ends tomorrow", which is exact because the trial is 14 days from the same moment |

### Automation layout ("Welcome series")

```
trigger  dayspring.signed_up
  → send_email   welcome
  → delay        1 day
  → send_email   slash
  → delay        2 days
  → condition    contact.properties.imported eq "yes"
        met      → send_email journal
        not met  → send_email journal-import
  → delay        2 days
  → condition    contact.properties.walked_ritual eq "yes"
        met      → (nothing)
        not met  → send_email rituals
  → delay        4 days
  → send_email   told-back
  → delay        4 days
  → condition    contact.properties.plan eq "trialing"
        met      → send_email trial
```

If the workflow editor can't join two branches back into one step, duplicate the
downstream steps under each branch. The day numbers must stay the same either way.

Every `send_email` step:

- **Template:** the published template for that key.
- **Variables:** `{ "NAME": { "var": "contact.first_name" } }`.
- **From:** `The Dayspring team <hello@usedayspring.app>`, or whichever address is verified.
- **Reply-to:** an inbox a person reads. Several emails say "just reply", and those replies
  are the point.

### Templates: upload rules (these are why the files look the way they do)

For each entry in `templates/manifest.json`, create a Resend Template:

- **name:** the manifest's `name`.
- **subject:** the manifest's `subject`, plain text.
- **html / text:** the `.html` and `.txt` files.
- **variables:** `[{ "key": "NAME", "type": "string", "fallback_value": "there" }]`.
- **preview text:** already embedded as a hidden preheader in the HTML. Set the Template's
  preview field to the manifest's `preview` too if the editor asks.

Then **publish** each one; Automations only send published Templates.

- Variables are **triple-brace** (`{{{NAME}}}`). Fallbacks are declared on the Template,
  **not** inline: the `{{{FIRST_NAME|there}}}` form the Ascent broadcast used is Broadcast
  syntax and doesn't apply here.
- `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`, `contact` and `this` are
  **reserved** in Templates. That's why the greeting is `{{{NAME}}}`.
- `{{{RESEND_UNSUBSCRIBE_URL}}}` is **not** added automatically in Automations. Every
  template already carries it in its footer, in both HTML and text.
- No variables in subjects.

### App code to write

1. **Signup event.** In `api/profile/ensure.ts`, when the profile row is created for the
   first time (no `existing` row), after the contact upsert has finished:
   `POST https://api.resend.com/events/send` with
   `{ "event": "dayspring.signed_up", "email": user.email }`.
   - Use `waitUntil`, and never fail or delay `ensure`. Follow
     `scheduleAccountContactUpsert` in `api/_lib/resendAudience.ts`.
   - Chain the event **after** that upsert resolves, so the contact exists with its first
     name before the Automation's first step runs.
   - Gate it behind an env flag (e.g. `WELCOME_SERIES_ENABLED=true`) so it can ship dark.
2. **Contact properties.** Create `imported`, `walked_ritual` and `plan` in Resend
   (strings, default `"no"` / `"no"` / `""`). Then keep them current:
   - `imported` → `"yes"` in `api/processing/enqueue.ts`, which the client calls when an
     import finishes.
   - `plan` → on every plan write in `api/_lib/updateSubscription.ts` (and the trial grant
     in `ensure.ts`).
   - **Daily reconcile** in `api/cron/sync-resend.ts`, extended to set all three for every
     account:
     - `imported`: any `entries.source <> 'native'`
     - `walked_ritual`: any `entries.body_markdown` containing `<!-- ritual:`
     - `plan`: `profiles.plan`

     This covers anything a live hook misses. `walked_ritual` can rely on the daily
     reconcile alone.
   - Never write `unsubscribed` from these updates. `resendAudience.ts` already guarantees
     an opt-out stays an opt-out.
3. **Deletion** already removes the contact (`scheduleAccountContactRemoval`). Check that a
   running Automation stops for a deleted contact.

### Before switching it on (dashboard work, needs Phil)

- [ ] A verified sending domain in Resend (usedayspring.app) and the From address.
- [ ] **Sign in with Apple relay.** Register the sending domain, Resend's return-path
  subdomain (`send.usedayspring.app`) and the From address in the Apple Developer portal
  (Certificates, Identifiers & Profiles → Sign in with Apple for Email Communication).
  Without this, every `@privaterelay.appleid.com` user bounces.
- [ ] Send each Template to yourself with the Template's "Test email". Include one test to
  a contact with **no first name** and confirm it reads "Hi there,".
- [ ] Duplicate the Automation with minute-long delays, run one test account through it
  end to end, then delete the duplicate.
- [ ] Turn on `WELCOME_SERIES_ENABLED` last.

### Known trade-offs

- **Send time.** Delays count from the signup moment, so each email lands at roughly the
  time of day the person signed up. The original plan (7am in the writer's timezone)
  needs a custom sender and isn't worth it for now.
- **iPhone.** The site lists iOS as "Soon", so no email links to an iPhone app. When the
  App Store listing is live, add it to `welcome` and the "find it" lines.
- **Measuring.** Every app link carries `utm_medium=welcome&utm_campaign=<key>`. Judge the
  series by what people do after each email (`slash_used`, an import, `ritual_begun`), not
  by opens, which Apple Mail's privacy protection makes meaningless.
