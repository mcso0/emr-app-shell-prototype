-- Reuse the synthetic WP03 confirmed second attempt; all changes roll back.
do $test$
declare actor uuid:=(select user_id from wp01b_actor); wi public.order_fulfillment_work_items;
  t public.order_tasks; c jsonb; result jsonb; again jsonb; initial_plan jsonb; confirmed_plan jsonb; first_id uuid;
  cmd uuid:='97080000-0000-4000-8000-000000000001'; stamp timestamptz:=now();
begin
  select * into strict wi from public.order_fulfillment_work_items
    where order_id='97030000-0000-4000-8000-000000000004' and task_attempt_no=2;
  select * into strict t from public.order_tasks where id=wi.task_id;
  initial_plan:=t.effective_snapshot;
  select confirmed_snapshot into confirmed_plan from public.orders where id=t.order_id;
  if t.execution_result_schema_version<>1 then raise exception 'new task result contract missing'; end if;
  perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'start',wi.row_revision,
    '97080000-0000-4000-8000-000000000002',null,null,null);
  select * into wi from public.order_fulfillment_work_items where id=wi.id;
  begin
    perform public.clair_transition_fulfillment_work_item('clair-demo',actor,wi.id,'complete',wi.row_revision,
      '97080000-0000-4000-8000-000000000003',null,null,null);
    raise exception 'test unrecorded completion succeeded';
  exception when others then
    if sqlerrm<>'actual_execution_result_required' then raise; end if;
  end;
  c:=public.clair_get_order_execution_context('clair-demo',wi.id);
  if jsonb_array_length(c->'results')<>0 or c->>'workspaceId'<>'clair-demo' then raise exception 'context shape failure'; end if;
  begin
    perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,c->>'planSha256',0,cmd,
      stamp,'{"preparedQuantity":7.5,"preparedUnit":"tablet"}',null,null);
    raise exception 'test variance omitted';
  exception when others then if sqlerrm<>'variance_reason_required' then raise; end if; end;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,c->>'planSha256',0,cmd,
    stamp,'{"preparedQuantity":7.5,"preparedUnit":"tablet"}','Synthetic fixture measured amount',null);
  again:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,c->>'planSha256',0,cmd,
    stamp,'{"preparedQuantity":7.5,"preparedUnit":"tablet"}','Synthetic fixture measured amount',null);
  if result is distinct from again or result->>'status'<>'completed' or jsonb_array_length(result->'results')<>1 then raise exception 'record/complete/retry failed: %',result; end if;
  if not exists(select 1 from public.orders where id=t.order_id and confirmed_snapshot=confirmed_plan) then raise exception 'actual changed confirmed plan'; end if;
  if not exists(select 1 from public.order_billing_candidates where order_id=t.order_id and quantity=8 and amount=8000) then raise exception 'actual changed planned billing'; end if;
  first_id:=(result#>>'{results,0,id}')::uuid;
  begin
    perform public.clair_record_order_execution_result('clair-demo',actor,wi.id,wi.row_revision,c->>'planSha256',0,cmd,
      stamp,'{"preparedQuantity":8,"preparedUnit":"tablet"}','Synthetic fixture measured amount',null);
    raise exception 'test mismatched retry accepted';
  exception when others then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
  result:=public.clair_record_order_execution_result('clair-demo',actor,wi.id,(result->>'workItemRevision')::bigint,c->>'planSha256',1,
    '97080000-0000-4000-8000-000000000004',stamp,'{"preparedQuantity":8,"preparedUnit":"tablet"}',null,'Synthetic counting correction');
  if jsonb_array_length(result->'results')<>2 or result#>>'{results,0,payload,preparedQuantity}'<>'7.5'
    or result#>>'{results,1,payload,preparedQuantity}'<>'8' then raise exception 'append amendment failure'; end if;
  if not exists(select 1 from public.order_tasks where id=t.id and effective_snapshot=initial_plan
    and result_snapshot->>'executionResultId'=first_id::text) then raise exception 'history snapshot overwritten'; end if;
  begin
    update public.order_execution_result_versions set payload='{}' where id=first_id;
    raise exception 'test mutable result';
  exception when sqlstate '55000' then null; end;
  begin
    delete from public.order_execution_result_versions where id=first_id;
    raise exception 'test deletable result';
  exception when sqlstate '55000' then null; end;
  if has_table_privilege('authenticated','public.order_execution_result_versions','INSERT')
    or has_table_privilege('authenticated','public.order_execution_result_versions','UPDATE')
    or has_table_privilege('anon','public.order_execution_result_versions','SELECT') then raise exception 'direct result table grant'; end if;
  if private.clair_execution_result_payload_valid('dispensing','{"preparedQuantity":8,"preparedUnit":"tablet","performedByUserId":"spoof"}')
    or private.clair_execution_result_payload_valid('treatment','{"performedProcedure":"test","outcome":"done","administeredAmount":1}')
    or private.clair_execution_result_payload_valid('imaging','{"acquiredViews":[],"performedProtocol":"test","quality":"diagnostic","findings":"test","interpretation":"test"}') then raise exception 'invalid result payload accepted'; end if;
  raise notice 'WP08 actual record/complete/retry/variance/amendment/immutability and planned billing preserved';
end $test$;
