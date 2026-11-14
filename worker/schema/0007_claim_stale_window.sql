-- Worker tick budget (Nov 2026). A Worker tick is cancelled at most 30 s after
-- its 202 (waitUntil cap), so a lock older than 90 s belongs to a dead tick.
-- Reclaim it after 90 s instead of 5 minutes, so a tick killed mid-unit is
-- resumed by the next tick (kick or the every-minute cron) almost at once.
-- Units are idempotent on retry (insights_period_key, gather stamps by hash).
-- Neon only; Supabase keeps its own RPC. Apply at the switch.
CREATE OR REPLACE FUNCTION claim_processing_jobs(k integer)
 RETURNS SETOF processing_jobs
 LANGUAGE sql
AS $function$
  update processing_jobs
     set status = 'running', locked_at = now(), attempts = attempts + 1
   where id in (
     select id from processing_jobs
      where status in ('queued','running')
        and (locked_at is null or locked_at < now() - interval '90 seconds')
      order by created_at
      for update skip locked
      limit k
   )
  returning *;
$function$;
