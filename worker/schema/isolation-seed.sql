-- Two synthetic users. No production data.
-- A cannot see or write B's rows.

INSERT INTO "user" (id, name, email, email_verified)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ada', 'ada@example.test', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Ben', 'ben@example.test', TRUE);

INSERT INTO profiles (owner, has_seen_welcome, plan, plan_source)
VALUES
  ('11111111-1111-1111-1111-111111111111', TRUE, 'trialing', 'app'),
  ('22222222-2222-2222-2222-222222222222', TRUE, 'trialing', 'app');

INSERT INTO entries (id, owner, body_markdown, title, word_count, source)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Ada wrote this.', 'Ada day', 3, 'native'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '22222222-2222-2222-2222-222222222222', 'Ben wrote this.', 'Ben day', 3, 'native');

INSERT INTO insights (id, owner, type, structured_payload)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'weekly', '{"who":"ada"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', 'weekly', '{"who":"ben"}');

INSERT INTO spiritual_items (id, owner, type, content, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'prayer', 'Ada prays', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '22222222-2222-2222-2222-222222222222', 'prayer', 'Ben prays', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO reminders (id, owner, content, remind_at, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', 'Ada remind', '2020-01-01T09:00:00Z', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '22222222-2222-2222-2222-222222222222', 'Ben remind', '2020-01-01T09:00:00Z', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO attachments (id, owner, hash, storage_key)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'ada-hash', '11111111-1111-1111-1111-111111111111/ada-hash.jpg'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '22222222-2222-2222-2222-222222222222', 'ben-hash', '22222222-2222-2222-2222-222222222222/ben-hash.jpg');

INSERT INTO marks (id, owner, entry_id, quote)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ada quote'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Ben quote');

INSERT INTO kept_subjects (id, owner, subject_key, label)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', '11111111-1111-1111-1111-111111111111', 'mercy', 'Mercy'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', '22222222-2222-2222-2222-222222222222', 'mercy', 'Mercy');

INSERT INTO threads (id, owner, title)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', '11111111-1111-1111-1111-111111111111', 'Ada thread'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', '22222222-2222-2222-2222-222222222222', 'Ben thread');

INSERT INTO thread_members (id, thread_id, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO ropes (id, owner, label)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10', '11111111-1111-1111-1111-111111111111', 'Ada rope'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10', '22222222-2222-2222-2222-222222222222', 'Ben rope');

INSERT INTO processing_jobs (id, owner, kind, status)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11', '11111111-1111-1111-1111-111111111111', 'gather', 'queued'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11', '22222222-2222-2222-2222-222222222222', 'gather', 'queued');

INSERT INTO concordance (id, owner, term)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12', '11111111-1111-1111-1111-111111111111', 'grace'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12', '22222222-2222-2222-2222-222222222222', 'grace');

INSERT INTO scripture_refs (id, owner, canonical, entry_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13', '11111111-1111-1111-1111-111111111111', 'John.3.16', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13', '22222222-2222-2222-2222-222222222222', 'John.3.16', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO echo_candidates (owner, entry_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1');

INSERT INTO prayer_threads (id, owner, label)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', '11111111-1111-1111-1111-111111111111', 'Ada cairn'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', '22222222-2222-2222-2222-222222222222', 'Ben cairn');

INSERT INTO welcome_drip_enrollments (owner, source, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'signup', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'signup', 'active');
