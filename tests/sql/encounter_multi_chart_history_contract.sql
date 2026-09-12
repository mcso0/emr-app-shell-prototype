\set ON_ERROR_STOP on
-- Run only through the owned chart-pr037 local rehearsal runner.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values
  ('96378000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
    'MULTI-HISTORY-001', 'Synthetic chart history patient', 'dog', 'unknown'),
  ('96378000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
    'MULTI-HISTORY-002', 'Synthetic other history patient', 'cat', 'unknown');

insert into public.encounters(
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, checked_in_at, started_at
)
values
  ('96378000-0000-4000-8000-000000000011', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
    'MULTI-HISTORY-OLD', 'walk_in', 'completed', '2026-09-08T06:00:00Z', '2026-09-08T06:10:00Z'),
  ('96378000-0000-4000-8000-000000000012', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
    'MULTI-HISTORY-EMPTY', 'walk_in', 'completed', '2026-09-12T08:00:00Z', '2026-09-12T08:10:00Z'),
  ('96378000-0000-4000-8000-000000000013', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000002', '49110000-0000-4000-8000-000000000003',
    'MULTI-HISTORY-OTHER-PATIENT', 'walk_in', 'completed', '2026-09-12T09:00:00Z', '2026-09-12T09:10:00Z');

insert into public.soap_notes(
  id, workspace_id, encounter_id, author_user_id, status,
  clinical_at, created_at, updated_at
)
values
  ('96378000-0000-4000-8000-000000000101', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000011', '49110000-0000-4000-8000-000000000003',
    'autosaved', '2026-07-01T06:00:00Z', '2026-09-12T00:15:30Z', '2026-09-14T02:00:00Z'),
  ('96378000-0000-4000-8000-000000000102', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000011', '49110000-0000-4000-8000-000000000003',
    'signed', '2026-09-20T06:00:00Z', '2026-09-12T00:15:30Z', '2026-09-20T08:00:00Z'),
  ('96378000-0000-4000-8000-000000000103', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000011', '49110000-0000-4000-8000-000000000003',
    'draft', '2026-10-01T06:00:00Z', '2026-09-11T23:59:00Z', '2026-10-01T08:00:00Z'),
  ('96378000-0000-4000-8000-000000000104', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000011', '49110000-0000-4000-8000-000000000003',
    'voided', '2026-10-02T06:00:00Z', '2026-09-13T00:00:00Z', '2026-10-02T08:00:00Z'),
  ('96378000-0000-4000-8000-000000000105', 'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000013', '49110000-0000-4000-8000-000000000003',
    'draft', '2026-09-13T06:00:00Z', '2026-09-13T00:00:00Z', '2026-09-13T08:00:00Z');

update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership
  on membership.workspace_id = assignment.workspace_id
 and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id
  and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '49110000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $test$
declare
  first_page jsonb;
  second_page jsonb;
  other_patient jsonb;
begin
  first_page := public.clair_list_chart_patient_history(
    'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000001',
    null,
    2
  );
  if first_page->>'totalCount' <> '3' then
    raise exception 'history_count_includes_empty_or_voided_encounter';
  end if;
  if jsonb_array_length(first_page->'items') <> 2 or first_page->>'nextCursor' is null then
    raise exception 'history_first_page_shape';
  end if;
  if first_page#>>'{items,0,chart,id}' <> '96378000-0000-4000-8000-000000000102'
    or first_page#>>'{items,1,chart,id}' <> '96378000-0000-4000-8000-000000000101' then
    raise exception 'same_created_at_tie_order';
  end if;
  if first_page#>>'{items,0,encounter,id}' <> '96378000-0000-4000-8000-000000000011' then
    raise exception 'chart_encounter_owner_lost';
  end if;

  second_page := public.clair_list_chart_patient_history(
    'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000001',
    first_page->>'nextCursor',
    2
  );
  if second_page->>'totalCount' <> '3'
    or jsonb_array_length(second_page->'items') <> 1
    or second_page#>>'{items,0,chart,id}' <> '96378000-0000-4000-8000-000000000103'
    or second_page->>'nextCursor' is not null then
    raise exception 'history_second_page_loss_or_duplicate';
  end if;

  other_patient := public.clair_list_chart_patient_history(
    'workspace-clair-cheongdam',
    '96378000-0000-4000-8000-000000000002',
    null,
    50
  );
  if other_patient->>'totalCount' <> '1'
    or other_patient#>>'{items,0,chart,id}' <> '96378000-0000-4000-8000-000000000105' then
    raise exception 'patient_scope_leak';
  end if;
end;
$test$;

reset role;
select 'PASS encounter_multi_chart_history_contract' as result;
rollback;
