-- Synthetic, transactional downgrade proof. Run only on a disposable DB with
-- the SOAP V1/V2, multi-chart, and private attachment migrations installed.
begin;
insert into auth.users (id, aud, role, email)
values ('10000000-0000-4000-8000-000000000040', 'authenticated', 'authenticated', 'soap-capability@example.invalid');
insert into public.users (id, display_name)
values ('10000000-0000-4000-8000-000000000040', 'Synthetic capability actor');
insert into public.workspaces (id, display_name)
values ('soap-capability-proof', 'Synthetic capability workspace');
insert into public.user_memberships (id, workspace_id, user_id, roles, status)
values ('20000000-0000-4000-8000-000000000040', 'soap-capability-proof',
  '10000000-0000-4000-8000-000000000040', array['hospital_admin'], 'active');
insert into public.patients (id, workspace_id, patient_no, name, species)
values ('30000000-0000-4000-8000-000000000040', 'soap-capability-proof', 'SYN-040', 'Synthetic', 'dog');
insert into public.encounters (id, workspace_id, patient_id, encounter_no, reception_type, status)
values ('40000000-0000-4000-8000-000000000040', 'soap-capability-proof',
  '30000000-0000-4000-8000-000000000040', 'SYN-040', 'walk_in', 'in_consultation');
insert into public.encounters (id, workspace_id, patient_id, encounter_no, reception_type, status)
values ('40000000-0000-4000-8000-000000000041', 'soap-capability-proof',
  '30000000-0000-4000-8000-000000000040', 'SYN-041', 'walk_in', 'in_consultation');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000040', true);
do $proof$
declare
  v_rich jsonb := $rich${"schemaVersion":1,"blocks":[{
    "id":"section-1","type":"soapSection",
    "props":{"kind":"objective","label":"Objective","scope":"default","systemLabel":"Default"},
    "children":[{"id":"table-1","type":"table","props":{"textColor":"default"},
      "content":{"type":"tableContent","columnWidths":[null],"rows":[{"cells":[{
        "type":"tableCell","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left","colspan":1,"rowspan":1},
        "content":[{"type":"text","text":"Synthetic","styles":{}}]
      }]}]},"children":[]}]}
  ]}$rich$::jsonb;
  v_plain jsonb := $plain${"schemaVersion":1,"blocks":[{
    "id":"section-1","type":"soapSection",
    "props":{"kind":"objective","label":"Objective","scope":"default","systemLabel":"Default"},
    "children":[{"id":"text-1","type":"paragraph","props":{"backgroundColor":"default","textColor":"default","textAlignment":"left"},
      "content":[{"type":"text","text":"Updated","styles":{}}],"children":[]}]}
  ]}$plain$::jsonb;
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
  v_fourth jsonb;
begin
  -- A new editor may create a bounded table; the old v3 RPC signature stays intact.
  v_first := public.clair_save_chart_soap_note_v3(
    'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
    '40000000-0000-4000-8000-000000000040',
    pg_catalog.jsonb_build_object('objective','Synthetic','subjective','','assessment','','plan','',
      'blockDocument',v_rich,'editorCapability','media_table_v1'), null, 'manual_save', null);
  if v_first->>'id' is null or v_first->>'auditRecorded' <> 'true' then
    raise exception 'capable create did not persist and audit';
  end if;

  -- The old deployment sends the same schemaVersion but no capability. It
  -- cannot remove the persisted table, even with a current revision timestamp.
  begin
    perform public.clair_save_chart_soap_note_v3(
      'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
      '40000000-0000-4000-8000-000000000040',
      pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
        'blockDocument',v_plain), (v_first->>'updatedAt')::timestamptz, 'manual_save', null);
    raise exception 'legacy downgrade was accepted';
  exception when check_violation then
    if sqlerrm <> 'soap_editor_upgrade_required' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_soap_note_v2(
      'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
      '40000000-0000-4000-8000-000000000040',
      pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
        'blockDocument',v_plain), (v_first->>'updatedAt')::timestamptz, 'manual_save', null);
    raise exception 'legacy v2 downgrade was accepted';
  exception when check_violation then
    if sqlerrm <> 'soap_editor_upgrade_required' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_soap_note(
      'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
      '40000000-0000-4000-8000-000000000040',
      pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan',''),
      (v_first->>'updatedAt')::timestamptz, 'manual_save');
    raise exception 'legacy v1 projection overwrite was accepted';
  exception when raise_exception then
    if sqlerrm <> 'soap_client_upgrade_required' then raise; end if;
  end;

  -- Explicit new editor capability permits intentional table removal.
  v_second := public.clair_save_chart_soap_note_v3(
    'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
    '40000000-0000-4000-8000-000000000040',
    pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
      'blockDocument',v_plain,'editorCapability','media_table_v1'),
    (v_first->>'updatedAt')::timestamptz, 'manual_save', null);
  if v_second->>'objective' <> 'Updated' then raise exception 'capable removal failed'; end if;

  -- Multi-chart v4 retains its chart ID and optimistic revision contract.
  v_third := public.clair_save_chart_soap_note_v4(
    'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
    '40000000-0000-4000-8000-000000000040', (v_second->>'id')::uuid,
    pg_catalog.jsonb_build_object('objective','Synthetic','subjective','','assessment','','plan','',
      'blockDocument',v_rich,'editorCapability','media_table_v1'),
    (v_second->>'updatedAt')::timestamptz, 'manual_save', null, null);
  begin
    perform public.clair_save_chart_soap_note_v4(
      'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
      '40000000-0000-4000-8000-000000000040', (v_third->>'id')::uuid,
      pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
        'blockDocument',v_plain),
      (v_third->>'updatedAt')::timestamptz, 'manual_save', null, null);
    raise exception 'legacy multi-chart downgrade was accepted';
  exception when check_violation then
    if sqlerrm <> 'soap_editor_upgrade_required' then raise; end if;
  end;
  v_fourth := public.clair_save_chart_soap_note_v4(
    'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
    '40000000-0000-4000-8000-000000000040', (v_third->>'id')::uuid,
    pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
      'blockDocument',v_plain,'editorCapability','media_table_v1'),
    (v_third->>'updatedAt')::timestamptz, 'manual_save', null, null);
  if v_fourth->>'objective' <> 'Updated' then raise exception 'capable multi-chart removal failed'; end if;
  v_first := public.clair_save_chart_soap_note_v3(
    'soap-capability-proof', '10000000-0000-4000-8000-000000000040',
    '40000000-0000-4000-8000-000000000041',
    pg_catalog.jsonb_build_object('objective','Updated','subjective','','assessment','','plan','',
      'blockDocument',v_plain), null, 'manual_save', null);
  if v_first->>'objective' <> 'Updated' then raise exception 'legacy plain save regressed'; end if;
end;
$proof$;
reset role;
do $audit$
declare v_count integer;
begin
  if private.clair_soap_has_rich_blocks(
    '[{"blocks":[{"type":"soapSection","children":[{"type":"image","children":[]}]}]}]'::jsonb, 2::smallint
  ) is distinct from true
    or private.clair_soap_has_rich_blocks(
      '[{"blocks":[{"type":"paragraph","children":[]}]}]'::jsonb, 2::smallint
    ) is distinct from false
  then raise exception 'nested V2 media detection failed'; end if;
  select count(*) into v_count from public.audit_events
  where workspace_id = 'soap-capability-proof' and event_type = 'chart.soap_saved';
  if v_count <> 5 then raise exception 'expected exactly five successful save audits'; end if;
end;
$audit$;
rollback;
