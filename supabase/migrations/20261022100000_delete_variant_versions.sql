-- Let members delete saved versions of a variant's code from its version history.
-- Versions are still only ever written by snapshot_variant() (no insert or update policy).
create policy "members delete variant versions" on public.variant_versions
  for delete to authenticated
  using (
    exists (
      select 1 from public.variants v
      where v.id = variant_id and public.can_access_experiment(v.experiment_id)
    )
  );
