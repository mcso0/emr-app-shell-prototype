-- DEMO-DATA-PR-003 follow-up (Cheongdam only). The master seed gave all 25
-- seed patients the same primary attending veterinarian (이수지), so every
-- chart search card showed one 주치의. Each patient now gets the veterinarian
-- who saw them most often in the replayed visits. The same values are in
-- supabase/snippets/den-468-491_cheongdam_master_seed.sql.
--
-- Only patients.primary_attending_vet_id changes. Triggers are off inside the
-- block so updated_at keeps its past date. Applied to the hosted demo database
-- on 2026-11-29 (22 rows changed; 3 patients already had 이수지).
-- Keep `dry := true` to preview: the block ends with "PRIMARY_VET_ROLLBACK {...}".

do $vets$
declare
  dry constant boolean := true;
  n int; out jsonb;
begin
  set local session_replication_role = replica;
  update public.patients p set primary_attending_vet_id = ('49110000-0000-4000-8000-' || lpad(m.vet::text, 12, '0'))::uuid
  from (values
    (1, 11), (2, 6), (3, 7), (4, 3), (5, 10), (6, 6), (7, 3), (8, 8), (9, 10), (10, 6),
    (11, 8), (12, 7), (13, 10), (14, 11), (15, 8), (16, 6), (17, 7), (18, 10), (19, 8), (20, 11),
    (21, 3), (22, 10), (23, 7), (24, 6), (25, 8)
  ) m(no, vet)
  where p.workspace_id = 'workspace-clair-cheongdam'
    and p.id = ('49121000-0000-4000-8000-' || lpad(m.no::text, 12, '0'))::uuid
    and p.primary_attending_vet_id is distinct from ('49110000-0000-4000-8000-' || lpad(m.vet::text, 12, '0'))::uuid;
  get diagnostics n = row_count;
  set local session_replication_role = origin;
  out := jsonb_build_object('dry', dry, 'changed', n,
    'byVet', (select jsonb_object_agg(k, c) from (
      select u.display_name k, count(*) c from public.patients p
      join public.users u on u.id = p.primary_attending_vet_id
      where p.workspace_id = 'workspace-clair-cheongdam' group by 1) x),
    'neverSawPatient', (select count(*) from public.patients p where p.workspace_id = 'workspace-clair-cheongdam'
      and p.primary_attending_vet_id not in (select e.primary_veterinarian_id from public.encounters e where e.patient_id = p.id)));
  if dry then raise exception 'PRIMARY_VET_ROLLBACK %', out::text; end if;
end $vets$;
