-- The eight declared kinds.
--
-- `spiritual_items.type` was created with a check constraint listing the three
-- kinds that existed then (prayer, sense, scripture). The margin adds five more
-- — gift, desire, learned, story, absence — and every one of them is written
-- through the same insert path, so the constraint has to widen before the app
-- can save one.
--
-- APPLY THIS BEFORE DEPLOYING THE CLIENT. Until it lands, a /gift (or any of the
-- other four) still renders correctly from its fence in the entry body, but the
-- `spiritual_items` row is rejected — and because save-time reconcile upserts an
-- entry's markings as one statement, one rejected kind takes the entry's whole
-- batch with it. Nothing is lost from the writing (the fence is the source of
-- truth and lives in body_markdown), but the Altar would not see it.
--
-- Run in the SQL editor, not `db push` — this project's CLI migration history is
-- out of sync with the live database.

alter table public.spiritual_items
  drop constraint if exists spiritual_items_type_check;

alter table public.spiritual_items
  add constraint spiritual_items_type_check
  check (
    type in (
      'prayer',
      'sense',
      'scripture',
      'gift',
      'desire',
      'learned',
      'story',
      'absence'
    )
  );
