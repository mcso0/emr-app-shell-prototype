\set ON_ERROR_STOP on

-- Run with:
-- psql -v soap_block_document_migration=/absolute/path/to/migration.sql \
--   -f tests/sql/chart_soap_block_document_migration_compatibility.sql
-- The migration and all fixtures are intentionally rolled back.

begin;
\i :soap_block_document_migration

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  sex
)
values (
  '96000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'SOAP-COMPAT-TEST',
  'SOAP compatibility test',
  'dog',
  'unknown'
);

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  status,
  started_at
)
values (
  '96000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '96000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'SOAP-COMPAT-TEST',
  'walk_in',
  'in_consultation',
  now()
);

update public.workspace_permission_roles role
set permissions = '{"allowed":["chart:update"]}'::jsonb
from public.workspace_membership_permission_role_assignments assignment
join public.user_memberships membership
  on membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
where role.workspace_id = assignment.workspace_id
  and role.id = assignment.permission_role_id
  and membership.workspace_id = 'workspace-clair-cheongdam'
  and membership.user_id = '49110000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $test$
declare
  v_document jsonb := $document$
    {
      "schemaVersion": 1,
      "blocks": [
        {
          "id": "section-s",
          "type": "soapSection",
          "props": {
            "kind": "subjective",
            "label": "주관적",
            "systemLabel": "기본 SOAP",
            "scope": "default"
          },
          "children": [
            {
              "id": "section-s-child",
              "type": "paragraph",
              "props": {
                "backgroundColor": "default",
                "textColor": "default",
                "textAlignment": "left"
              },
              "content": [
                { "type": "text", "text": "V2 보호자 진술", "styles": {} }
              ],
              "children": []
            }
          ]
        },
        {
          "id": "section-o",
          "type": "soapSection",
          "props": {
            "kind": "objective",
            "label": "객관적",
            "systemLabel": "기본 SOAP",
            "scope": "default"
          },
          "children": [
            {
              "id": "section-o-child",
              "type": "paragraph",
              "props": {
                "backgroundColor": "default",
                "textColor": "default",
                "textAlignment": "left"
              },
              "content": [],
              "children": []
            }
          ]
        },
        {
          "id": "section-a",
          "type": "soapSection",
          "props": {
            "kind": "assessment",
            "label": "평가",
            "systemLabel": "기본 SOAP",
            "scope": "default"
          },
          "children": [
            {
              "id": "section-a-child",
              "type": "paragraph",
              "props": {
                "backgroundColor": "default",
                "textColor": "default",
                "textAlignment": "left"
              },
              "content": [],
              "children": []
            }
          ]
        },
        {
          "id": "section-p",
          "type": "soapSection",
          "props": {
            "kind": "plan",
            "label": "계획",
            "systemLabel": "기본 SOAP",
            "scope": "default"
          },
          "children": [
            {
              "id": "section-p-child",
              "type": "paragraph",
              "props": {
                "backgroundColor": "default",
                "textColor": "default",
                "textAlignment": "left"
              },
              "content": [],
              "children": []
            }
          ]
        }
      ]
    }
  $document$::jsonb;
  v_legacy jsonb;
  v_v2 jsonb;
  v_v2_revised jsonb;
  v_guarded boolean := false;
  v_get_denied boolean := false;
