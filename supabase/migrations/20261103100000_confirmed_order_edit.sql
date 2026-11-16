begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

-- Effective financial values are separate from the immutable confirmation and
-- billed snapshots. All writes enter through authenticated, scoped RPCs.
create table private.order_financial_edits (
 workspace_id text not null, order_id uuid not null,
 version integer not null default 0, approved_values jsonb,
 proposed_values jsonb, proposal_id uuid, invoice_id uuid,
 invoice_line_before jsonb, proposed_by uuid, proposed_at timestamptz,
 primary key(workspace_id,order_id)
);
create table private.confirmed_order_edit_commands (
 workspace_id text not null, command_id uuid not null, order_id uuid not null,
 actor_id uuid not null, request jsonb not null, before_values jsonb not null,
 after_values jsonb not null, created_at timestamptz not null default now(),
 primary key(workspace_id,command_id)
);
create table private.confirmed_order_edit_scope (transaction_id bigint,workspace_id text,order_id uuid,primary key(transaction_id,workspace_id,order_id));
revoke all on private.confirmed_order_edit_scope from public,anon,authenticated,service_role;
alter table private.confirmed_order_edit_scope enable row level security;
create table private.order_clinical_edit_revisions (
 workspace_id text not null, order_id uuid not null, revision integer not null,
 command_id uuid not null, before_values jsonb not null, after_values jsonb not null,
 reason text not null, actor_id uuid not null, created_at timestamptz not null default now(),
 primary key(workspace_id,order_id,revision)
);
revoke all on private.order_financial_edits,private.confirmed_order_edit_commands,private.order_clinical_edit_revisions from public,anon,authenticated,service_role;
alter table private.order_financial_edits enable row level security;
alter table private.confirmed_order_edit_commands enable row level security;
alter table private.order_clinical_edit_revisions enable row level security;

