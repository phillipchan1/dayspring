-- kept_subjects.kind — which Life Map list a typed subject belongs in.
--
-- WHY: the Life Map shows four lists (People · Places · Domains · Matters). A
-- subject that came from the Concordance already knows: its `kind` is one of
-- person/place/org/project/term and `sectionFor()` folds org+project into
-- Domains. A subject the writer TYPED has no Concordance row behind it, so
-- "Vera" typed into the People box would otherwise land nowhere.
--
-- NULLABLE ON PURPOSE. Every row kept before this column existed has none, and
-- `keptSection()` falls those to Matters rather than dropping them: a subject
-- the writer kept must never vanish because a column arrived late.
--
-- NOT A TAXONOMY THE WRITER MAINTAINS. This is which box they typed into, and
-- it is corrected by moving the chip — never by a picker. `kept_subjects`' own
-- migration forbids rename/merge/nest/archive for the same reason, and a "kind"
-- dropdown would be the first management affordance through that door.
--
-- Purely additive + idempotent. No existing rows are touched.

alter table public.kept_subjects
  add column if not exists kind text
    check (kind is null or kind in ('person', 'place', 'domain', 'matter'));

comment on column public.kept_subjects.kind is
  'Life Map list for a typed subject. Null for rows kept before the Life Map, and for anything backed by a Concordance row, which carries its own kind.';
