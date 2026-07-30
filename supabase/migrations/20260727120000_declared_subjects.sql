-- Declared threads by SUBJECT, not by devotional register.
--
-- WHY: the previous declared-thread builder (api/_lib/altar.ts → threadItems)
-- clustered raw prayer text by embedding similarity, which measures REGISTER, not
-- what a prayer is about. Every "lord… help me… let me…" reads alike, so a cluster's
-- centroid drifted into generic devotional space and became a magnet. Measured on
-- one real thread: 299 members, of which 289 sat BELOW the 0.64 merge bar relative
-- to the seed prayer — yet all 299 cleared it against the drifted centroid. The
-- title ("Grace for apostolic evangelism") described its first six members and
-- nothing else.
--
-- The replacement (api/_lib/declared.ts) tags each prayer with the concrete
-- life-matter it concerns and groups by that. Two columns support it:
--
--   • subject_tags      — the persisted {label, kind}[] for one prayer/sense line.
--     Grouping then becomes a deterministic recompute, so re-deriving the whole
--     field costs no model calls and is safe to run daily.
--   • subject_tagged_at — watermark: the model reads each line at most once, ever.
--     Cost-idempotency, mirroring entries.prayer_scanned_at.
--
-- Purely additive + idempotent. No existing rows are touched.

alter table public.spiritual_items
  add column if not exists subject_tags      jsonb,
  add column if not exists subject_tagged_at timestamptz;

-- Find untagged prayer/sense lines fast (shrinks as tagging progresses).
create index if not exists spiritual_items_untagged
  on public.spiritual_items (owner)
  where subject_tagged_at is null and type in ('prayer', 'sense');
