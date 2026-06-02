-- scripture_text — global verbatim-passage cache for the ESV API.
--
-- This is the SOURCE OF TRUTH for verse text. The model no longer recites
-- scripture; it only picks references. Each reference is resolved against
-- Crossway's ESV API (api.esv.org) and the verbatim text is cached here so we
-- fetch any given passage once, then serve it locally forever (ESV text never
-- changes). One row per (normalized reference, translation).
--
-- Unlike scripture_refs, this table is NOT owner-scoped: scripture text is
-- universal, identical for every user, so the cache is shared. It is written
-- and read ONLY by the server (service-role key), never by the client — the
-- browser receives text through /api/spiritual/scripture. RLS is enabled with
-- NO policy, which locks out the anon/auth roles entirely while the service
-- role (which bypasses RLS) retains full access.

create table if not exists public.scripture_text (
  ref          text not null,            -- normalized lookup key: lowercased, ws-collapsed ('romans 8:28')
  translation  text not null default 'ESV',
  canonical    text not null,            -- ESV's canonical reference, as displayed ('Romans 8:28')
  text         text not null,            -- verbatim passage, whitespace-normalized for inline display
  fetched_at   timestamptz not null default now(),
  primary key (ref, translation)
);

alter table public.scripture_text enable row level security;
-- Intentionally no policy: only the service-role key (which bypasses RLS) may
-- touch this table. The client reaches it solely through the API endpoint.