begin
  if to_regprocedure(
    'public.clair_save_chart_soap_note(text,text,uuid,jsonb,timestamptz,text)'
  ) is null then
    raise exception 'legacy_writer_missing_after_additive_migration';
  end if;

  if to_regprocedure(
    'public.clair_save_chart_soap_note_v2(text,text,uuid,jsonb,timestamptz,text,text)'
  ) is null then
    raise exception 'v2_writer_missing_after_additive_migration';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.clair_save_chart_soap_note_v2(text,text,uuid,jsonb,timestamptz,text,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.clair_save_chart_soap_note_v2(text,text,uuid,jsonb,timestamptz,text,text)',
    'execute'
  ) then
    raise exception 'v2_writer_grant_boundary_invalid';
  end if;

  v_legacy := public.clair_save_chart_soap_note(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'subjective', 'legacy 보호자 진술',
      'objective', '',
      'assessment', '',
      'plan', ''
    ),
    null,
    'autosave'
  );

  if v_legacy->>'subjective' is distinct from 'legacy 보호자 진술'
    or v_legacy ? 'blockDocument'
  then
    raise exception 'legacy_writer_broke_during_migration_first_window';
  end if;

  begin
    perform public.clair_get_chart_soap_note(
      'workspace-clair-cheongdam',
      '96000000-0000-4000-8000-000000000002'
    );
  exception
    when sqlstate '42501' then
      if sqlerrm = 'permission_missing' then
        v_get_denied := true;
      else
        raise;
      end if;
  end;

  if not v_get_denied then
    raise exception 'update_only_actor_unexpectedly_acquired_chart_view';
  end if;

  v_v2 := public.clair_save_chart_soap_note_v2(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'blockDocument', v_document,
      'subjective', 'V2 보호자 진술',
      'objective', '',
      'assessment', '',
      'plan', ''
    ),
    (v_legacy->>'updatedAt')::timestamptz,
    'manual_save',
    'soap-compat-v2-save'
  );

  if v_v2->>'subjective' is distinct from 'V2 보호자 진술'
    or v_v2->'blockDocument' is distinct from v_document
    or v_v2->>'auditHandledBy' is distinct from 'database_transaction'
  then
    raise exception 'v2_writer_canonical_persistence_failed';
  end if;

  v_document := jsonb_set(
    v_document,
    '{blocks,0,children,0,content,0,text}',
    to_jsonb('V2 수정 진술'::text)
  );
  v_v2_revised := public.clair_save_chart_soap_note_v2(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'blockDocument', v_document,
      'subjective', 'V2 수정 진술',
      'objective', '',
      'assessment', '',
      'plan', ''
    ),
    (v_v2->>'updatedAt')::timestamptz,
    'autosave',
    'soap-compat-v2-revision'
  );

  if v_v2_revised->>'subjective' is distinct from 'V2 수정 진술'
    or v_v2_revised->'blockDocument' is distinct from v_document
  then
    raise exception 'v2_writer_canonical_revision_failed';
  end if;

  begin
    perform public.clair_save_chart_soap_note(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '96000000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'subjective', 'stale legacy overwrite',
        'objective', '',
        'assessment', '',
        'plan', ''
      ),
      (v_v2_revised->>'updatedAt')::timestamptz,
      'autosave'
    );
  exception
    when others then
      if sqlerrm = 'soap_client_upgrade_required' then
        v_guarded := true;
      else
        raise;
      end if;
  end;

  if not v_guarded then
    raise exception 'legacy_writer_overwrote_canonical_document';
  end if;

end;
$test$;

reset role;

do $audit$
begin
  if not exists (
    select 1
    from public.audit_events
    where workspace_id = 'workspace-clair-cheongdam'
      and encounter_id = '96000000-0000-4000-8000-000000000002'
      and request_id = 'soap-compat-v2-save'
      and event_type = 'chart.soap_saved'
  ) then
    raise exception 'v2_writer_audit_event_missing';
  end if;

  if not exists (
    select 1
    from public.audit_events
    where workspace_id = 'workspace-clair-cheongdam'
      and encounter_id = '96000000-0000-4000-8000-000000000002'
      and request_id = 'soap-compat-v2-revision'
      and event_type = 'chart.soap_saved'
  ) then
    raise exception 'v2_writer_revision_audit_event_missing';
  end if;

  if not exists (
    select 1
    from public.soap_notes
    where workspace_id = 'workspace-clair-cheongdam'
      and encounter_id = '96000000-0000-4000-8000-000000000002'
      and subjective = 'V2 수정 진술'
      and block_document #>> '{0,children,0,content,0,text}' = 'V2 수정 진술'
  ) then
    raise exception 'legacy_rejection_did_not_preserve_canonical_row';
  end if;
end;
$audit$;

rollback;

do $residue$
begin
  if exists (
    select 1
    from public.patients
    where id = '96000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.encounters
    where id = '96000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'soap_compatibility_test_residue_detected';
  end if;
end;
$residue$;
