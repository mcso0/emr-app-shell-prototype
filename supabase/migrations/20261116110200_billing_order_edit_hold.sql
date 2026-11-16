-- Project the confirmed-order editor's lease onto its unpaid invoices. Invoice
-- status, amounts, assignment and optimistic version timestamps stay unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create function pg_temp.patch_billing_hold(signature text, old text, replacement text)
returns void language plpgsql as $$
declare definition text:=pg_get_functiondef(signature::regprocedure);
begin
 if (length(definition)-length(replace(definition,old,'')))/length(old)<>1 then raise exception 'billing hold patch drift: %',signature; end if;
 execute replace(definition,old,replacement);
end $$;
create table private.order_billing_edit_leases (
 workspace_id text not null,order_id uuid not null,invoice_id uuid not null,
 actor_id uuid not null,session_id uuid not null,expires_at timestamptz not null,
 primary key(workspace_id,order_id,invoice_id),
 foreign key(workspace_id,order_id) references public.orders(workspace_id,id) on delete cascade,
 foreign key(workspace_id,invoice_id) references public.invoices(workspace_id,id) on delete cascade
);
alter table private.order_billing_edit_leases enable row level security;
revoke all on private.order_billing_edit_leases from public,anon,authenticated,service_role;
create function private.clair_invoice_order_edit_held(p_workspace_id text,p_invoice_id uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.order_billing_edit_leases l where l.workspace_id=p_workspace_id
  and l.invoice_id=p_invoice_id and l.expires_at>clock_timestamp())
$$;
create function private.clair_assert_invoice_order_edit_available(p_workspace_id text,p_invoice_id uuid) returns void
language plpgsql set search_path='' as $$
begin
 if private.clair_invoice_order_edit_held(p_workspace_id,p_invoice_id) then raise exception 'order_work_on_hold'; end if;
end $$;
create function private.clair_broadcast_billing_edit_lease() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_value private.order_billing_edit_leases;
begin
 row_value:=case when tg_op='DELETE' then old else new end;
 perform realtime.send(jsonb_build_object('workspaceId',row_value.workspace_id,'domain','queue','sourceTable','invoices',
  'operation',tg_op,'entityId',row_value.invoice_id,'occurredAt',now(),'version',1),
  'queue_changed',private.clair_queue_realtime_topic(row_value.workspace_id),true);
 return null;
end $$;
create trigger order_billing_edit_lease_realtime after insert or update or delete on private.order_billing_edit_leases
for each row execute function private.clair_broadcast_billing_edit_lease();

create function private.clair_lock_order_checkouts(p_workspace_id text,p_order_id uuid) returns void
language plpgsql set search_path='' as $$
begin
  perform 1 from public.billing_checkout_sessions checkout
  where checkout.workspace_id=p_workspace_id and exists(
   select 1 from public.billing_checkout_session_invoices link join public.invoice_lines line
    on line.workspace_id=link.workspace_id and line.invoice_id=link.invoice_id
   where link.workspace_id=p_workspace_id and link.checkout_session_id=checkout.id
    and (line.order_id=p_order_id or exists(select 1 from public.order_billing_candidates candidate
      where candidate.workspace_id=p_workspace_id and candidate.order_id=p_order_id
        and candidate.invoice_line_id=line.id and candidate.status<>'cancelled')))
  order by checkout.id for update;
end $$;
-- Every editor path, including session-less saves, follows session -> invoice.
select pg_temp.patch_billing_hold('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
$old$ select invoice.* into i from public.invoices invoice join public.invoice_lines l on l.workspace_id=invoice.workspace_id and l.invoice_id=invoice.id$old$,
$new$ perform private.clair_lock_order_checkouts(p_workspace_id,p_order_id);
 select invoice.* into i from public.invoices invoice join public.invoice_lines l on l.workspace_id=invoice.workspace_id and l.invoice_id=invoice.id$new$);

