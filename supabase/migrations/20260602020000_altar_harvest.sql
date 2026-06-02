-- Altar prayer harvest — surface the prayers already written in the prose of
-- entries (especially imports that never passed through the editor, so they were
-- never /pray-/sense-tagged). Mirrors the Lamp's prose scan.
--
-- Two columns:
--   • entries.prayer_scanned_at — watermark so the (LLM-priced) scan never
--     re-reads an entry it already harvested. Cost-idempotency.
--   • spiritual_items.source — 'command' (typed via /pray, tied to an editor
--     fence block — NEVER delete from the Altar or the editor desyncs),
--     'scanned' (extracted from prose, no fence — safe to remove), etc.

alter table public.entries add column if not exists prayer_scanned_at timestamptz;

alter table public.spiritual_items
  add column if not exists source text not null default 'command';

-- Find unscanned entries fast (shrinks as the harvest progresses).
create index if not exists entries_prayer_unscanned
  on public.entries (owner) where prayer_scanned_at is null;
