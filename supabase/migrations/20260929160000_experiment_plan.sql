-- Sample-size planner inputs (step 1): baseline conversion rate and smallest lift worth
-- detecting, both as fractions, e.g. {"baseline": 0.05, "mde": 0.15}.
alter table public.experiments add column plan jsonb not null default '{}';