alter function public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text) rename to clair_manage_confirmed_order_edit_session_clinical_base;
create function public.clair_manage_confirmed_order_edit_session(p_workspace_id text,p_chart_id uuid,p_order_id uuid,p_session_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb; result jsonb; target_invoice public.invoices; has_clinical boolean; has_billing boolean;
begin
 if p_session_id is null or p_action is null or p_action not in ('begin','renew','release') then raise exception 'invalid_input'; end if;
 context:=public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
 if p_action='release' then
  result:=public.clair_manage_confirmed_order_edit_session_clinical_base(p_workspace_id,p_chart_id,p_order_id,p_session_id,p_action);
  delete from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id;
  return result;
 end if;
 context:=public.clair_get_confirmed_order_edit(p_workspace_id,p_chart_id,p_order_id);
 select exists(select 1 from private.order_work_holds where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id) into has_clinical;
 select exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id) into has_billing;
 if p_action='renew' then
  perform 1 from public.invoices i where i.workspace_id=p_workspace_id and exists(
    select 1 from private.order_billing_edit_leases lease where lease.workspace_id=p_workspace_id and lease.order_id=p_order_id
      and lease.actor_id=auth.uid() and lease.session_id=p_session_id and lease.invoice_id=i.id)
    order by i.id for update;
  if exists(select 1 from private.order_billing_edit_leases lease where lease.workspace_id=p_workspace_id and lease.order_id=p_order_id
    and lease.actor_id=auth.uid() and lease.session_id=p_session_id and private.clair_invoice_edit_locked(p_workspace_id,lease.invoice_id)) then
    raise exception 'order_edit_session_expired';
  end if;
  if not coalesce((context->>'canEditClinical')::boolean,false) and not coalesce((context->>'canEditFinancial')::boolean,false) then raise exception 'permission_missing' using errcode='42501'; end if;
  if exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id and expires_at<=clock_timestamp())
     or not (has_clinical or has_billing) then raise exception 'order_edit_session_expired'; end if;
  if has_clinical then
   result:=public.clair_manage_confirmed_order_edit_session_clinical_base(p_workspace_id,p_chart_id,p_order_id,p_session_id,p_action);
  end if;
  update private.order_billing_edit_leases set expires_at=clock_timestamp()+interval '5 minutes'
   where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id;
  return jsonb_build_object('context',context,'editSessionId',p_session_id);
 end if;
 result:=public.clair_manage_confirmed_order_edit_session_clinical_base(p_workspace_id,p_chart_id,p_order_id,p_session_id,p_action);
 if coalesce((context->>'canEditClinical')::boolean,false) or coalesce((context->>'canEditFinancial')::boolean,false) then
  if exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and expires_at>clock_timestamp()
    and (actor_id is distinct from auth.uid() or session_id is distinct from p_session_id)) then raise exception 'order_work_on_hold'; end if;
  -- Checkout status triggers own the session row before locking its invoices.
  -- Take the same order here so a prepared -> pending transition cannot deadlock
  -- with expiry, including one checkout spanning several encounters.
  perform private.clair_lock_order_checkouts(p_workspace_id,p_order_id);
  for target_invoice in select i.* from public.invoices i where i.workspace_id=p_workspace_id and exists(
   select 1 from public.invoice_lines line where line.workspace_id=i.workspace_id and line.invoice_id=i.id
    and (line.order_id=p_order_id or exists(select 1 from public.order_billing_candidates c
      where c.workspace_id=p_workspace_id and c.order_id=p_order_id and c.invoice_line_id=line.id and c.status<>'cancelled')))
   order by i.id for update
  loop
   if not private.clair_invoice_edit_locked(p_workspace_id,target_invoice.id) then
    insert into private.order_billing_edit_leases as existing(workspace_id,order_id,invoice_id,actor_id,session_id,expires_at)
    values(p_workspace_id,p_order_id,target_invoice.id,auth.uid(),p_session_id,clock_timestamp()+interval '5 minutes')
    on conflict(workspace_id,order_id,invoice_id) do update set actor_id=excluded.actor_id,session_id=excluded.session_id,expires_at=excluded.expires_at
    where existing.expires_at<=clock_timestamp() or (existing.actor_id=auth.uid() and existing.session_id=p_session_id);
    update public.billing_checkout_sessions s set status='expired',completed_at=now(),updated_at=now()
    where s.workspace_id=p_workspace_id and s.status='prepared' and exists(select 1 from public.billing_checkout_session_invoices link
      where link.workspace_id=p_workspace_id and link.checkout_session_id=s.id and link.invoice_id=target_invoice.id);
   end if;
  end loop;
 end if;
 if exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id and expires_at>clock_timestamp()) then
  result:=result||jsonb_build_object('editSessionId',p_session_id);
 end if;
 return result;
end $$;

