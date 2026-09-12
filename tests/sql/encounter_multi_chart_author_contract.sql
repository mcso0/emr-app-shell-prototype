\set ON_ERROR_STOP on
-- Run only in an isolated, migrated database with synthetic supabase/seed.sql fixtures.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
insert into public.patients(id, workspace_id, patient_no, name, species, sex)
values ('96373000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam',
  'MULTI-CHART-AUTHOR-037', 'Synthetic multi chart patient', 'dog', 'unknown');
insert into public.encounters(id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status, started_at)
values ('96373000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam',
  '96373000-0000-4000-8000-000000000001', '49110000-0000-4000-8000-000000000003',
  'MULTI-CHART-AUTHOR-037', 'walk_in', 'in_consultation', now());
update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:view","chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';

insert into public.soap_notes(id,workspace_id,encounter_id,status,author_user_id)
values('96373000-0000-4000-8000-000000000003','workspace-clair-cheongdam','96373000-0000-4000-8000-000000000002','draft',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','49110000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare w text:='workspace-clair-cheongdam'; a text:='49110000-0000-4000-8000-000000000003';
 e uuid:='96373000-0000-4000-8000-000000000002'; c uuid:='96373000-0000-4000-8000-000000000003'; n jsonb; doc jsonb; payload jsonb; i integer;
begin
 doc:='{"schemaVersion":1,"blocks":[{"id":"synthetic-author","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Synthetic preserved original author","styles":{}}],"children":[]}]}'::jsonb;
 payload:=jsonb_build_object('blockDocument',doc,'subjective','','objective','','assessment','','plan','');
 for i in 1..4 loop
   n:=public.clair_get_chart_soap_note_by_id(w,e,c);
   if i=1 then n:=public.clair_save_chart_soap_note(w,a,e,payload,(n->>'updatedAt')::timestamptz);
   elsif i=2 then n:=public.clair_save_chart_soap_note_v2(w,a,e,payload,(n->>'updatedAt')::timestamptz);
   elsif i=3 then n:=public.clair_save_chart_soap_note_v3(w,a,e,payload,(n->>'updatedAt')::timestamptz);
   else n:=public.clair_save_chart_soap_note_v4(w,a,e,c,payload,(n->>'updatedAt')::timestamptz);
   end if;
   if n->>'authorUserId' is not null then raise exception 'null_original_author_reattributed: %',i; end if;
 end loop;
end $test$;
select 'PASS encounter_multi_chart_author_contract';
rollback;
