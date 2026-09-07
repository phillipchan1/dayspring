-- A server-derived write must never look like a user edit.
--
-- 20260801120000_multi_device_sync.sql exempted ONE derived column, `embedding`,
-- from bumping updated_at. Every other derived column kept bumping it, and the
-- daily cron writes two of them: api/_lib/altar.ts markScanned sets
-- prayer_scanned_at, api/_lib/concordance.ts markScanned sets
-- concordance_scanned_at. Both select entries the model hasn't read yet — which
-- is exactly an entry written this morning.
--
-- That cost a user their entry, twice over:
--
--   1. The bump made every device re-download the row over listEntriesSince.
--   2. Worse: it moved updated_at while the body stood still. updated_at is the
--      base an optimistic-concurrency push declares, and a device that is being
--      typed on cannot learn the new value (a queued write suppresses the pull,
--      and while you type there is always a queued write). So the next push
--      declared a base the server had moved past, upsert_entry_checked reported
--      a conflict that no other device had caused, and the client — correctly,
--      given what it was told — preserved the "losing" side as its own entry.
--      A watermark write forked someone's journal entry in half.
--
-- The fix generalises the embedding exemption into the rule it was a special
-- case of: bump updated_at when a column the CLIENT CAN SEE changed, and only
-- then. The list mirrors ENTRY_COLUMNS in src/lib/entries.ts (minus id, which
-- never changes, and updated_at itself). A column the client never reads cannot
-- oblige it to re-sync, so any derived column added later is exempt by default
-- rather than by remembering to exempt it — which is how this bug got in.
--
-- Comparing the columns directly rather than diffing to_jsonb(row) also keeps
-- the 1536-float embedding vector out of the comparison entirely.
--
-- supabase/tests/multi_device_sync.test.sql covers each derived column, and
-- fails if `entries` gains a column nobody has classified as one or the other.

create or replace function public.entries_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.created_at    is distinct from old.created_at
  or new.body_markdown is distinct from old.body_markdown
  or new.title         is distinct from old.title
  or new.mood          is distinct from old.mood
  or new.tags          is distinct from old.tags
  or new.word_count    is distinct from old.word_count
  or new.source        is distinct from old.source
  or new.external_id   is distinct from old.external_id then
    new.updated_at = now();
  else
    -- Nothing the client reads changed: a derived-column write, or a no-op.
    -- Holding the old value here is also what stops a client forging one.
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.entries_touch_updated_at();
