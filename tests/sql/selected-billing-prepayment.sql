-- Appended to the synthetic fixture/helpers from confirmed-order-edit.sql.
do $$
declare s jsonb; r jsonb; replay jsonb; inv uuid; old_version timestamptz; c jsonb; session_id uuid; n integer;
 w text:='synthetic-order-edit'; e uuid:='84000000-0000-4000-8000-000000000001';
 o uuid:='86000000-0000-4000-8000-000000000001'; o2 uuid:='86000000-0000-4000-8000-000000000002';
begin
 perform pg_temp.assert_true((select row#>>'{preBillingOverride,adjustmentAmountKrw}'='-1000' from jsonb_array_elements(public.clair_get_chart_order_actions(w,e)->'rows') row where row->>'orderId'=o::text),'confirmed row shows existing candidate discount before first edit');
 s:=public.clair_get_chart_order_billing_summary(w,e);
 begin
  perform public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','empty-selection','{}',true);
  raise exception 'empty accepted';
 exception when raise_exception then if sqlerrm<>'invalid_billing_selection' then raise; end if; end;
 begin
  perform public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','unfinished',array[o],false);
  raise exception 'unfinished accepted';
 exception when raise_exception then if sqlerrm<>'unfinished_ack_required' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 begin
  perform public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','unauthorized-selection',array[o],true);
  raise exception 'unauthorized selection accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 begin
  perform public.clair_request_selected_chart_order_billing('synthetic-edit-other',auth.uid(),e,s->>'etag','foreign-selection',array[o],true);
  raise exception 'foreign workspace accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
 r:=public.clair_get_fulfillment_instruction(w,'88000000-0000-4000-8000-000000000001');
 r:=public.clair_mutate_fulfillment_instruction(w,'88000000-0000-4000-8000-000000000001',jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',r->>'revision'));
 r:=public.clair_get_order_execution_context(w,'88000000-0000-4000-8000-000000000001');
 perform public.clair_record_order_execution_result(w,auth.uid(),'88000000-0000-4000-8000-000000000001',(r->>'workItemRevision')::bigint,r->>'planSha256',0,gen_random_uuid(),now(),'{"preparedQuantity":2,"preparedUnit":"tablet"}','합성 계획 수량 확인',null);
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 s:=public.clair_get_chart_order_billing_summary(w,e);
 r:=public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','selected-one',array[o],false);
 inv:=(r->>'invoiceId')::uuid;
 perform pg_temp.assert_true((select count(*)=1 from public.invoice_lines where invoice_id=inv),'only selected order invoiced');
 perform pg_temp.assert_true((select count(*)=2 from public.order_billing_candidates where workspace_id=w and invoice_line_id is null),'two unselected candidates preserved');
 replay:=public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','selected-one',array[o],false);
 perform pg_temp.assert_true(replay->>'invoiceId'=r->>'invoiceId','retry same invoice');
 perform pg_temp.assert_true((select count(*)=1 from public.invoice_lines where invoice_id=inv),'retry no duplicate lines');
 begin
  perform public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','selected-one',array[o2],false);
  raise exception 'changed selection accepted';
 exception when raise_exception then if sqlerrm<>'idempotency_conflict' then raise; end if; end;
 s:=public.clair_get_chart_order_billing_summary(w,e);
 begin
  perform public.clair_request_selected_chart_order_billing(w,auth.uid(),e,s->>'etag','mixed-selection',array[o,o2],true);
  raise exception 'mixed already linked selection accepted';
 exception when raise_exception then if sqlerrm<>'billing_selection_unavailable' then raise; end if; end;
 perform pg_temp.assert_true((select count(*)=1 from public.invoice_lines where invoice_id=inv),'invalid selection atomic rollback');
 update public.invoices set assigned_to_user_id=auth.uid() where id=inv;
 select updated_at into old_version from public.invoices where id=inv;
 r:=public.clair_prepare_billing_checkout_session(w,auth.uid(),array[inv],'cash');
 perform pg_temp.assert_true((select count(*)>=1 from public.billing_checkout_sessions where workspace_id=w and status='prepared'),'checkout prepared');
 r:=pg_temp.edit(o,'{"unitPriceKrw":7000}');
 perform pg_temp.assert_true(r#>>'{pendingFinancial,unitPriceKrw}'='7000','prepared checkout permits proposal');
 perform pg_temp.assert_true(not exists(select 1 from public.billing_checkout_sessions where workspace_id=w and status='prepared'),'prepared sessions invalidated');
 perform pg_temp.assert_true((select total_amount=9000 from public.invoices where id=inv),'proposal preserves invoice amount');
 begin
  perform public.clair_prepare_billing_checkout_session(w,auth.uid(),array[inv],'cash');
  raise exception 'pending prepare accepted';
 exception when raise_exception then if sqlerrm not in ('billing_review_required','billing_change_pending') then raise; end if; end;
 begin
  perform public.clair_transition_billing_invoice_status(w,auth.uid(),inv,'paid','cash','합성 결제 확인',old_version);
  raise exception 'pending payment accepted';
 exception when raise_exception then if sqlerrm not in ('billing_review_required','billing_change_pending','invoice_revision_conflict') then raise; end if; end;
 begin
  perform public.clair_save_billing_payment_status(w,auth.uid(),inv,'complete_payment','cash',null,old_version);
  raise exception 'pending fallback payment accepted';
 exception when raise_exception then if sqlerrm not in ('billing_review_required','billing_change_pending','invoice_revision_conflict') then raise; end if; end;
 c:=public.clair_get_order_billing_changes(w,inv)->0;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
 begin
  perform public.clair_approve_order_billing_change(w,inv,o,(c->>'proposalId')::uuid,(c->>'version')::integer);
  raise exception 'foreign assignee accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 perform public.clair_approve_order_billing_change(w,inv,o,(c->>'proposalId')::uuid,(c->>'version')::integer);
 perform pg_temp.assert_true((select total_amount=13000 from public.invoices where id=inv),'approval changes amount');
 -- A single DO transaction shares now(); use an explicitly stale client token.
 old_version:=old_version-interval '1 second';
 begin
  perform public.clair_transition_billing_invoice_status(w,auth.uid(),inv,'paid','cash','합성 결제 확인',old_version);
  raise exception 'stale payment accepted';
 exception when raise_exception then if sqlerrm<>'invoice_revision_conflict' then raise; end if; end;
 begin
  perform public.clair_save_billing_payment_status(w,auth.uid(),inv,'complete_payment','cash',null,old_version);
  raise exception 'stale fallback accepted';
 exception when raise_exception then if sqlerrm<>'invoice_revision_conflict' then raise; end if; end;
 begin
  perform public.clair_transition_billing_invoice_status(w,auth.uid(),inv,'paid','cash');
  raise exception 'missing token accepted';
 exception when raise_exception then if sqlerrm<>'invoice_revision_conflict' then raise; end if; end;
 perform pg_temp.assert_true(not has_function_privilege('authenticated','public.clair_transition_billing_invoice_status_before_version_guard(text,uuid,uuid,text,text,text)','EXECUTE'),'old writer inaccessible');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','public.clair_save_billing_payment_status_before_version_guard(text,uuid,uuid,text,text,text)','EXECUTE'),'old fallback inaccessible');
 r:=public.clair_prepare_billing_checkout_session(w,auth.uid(),array[inv],'cash');
 select id into session_id from public.billing_checkout_sessions where workspace_id=w and status='prepared' limit 1;
 update public.billing_checkout_sessions set status='payment_pending' where id=session_id;
 begin
  perform pg_temp.edit(o,'{"unitPriceKrw":8000}');
  raise exception 'inflight edit accepted';
 exception when raise_exception then if sqlerrm<>'payment_locked' then raise; end if; end;
 update public.billing_checkout_sessions set status='expired',completed_at=now() where id=session_id;
 select updated_at into old_version from public.invoices where id=inv;
 perform public.clair_transition_billing_invoice_status(w,auth.uid(),inv,'paid','cash','합성 결제 확인',old_version);
 perform pg_temp.assert_true((select status='paid' from public.invoices where id=inv),'fresh payment accepted');
 begin
  perform pg_temp.edit(o,'{"unitPriceKrw":9000}');
  raise exception 'paid edit accepted';
 exception when raise_exception then if sqlerrm<>'payment_locked' then raise; end if; end;
end $$;
rollback;
