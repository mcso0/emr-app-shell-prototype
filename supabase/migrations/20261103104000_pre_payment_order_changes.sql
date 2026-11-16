begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create function pg_temp.prepayment_patch(signature text,old text,replacement text,expected integer default 1)
returns void language plpgsql as $$
declare definition text;
begin
 definition:=pg_get_functiondef(signature::regprocedure);
 if (length(definition)-length(replace(definition,old,'')))/length(old)<>expected then raise exception 'prepayment source drift: %',signature; end if;
 execute replace(definition,old,replacement);
end $$;

-- Merely displaying a prepared checkout does not start payment. Financial
-- proposals invalidate those snapshots, but never a payment already in flight.
select pg_temp.prepayment_patch('private.clair_invoice_edit_locked(text,uuid)',
 's.status in (''prepared'',''payment_pending'',''paid'')',
 's.status in (''payment_pending'',''paid'')');
select pg_temp.prepayment_patch('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
 'proposal_id=excluded.proposal_id,invoice_id=excluded.invoice_id,invoice_line_before=excluded.invoice_line_before,proposed_by=excluded.proposed_by,proposed_at=excluded.proposed_at;',
 $replacement$proposal_id=excluded.proposal_id,invoice_id=excluded.invoice_id,invoice_line_before=excluded.invoice_line_before,proposed_by=excluded.proposed_by,proposed_at=excluded.proposed_at;
   -- Existing writer holds encounter advisory + invoice locks, matching prepare.
   update public.billing_checkout_sessions session set status='expired',completed_at=now(),updated_at=now()
   where session.workspace_id=p_workspace_id and session.status='prepared'
     and exists(select 1 from public.billing_checkout_session_invoices link
       where link.workspace_id=p_workspace_id and link.checkout_session_id=session.id and link.invoice_id=i.id);$replacement$);

-- Return the concurrency token in the same SQL snapshot as its monetary values.
select pg_temp.prepayment_patch('public.clair_get_billing_invoice_lines(text,uuid)',
 '''createdAt'', i.created_at','''createdAt'', i.created_at, ''updatedAt'', i.updated_at');
select pg_temp.prepayment_patch('public.clair_get_billing_payment_status(text,uuid)',
 '''createdAt'', i.created_at','''createdAt'', i.created_at, ''updatedAt'', i.updated_at');

-- Retire the old public payment signatures. Both payment paths require the
-- exact invoice version shown to the assignee. Non-payment calls retain defaults.
alter function public.clair_transition_billing_invoice_status(text,uuid,uuid,text,text,text) rename to clair_transition_billing_invoice_status_before_version_guard;
revoke all on function public.clair_transition_billing_invoice_status_before_version_guard(text,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.clair_transition_billing_invoice_status(
 p_workspace_id text,p_actor_user_id uuid,p_invoice_id uuid,p_target text,
 p_payment_method text default null,p_reason text default null,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare invoice public.invoices; result jsonb;
begin
 perform private.clair_assert_invoice_owner(p_workspace_id,p_invoice_id,p_actor_user_id);
 select * into invoice from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id;
 if p_target='paid' then
  if p_expected_updated_at is null or p_expected_updated_at is distinct from invoice.updated_at then raise exception 'invoice_revision_conflict'; end if;
  if exists(select 1 from public.billing_checkout_sessions s join public.billing_checkout_session_invoices link on link.workspace_id=s.workspace_id and link.checkout_session_id=s.id
    where link.workspace_id=p_workspace_id and link.invoice_id=p_invoice_id and s.status='payment_pending') then raise exception 'payment_in_progress'; end if;
 end if;
 result:=public.clair_transition_billing_invoice_status_before_version_guard(p_workspace_id,p_actor_user_id,p_invoice_id,p_target,p_payment_method,p_reason);
 return jsonb_set(result,'{invoice,updatedAt}',(select to_jsonb(updated_at) from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id));
end $$;
revoke all on function public.clair_transition_billing_invoice_status(text,uuid,uuid,text,text,text,timestamptz) from public,anon,service_role;
grant execute on function public.clair_transition_billing_invoice_status(text,uuid,uuid,text,text,text,timestamptz) to authenticated;

alter function public.clair_save_billing_payment_status(text,uuid,uuid,text,text,text) rename to clair_save_billing_payment_status_before_version_guard;
revoke all on function public.clair_save_billing_payment_status_before_version_guard(text,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.clair_save_billing_payment_status(
 p_workspace_id text,p_actor_user_id uuid,p_invoice_id uuid,p_action text,
 p_payment_method text default null,p_unpaid_reason text default null,p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare invoice public.invoices; result jsonb;
begin
 perform private.clair_assert_invoice_owner(p_workspace_id,p_invoice_id,p_actor_user_id);
 select * into invoice from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id;
 if p_action='complete_payment' then
  if p_expected_updated_at is null or p_expected_updated_at is distinct from invoice.updated_at then raise exception 'invoice_revision_conflict'; end if;
  if exists(select 1 from public.billing_checkout_sessions s join public.billing_checkout_session_invoices link on link.workspace_id=s.workspace_id and link.checkout_session_id=s.id
    where link.workspace_id=p_workspace_id and link.invoice_id=p_invoice_id and s.status='payment_pending') then raise exception 'payment_in_progress'; end if;
 end if;
 result:=public.clair_save_billing_payment_status_before_version_guard(p_workspace_id,p_actor_user_id,p_invoice_id,p_action,p_payment_method,p_unpaid_reason);
 return jsonb_set(result,'{invoice,updatedAt}',(select to_jsonb(updated_at) from public.invoices where workspace_id=p_workspace_id and id=p_invoice_id));
end $$;
revoke all on function public.clair_save_billing_payment_status(text,uuid,uuid,text,text,text,timestamptz) from public,anon,service_role;
grant execute on function public.clair_save_billing_payment_status(text,uuid,uuid,text,text,text,timestamptz) to authenticated;
commit;
