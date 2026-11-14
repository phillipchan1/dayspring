-- Align copy-abort columns with the Supabase source. Additive / nullability /
-- type only. 0003 is already stamped on DBs that ran the first landing file.

-- Target-only NOT NULL, no default, Worker does not read these on copy.
ALTER TABLE item_subjects ALTER COLUMN subject_key DROP NOT NULL;
ALTER TABLE concordance_occurrences ALTER COLUMN term DROP NOT NULL;

-- Source acked_processing_completion is text completion keys (ProcessingBanner).
-- 0001 was boolean; 0003 only dropped NOT NULL. Replace with TEXT.
ALTER TABLE profiles DROP COLUMN IF EXISTS acked_processing_completion;
ALTER TABLE profiles ADD COLUMN acked_processing_completion TEXT;
