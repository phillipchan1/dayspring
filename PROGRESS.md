# Dayspring — Progress

Single-user AI journaling app. Source of truth: [personal-ai-journal-requirements.md](./personal-ai-journal-requirements.md).
**Building Phase 1 only.** No importers, synthesis, cockpit, or native wrappers yet.

---

## Decisions made

| Decision | Choice | Notes |
|---|---|---|
| Editor rendering | **CodeMirror 6, near-live inline** | Single pane, plaintext markdown storage. Obsidian/iA-Writer feel. |
| Auth | Any Google account may sign in | App-side email allowlist **removed** (Phil's request). Access governed by the Google OAuth consent screen (Testing mode) + per-row RLS (owner = auth.uid()). |
| Theme (start) | One Dark–ish dark theme | Extensible `[data-theme]` token system in `src/styles/themes.css`. |
| Font (start) | JetBrains Mono | Extensible font tokens. |
| Repo layout | Single Vite app | Structured so Tauri (Mac) / Capacitor (iOS) wrap it later without restructuring. |
| Package manager | npm | |
| TypeScript | strict mode (+ extras) | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc. |

---

## Status

### ✅ Done
- Scaffolded Vite + React + TS (strict). Path alias `@/*` → `src/*`.
- Theme token system (One Dark) + global styles.
- Supabase client (boots without keys; shows a setup screen until configured).
- Auth: Google OAuth sign-in, single-email allowlist gate, sign-out.
- `entries` schema SQL with RLS + idempotent-import unique index (`supabase/schema.sql`).
- **Checkpoint 1 ✅ verified live:** Google sign-in → allowlist → save → row in Supabase `entries`. Confirmed by Phil. (`HelloComposer` is temporary; the real editor replaces it.)
- Dev server pinned to **port 5180** (`strictPort`) — 5173 collided with another local app. Supabase Site URL / Redirect URLs updated to `http://localhost:5180`.

- **Checkpoint 2 ✅:** CodeMirror 6 near-live inline markdown editor (`src/editor/`), JetBrains Mono webfont, One Dark highlight. Centered writing column, line wrapping, transparent theme. Verified rendering via a temporary dev harness (removed).
- **Continuous autosave** (`useAutosave`): debounced (600ms), creates-then-updates, single in-flight save with follow-up flush, flushes on tab-hide / beforeunload / unmount. Save-status badge + live word count. Entry list panel (toggleable) to switch entries; `+ New` starts a fresh entry.

- **Checkpoint 3 ✅:** Focus mode + genuinely-different responsive layouts.
  - **Settings store** (`src/lib/settings.ts` + `useSettings`): localStorage-backed, per-device; focus prefs + editor typography (applied to CSS vars in `App`).
  - **Focus mode** (`useFocusMode`): full-screen takeover (all chrome hidden) + best-effort browser Fullscreen API; ⌘/Ctrl+Enter toggles, Esc exits. Faded floating controls (`FocusControls`).
  - **Typewriter scrolling** (`src/editor/typewriter.ts`): active line centered; padding measured in px from editor height (not `vh`) so it survives the mobile keyboard; self-heals if layout isn't ready at mount.
  - **Paragraph dimming** (`src/editor/dimming.ts`): fades all but the cursor's paragraph. Both live in CM compartments, toggle live, and only apply in focus mode.
  - **Layouts**: `DesktopJournal` (deep-margin centered column + hideable entry panel) vs `MobileJournal` (single column, swipe/tap entry drawer, thumb bar with safe-area insets, visual-viewport height tracking for keyboard-awareness). One Editor instance shared via `editorSlot`.

- **Checkpoint 4 ✅:** Reading view + search + settings panel.
  - **Reading view** (`Reader.tsx` + `lib/markdown.ts`): read-only rendered markdown (marked + DOMPurify-sanitized), `.markdown-body` typography in theme tokens, date header. Read/Edit toggle in header (mobile too). Autosave disabled in read mode.
  - **Search** (`search.ts`): case-insensitive filter over entry bodies with match snippets, in the sidebar (desktop) and drawer (mobile). Client-side over loaded entries — swap to a Supabase full-text query when import (Phase 2) grows the corpus.
  - **Settings panel** (`features/settings/SettingsPanel.tsx`): modal wired to the store — theme select, font-size / line-height / column-width sliders, focus toggles, reset. ⚙ button in desktop header + mobile bar.

- **Checkpoint 5 ✅ — Offline cache + sync-on-reconnect:**
  - **IndexedDB cache** (`lib/db.ts`, via `idb`): entries store + outbox store. App loads from cache instantly.
  - **Offline-first repo** (`lib/repo.ts`): optimistic writes (client-generated UUID), outbox queue, background `flush()` to Supabase (`upsertEntryRow`), `sync()` = flush-then-pull with **last-write-wins** (newest `updated_at`; the actively-edited entry and pending rows are preserved on pull).
  - Re-syncs on `online` / tab focus / visibility; flags `offline` immediately. **SyncBadge** shows Offline · N / Syncing N / Synced.
  - Autosave now routes through the repo, so a dropped connection never loses a keystroke — writes queue locally and replay on reconnect.
  - Verified the local path (cache + outbox + optimistic read + badge) via a temporary harness; server flush/pull exercises with a real session.

### Decision change (Phil)
- **No client win-capture UI.** Wins are to be extracted **passively, server-side** (Phase 2 — e.g. a Supabase Edge Function / Vercel function on new entries, writing `win` rows to `insights`). Phase 1 client needs nothing for this; entries are already cleanly stored and server-queryable.

## Phase 1 status: feature-complete ✅
Editor · autosave · focus mode · responsive layouts · reading · search · settings · Google auth (single-account) · entries in Supabase · offline cache + sync. Remaining = polish/QA + the items below.

### Notes / future
- Bundle is ~990 kB unminified (CodeMirror + marked + fontsource) in one chunk — fine for single-user; lazy-load Reader/Settings or code-split if startup ever feels heavy.
- Search is client-side over loaded entries; move to a Supabase full-text query once the Phase 2 import grows history.
- `idb` chosen over localStorage so the cache survives the Phase 2 multi-year import.

### Dependencies added
react, react-dom, @supabase/supabase-js, codemirror + @codemirror/* (state/view/commands/language/lang-markdown), @lezer/highlight, @fontsource/jetbrains-mono, marked, dompurify, idb.

---

## Manual setup you (Phil) need to do
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Enable Google provider in Supabase Auth (paste Google OAuth client ID/secret; add the redirect URL Supabase shows).
4. In Google Cloud OAuth consent screen, restrict to just your account (belt-and-suspenders).
5. Copy `.env.example` → `.env.local` and fill `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ALLOWED_EMAIL`.
6. `npm install` then `npm run dev`.

---

## Planned phases (designs)
- **Multi-tenancy** — [docs/MULTI_TENANCY_PLAN.md](./docs/MULTI_TENANCY_PLAN.md). Data model is already RLS-isolated per `owner`; remaining work is client-side isolation fixes (cache purge on sign-out, per-owner import index), then the product/billing layer.
- **Diarly image import** — [docs/IMAGE_IMPORT_PLAN.md](./docs/IMAGE_IMPORT_PLAN.md). Storage bucket + `attachments` table + streaming upload pipeline; the paid premium tier.

## Open questions / parking lot
- (none right now)
