-- Re-read every page that carries a Scripture fence, once, so Lamp learns what
-- it could not see before. See D-032 and src/lib/scripture/highlights.ts.
--
--   · A scripture ritual page lit its chapter on Lamp but none of the verses the
--     writer highlighted in it — a `> phrase (v. 5)` line has no book name, and
--     nothing read it back.
--   · A whole-chapter fence in Mark, Acts, Job, Revelation, Proverbs, Judges or
--     Numbers was not counted at all: the prose parser refuses a bare chapter
--     for a book named like a word.
--
-- Both are fixed in the reader (src/lib/scripture/refRows.ts), which the editor's
-- save and the gather engine share. New and edited pages are right from the
-- deploy on. A page that has not changed is not pending, so the engine would
-- never go back to it — this makes the existing ones pending, for every account.
--
-- ── Cost: nothing but one pass of the deterministic derive ───────────────────
--
-- A first gather (gathered_hash IS NULL) trusts the marks the old scanners left,
-- and runs a model step only where its mark is missing (planEntry in
-- api/_lib/gatherEngine.ts). A page that has been read before runs none. The
-- derive is additive and idempotent: it inserts the references the table lacks,
-- never overwrites a row, and never deletes one.
--
-- Writing gathered_hash does not move updated_at (20260823120000), so nothing
-- re-syncs as an edit; `entries` is in the realtime publication, so each
-- connected device receives one no-op change event per page.
--
-- ── ORDER MATTERS: apply this AFTER the deploy that carries the new reader ───
--
-- Run before it, the OLD reader would derive these pages, stamp them gathered,
-- and the fix would again wait for an edit that may never come.
--
--   supabase db query --linked -f supabase/migrations/20261002120000_requeue_scripture_pages.sql

update public.entries
   set gathered_hash = null,
       gather_attempts = 0
 where gathered_hash is not null
   and body_markdown like '%```dayspring-scripture %';