alter function private.clair_finish_order_edit_hold(text,uuid,uuid) rename to clair_finish_order_edit_hold_clinical_base;
create function private.clair_finish_order_edit_hold(p_workspace_id text,p_order_id uuid,p_session_id uuid)
returns void language plpgsql set search_path='' as $$
declare has_billing boolean; has_clinical boolean;
begin
 perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
 if p_session_id is not null and exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id
   and actor_id=auth.uid() and session_id=p_session_id and expires_at<=clock_timestamp()) then raise exception 'order_edit_session_expired'; end if;
 select exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and expires_at>clock_timestamp()) into has_billing;
 if has_billing and exists(select 1 from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id
   and expires_at>clock_timestamp() and (actor_id is distinct from auth.uid() or session_id is distinct from p_session_id)) then raise exception 'order_work_on_hold'; end if;
 select exists(select 1 from private.order_work_holds where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id) into has_clinical;
 perform private.clair_finish_order_edit_hold_clinical_base(p_workspace_id,p_order_id,case when has_billing and not has_clinical then null else p_session_id end);
 delete from private.order_billing_edit_leases where workspace_id=p_workspace_id and order_id=p_order_id and actor_id=auth.uid() and session_id=p_session_id;
end $$;

-- Protect every existing owner mutation, including stale financial approvals.
select pg_temp.patch_billing_hold('private.clair_assert_invoice_owner(text,uuid,uuid)',
$old$ if i.assigned_to_user_id is distinct from p_actor_user_id then raise exception 'current_assignee_required' using errcode='42501'; end if;$old$,
$new$ if i.assigned_to_user_id is distinct from p_actor_user_id then raise exception 'current_assignee_required' using errcode='42501'; end if;
 perform private.clair_assert_invoice_order_edit_available(p_workspace_id,p_invoice_id);$new$);
select pg_temp.patch_billing_hold('private.clair_guard_pending_order_billing()',
$old$begin
 if (($old$,
$new$begin
 if (new.status='paid' and old.status is distinct from 'paid') or (new.payment_state='paid' and old.payment_state is distinct from 'paid') then
  perform private.clair_assert_invoice_order_edit_available(old.workspace_id,old.id);
 end if;
 if (($new$);
select pg_temp.patch_billing_hold('private.clair_guard_pending_order_checkout()',
$old$  if exists(select 1 from private.order_financial_edits f join public.billing_checkout_session_invoices si$old$,
$new$  if exists(select 1 from public.billing_checkout_session_invoices si where si.workspace_id=new.workspace_id and si.checkout_session_id=new.id
    and private.clair_invoice_order_edit_held(si.workspace_id,si.invoice_id)) then raise exception 'order_work_on_hold'; end if;
  if exists(select 1 from private.order_financial_edits f join public.billing_checkout_session_invoices si$new$);
select pg_temp.patch_billing_hold('private.clair_guard_pending_order_checkout_invoice()',
$old$ select * into i from public.invoices where workspace_id=new.workspace_id and id=new.invoice_id for update;$old$,
$new$ select * into i from public.invoices where workspace_id=new.workspace_id and id=new.invoice_id for update;
 if exists(select 1 from public.billing_checkout_sessions s where s.workspace_id=new.workspace_id and s.id=new.checkout_session_id and s.status in ('prepared','payment_pending','paid')) then
  perform private.clair_assert_invoice_order_edit_available(new.workspace_id,new.invoice_id);
 end if;$new$);
select pg_temp.patch_billing_hold('public.clair_get_billing_assignment(text,uuid)',
$old$ 'revision',i.assignment_revision,$old$,
$new$ 'pauseReason',case when private.clair_invoice_order_edit_held(p_workspace_id,i.id) then 'order_edit' end,
 'revision',i.assignment_revision,$new$);
select pg_temp.patch_billing_hold('private.clair_list_billing_queue(text,date,integer,integer)',
$old$        'lineCount',lines.line_count,$old$,
$new$        'pauseReason',case when private.clair_invoice_order_edit_held(p_workspace_id,i.id) then 'order_edit' end,
        'lineCount',lines.line_count,$new$);
select pg_temp.patch_billing_hold('public.clair_get_order_billing_changes(text,uuid)',
$old$'canApprove',coalesce(i.assigned_to_user_id=auth.uid()$old$,
$new$'canApprove',coalesce(not private.clair_invoice_order_edit_held(p_workspace_id,i.id) and i.assigned_to_user_id=auth.uid()$new$);

revoke all on function public.clair_manage_confirmed_order_edit_session_clinical_base(text,uuid,uuid,uuid,text),
 private.clair_finish_order_edit_hold_clinical_base(text,uuid,uuid), private.clair_finish_order_edit_hold(text,uuid,uuid),
 private.clair_lock_order_checkouts(text,uuid), private.clair_invoice_order_edit_held(text,uuid),private.clair_assert_invoice_order_edit_available(text,uuid),private.clair_broadcast_billing_edit_lease()
from public,anon,authenticated,service_role;
revoke all on function public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text) to authenticated;
commit;
