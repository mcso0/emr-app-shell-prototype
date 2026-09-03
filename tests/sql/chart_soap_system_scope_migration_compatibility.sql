\set ON_ERROR_STOP on

-- Run with:
-- psql \
--   -v soap_block_document_migration=/absolute/path/to/20260831120000_chart_soap_block_document.sql \
--   -v soap_system_scope_migration=/absolute/path/to/20260903104212_chart_soap_system_scope_v2.sql \
--   -f tests/sql/chart_soap_system_scope_migration_compatibility.sql
-- Both migrations and all synthetic fixtures are intentionally rolled back.

begin;
\i :soap_block_document_migration
\i :soap_system_scope_migration

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species,
  sex
)
values (
  '96100000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'SOAP-SCOPE-TEST',
  'SOAP scope compatibility test',
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
  '96100000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '96100000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'SOAP-SCOPE-TEST',
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
      "schemaVersion": 2,
      "scopes": [
        {
          "scopeKey": "default",
          "scope": "default",
          "systemLabel": "기본 SOAP",
          "blocks": [
            {
              "id": "default-s",
              "type": "soapSection",
              "props": {
                "kind": "subjective",
                "label": "주관적",
                "systemLabel": "기본 SOAP",
                "scope": "default"
              },
              "children": [
                {
                  "id": "default-s-child",
                  "type": "paragraph",
                  "props": {
                    "backgroundColor": "default",
                    "textColor": "default",
                    "textAlignment": "left"
                  },
                  "content": [
                    { "type": "text", "text": "기본 보호자 진술", "styles": {} }
                  ],
                  "children": []
                }
              ]
            },
            {
              "id": "default-root",
              "type": "paragraph",
              "props": {
                "backgroundColor": "default",
                "textColor": "default",
                "textAlignment": "left"
              },
              "content": [
                { "type": "text", "text": "기존 자유 입력", "styles": {} }
              ],
              "children": []
            }
          ]
        },
        {
          "scopeKey": "system:system-musculoskeletal",
          "scope": "system",
          "systemId": "system-musculoskeletal",
          "systemLabel": "근골격계",
          "blocks": [
            {
              "id": "musculoskeletal-s",
              "type": "soapSection",
              "props": {
                "kind": "subjective",
                "label": "주관적",
                "systemLabel": "근골격계",
                "scope": "system"
              },
              "children": [
                {
                  "id": "musculoskeletal-s-child",
                  "type": "paragraph",
                  "props": {
                    "backgroundColor": "default",
                    "textColor": "default",
                    "textAlignment": "left"
                  },
                  "content": [
                    { "type": "text", "text": "근골격계 전용 진술", "styles": {} }
                  ],
                  "children": []
                }
              ]
            }
          ]
        }
      ]
    }
  $document$::jsonb;
  v_saved jsonb;
  v_revised jsonb;
  v_downgrade_guarded boolean := false;
begin
  if to_regprocedure(
    'public.clair_save_chart_soap_note_v3(text,text,uuid,jsonb,timestamptz,text,text)'
  ) is null then
    raise exception 'v3_writer_missing_after_scope_migration';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.clair_save_chart_soap_note_v3(text,text,uuid,jsonb,timestamptz,text,text)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.clair_save_chart_soap_note_v3(text,text,uuid,jsonb,timestamptz,text,text)',
    'execute'
  ) then
    raise exception 'v3_writer_grant_boundary_invalid';
  end if;

  v_saved := public.clair_save_chart_soap_note_v3(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96100000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'blockDocument', v_document,
      'subjective', '기본 보호자 진술',
      'objective', '',
      'assessment', '',
      'plan', ''
    ),
    null,
    'autosave',
    'soap-system-scope-save'
  );

  if v_saved->>'subjective' is distinct from '기본 보호자 진술'
    or v_saved->'blockDocument' is distinct from v_document
    or v_saved->>'auditHandledBy' is distinct from 'database_transaction'
    or v_saved->>'subjective' like '%근골격계 전용 진술%'
  then
    raise exception 'v3_scope_persistence_or_projection_failed';
  end if;

  begin
    perform public.clair_save_chart_soap_note_v2(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '96100000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'blockDocument', jsonb_build_object(
          'schemaVersion', 1,
          'blocks', v_document->'scopes'->0->'blocks'
        ),
        'subjective', '기본 보호자 진술',
        'objective', '',
        'assessment', '',
        'plan', ''
      ),
      (v_saved->>'updatedAt')::timestamptz,
      'autosave',
      'soap-system-scope-downgrade'
    );
  exception
    when others then
      if sqlerrm = 'soap_client_upgrade_required' then
        v_downgrade_guarded := true;
      else
        raise;
      end if;
  end;

  if not v_downgrade_guarded then
    raise exception 'v2_writer_downgrade_was_not_guarded';
  end if;

  v_document := jsonb_set(
    v_document,
    '{scopes,1,blocks,0,children,0,content,0,text}',
    '"근골격계 수정 진술"'::jsonb
  );
  v_revised := public.clair_save_chart_soap_note_v3(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96100000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'blockDocument', v_document,
      'subjective', '기본 보호자 진술',
      'objective', '',
      'assessment', '',
      'plan', ''
    ),
    (v_saved->>'updatedAt')::timestamptz,
    'manual_save',
    'soap-system-scope-revise'
  );

  if v_revised->'blockDocument'->'scopes'->1->'blocks'->0->'children'->0
      ->'content'->0->>'text' is distinct from '근골격계 수정 진술'
    or v_revised->>'subjective' is distinct from '기본 보호자 진술'
  then
    raise exception 'v3_scope_revision_failed';
  end if;
end;
$test$;

reset role;
rollback;
