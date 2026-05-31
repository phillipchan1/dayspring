# Dayspring — Multi-Tenancy Phase Plan

Turning Dayspring from "single-user, my account" into "any number of users, each
with a private journal." Companion to [PROGRESS.md](../PROGRESS.md).

> **TL;DR — you're most of the way there already.** The schema was built
> multi-tenant from day one: every `entries` row has an `owner` and RLS scopes
> reads/writes to `auth.uid() = owner`. The email allowlist is already removed.
> The real work is (1) a handful of **client-side isolation bugs** that only bite
> once a second person can sign in, (2) one **cross-tenant correctness bug in the
> import dedup index**, and (3) the **product/commercial layer** (onboarding,
> billing, abuse, legal).

---

## What already works (no change needed)

| Concern | Status | Where |
|---|---|---|
| Per-row data isolation | ✅ RLS: `using/with check (auth.uid() = owner)` | `supabase/schema.sql` |
| `owner` auto-set | ✅ `owner uuid not null default auth.uid()` | `supabase/schema.sql` |
| Account deletion cascade | ✅ `references auth.users on delete cascade` | `supabase/schema.sql` |
| Sign-in for any account | ✅ allowlist removed; OAuth only | `src/lib/auth.ts`, `src/App.tsx` |
| Auth session tracking | ✅ `onAuthStateChange` | `src/hooks/useSession.ts` |

Because Postgres RLS is enforced at the database, even though the anon key is
public, a signed-in user can only ever see their own rows. That's the hard part
of multi-tenancy and it's done.

---

## Gaps to close

### A. Correctness & privacy — MUST fix before a 2nd user exists

These are latent today (only one person signs in) but become real bugs/leaks the
moment two people use the same app — especially on a **shared browser/device**.

1. **Local cache is not user-scoped (privacy leak).**
   `src/lib/db.ts` opens a single IndexedDB (`'dayspring'`) and never clears it on
   sign-out. After user A signs out and user B signs in on the same browser:
   - `repo.listEntries()` reads the cache first → **A's entries render to B** until a sync completes.
   - `sync()` merges server rows with the local cache and *keeps local-only rows*
     (`repo.ts` "local-only rows" branch) → **A's private entries persist in B's view**.
   - A's queued **outbox** writes would **replay under B's session**, writing A's content into B's account.

   **Fix:** on sign-out, `await cache.cacheClear()` + clear the outbox; and namespace
   the IndexedDB name (or an internal key) by `session.user.id` so caches can't bleed.
   Add a guard in `repo` that ignores/clears cache whose owner ≠ current user.