create function private.clair_order_effective_financial(p_workspace_id text,p_order_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with effective as (
 select o.billing_reflection_enabled,c.*,f.approved_values,l.description as line_description,
 l.quantity as line_quantity,l.unit_price as line_price,l.tax_type as line_tax,l.discount_amount as line_discount,
 (l.id is not null and (l.quantity is distinct from c.quantity or l.line_total is distinct from c.amount)) as invoice_overridden
 from public.orders o join public.order_billing_candidates c on c.workspace_id=o.workspace_id and c.order_id=o.id
 left join private.order_financial_edits f on f.workspace_id=o.workspace_id and f.order_id=o.id
 left join public.invoice_lines l on l.workspace_id=c.workspace_id and l.id=c.invoice_line_id
 where o.workspace_id=p_workspace_id and o.id=p_order_id and c.status<>'cancelled'
 order by c.billing_cycle desc limit 1
 ) select jsonb_build_object(
  'billingName',coalesce(line_description,billing_name_snapshot),'billingQuantity',coalesce(line_quantity,quantity),
  'unitPriceKrw',case when invoice_overridden then line_price else unit_price end,
  'taxClass',coalesce(line_tax,approved_values->>'taxClass',tax_class_snapshot),
  'billingReflectionEnabled',billing_reflection_enabled,
  'adjustmentSource',case when invoice_overridden then to_jsonb('amount'::text) else source_snapshot#>'{preBillingOverride,adjustmentSource}' end,
  'adjustmentAmountKrw',case when invoice_overridden then -line_discount else coalesce((source_snapshot#>>'{preBillingOverride,adjustmentAmountKrw}')::numeric,0) end,
  'adjustmentPercent',case when invoice_overridden then case when line_price*line_quantity=0 then 0 else -line_discount/(line_price*line_quantity)*100 end else coalesce((source_snapshot#>>'{preBillingOverride,adjustmentPercent}')::numeric,0) end,
  'adjustmentReason',coalesce(source_snapshot#>>'{preBillingOverride,adjustmentReason}','')) from effective;
$$;

create function private.clair_invoice_edit_locked(p_workspace_id text,p_invoice_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.invoices i where i.workspace_id=p_workspace_id and i.id=p_invoice_id
   and (i.status not in ('draft','issued') or i.payment_state in ('paid','refunded')))
 or exists(select 1 from public.billing_checkout_session_invoices si join public.billing_checkout_sessions s
   on s.workspace_id=si.workspace_id and s.id=si.checkout_session_id where si.workspace_id=p_workspace_id and si.invoice_id=p_invoice_id
   and s.status in ('prepared','payment_pending','paid'));
$$;

create function public.clair_get_confirmed_order_edit(p_workspace_id text,p_chart_id uuid,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; t public.order_tasks; c public.order_billing_candidates; i public.invoices;
 f private.order_financial_edits; version text;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
   or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id and origin_chart_id=p_chart_id;
 if not found or o.clinical_order_type not in ('dispensing','treatment') or o.row_type='set'
   or o.order_confirmation_status not in ('confirmed','billed') or o.status='cancelled' then raise exception 'order_unavailable'; end if;
 perform private.clair_require_order_chart(p_workspace_id,auth.uid()::text,o.encounter_id,p_chart_id,false);
 select * into t from public.order_tasks where workspace_id=p_workspace_id and order_id=o.id and task_role='execution' order by attempt_no desc limit 1;
 select * into c from public.order_billing_candidates where workspace_id=p_workspace_id and order_id=o.id and status<>'cancelled' order by billing_cycle desc limit 1;
 select invoice.* into i from public.invoices invoice join public.invoice_lines l on l.workspace_id=invoice.workspace_id and l.invoice_id=invoice.id
   where l.workspace_id=p_workspace_id and l.id=c.invoice_line_id;
 select * into f from private.order_financial_edits where workspace_id=p_workspace_id and order_id=o.id;
 version:=encode(extensions.digest(jsonb_build_array(to_jsonb(o),to_jsonb(t),to_jsonb(c),to_jsonb(i),to_jsonb(f),(select to_jsonb(l) from public.invoice_lines l where l.workspace_id=p_workspace_id and l.id=c.invoice_line_id))::text,'sha256'),'hex');
 return jsonb_build_object('orderId',o.id,'chartId',p_chart_id,'version',version,'detailInputs',o.detail_inputs,
  'detailSchemaVersion',o.detail_schema_version,'taskStatus',coalesce(t.status,'pending'),
  'billingStage',case when i.id is null then 'before' when private.clair_invoice_edit_locked(p_workspace_id,i.id) then 'locked' else 'requested' end,
  'calculationOutputs',o.calculation_outputs,
  'financial',case when private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') then private.clair_order_effective_financial(p_workspace_id,o.id) end,
  'pendingFinancial',case when private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') then f.proposed_values end,
  'canEditClinical',private.clair_current_user_has_workspace_permission(p_workspace_id,'order:update') and coalesce(t.status,'pending') not in ('cancelled','returned'),
  'canEditFinancial',private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update') and private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:issue') and c.id is not null,
  'actualDispenseMode',case when o.calculation_outputs->>'actualDispenseSource'='manual_override' then 'manual' else 'automatic' end,
  'actualDispenseQuantity',to_jsonb(coalesce((o.calculation_outputs->>'plannedPracticalTotalQuantity')::numeric,(o.calculation_outputs->>'totalRequiredDispenseQuantity')::numeric,case when o.calculation_outputs->>'preparationQuantityScope'='course_total' then (o.calculation_outputs->>'actualDispenseQuantity')::numeric else (o.calculation_outputs->>'actualDispenseQuantity')::numeric*(o.calculation_outputs->>'totalOccurrences')::numeric end)));
end $$;

-- Reuse the established amount calculation (base rounded to KRW, then rounded
-- signed percentage adjustment). Tax classification is an effective override;
-- original authority snapshots remain immutable.
create function private.clair_apply_order_financial(p_workspace_id text,p_order_id uuid,p_values jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c public.order_billing_candidates; base bigint; v_amount bigint; v_price numeric; v_quantity numeric;
begin
 select * into c from public.order_billing_candidates where workspace_id=p_workspace_id and order_id=p_order_id and status<>'cancelled' order by billing_cycle desc limit 1 for update;
 if not found then raise exception 'billing_owner_required'; end if;
 v_price:=(p_values->>'unitPriceKrw')::numeric; v_quantity:=(p_values->>'billingQuantity')::numeric;
 base:=round(v_price*v_quantity)::bigint;
 v_amount:=base+case p_values->>'adjustmentSource' when 'amount' then (p_values->>'adjustmentAmountKrw')::numeric::bigint when 'percent' then round(base*(p_values->>'adjustmentPercent')::numeric/100)::bigint else 0 end;
 if v_amount<0 or v_amount>9999999999.99 then raise exception 'invalid_input'; end if;
 update public.order_billing_candidates set unit_price=v_price,quantity=v_quantity,amount=v_amount,
  billing_name_snapshot=p_values->>'billingName',source_snapshot=source_snapshot||jsonb_build_object('preBillingOverride',
   jsonb_build_object('billingName',p_values->>'billingName','billingQuantity',v_quantity,'billingReflectionEnabled',(p_values->>'billingReflectionEnabled')::boolean,
    'adjustmentSource',p_values->'adjustmentSource','adjustmentPercent',case when p_values->>'adjustmentSource'='percent' then (p_values->>'adjustmentPercent')::numeric when base=0 then 0 else (v_amount-base)::numeric/base*100 end,'adjustmentAmountKrw',v_amount-base,
    'adjustmentReason',p_values->>'adjustmentReason')),updated_at=now()
 where workspace_id=p_workspace_id and id=c.id;
 update public.orders set billing_reflection_enabled=(p_values->>'billingReflectionEnabled')::boolean,updated_at=now()
 where workspace_id=p_workspace_id and id=p_order_id;
 insert into private.order_financial_edits(workspace_id,order_id,approved_values,version) values(p_workspace_id,p_order_id,p_values,1)
 on conflict(workspace_id,order_id) do update set approved_values=excluded.approved_values,version=private.order_financial_edits.version+1;
end $$;

create function private.clair_validate_order_financial(v jsonb)
returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(v)<>'object' or length(btrim(coalesce(v->>'billingName',''))) not between 1 and 200
 or jsonb_typeof(v->'billingQuantity')<>'number' or (v->>'billingQuantity')::numeric<=0
 or (v->>'billingQuantity')::numeric<>round((v->>'billingQuantity')::numeric,3) or (v->>'billingQuantity')::numeric>999999999.999
 or (v->>'unitPriceKrw')::numeric<>round((v->>'unitPriceKrw')::numeric,2) or (v->>'unitPriceKrw')::numeric>9999999999.99
 or coalesce(v->>'adjustmentSource','none') not in ('none','amount','percent')
 or jsonb_typeof(v->'adjustmentAmountKrw')<>'number' or (v->>'adjustmentAmountKrw')::numeric<>trunc((v->>'adjustmentAmountKrw')::numeric)
 or jsonb_typeof(v->'unitPriceKrw')<>'number' or (v->>'unitPriceKrw')::numeric<0
 or coalesce(v->>'taxClass','') not in ('taxable','non_taxable')
 or jsonb_typeof(v->'billingReflectionEnabled')<>'boolean'
 or jsonb_typeof(v->'adjustmentPercent')<>'number' or (v->>'adjustmentPercent')::numeric not between -100 and 10000
 or length(coalesce(v->>'adjustmentReason',''))>500
 or exists(select 1 from jsonb_object_keys(v) k where k not in ('billingName','billingQuantity','unitPriceKrw','taxClass','billingReflectionEnabled','adjustmentSource','adjustmentAmountKrw','adjustmentPercent','adjustmentReason'))
 then raise exception 'invalid_input'; end if;
end $$;

create function public.clair_edit_confirmed_order(p_workspace_id text,p_chart_id uuid,p_order_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; t public.order_tasks; c public.order_billing_candidates; wi public.order_fulfillment_work_items;
 old_wi public.order_fulfillment_work_items; i public.invoices; old_command private.confirmed_order_edit_commands;
 before_context jsonb; after_context jsonb; financial jsonb; base_financial jsonb; clinical jsonb;
 clinical_changed boolean; financial_changed boolean; result jsonb; cmd uuid; revision integer; requester uuid;
 action text; amount_quantity numeric;
begin
 -- Read authority is checked before replay; a command cannot expose another workspace.
 before_context:=public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 if jsonb_typeof(p_command)<>'object' or p_command->>'orderId' is distinct from p_order_id::text
 or p_command->>'chartId' is distinct from p_chart_id::text or length(coalesce(p_command->>'reason',''))>500
 or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('orderId','chartId','commandId','expectedVersion','clinical','financial','reason')) then raise exception 'invalid_input'; end if;
 cmd:=(p_command->>'commandId')::uuid;
 if cmd is null then raise exception 'invalid_input'; end if;
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
 perform pg_advisory_xact_lock(hashtextextended('clinical_billing:'||p_workspace_id||':'||o.encounter_id,0));
 perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
 perform 1 from public.encounters where workspace_id=p_workspace_id and id=o.encounter_id for update;
 perform 1 from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id for update;
 select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id for update;
 select * into old_command from private.confirmed_order_edit_commands where workspace_id=p_workspace_id and command_id=cmd;
 if found then
   if old_command.actor_id<>auth.uid() or old_command.order_id<>p_order_id or old_command.request<>p_command then raise exception 'idempotency_conflict'; end if;
   return public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 end if;
 select * into c from public.order_billing_candidates where workspace_id=p_workspace_id and order_id=p_order_id and status<>'cancelled' order by billing_cycle desc limit 1 for update;
 select invoice.* into i from public.invoices invoice join public.invoice_lines l on l.workspace_id=invoice.workspace_id and l.invoice_id=invoice.id
   where l.workspace_id=p_workspace_id and l.id=c.invoice_line_id for update of invoice;
 before_context:=public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 if p_command->>'expectedVersion' is distinct from before_context->>'version' then raise exception 'revision_conflict'; end if;
 select * into t from public.order_tasks where workspace_id=p_workspace_id and order_id=p_order_id and task_role='execution' order by attempt_no desc limit 1 for update;
 clinical:=p_command->'clinical';
 clinical_changed:=clinical is not null and (clinical->'detailInputs' is distinct from o.detail_inputs
  or clinical->>'actualDispenseMode' is distinct from before_context->>'actualDispenseMode'
  or (clinical->>'actualDispenseMode'='manual' and clinical->'actualDispenseQuantity' is distinct from before_context->'actualDispenseQuantity'));
 if p_command ? 'financial' and not (before_context->>'canEditFinancial')::boolean then raise exception 'permission_missing' using errcode='42501'; end if;
 base_financial:=coalesce((select proposed_values from private.order_financial_edits where workspace_id=p_workspace_id and order_id=p_order_id),private.clair_order_effective_financial(p_workspace_id,p_order_id));
 if p_command ? 'financial' and base_financial is null then raise exception 'billing_owner_required'; end if;
 financial:=base_financial||coalesce(p_command->'financial','{}');
 financial_changed:=p_command ? 'financial' and financial is distinct from base_financial;
 if financial_changed then
  if not (before_context->>'canEditFinancial')::boolean then raise exception 'permission_missing' using errcode='42501'; end if;
  if base_financial is null then raise exception 'billing_owner_required'; end if;
  perform private.clair_validate_order_financial(financial);
  if before_context->>'billingStage'='locked' then raise exception 'payment_locked'; end if;
 end if;
 if not clinical_changed and not financial_changed then return before_context; end if;
 if clinical_changed then
  if not (before_context->>'canEditClinical')::boolean then raise exception 'permission_missing' using errcode='42501'; end if;
  if length(btrim(coalesce(p_command->>'reason',''))) not between 3 and 500 then raise exception 'invalid_input'; end if;
  if jsonb_typeof(clinical->'detailInputs')<>'object' or clinical->>'actualDispenseMode' not in ('automatic','manual')
   or exists(select 1 from jsonb_object_keys(clinical) k where k not in ('detailInputs','detailSchemaVersion','actualDispenseMode','actualDispenseQuantity')) then raise exception 'invalid_input'; end if;
  select * into old_wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and order_id=p_order_id;
  requester:=coalesce(o.requested_by_user_id,old_wi.requested_by_user_id);
  action:=case when t.status='pending' then 'amend' else 're_request' end;
  insert into private.confirmed_order_edit_scope values(txid_current(),p_workspace_id,p_order_id);
  result:=public.clair_mutate_chart_order_execution_for_chart(p_workspace_id,auth.uid(),p_chart_id,p_order_id,action,p_command->>'reason',o.revision_no,case when o.clinical_order_type='dispensing' then clinical else clinical-'actualDispenseMode'-'actualDispenseQuantity' end,cmd::text);
  delete from private.confirmed_order_edit_scope where transaction_id=txid_current() and workspace_id=p_workspace_id and order_id=p_order_id;
  select * into o from public.orders where workspace_id=p_workspace_id and id=p_order_id;
  select coalesce(max(r.revision),0)+1 into revision from private.order_clinical_edit_revisions r where r.workspace_id=p_workspace_id and r.order_id=p_order_id;
  insert into private.order_clinical_edit_revisions(workspace_id,order_id,revision,command_id,before_values,after_values,reason,actor_id)
  values(p_workspace_id,p_order_id,revision,cmd,before_context,jsonb_build_object('detailInputs',o.detail_inputs,'calculationOutputs',o.calculation_outputs),p_command->>'reason',auth.uid());
  -- Keep the current performer on a replacement and preserve the original requester.
  select * into wi from public.order_fulfillment_work_items where workspace_id=p_workspace_id and order_id=p_order_id;
  if wi.task_id is distinct from old_wi.task_id then
   update public.order_tasks set assigned_to_user_id=old_wi.assigned_to_user_id,
    assigned_by_user_id=old_wi.assigned_by_user_id,assigned_at=old_wi.assigned_at
   where workspace_id=p_workspace_id and id=wi.task_id;
  end if;
  -- Financial quantity follows the existing price-basis contract, never a clinical dose guess.
  if c.id is not null then
   amount_quantity:=case c.price_basis_snapshot when 'per_order' then 1 when 'fixed_set' then 1
     when 'per_day' then (o.detail_inputs->>'durationDays')::numeric
     when 'per_administration' then (o.calculation_outputs->>'totalOccurrences')::numeric
     when 'per_product_unit' then (o.calculation_outputs->>'totalRequiredDispenseQuantity')::numeric
     when 'per_kg' then (o.calculation_outputs#>>'{weightSnapshot,valueKg}')::numeric else c.quantity end;
   if amount_quantity is null or amount_quantity<=0 then raise exception 'billing_quantity_calculation_incomplete'; end if;
   if not coalesce(p_command->'financial','{}') ? 'billingQuantity' then financial:=jsonb_set(financial,'{billingQuantity}',to_jsonb(amount_quantity)); end if;
   financial_changed:=financial is distinct from base_financial;
  end if;
 end if;
 if financial_changed then
  perform private.clair_validate_order_financial(financial);
  if i.id is null then perform private.clair_apply_order_financial(p_workspace_id,p_order_id,financial);
  else
   -- A clinical change can proceed during payment, but its billing correction is
   -- retained for the existing reversal/refund path rather than changing paid money.
   insert into private.order_financial_edits(workspace_id,order_id,version,proposed_values,proposal_id,invoice_id,invoice_line_before,proposed_by,proposed_at)
   values(p_workspace_id,p_order_id,1,financial,cmd,i.id,(select to_jsonb(l) from public.invoice_lines l where l.workspace_id=p_workspace_id and l.id=c.invoice_line_id),auth.uid(),now())
   on conflict(workspace_id,order_id) do update set version=private.order_financial_edits.version+1,proposed_values=excluded.proposed_values,
    proposal_id=excluded.proposal_id,invoice_id=excluded.invoice_id,invoice_line_before=excluded.invoice_line_before,proposed_by=excluded.proposed_by,proposed_at=excluded.proposed_at;
  end if;
 elsif clinical_changed and c.id is not null and i.id is null then
  -- Existing clinical recalculation must not discard a previous financial override.
  perform private.clair_apply_order_financial(p_workspace_id,p_order_id,financial);
 end if;
 after_context:=public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 insert into private.confirmed_order_edit_commands(workspace_id,command_id,order_id,actor_id,request,before_values,after_values)
 values(p_workspace_id,cmd,p_order_id,auth.uid(),p_command,before_context,after_context);
 return after_context;
end $$;

-- Invoice review returns only this workspace and checks billing read authority.
create function public.clair_get_order_billing_changes(p_workspace_id text,p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
 or not private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:view') then raise exception 'permission_missing' using errcode='42501'; end if;
 if not exists(select 1 from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id) then raise exception 'order_unavailable'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('orderId',f.order_id,'proposalId',f.proposal_id,'version',f.version,
  'before',private.clair_order_effective_financial(p_workspace_id,f.order_id),'proposed',f.proposed_values,
  'canApprove',coalesce(i.assigned_to_user_id=auth.uid() and private.clair_current_user_has_workspace_permission(p_workspace_id,'billing:issue') and not private.clair_invoice_edit_locked(p_workspace_id,i.id),false),
  'createdAt',f.proposed_at) order by f.proposed_at),'[]'::jsonb)
 from private.order_financial_edits f join public.invoices i on i.workspace_id=f.workspace_id and i.id=f.invoice_id
 where f.workspace_id=p_workspace_id and f.invoice_id=p_invoice_id and f.proposed_values is not null);
end $$;

create function public.clair_approve_order_billing_change(p_workspace_id text,p_invoice_id uuid,p_order_id uuid,p_proposal_id uuid,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.order_financial_edits; c public.order_billing_candidates; l public.invoice_lines; price numeric; amount bigint; base bigint; v_quantity numeric; before_values jsonb;
begin
 perform private.clair_assert_invoice_owner(p_workspace_id,p_invoice_id,auth.uid());
 if exists(select 1 from private.confirmed_order_edit_commands r where r.workspace_id=p_workspace_id and r.order_id=p_order_id and r.actor_id=auth.uid()
   and r.request=jsonb_build_object('action','billing_approval','proposalId',p_proposal_id,'version',p_version)) then return public.clair_get_order_billing_changes(p_workspace_id,p_invoice_id); end if;
 if private.clair_invoice_edit_locked(p_workspace_id,p_invoice_id) then raise exception 'payment_locked'; end if;
 select * into f from private.order_financial_edits where workspace_id=p_workspace_id and order_id=p_order_id and invoice_id=p_invoice_id for update;
 if not found or f.proposed_values is null or f.proposal_id is distinct from p_proposal_id or f.version is distinct from p_version then raise exception 'revision_conflict'; end if;
 select * into c from public.order_billing_candidates where workspace_id=p_workspace_id and order_id=p_order_id and invoice_line_id is not null order by billing_cycle desc limit 1 for update;
 select * into l from public.invoice_lines where workspace_id=p_workspace_id and invoice_id=p_invoice_id and id=c.invoice_line_id for update;
 if not found or to_jsonb(l) is distinct from f.invoice_line_before then raise exception 'revision_conflict'; end if;
 if f.proposed_values->>'taxClass'='taxable' and not exists(select 1 from public.workspace_order_billing_policies where workspace_id=p_workspace_id and vat_calculation_policy is not null) then raise exception 'vat_calculation_policy_missing'; end if;
 before_values:=private.clair_order_effective_financial(p_workspace_id,p_order_id);
 perform private.clair_apply_order_financial(p_workspace_id,p_order_id,f.proposed_values);
 select * into c from public.order_billing_candidates where workspace_id=p_workspace_id and id=c.id;
 v_quantity:=c.quantity; amount:=case when (f.proposed_values->>'billingReflectionEnabled')::boolean then c.amount else 0 end; price:=c.unit_price;
 if (price*v_quantity)::numeric(12,2)<amount then price:=ceil(amount/v_quantity*100)/100; end if;
 update private.order_financial_edits set proposed_values=null,version=version+1 where workspace_id=p_workspace_id and order_id=p_order_id;
 update public.invoice_lines set quantity=v_quantity,unit_price=price,discount_amount=(price*v_quantity-amount)::numeric(12,2),
  description=f.proposed_values->>'billingName',billing_name_snapshot=f.proposed_values->>'billingName',tax_type=f.proposed_values->>'taxClass',updated_at=now()
 where workspace_id=p_workspace_id and id=l.id;
 update public.invoices i set subtotal_amount=totals.amount,total_amount=greatest(totals.amount-i.discount_amount+i.tax_amount,0),updated_at=now()
 from (select coalesce(sum(line_total),0) amount from public.invoice_lines where workspace_id=p_workspace_id and invoice_id=p_invoice_id) totals
 where i.workspace_id=p_workspace_id and i.id=p_invoice_id;
 insert into private.confirmed_order_edit_commands(workspace_id,command_id,order_id,actor_id,request,before_values,after_values)
 values(p_workspace_id,gen_random_uuid(),p_order_id,auth.uid(),jsonb_build_object('action','billing_approval','proposalId',p_proposal_id,'version',p_version),before_values,f.proposed_values);
 return public.clair_get_order_billing_changes(p_workspace_id,p_invoice_id);
end $$;

-- Payment cannot race past an unapproved financial proposal.
create function private.clair_guard_pending_order_billing()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if ((new.status='paid' and old.status is distinct from 'paid') or (new.payment_state='paid' and old.payment_state is distinct from 'paid')) and exists(select 1 from private.order_financial_edits f
  where f.workspace_id=new.workspace_id and f.invoice_id=new.id and f.proposed_values is not null)
 then raise exception 'billing_review_required'; end if;
 return new;
end $$;
create trigger confirmed_order_billing_payment_guard before update on public.invoices for each row execute function private.clair_guard_pending_order_billing();
create function private.clair_guard_pending_order_checkout()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('prepared','payment_pending','paid') then
  perform 1 from public.invoices i join public.billing_checkout_session_invoices si on si.workspace_id=i.workspace_id and si.invoice_id=i.id
   where si.workspace_id=new.workspace_id and si.checkout_session_id=new.id order by i.id for update of i;
  if exists(select 1 from private.order_financial_edits f join public.billing_checkout_session_invoices si
   on si.workspace_id=f.workspace_id and si.invoice_id=f.invoice_id where si.workspace_id=new.workspace_id and si.checkout_session_id=new.id and f.proposed_values is not null)
  then raise exception 'billing_review_required'; end if;
 end if;
 return new;
end $$;
create trigger confirmed_order_checkout_guard before insert or update on public.billing_checkout_sessions for each row execute function private.clair_guard_pending_order_checkout();

-- Specific grants below; implementation helpers remain private.
revoke all on function private.clair_order_effective_financial(text,uuid),private.clair_invoice_edit_locked(text,uuid),private.clair_apply_order_financial(text,uuid,jsonb),private.clair_validate_order_financial(jsonb),private.clair_guard_pending_order_billing(),private.clair_guard_pending_order_checkout() from public,anon,authenticated,service_role;
revoke all on function public.clair_get_confirmed_order_edit(text,uuid,uuid),public.clair_edit_confirmed_order(text,uuid,uuid,jsonb),public.clair_get_order_billing_changes(text,uuid),public.clair_approve_order_billing_change(text,uuid,uuid,uuid,integer) from public,anon,service_role;
grant execute on function public.clair_get_confirmed_order_edit(text,uuid,uuid),public.clair_edit_confirmed_order(text,uuid,uuid,jsonb),public.clair_get_order_billing_changes(text,uuid),public.clair_approve_order_billing_change(text,uuid,uuid,uuid,integer) to authenticated;
create function private.clair_guard_pending_order_checkout_invoice()
returns trigger language plpgsql security definer set search_path='' as $$
declare i public.invoices;
begin
 select * into i from public.invoices where workspace_id=new.workspace_id and id=new.invoice_id for update;
 if exists(select 1 from public.billing_checkout_sessions s where s.workspace_id=new.workspace_id and s.id=new.checkout_session_id and s.status in ('prepared','payment_pending','paid'))
 and exists(select 1 from private.order_financial_edits f where f.workspace_id=new.workspace_id and f.invoice_id=new.invoice_id and f.proposed_values is not null)
 then raise exception 'billing_review_required'; end if;
 return new;
end $$;
create trigger confirmed_order_checkout_invoice_guard before insert or update on public.billing_checkout_session_invoices for each row execute function private.clair_guard_pending_order_checkout_invoice();
revoke all on function private.clair_guard_pending_order_checkout_invoice() from public,anon,authenticated,service_role;

commit;
