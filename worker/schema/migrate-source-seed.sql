-- Two synthetic users. No production data.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ada@example.test', NOW(), '{"name":"Ada"}', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.test', NOW(), '{"name":"Ben"}', NOW(), NOW());

INSERT INTO auth.identities (id, user_id, provider, provider_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '11111111-1111-1111-1111-111111111111', 'google', 'ada-google'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '22222222-2222-2222-2222-222222222222', 'google', 'ben-google');

INSERT INTO public.profiles (owner, has_seen_welcome, plan)
VALUES
  ('11111111-1111-1111-1111-111111111111', TRUE, 'active'),
  ('22222222-2222-2222-2222-222222222222', TRUE, 'trialing');

INSERT INTO public.entries (id, owner, body_markdown, title, word_count, source, tags, circumstances)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Ada wrote this.', 'Ada day', 3, 'native', ARRAY['mercy','hope'], '{"mood":"quiet"}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'Ben wrote this.', 'Ben day', 3, 'native', ARRAY['grace'], '{}'::jsonb);

INSERT INTO public.spiritual_items (id, owner, entry_id, type, content, metadata, subject_tags)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa51', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'prayer', 'Ada prayed', '{"kind":"intercession","ok":true}'::jsonb, '["mercy","hope"]'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb51', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'prayer', 'Ben prayed', '{"kind":"thanks"}'::jsonb, NULL);

INSERT INTO public.echo_candidates (id, owner, entry_id, text, entry_date)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaec', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ada echo', '2020-01-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbec', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Ben echo', '2020-01-01');

INSERT INTO public.attachments (id, owner, hash, storage_key)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'ada-hash', '11111111-1111-1111-1111-111111111111/ada-hash.jpg'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '22222222-2222-2222-2222-222222222222', 'ben-hash', '22222222-2222-2222-2222-222222222222/ben-hash.jpg');

INSERT INTO public.threads (id, owner, label, kind)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', '11111111-1111-1111-1111-111111111111', 'Ada thread', 'derived'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', '22222222-2222-2222-2222-222222222222', 'Ben thread', 'derived');