2. **Import dedup index is global, not per-owner (cross-tenant collision).**
   Today's unique index is `(source, external_id)` across the whole table. Two users
   importing Diarly will both produce e.g. `Journal/2013/01-01` → user B's import
   **collides with user A's row**; the `ON CONFLICT DO UPDATE` then targets A's row,
   which RLS forbids → the import errors (and conceptually leaks that A's key exists).

   **Fix (ties directly to the importer we just shipped):**
   ```sql
   drop index if exists public.entries_source_external_id_key;
   create unique index if not exists entries_owner_source_external_id_key
     on public.entries (owner, source, external_id);
   ```
   and change the upsert to `onConflict: 'owner,source,external_id'`, passing
   `owner: session.user.id` explicitly on each row (`src/lib/entries.ts`
   `upsertImportedEntries`). Per-owner dedup is what we actually want anyway.

3. **Settings are per-device, not per-user.**
   `dayspring.settings.v1` in localStorage is shared across whoever uses the browser.
   Not a privacy leak (just preferences), but surprising. **Fix (low priority):**
   key the localStorage entry by user id, and/or persist settings to a `profiles`
   row so they follow the user across devices.

### B. Infrastructure & scale

4. **Publish the Google OAuth consent screen.** It's almost certainly in **Testing**
   mode (only listed test users can sign in). To accept real users, move it to
   **In production**. Basic `email`/`profile` scopes generally don't need Google's
   sensitive-scope verification, but the unverified-app screen caps you until you
   verify branding. *No code change — a Google Cloud console task.*

5. **Index for owner-scoped queries.** Every query runs under an implicit
   `where owner = auth.uid()`. Add a composite index so it scales:
   ```sql
   create index if not exists entries_owner_created_at_idx
     on public.entries (owner, created_at desc);
   ```
   (The current `entries_created_at_idx` ignores `owner`.)

6. **A `profiles` table.** Most multi-tenant apps want a row per user for
   display name, plan/entitlements, settings, created-at, etc.:
   ```sql
   create table public.profiles (
     id uuid primary key references auth.users on delete cascade,
     email text, display_name text,
     plan text not null default 'free',
     created_at timestamptz not null default now()
   );
   ```
   with RLS `id = auth.uid()` and a trigger (or Edge Function) to insert on signup.

7. **Server-side work must stop assuming one user.** The planned passive
   win/insight extraction (PROGRESS.md "Decision change") must run **per `owner`**
   and write `insights` rows with the correct owner — don't aggregate across tenants.

### C. Product & commercial layer

8. **Onboarding / empty state.** New users have zero entries. Today the UI assumes
   existing content (loads first entry, etc.). Add a first-run empty state + the
   "Import from Diarly" path as a natural onboarding step.

9. **Billing & entitlements (if charging).** As discussed, the **image import is the
   premium hook**. Needs: Stripe (or similar), a `plan`/entitlement on `profiles`,
   server-side enforcement (an Edge Function checks the plan before issuing storage
   upload URLs), and a paywall UI. See [IMAGE_IMPORT_PLAN.md](./IMAGE_IMPORT_PLAN.md)
   for the cost model that justifies the tier.

10. **Abuse & limits.** Public signup invites abuse. Minimum: per-user rate limits
    on writes/imports, a storage quota per plan, and Supabase's built-in auth
    throttling. Consider CAPTCHA on signup.

11. **Legal / compliance.** A multi-user product handling personal journals needs a
    privacy policy + ToS, a self-serve **export** and **delete-my-account** flow
    (cascade already supports delete), and a data-retention stance. Journals are
    sensitive — be explicit that entries are private and never used for training.

12. **Multi-device sign-out semantics.** Decide global vs. local sign-out; ensure
    sign-out always runs the cache/outbox purge from gap #1.

---

## Suggested sequencing

- **Phase MT-1 — Make it *safe* for >1 user (1–2 days).**
  Gaps #1, #2, #5. Purge-on-sign-out + per-user cache namespacing, per-owner import
  index + upsert change, owner/created_at index. After this, two accounts can
  coexist without leaks. *This is the only phase that's a hard prerequisite for any
  second user.*

- **Phase MT-2 — Make it a *product* (3–5 days).**
  Gaps #4, #6, #8. Publish OAuth, add `profiles` + signup trigger, onboarding/empty
  state. Now strangers can sign up and have a coherent first run.

- **Phase MT-3 — Make it a *business* (1–2 weeks).**
  Gaps #9, #10, #11. Stripe + entitlements, quotas/rate limits, legal pages,
  export/delete. Gate the image importer behind the paid plan.

---

## Risks / watch-items
- **The cache leak (#1) is the highest-severity item** — it's a privacy bug, not
  just a polish item. Treat it as the gating issue.
- iOS (Capacitor) and Tauri each persist their own IndexedDB; the purge-on-sign-out
  logic must run in all three shells.
- Publishing OAuth changes the consent screen users see — test the full sign-up flow
  with a non-test Google account before launch.

## Open questions
- Do you want settings to **follow the user across devices** (DB-backed) or stay
  per-device? Affects whether `profiles` carries settings.
- Free-tier limits: how many entries / how much storage before paywall?
- Self-serve signup for everyone, or invite-only beta first?
