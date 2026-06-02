-- Broadcast entry changes to connected clients (multi-tab / multi-device sync).
alter publication supabase_realtime add table public.entries;
