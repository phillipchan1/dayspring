-- Migration: add 'quarterly' to the insights rollup cascade (Looking Back v2).
-- Additive + idempotent: widens the allowed `type` values and the per-period
-- unique index to include 'quarterly'. No data is changed.

alter table public.insights drop constraint if exists insights_type_check;
alter table public.insights
  add constraint insights_type_check
  check (type in ('per_entry','weekly','monthly','quarterly','yearly','win'));

drop index if exists public.insights_period_key;
create unique index if not exists insights_period_key
  on public.insights (owner, type, period_start, period_end)
  where type in ('weekly','monthly','quarterly','yearly');
