-- Correct provenance for new lab links to an already accepted workspace item.
-- Neither MAX/latest nor an incoming master revision is an accepted item pin.
set lock_timeout='5s';
set statement_timeout='120s';
create function private.clair_selected_lab_projection_version(p_workspace_id text,p_item_id text,p_link_id text)
returns public.lab_test_item_versions language plpgsql security definer set search_path=pg_catalog,public as $f$
declare revision integer; selected public.lab_test_item_versions;
begin
  select pinned_workspace_result_revision into revision from public.order_catalog_lab_test_item_links where workspace_id=p_workspace_id and id=p_link_id;
  if not found then select workspace_result_revision into revision from public.lab_test_items where workspace_id=p_workspace_id and id=p_item_id; end if;
  select * into selected from public.lab_test_item_versions where workspace_id=p_workspace_id and lab_test_item_id=p_item_id and workspace_result_revision=revision;
  if not found or selected.definition_origin='quarantined' then raise exception 'accepted_lab_definition_version_missing'; end if;
  return selected;
end $f$;
revoke all on function private.clair_selected_lab_projection_version(text,text,text) from public,anon,authenticated,service_role;

create function private.clair_lab_projection_member_from_link(p_workspace_id text,p_link_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $f$
declare l public.order_catalog_lab_test_item_links; v public.lab_test_item_versions;
begin
  select * into strict l from public.order_catalog_lab_test_item_links where workspace_id=p_workspace_id and id=p_link_id;
  select * into strict v from public.lab_test_item_versions where workspace_id=p_workspace_id and lab_test_item_id=l.lab_test_item_id and workspace_result_revision=l.pinned_workspace_result_revision;
  if l.snapshot_metadata->>'itemVersionSourceMasterRecordId' is distinct from v.source_master_record_id::text
    or l.snapshot_metadata->>'itemVersionSourceTestRevision' is distinct from v.source_master_revision::text then raise exception 'lab_projection_existing_metadata_inconsistent'; end if;
  return jsonb_build_object('linkOrigin',l.link_origin,'profileKind',l.profile_kind,'sourceMasterTestRecordId',l.source_master_test_record_id,
    'ownerPinnedSourceTestRevision',l.owner_pinned_source_test_revision,'itemVersionSourceMasterRecordId',v.source_master_record_id,
    'itemVersionSourceTestRevision',v.source_master_revision,'labTestItemId',l.lab_test_item_id,'pinnedWorkspaceResultRevision',l.pinned_workspace_result_revision,
    'sourceOrdinal',l.source_ordinal,'effectiveSortOrder',l.effective_sort_order,'required',l.required,'displayGroup',l.display_group);
end $f$;
revoke all on function private.clair_lab_projection_member_from_link(text,text) from public,anon,authenticated,service_role;

do $patch$
declare d text; old text; line text; matches integer:=0;
begin
  d:=pg_get_functiondef('private.clair_adopt_lab_master_projection_to_workspace_payload(text,uuid)'::regprocedure);
  d:=replace(d,'  v_item_revision integer;',E'  v_item_revision integer;\n  v_selected public.lab_test_item_versions;');
  old:=$a$v_snapshot := pg_catalog.jsonb_build_object('schemaVersion',2,'linkOrigin','clair_master','profileKind'$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>2 then raise exception 'lab_selected_pin_snapshot_anchors'; end if;
  d:=replace(d,old,E'v_selected := private.clair_selected_lab_projection_version(p_workspace_id,v_item_id,v_link_id);\n      '||old);
  d:=replace(d,$a$'itemVersionSourceMasterRecordId',v_test_id,'itemVersionSourceTestRevision',v_test_revision$a$,
    $a$'itemVersionSourceMasterRecordId',v_selected.source_master_record_id,'itemVersionSourceTestRevision',v_selected.source_master_revision$a$);
  d:=replace(d,$a$'pinnedWorkspaceResultRevision',1$a$,$a$'pinnedWorkspaceResultRevision',v_selected.workspace_result_revision$a$);
  old:=$a$(v_member->>'sortOrder')::integer,(v_member->>'sortOrder')::integer,1,$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_selected_pin_panel_column_anchor'; end if;
  d:=replace(d,old,$a$(v_member->>'sortOrder')::integer,(v_member->>'sortOrder')::integer,v_selected.workspace_result_revision,$a$);
  old:='v_catalog.source_master_record_id,v_source_revision,v_test_id,v_test_revision,null,0,1,true,null,';
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_selected_pin_test_column_anchor'; end if;
  d:=replace(d,old,'v_catalog.source_master_record_id,v_source_revision,v_test_id,v_test_revision,null,0,v_selected.workspace_result_revision,true,null,');
  -- Assignment does not change FOUND, preserving the existing insertion counter.
  for line in select regexp_split_to_table(d,E'\n') loop
    if btrim(line) like 'v_members := %jsonb_build_array%jsonb_build_object%' then
      d:=replace(d,line,case when line like '%v_members ||%' then
        '        v_members := v_members || jsonb_build_array(private.clair_lab_projection_member_from_link(p_workspace_id,v_link_id));'
        else '      v_members := jsonb_build_array(private.clair_lab_projection_member_from_link(p_workspace_id,v_link_id));' end);
      matches:=matches+1;
    end if;
  end loop;
  if matches<>2 then raise exception 'lab_selected_pin_member_anchors'; end if;
  execute d;
end $patch$;

-- The canonical result is frozen after task creation. Attach only the exact
-- current task attempt; ambiguity is an error, never a first/latest-row choice.
do $patch$
declare d text; old text;
begin
  d:=pg_get_functiondef('public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)'::regprocedure);
  old:='  update public.order_billing_candidates candidate';
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_result_post_freeze_attach_anchor'; end if;
  execute replace(d,old,$a$
  perform private.clair_attach_lab_result_work_item(p_workspace_id,p_actor_user_id,wi.order_id,wi.id)
      from public.order_fulfillment_work_items wi
      join public.order_tasks task on task.workspace_id=wi.workspace_id
        and task.id=wi.task_id and task.attempt_no=wi.task_attempt_no
      join public.orders selected_order on selected_order.workspace_id=wi.workspace_id and selected_order.id=wi.order_id
      where wi.workspace_id=p_workspace_id
        and wi.encounter_id=p_encounter_id and wi.queue_type='lab'
        and task.attempt_no=1
        and (selected_order.id=any(p_selected_root_order_ids) or selected_order.parent_chart_order_line_id=any(p_selected_root_order_ids))
      order by wi.order_id,wi.id;
$a$||old);
end $patch$;

-- Confirming a later order in an encounter must not rewrite completed siblings.
do $patch$
declare d text; old text;
begin
  d:=pg_get_functiondef('public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)'::regprocedure);
  old:=$a$    and task.attempt_no = item.task_attempt_no
    and task.encounter_id = p_encounter_id
    and task.attempt_no = 1;$a$;
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'lab_confirm_work_projection_anchor'; end if;
  execute replace(d,old,$a$    and task.attempt_no = item.task_attempt_no
    and task.encounter_id = p_encounter_id
    and task.attempt_no = 1
    and task.status not in ('complete','cancelled')
    and item.source_snapshot is distinct from task.effective_snapshot
    and exists(select 1 from public.orders selected_order where selected_order.workspace_id=p_workspace_id and selected_order.id=task.order_id
      and (selected_order.id=any(p_selected_root_order_ids) or selected_order.parent_chart_order_line_id=any(p_selected_root_order_ids)));$a$);
end $patch$;
