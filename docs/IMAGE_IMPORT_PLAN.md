# Dayspring — Diarly Image Import Phase Plan

Importing the photo attachments embedded in a Diarly Markdown export, so a
migrated journal looks complete (text **and** images) — and serving as the
premium, paid tier of the importer. Companion to the text importer already
shipped ([src/lib/diarlyImport.ts](../src/lib/diarlyImport.ts)) and to
[MULTI_TENANCY_PLAN.md](./MULTI_TENANCY_PLAN.md).

> **Status:** planned / not built. The text importer deliberately **skips** the
> `data/` folders today.

---

## What we confirmed from a real export

- The zip is **~1.4 GB**, almost entirely attachments. Markdown is ~14 MB of the total.
- Layout: `Export/<Journal>/<Year>/data/<contenthash>.<ext>` (lowercase `data/`).
- Bodies reference images with **standard markdown**, path relative to the entry's folder:
  ```markdown
  ![](data/f1a0f7e735e78b0c02325b0fa6e3f42c.jpeg)
  ```
- Filenames are **content hashes** → the same image reused across entries is
  physically one file. Natural, free dedup.
- Bodies also contain `- [ ](diarly://map/0,0)` location links (a custom scheme) —
  ignore/strip these.

This is about as clean as an import gets: the rendering path already exists
(`Reader` runs marked + DOMPurify, and `global.css` styles `.markdown-body img`).
The only missing piece is **getting the bytes to a place a URL can serve them
from, and rewriting the link**.

---

## Architecture

### Storage
- A **private Supabase Storage bucket** (e.g. `attachments`) with RLS so a user can
  only read/write objects under their own prefix: `*/objects` path begins with
  `auth.uid()`. Object key: `<owner>/<sha-or-diarlyhash>.<ext>`.
- Content-hash keys mean **idempotent uploads** and cross-entry dedup for free.

### Metadata (optional but recommended)
```sql
create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users on delete cascade,
  hash        text not null,            -- diarly content hash (or our sha256)
  storage_key text not null,            -- <owner>/<hash>.<ext>
  mime        text,
  bytes       integer,
  created_at  timestamptz not null default now(),
  unique (owner, hash)
);
```
RLS `owner = auth.uid()`. Lets us (a) skip re-uploading known hashes, (b) show
storage usage per user for quotas/billing, (c) clean up orphans.

### Rendering
Two options for the rewritten URL:
- **Signed URLs** (private bucket): generate on render via the Storage client,
  cache, refresh on expiry. Most private, slightly more plumbing.
- **Public bucket + unguessable keys**: simpler, but objects are world-readable if
  the URL leaks. For a private journal, prefer **signed URLs**.

Store a **stable reference** in the markdown (e.g. `![](attachment:<hash>)`) and
resolve it to a fresh signed URL at render time — so we never persist an expiring
URL in the entry body.

---

## Import pipeline (extends the existing flow)

Per entry, after the text upsert:
1. Scan body for `!\[[^\]]*\]\((data/[^)]+)\)` references.
2. For each, resolve the zip path `Export/<Journal>/<Year>/<data/...>` and read it
   **lazily as a blob** (`zip.file(path).async('blob')`) — JSZip only decompresses
   that one file, so we never inflate the whole 1.4 GB.
3. Compute/lookup hash. If `attachments` already has `(owner, hash)` → skip upload.
4. Else upload blob to `attachments/<owner>/<hash>.<ext>`; insert the row.
5. Rewrite the body reference `data/<hash>.<ext>` → `attachment:<hash>` and update
   the entry (or do it before the text upsert so it's one write).

### Memory & throughput (the 1.4 GB problem)
- Process attachments **one at a time** (or a small concurrency pool, e.g. 3–4),
  releasing each blob before the next. Never hold the full archive decompressed.
- The browser still loads the **whole 1.4 GB zip into an ArrayBuffer** for JSZip.
  On Mac/Tauri that's fine; on **iOS (Capacitor) it's risky**. Options: recommend
  desktop for first import; or move to a **streaming unzip** (e.g. a Web Worker +
  streaming reader) if iOS import is a requirement.

### Idempotency & resume
- Re-running is safe: text dedupes on `(owner, source, external_id)`; images dedupe
  on `(owner, hash)`. A failed run mid-way resumes by skipping already-stored hashes.
- Show progress as **two bars**: entries upserted, and attachments uploaded
  (`X / Y`, plus MB transferred). Summarize uploaded / skipped-duplicate / failed.

---

## Edge cases
- **HEIC**: Diarly on iOS may export `.heic`, which browsers can't render. *(This
  export is all JPEG.)* A general feature needs HEIC→JPEG conversion (client-side
  via a wasm decoder, or a server/Edge transform) — non-trivial; scope explicitly.
- **Missing/renamed attachment** referenced by a body → leave the ref, log it in the
  summary (same "never guess" principle as undated text entries).
- **Non-image attachments** (PDFs, audio) if Diarly includes them → store as generic
  attachments or skip with a logged note.
- **`diarly://` links** → strip during import.
- **Huge single images** → enforce a per-file cap tied to plan.

---

## Cost model (why this is the paid tier)
- Text import is ~free: parsed client-side, kilobytes written to Postgres.
- Images flip the economics — **recurring** costs that scale per user:
  - **Storage**: ~Supabase $0.021/GB-month (check current pricing). A 1.4 GB
    library ≈ a few cents/month *per user*, but it compounds across users and never
    stops.
  - **Egress**: bandwidth on every render/view is the bigger long-run cost; mitigate
    with signed-URL caching + CDN + lazy-loading images in the Reader.
- This is the natural premium feature: it's the bulk of the data, the only real
  cost driver, and the thing that makes "move my whole journal to Dayspring" viable.
  Gate it behind the paid plan (see MULTI_TENANCY_PLAN.md, gap #9), enforced
  **server-side** (Edge Function checks `profiles.plan` before issuing upload URLs).

---

## Milestones
- **IMG-1 — Storage foundation (0.5–1 day):** bucket + RLS, `attachments` table,
  `attachment:<hash>` render resolver in the Reader (test with a hand-uploaded image).
- **IMG-2 — Import pipeline (2–3 days):** ref scan, lazy blob read, dedup, upload,
  body rewrite, two-bar progress, resume. Verify on the real 1.4 GB export (desktop).
- **IMG-3 — Hardening (1–2 days):** quotas/caps, HEIC decision, missing-file & non-image
  handling, egress optimization (lazy-load + CDN), summary polish.
- **IMG-4 — Monetization wiring (folds into MT-3):** plan check before upload URLs,
  paywall UI, storage-usage display.

## Open questions
- Private (signed URLs) — confirm yes for a journal app? (Recommended.)
- Is **iOS import** in scope, or is "import on desktop" an acceptable constraint for v1?
- Do you want HEIC support in v1, or JPEG/PNG only with HEIC as a fast-follow?
- Free-tier storage allowance before the paywall triggers?
