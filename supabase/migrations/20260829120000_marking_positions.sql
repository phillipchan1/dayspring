-- Where a marking sits in the page it came from.
--
-- ── Why a marking has never had a position ───────────────────────────────────
--
-- `scripture_refs` has carried char_start/char_end since it was written, and
-- `spiritual_items` has carried nothing. So a subject (a regex over the prose,
-- which lights particular LINES) and a marking (a page-level boolean with no
-- words and no position) were never the same kind of thing, and lighting
-- "Esther" and "Scripture" together could only ever mean "both are true
-- somewhere on this page".
--
-- `src/features/pages/nearby.ts` gets around it by searching the marking's own
-- text back into the body and counting lines. That works, and it pays for it
-- three times: a needle under 12 characters is unlocatable and silently
-- dropped; a DECLARED block is excluded outright, because its fence is stripped
-- from the prose before the search runs, so every `/pray` the writer typed is
-- invisible to the one feature built to find it; and the answer can only be
-- computed on a client that already holds the entry, which is why the Lamp, Ask
-- and the rollup crons cannot ask the question at all.
--
-- Storing the offsets at save time makes it arithmetic instead of a search.
--
-- ── Nullable on purpose ──────────────────────────────────────────────────────
--
-- Two rows can honestly have no position, and neither is a defect to be
-- backfilled away:
--
--   · a row whose `entry_id` went null when its entry was deleted (the FK is
--     `on delete set null`) — there is no page left to be at an offset into;
--   · a harvested row whose verbatim text no longer appears in the body,
--     because the writer edited the sentence after the harvest read it.
--
-- A reader must treat NULL as "unlocated", never as "at the top of the page" —
-- coalescing to 0 would put every orphan on line one, next to whatever the
-- writer happened to open with.
--
-- Offsets are into `entries.body_markdown` exactly as stored, fences included,
-- so a declared block finally has one. They are only meaningful alongside the
-- body they were computed from; save-time reconcile rewrites them whenever the
-- body changes, and anything reading them stale gets a wrong line, not a crash.

alter table public.spiritual_items add column if not exists char_start int;
alter table public.spiritual_items add column if not exists char_end   int;

-- The join reads "every located marking on this page", so entry_id leads.
-- Partial, because the unlocated rows above are never what it is looking for.
create index if not exists spiritual_items_located_idx
  on public.spiritual_items (entry_id, char_start)
  where char_start is not null;
