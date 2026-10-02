-- Personalization: a change shown to everyone who matches the targeting, with no
-- comparison. Stored as an experiment of type `personalization` whose original gets
-- weight 0 and whose one variation gets weight 100, so the SDK needs no changes.

alter table public.experiments drop constraint experiments_type_check;
alter table public.experiments add constraint experiments_type_check
  check (type in ('ab', 'split_url', 'mvt', 'personalization'));
