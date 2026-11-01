-- Scoped synthetic instructions fixture (inside runner rollback transaction).
update encounters set status='ordered' where id='20000000-0000-4000-8000-000000000001';
insert into soap_notes values('51000000-0000-4000-8000-000000000001','workspace-a','20000000-0000-4000-8000-000000000001','draft');
insert into orders(id,workspace_id,encounter_id,origin_chart_id,status,clinical_order_type,destination_module,order_confirmation_status,row_type,requested_by_user_id,sort_order,detail_inputs)
select ('52000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a','20000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',
 'requested',case when n=3 then 'clinical_lab' else 'dispensing' end,case when n=3 then 'lab' else 'dispensing' end,'confirmed','single',
 '00000000-0000-4000-8000-000000000003',n,jsonb_build_object('route',case when n=1 then 'PO' else 'TOP' end)
from generate_series(1,3) n;
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,status,priority,attempt_no,effective_snapshot)
select ('53000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,'execution',clinical_order_type,destination_module,'pending','normal',1,
 jsonb_build_object('detailInputs',detail_inputs) from orders where id::text like '52000000%';
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,status,queue_type,clinical_order_type,destination_module,source_snapshot,requested_by_user_id,assigned_to_user_id)
select ('54000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,'requested',destination_module,clinical_order_type,destination_module,'{}',
 '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001'
from order_tasks where id::text like '53000000%';

do $$
declare chart uuid:='51000000-0000-4000-8000-000000000001'; po uuid:='53000000-0000-4000-8000-000000000001';
 topical uuid:='53000000-0000-4000-8000-000000000002'; lab uuid:='53000000-0000-4000-8000-000000000003';
 d jsonb; review jsonb; cmd jsonb; saved jsonb; old_key text; count_before bigint; wi uuid:='54000000-0000-4000-8000-000000000001';
begin
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 perform public.clair_save_chart_oral_instruction('workspace-a',chart,0,'legacy PO only');
 d:=public.clair_get_overall_instructions('workspace-a',chart);
 if d#>>'{current,0,legacy}'<>'true' then raise exception 'legacy not available for explicit apply'; end if;
 if jsonb_array_length(private.clair_task_effective_instructions('workspace-a',topical)->'entries')<>0 then raise exception 'legacy widened to topical'; end if;
 if jsonb_array_length(private.clair_task_effective_instructions('workspace-a',po)->'entries')<>1 then raise exception 'legacy PO lost'; end if;
 cmd:=jsonb_build_object('commandId',gen_random_uuid(),'changes',jsonb_build_array(jsonb_build_object('scope','dispensing','expectedRevision',1,'operation','set','instruction','legacy PO only')));
 saved:=public.clair_apply_overall_instructions('workspace-a',chart,cmd);
 if saved is distinct from public.clair_apply_overall_instructions('workspace-a',chart,cmd) then raise exception 'replay changed outcome'; end if;
 if (select count(*) from private.chart_instruction_revisions where chart_id=chart)<>1 then raise exception 'duplicate revision'; end if;
 if (select count(*) from notification_events where event_key='overall_instruction_changed')<>1 then raise exception 'multi-task notification not deduped'; end if;
 if jsonb_array_length(private.clair_task_effective_instructions('workspace-a',topical)->'entries')<>1 then raise exception 'promotion did not reach topical'; end if;
 if jsonb_array_length(private.clair_task_effective_instructions('workspace-a',lab)->'entries')<>0 then raise exception 'unrelated category received dispensing'; end if;
 begin
  perform public.clair_save_chart_oral_instruction('workspace-a',chart,1,'divergent old writer');
  raise exception 'old writer still live';
 exception when raise_exception then if sqlerrm<>'legacy_instruction_retired' then raise; end if; end;
 begin
  perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_set(cmd,'{changes,0,instruction}','"replay mutation"'));
  raise exception 'payload mismatch replay';
 exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 begin
  perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes','[{"scope":"overall","expectedRevision":0,"operation":"set","instruction":"must rollback"},{"scope":"dispensing","expectedRevision":1,"operation":"set","instruction":"stale"}]'::jsonb));
  raise exception 'partial scope commit';
 exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
 if exists(select 1 from private.chart_instruction_revisions where chart_id=chart and scope='overall') then raise exception 'atomic save violated'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 review:=public.clair_get_task_instruction_review('workspace-a',po);
 old_key:=review#>>'{current,versionKey}';
 if not (review->>'requiresAcknowledgement')::boolean then raise exception 'missing acknowledgement requirement'; end if;
 begin perform private.clair_require_task_instruction_ack('workspace-a',po,auth.uid()); raise exception 'unacknowledged allowed';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 -- Both real mutation paths reject missing acknowledgement before state changes.
 d:=public.clair_get_fulfillment_instruction('workspace-a',wi);
 begin
  perform public.clair_mutate_fulfillment_instruction('workspace-a',wi,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  raise exception 'instruction claim bypassed acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 begin
  perform public.clair_transition_fulfillment_work_item('workspace-a',auth.uid(),wi,'start',(select row_revision from order_fulfillment_work_items where id=wi),gen_random_uuid(),null,null,null);
  raise exception 'generic start bypassed acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 if (select status from order_tasks where id=po)<>'pending' then raise exception 'failed transition wrote state'; end if;
 perform public.clair_acknowledge_task_instructions('workspace-a',po,old_key);
 perform private.clair_require_task_instruction_ack('workspace-a',topical,auth.uid());
 if (public.clair_get_task_instruction_review('workspace-a',topical)->>'requiresAcknowledgement')::boolean then raise exception 'same chart/vector not reused'; end if;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000002',true);
 begin perform private.clair_require_task_instruction_ack('workspace-a',po,auth.uid()); raise exception 'another actor inherited acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object('commandId',gen_random_uuid(),'changes','[{"scope":"dispensing","expectedRevision":2,"operation":"delete"}]'::jsonb));
 perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
 begin -- Both real mutation paths reject missing acknowledgement before state changes.
 d:=public.clair_get_fulfillment_instruction('workspace-a',wi);
 begin
  perform public.clair_mutate_fulfillment_instruction('workspace-a',wi,jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  raise exception 'instruction claim bypassed acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 begin
  perform public.clair_transition_fulfillment_work_item('workspace-a',auth.uid(),wi,'start',(select row_revision from order_fulfillment_work_items where id=wi),gen_random_uuid(),null,null,null);
  raise exception 'generic start bypassed acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 if (select status from order_tasks where id=po)<>'pending' then raise exception 'failed transition wrote state'; end if;
 perform public.clair_acknowledge_task_instructions('workspace-a',po,old_key); raise exception 'stale acknowledgement';
 exception when raise_exception then if sqlerrm<>'instruction_version_conflict' then raise; end if; end;
 review:=public.clair_get_task_instruction_review('workspace-a',po);
 if review#>>'{current,entries,0,deleted}'<>'true' or not (review->>'requiresAcknowledgement')::boolean then raise exception 'deletion hidden'; end if;
 -- Requester completion remains authorized but needs that requester's own review.
 perform set_config('test.actor','00000000-0000-4000-8000-000000000003',true);
 d:=public.clair_get_fulfillment_instruction('workspace-a',wi);
 begin
  perform public.clair_mutate_fulfillment_instruction('workspace-a',wi,jsonb_build_object('action','complete','itemId',wi,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  raise exception 'requester skipped review';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 review:=public.clair_get_task_instruction_review('workspace-a',po);
 perform public.clair_acknowledge_task_instructions('workspace-a',po,review#>>'{current,versionKey}');
 cmd:=jsonb_build_object('action','complete','itemId',wi,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision');
 perform public.clair_mutate_fulfillment_instruction('workspace-a',wi,cmd);
 perform public.clair_mutate_fulfillment_instruction('workspace-a',wi,cmd);
 if (select status from order_tasks where id=po)<>'complete' or (select count(*) from private.task_instruction_snapshots where task_id=po and phase='completed')<>1 then raise exception 'requester completion/snapshot/replay failed'; end if;
 if (select document#>>'{entries,0,deleted}' from private.task_instruction_snapshots where task_id=po and phase='completed')<>'true' then raise exception 'completion did not retain deletion version'; end if;
 if (select count(*) from private.task_instruction_snapshots where task_id=po and phase='requested')<>1 then raise exception 'request snapshot changed'; end if;
 if (select document->'entries' from private.task_instruction_snapshots where task_id=po and phase='requested')<>'[]'::jsonb then raise exception 'historical empty snapshot overwritten'; end if;
 update encounters set status='completed' where id='20000000-0000-4000-8000-000000000001';
 if public.clair_get_overall_instructions('workspace-a',chart)->>'readOnlyReason'<>'encounter_read_only' then raise exception 'encounter eligibility mismatch'; end if;
 update encounters set status='ordered' where id='20000000-0000-4000-8000-000000000001';
 -- Read-only mixed terminal state and reopening follow confirmed order state.
 update orders set status=case when id::text like '%000001' then 'completed' else 'cancelled' end where origin_chart_id=chart;
 if public.clair_get_overall_instructions('workspace-a',chart)->>'readOnlyReason'<>'terminal_orders' then raise exception 'mixed terminal editable'; end if;
 update orders set status='requested' where id='52000000-0000-4000-8000-000000000003';
 if not (public.clair_get_overall_instructions('workspace-a',chart)->>'canEdit')::boolean then raise exception 'new active work did not reopen'; end if;
 begin perform public.clair_get_overall_instructions('workspace-b',chart); raise exception 'foreign workspace readable';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: overall atomic saves, replay, legacy scope, notifications, actor/vector acknowledgement, deletion, immutable snapshots, mixed terminal editability';
end $$;
