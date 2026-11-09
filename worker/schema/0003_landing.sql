-- Columns (and only columns) that live in supabase/migrations but not in
-- 0001_init / 0002_occ_updated_at. Additive. No functions, triggers, indexes,
-- or constraints — copied rows insert without them. No storage_objects:
-- photo metadata is public.attachments.

-- echo_candidates
ALTER TABLE echo_candidates ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE echo_candidates ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE echo_candidates ADD COLUMN IF NOT EXISTS entry_date TEXT;

-- altar_candidates (0001 only has payload jsonb)
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS source_entry_id UUID;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS entry_date TEXT;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS quote TEXT;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS char_start INTEGER;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS char_end INTEGER;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS one_line_reason TEXT;
ALTER TABLE altar_candidates ADD COLUMN IF NOT EXISTS gentle_question TEXT;

-- item_subjects (0001 has subject_key; prod has subject_id)
ALTER TABLE item_subjects ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE item_subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- threads (0001 has title/kind; prod uses label + derivation columns)
ALTER TABLE threads ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS lenses TEXT[] DEFAULT '{}';
ALTER TABLE threads ADD COLUMN IF NOT EXISTS member_entry_ids UUID[] DEFAULT '{}';
ALTER TABLE threads ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 0;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS breadth INTEGER DEFAULT 0;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS span_start TIMESTAMPTZ;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS span_end TIMESTAMPTZ;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS sim_threshold REAL;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS one_line_why TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS lens TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS interior BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS label_ai TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS label_user TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS rope_id UUID;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS temperature REAL;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS private BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS subject_kind TEXT;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS seed_item_id UUID;

-- ropes
ALTER TABLE ropes ADD COLUMN IF NOT EXISTS label_user TEXT;
ALTER TABLE ropes ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE ropes ADD COLUMN IF NOT EXISTS span_start TIMESTAMPTZ;
ALTER TABLE ropes ADD COLUMN IF NOT EXISTS span_end TIMESTAMPTZ;

-- thread_members
ALTER TABLE thread_members ADD COLUMN IF NOT EXISTS register TEXT;

-- prayer_threads (0001 has label/kind; prod uses title + cairn columns)
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS carries TEXT[] DEFAULT '{}';
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS planted_at TIMESTAMPTZ;
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS last_touch_at TIMESTAMPTZ;
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS seed_item_id UUID;
ALTER TABLE prayer_threads ADD COLUMN IF NOT EXISTS embedding TEXT;

-- encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS named_at TIMESTAMPTZ;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS source_entry_id UUID;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS reflection_text TEXT;

-- scripture_refs (0001 has canonical/book; prod uses OSIS columns)
ALTER TABLE scripture_refs ADD COLUMN IF NOT EXISTS book_osis TEXT;
ALTER TABLE scripture_refs ADD COLUMN IF NOT EXISTS book_name TEXT;
ALTER TABLE scripture_refs ADD COLUMN IF NOT EXISTS book_order INTEGER;
ALTER TABLE scripture_refs ADD COLUMN IF NOT EXISTS osis_ref TEXT;

-- concordance (0001 has term/payload)
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS canonical TEXT;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS surface_forms TEXT[] DEFAULT '{}';
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS descriptor TEXT;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS confidence REAL;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 0;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS effective_start DATE;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS effective_end DATE;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS superseded_by UUID;
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- concordance_occurrences (0001 has term; prod PK is concordance_id+entry_id)
ALTER TABLE concordance_occurrences ADD COLUMN IF NOT EXISTS concordance_id UUID;
ALTER TABLE concordance_occurrences ADD COLUMN IF NOT EXISTS entry_created_at TIMESTAMPTZ;

-- concordance_events (0001 has kind/payload; prod has action+canonical)
ALTER TABLE concordance_events ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE concordance_events ADD COLUMN IF NOT EXISTS canonical TEXT;
ALTER TABLE concordance_events ADD COLUMN IF NOT EXISTS entry_id UUID;
ALTER TABLE concordance_events ADD COLUMN IF NOT EXISTS entry_created_at TIMESTAMPTZ;

-- concordance_shadow (same shape as concordance)
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS canonical TEXT;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS surface_forms TEXT[] DEFAULT '{}';
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS descriptor TEXT;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS confidence REAL;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 0;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS effective_start DATE;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS effective_end DATE;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS superseded_by UUID;
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE concordance_shadow ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- marks
ALTER TABLE marks ADD COLUMN IF NOT EXISTS char_start INTEGER;

-- welcome_drip_enrollments
ALTER TABLE welcome_drip_enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
