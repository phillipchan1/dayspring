-- Two synthetic users. No production data.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ada@example.test', NOW(), '{"name":"Ada"}', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.test', NOW(), '{"name":"Ben"}', NOW(), NOW());

INSERT INTO auth.identities (id, user_id, provider, provider_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '11111111-1111-1111-1111-111111111111', 'apple', '001234.ada.apple'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '22222222-2222-2222-2222-222222222222', 'google', 'ben-google');

INSERT INTO public.profiles (owner, has_seen_welcome, plan, acked_processing_completion)
VALUES
  ('11111111-1111-1111-1111-111111111111', TRUE, 'active', '2026-03-01T12:00:00.000Z'),
  ('22222222-2222-2222-2222-222222222222', TRUE, 'trialing', NULL);

INSERT INTO public.entries (id, owner, body_markdown, title, word_count, source, tags, circumstances)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Ada wrote this.', 'Ada day', 3, 'native', ARRAY['mercy','hope'], '{"mood":"quiet"}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'Ben wrote this.', 'Ben day', 3, 'native', ARRAY['grace'], '{}'::jsonb);

INSERT INTO public.insights (id, owner, type, content_markdown)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11', '11111111-1111-1111-1111-111111111111', 'weekly', 'Ada week'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11', '22222222-2222-2222-2222-222222222222', 'weekly', 'Ben week');

INSERT INTO public.spiritual_items (id, owner, entry_id, type, content, metadata, subject_tags)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa51', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'prayer', 'Ada prayed', '{"kind":"intercession","ok":true}'::jsonb, '["mercy","hope"]'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb51', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'prayer', 'Ben prayed', NULL, NULL);

INSERT INTO public.reminders (id, owner, entry_id, content, remind_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ada remind', '2026-03-15T12:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Ben remind', '2026-03-16T12:00:00Z');

INSERT INTO public.echo_candidates (id, owner, entry_id, text, entry_date)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaec', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ada echo', '2020-01-01'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbec', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Ben echo', '2020-01-01');

INSERT INTO public.echo_dismissals (id, owner, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaed', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbed', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO public.resurface_dismissals (id, owner, source_type, source_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21', '11111111-1111-1111-1111-111111111111', 'echo', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb21', '22222222-2222-2222-2222-222222222222', 'echo', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO public.scripture_refs (id, owner, entry_id, book_osis, book_name, book_order, chapter, verse_start, osis_ref, entry_created_at, source, confidence)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa22', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ps', 'Psalms', 19, 23, 1, 'Ps.23.1', '2020-01-01T00:00:00Z', 'parsed', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb22', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Rom', 'Romans', 45, 8, 28, 'Rom.8.28', '2020-01-01T00:00:00Z', 'parsed', 0.9);

INSERT INTO public.scripture_text (ref, translation, canonical, text)
VALUES
  ('psalm 23:1', 'ESV', 'Psalm 23:1', 'The Lord is my shepherd; I shall not want.'),
  ('romans 8:28', 'ESV', 'Romans 8:28', 'And we know that for those who love God all things work together for good.');

INSERT INTO public.prayer_threads (id, owner, title, planted_at, last_touch_at, kind)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', '11111111-1111-1111-1111-111111111111', 'Ada cairn', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z', 'person'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', '22222222-2222-2222-2222-222222222222', 'Ben cairn', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z', 'person');

INSERT INTO public.encounters (id, owner, thread_id, source_entry_id, movement)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa23', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'named'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb23', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'named');

INSERT INTO public.altar_candidates (id, owner, thread_id, source_entry_id, entry_date, quote, one_line_reason, gentle_question)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2020-01-01', 'Ada quote', 'stirs', 'look?'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbac', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '2020-01-01', 'Ben quote', 'stirs', 'look?');

INSERT INTO public.altar_candidate_dismissals (id, owner, thread_id, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbad', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO public.item_subjects (id, owner, item_id, subject_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa24', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa51', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb24', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb51', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14');

INSERT INTO public.ropes (id, owner, label)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa25', '11111111-1111-1111-1111-111111111111', 'Ada rope'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb25', '22222222-2222-2222-2222-222222222222', 'Ben rope');

INSERT INTO public.threads (id, owner, label, kind)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', '11111111-1111-1111-1111-111111111111', 'Ada thread', 'derived'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', '22222222-2222-2222-2222-222222222222', 'Ben thread', 'derived');

INSERT INTO public.thread_members (id, thread_id, entry_id, register)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa26', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bringing'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb26', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'neutral');

INSERT INTO public.attachments (id, owner, hash, storage_key)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'ada-hash', '11111111-1111-1111-1111-111111111111/ada-hash.jpg'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '22222222-2222-2222-2222-222222222222', 'ben-hash', '22222222-2222-2222-2222-222222222222/ben-hash.jpg');

INSERT INTO public.processing_jobs (id, owner, kind, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa27', '11111111-1111-1111-1111-111111111111', 'reflections', 'done'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb27', '22222222-2222-2222-2222-222222222222', 'scripture', 'queued');

INSERT INTO public.concordance (id, owner, kind, canonical, source)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa28', '11111111-1111-1111-1111-111111111111', 'person', 'Esther', 'explicit'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb28', '22222222-2222-2222-2222-222222222222', 'person', 'Marcus', 'explicit');

INSERT INTO public.concordance_occurrences (concordance_id, entry_id, owner, entry_created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa28', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', '2020-01-01T00:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb28', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', '2020-01-01T00:00:00Z');

INSERT INTO public.concordance_events (id, owner, action, kind, canonical)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaace', '11111111-1111-1111-1111-111111111111', 'observe', 'person', 'Esther'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbce', '22222222-2222-2222-2222-222222222222', 'observe', 'person', 'Marcus');

INSERT INTO public.concordance_shadow (id, owner, kind, canonical, source)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa29', '11111111-1111-1111-1111-111111111111', 'person', 'Esther', 'explicit'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb29', '22222222-2222-2222-2222-222222222222', 'person', 'Marcus', 'explicit');

INSERT INTO public.marks (id, owner, entry_id, quote, char_start)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa2a', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ada wrote this.', 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb2a', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Ben wrote this.', 0);

INSERT INTO public.kept_subjects (id, owner, subject_key, label)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa2b', '11111111-1111-1111-1111-111111111111', 'c:esther', 'Esther'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb2b', '22222222-2222-2222-2222-222222222222', 'c:marcus', 'Marcus');

INSERT INTO public.welcome_drip_enrollments (owner, enrolled_at, source, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', '2026-03-01', 'signup', 'active'),
  ('22222222-2222-2222-2222-222222222222', '2026-03-01', 'backfill', 'active');
