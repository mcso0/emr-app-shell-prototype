\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96370000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-037', 'Synthetic multi chart patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96370000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96370000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-037', 'walk_in', 'in_consultation', now());
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
  w text := 'workspace-clair-cheongdam';
  actor text := '49110000-0000-4000-8000-000000000003';
  e uuid := '96370000-0000-4000-8000-000000000002';
  notes jsonb[] := array[]::jsonb[];
  n jsonb; saved jsonb; signed jsonb; doc jsonb; original_time timestamptz;
  denied boolean; i integer;
begin
  if public.clair_list_encounter_charts(w,e) <> '[]'::jsonb then raise exception 'phantom_chart'; end if;
  for i in 1..3 loop
    n := public.clair_create_encounter_chart(w,actor,e,
      ('96370000-0000-4000-8000-' || lpad((100+i)::text,12,'0'))::uuid,
      ('2026-09-09T00:00:00Z'::timestamptz + (i-1) * interval '8 hours'));
    notes := array_append(notes,n);
    if public.clair_create_encounter_chart(w,actor,e,
      ('96370000-0000-4000-8000-' || lpad((100+i)::text,12,'0'))::uuid)->>'id' <> n->>'id' then
      raise exception 'creation_retry_duplicate';
    end if;
    doc := jsonb_build_object('schemaVersion',2,'scopes',jsonb_build_array(jsonb_build_object(
      'scopeKey','default','scope','default','systemLabel','기본 SOAP',
      'blocks',jsonb_build_array(jsonb_build_object('id','paragraph-' || i,'type','paragraph',
        'props',jsonb_build_object('backgroundColor','default','textColor','default','textAlignment','left'),
        'content',jsonb_build_array(jsonb_build_object('type','text','text','Chart ' || i,'styles','{}'::jsonb)),
        'children','[]'::jsonb)))));
    saved := public.clair_save_chart_soap_note_v4(w,actor,e,(n->>'id')::uuid,
      jsonb_build_object('blockDocument',doc,'subjective','','objective','','assessment','','plan',''),
      (n->>'updatedAt')::timestamptz);
    if saved->'blockDocument' <> doc then raise exception 'document_not_saved'; end if;
    if saved->>'createdAt' <> n->>'createdAt' or saved->>'clinicalAt' <> n->>'clinicalAt' then
      raise exception 'identity_time_changed';
    end if;
    notes[i] := saved;
    denied := false;
    begin
      perform public.clair_save_chart_soap_note_v4(w,actor,e,(n->>'id')::uuid,
        jsonb_build_object('blockDocument',doc,'subjective','','objective','','assessment','','plan',''),
        (n->>'updatedAt')::timestamptz);
    exception when others then if sqlerrm = 'soap_note_conflict' then denied := true; else raise; end if; end;
    if not denied then raise exception 'stale_save_accepted'; end if;
  end loop;
  if jsonb_array_length(public.clair_list_encounter_charts(w,e)) <> 3 then raise exception 'chart_count'; end if;
  for i in 1..3 loop
    if public.clair_get_chart_soap_note_by_id(w,e,(notes[i]->>'id')::uuid)->'blockDocument'
      <> notes[i]->'blockDocument' then raise exception 'cross_chart_overwrite'; end if;
  end loop;
  denied := false;
  begin perform public.clair_get_chart_soap_note(w,e);
  exception when others then if sqlerrm = 'chart_id_required' then denied := true; else raise; end if; end;
  if not denied then raise exception 'ambiguous_reader_accepted'; end if;
  denied := false;
  begin perform public.clair_save_chart_soap_note_v3(w,actor,e,'{}'::jsonb);
  exception when others then if sqlerrm = 'chart_id_required' then denied := true; else raise; end if; end;
  if not denied then raise exception 'ambiguous_writer_accepted'; end if;
  denied := false;
  begin perform public.clair_complete_chart(w,actor,e);
  exception when others then if sqlerrm = 'unfinished_charts' then denied := true; else raise; end if; end;
  if not denied then raise exception 'unfinished_encounter_completed'; end if;
  n := notes[1];
  signed := public.clair_sign_encounter_chart(w,actor,e,(n->>'id')::uuid,(n->>'updatedAt')::timestamptz);
  if signed->>'status' <> 'signed' then raise exception 'sign_failed'; end if;
  if public.clair_get_chart_soap_note_by_id(w,e,(notes[2]->>'id')::uuid)->>'status' <> 'autosaved' then
    raise exception 'other_chart_signed'; end if;
  denied := false;
  begin
    perform public.clair_save_chart_soap_note_v4(w,actor,e,(signed->>'id')::uuid,
      jsonb_build_object('blockDocument',n->'blockDocument','subjective','','objective','','assessment','','plan',''),
      (signed->>'updatedAt')::timestamptz);
  exception when others then if sqlerrm = 'amendment_reason_required' then denied := true; else raise; end if; end;
  if not denied then raise exception 'signed_autosave_accepted'; end if;
  saved := public.clair_save_chart_soap_note_v4(w,actor,e,(signed->>'id')::uuid,
    jsonb_build_object('blockDocument',n->'blockDocument','subjective','','objective','','assessment','','plan',''),
    (signed->>'updatedAt')::timestamptz,'manual_save',null,'Synthetic correction reason');
  if saved->>'status' <> 'amended' then raise exception 'amendment_failed'; end if;
  denied := false;
  begin perform public.clair_get_chart_soap_note_by_id(w,e,'96370000-0000-4000-8000-000000000999');
  exception when others then if sqlerrm = 'chart_unavailable' then denied := true; else raise; end if; end;
  if not denied then raise exception 'foreign_chart_accepted'; end if;
  denied := false;
  begin perform public.clair_create_encounter_chart(w,'00000000-0000-4000-8000-000000000001',e,gen_random_uuid());
  exception when others then if sqlerrm = 'actor_mismatch' then denied := true; else raise; end if; end;
  if not denied then raise exception 'forged_actor_accepted'; end if;
  for i in 2..3 loop
    perform public.clair_sign_encounter_chart(w,actor,e,(notes[i]->>'id')::uuid,(notes[i]->>'updatedAt')::timestamptz);
  end loop;
  if public.clair_complete_chart(w,actor,e)->>'status' <> 'ready_for_billing' then raise exception 'encounter_not_finished'; end if;
  if public.clair_complete_chart(w,actor,e)->>'status' <> 'ready_for_billing' then raise exception 'completion_retry_failed'; end if;
  denied := false;
  begin perform public.clair_create_encounter_chart(w,actor,e,gen_random_uuid());
  exception when others then if sqlerrm = 'stale_status' then denied := true; else raise; end if; end;
  if not denied then raise exception 'finished_encounter_reopened'; end if;
end;
$test$;
reset role;
do $assert$
begin
  if (select count(*) from public.soap_note_revisions where change_reason = 'Synthetic correction reason') <> 1 then
    raise exception 'missing_amendment_history'; end if;
  if not exists(select 1 from public.soap_note_revisions where change_reason = 'Synthetic correction reason'
    and snapshot->>'status' = 'signed' and snapshot->'block_document' is not null) then
    raise exception 'incomplete_amendment_snapshot'; end if;
  if (select count(*) from public.encounters where encounter_no = 'MULTI-CHART-037') <> 1 then
    raise exception 'duplicate_encounter'; end if;
  if (select count(*) from public.waiting_queue_entries
    where encounter_id = '96370000-0000-4000-8000-000000000002' and queue_type = 'billing') <> 1 then
    raise exception 'billing_queue_duplicated'; end if;
  if (select count(*) from public.audit_events where encounter_id = '96370000-0000-4000-8000-000000000002') < 11 then
    raise exception 'missing_transactional_audit'; end if;
end;
$assert$;
select 'PASS encounter_multi_chart_soap_contract' as result;
rollback;
