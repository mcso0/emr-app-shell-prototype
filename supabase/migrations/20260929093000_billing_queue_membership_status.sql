-- Forward fix: the linked remote membership schema uses status, without deleted_at.
-- Read-only billing discovery. No table grants, data writes, or role-policy changes.
create or replace function private.clair_list_billing_queue(
  p_workspace_id text, p_operating_date date, p_offset integer default 0, p_limit integer default 200
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view') then
    raise exception 'billing_permission_denied' using errcode = '42501';
  end if;
  if p_operating_date is null or p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_billing_queue_scope' using errcode = '22023';
  end if;
  return coalesce((select jsonb_agg(page.item order by page.activity_at desc, page.id) from (
    select i.id, coalesce(i.billing_requested_at, i.issued_at, i.created_at) as activity_at,
      jsonb_build_object(
        'invoice', jsonb_build_object('id',i.id,'workspaceId',i.workspace_id,'encounterId',i.encounter_id,
          'invoiceNo',i.invoice_no,'status',i.status,'paymentState',i.payment_state,'unpaidReason',i.unpaid_reason,
          'totalAmount',i.total_amount,'createdAt',i.created_at,'issuedAt',i.issued_at,'billingRequestedAt',i.billing_requested_at),
        'encounter', jsonb_build_object('receptionType',e.reception_type),
        'patient', case when p.id is null then null else jsonb_build_object('name',p.name) end,
        'guardian', case when g.id is null then null else jsonb_build_object('name',g.name) end,
        'lineCount',lines.line_count,
        'lineSummary',case when lines.line_count = 0 then '청구 항목 없음' when lines.line_count = 1 then lines.first_description else lines.first_description || ' 외 ' || (lines.line_count - 1)::text || '건' end,
        'requestedByName',coalesce(requester.display_name,'미지정')
      ) as item
    from public.invoices i
    join public.encounters e on e.workspace_id = p_workspace_id and e.id = i.encounter_id
    left join public.patients p on p.workspace_id = p_workspace_id and p.id = e.patient_id and p.deleted_at is null and p.status <> 'soft_deleted'
    left join public.guardians g on g.workspace_id = p_workspace_id and g.id = coalesce(i.guardian_id,e.guardian_id) and g.deleted_at is null and g.status <> 'soft_deleted'
    left join public.user_memberships membership on membership.workspace_id = p_workspace_id
      and membership.user_id = coalesce(i.issued_by_user_id,e.primary_veterinarian_id) and membership.status = 'active'
    left join public.users requester on requester.id = membership.user_id and requester.status = 'active'
    cross join lateral (
      select count(*)::integer as line_count, (array_agg(l.description order by l.created_at,l.id))[1] as first_description
      from public.invoice_lines l where l.workspace_id = p_workspace_id and l.invoice_id = i.id
    ) lines
    where i.workspace_id = p_workspace_id and (
      (private.clair_billing_lifecycle_status(i.status,i.payment_state,i.unpaid_reason) in ('waiting','unpaid')
        and (coalesce(i.billing_requested_at,i.issued_at,i.created_at) at time zone 'Asia/Seoul')::date <= p_operating_date)
      or (private.clair_billing_lifecycle_status(i.status,i.payment_state,i.unpaid_reason) not in ('waiting','unpaid')
        and (coalesce(i.billing_requested_at,i.issued_at,i.created_at) at time zone 'Asia/Seoul')::date = p_operating_date)
    )
    order by activity_at desc,i.id offset p_offset limit p_limit
  ) page), '[]'::jsonb);
end;
$$;
revoke all on function private.clair_list_billing_queue(text,date,integer,integer) from public,anon,authenticated,service_role;
grant execute on function private.clair_list_billing_queue(text,date,integer,integer) to authenticated;
create or replace function public.clair_list_billing_queue(
  p_workspace_id text, p_operating_date date, p_offset integer default 0, p_limit integer default 200
) returns jsonb language sql stable security invoker set search_path = pg_catalog
as $$ select private.clair_list_billing_queue(p_workspace_id,p_operating_date,p_offset,p_limit); $$;
revoke all on function public.clair_list_billing_queue(text,date,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.clair_list_billing_queue(text,date,integer,integer) to authenticated;
comment on function public.clair_list_billing_queue(text,date,integer,integer) is
  'Date-scoped billing:view-only queue cards; outstanding carryover; terminal rows on request date; deleted subject names suppressed; no financial mutations.';
