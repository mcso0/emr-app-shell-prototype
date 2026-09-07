-- HOME-PR-014: explicitly authorized demo read-only source adapter.
-- Table grants and business records are unchanged. Caller identity is never an argument.
create or replace function private.clair_get_home_operations_source_snapshot(
  p_workspace_id text, p_offset integer default 0, p_limit integer default 500
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_chart boolean;
  v_billing boolean;
begin
  if auth.uid() is null or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:view') then
    raise exception 'home_permission_denied' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;
  v_chart := private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view');
  v_billing := private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view');
  return jsonb_build_object(
    'appointments', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.patient_id, r.guardian_id, r.assigned_veterinarian_id, r.scheduled_start_at, r.visit_purpose, r.symptom_note, r.status, r.created_by_user_id, r.created_at, r.updated_at, coalesce((select jsonb_agg(a.assignee_user_id order by a.assignee_user_id) from public.appointment_staff_assignments a where a.workspace_id = p_workspace_id and a.appointment_id = r.id), '[]'::jsonb) as assigned_staff_user_ids
      from public.appointments r where r.workspace_id = p_workspace_id
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'encounters', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.patient_id, r.guardian_id, r.appointment_id, r.primary_veterinarian_id, r.reception_type, r.chief_complaint, r.visit_purpose, r.status, r.checked_in_at, r.checked_in_by_user_id, coalesce((select jsonb_agg(a.assignee_user_id order by a.assignee_user_id) from public.encounter_staff_assignments a where a.workspace_id = p_workspace_id and a.encounter_id = r.id), '[]'::jsonb) as assigned_staff_user_ids
      from public.encounters r where r.workspace_id = p_workspace_id
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'waiting_queue_entries', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.encounter_id, r.queue_type, r.status, r.priority, r.entered_at, r.called_at, r.finished_at
      from public.waiting_queue_entries r where r.workspace_id = p_workspace_id and (r.queue_type = 'reception' or (r.queue_type = 'consultation' and v_chart))
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'patients', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.name
      from public.patients r where r.workspace_id = p_workspace_id and (exists (select 1 from public.appointments a where a.workspace_id = p_workspace_id and a.patient_id = r.id) or exists (select 1 from public.encounters e where e.workspace_id = p_workspace_id and e.patient_id = r.id))
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'guardians', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.name
      from public.guardians r where r.workspace_id = p_workspace_id and (exists (select 1 from public.appointments a where a.workspace_id = p_workspace_id and a.guardian_id = r.id) or exists (select 1 from public.encounters e where e.workspace_id = p_workspace_id and e.guardian_id = r.id) or (v_billing and exists (select 1 from public.invoices i where i.workspace_id = p_workspace_id and i.guardian_id = r.id)))
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.encounter_id, r.guardian_id, r.invoice_no, r.status, r.subtotal_amount, r.discount_amount, r.tax_amount, r.total_amount, r.issued_at, r.paid_at, r.payment_state, r.billing_requested_at, r.created_at
      from public.invoices r where r.workspace_id = p_workspace_id and v_billing
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'invoice_lines', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.invoice_id, r.order_id, r.description, r.quantity, r.unit_price, r.line_total, r.billing_candidate_id, r.created_at, r.updated_at
      from public.invoice_lines r where r.workspace_id = p_workspace_id and v_billing
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.billing_candidate_id
      from public.orders r where r.workspace_id = p_workspace_id and v_billing and r.billing_candidate_id is not null
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb),
    'user_memberships', coalesce((select jsonb_agg(to_jsonb(page)) from (select r.id, r.workspace_id, r.user_id, (select jsonb_build_object('display_name', u.display_name) from public.users u where u.id = r.user_id) as users
      from public.user_memberships r where r.workspace_id = p_workspace_id
      order by r.id offset p_offset limit p_limit) page), '[]'::jsonb)
  );
end;
$$;
revoke all on function private.clair_get_home_operations_source_snapshot(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function private.clair_get_home_operations_source_snapshot(text, integer, integer) to authenticated;

create or replace function public.clair_get_home_operations_source_snapshot(
  p_workspace_id text, p_offset integer default 0, p_limit integer default 500
) returns jsonb language sql stable security invoker set search_path = pg_catalog
as $$ select private.clair_get_home_operations_source_snapshot(p_workspace_id, p_offset, p_limit); $$;
revoke all on function public.clair_get_home_operations_source_snapshot(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.clair_get_home_operations_source_snapshot(text, integer, integer) to authenticated;
comment on function public.clair_get_home_operations_source_snapshot(text, integer, integer) is
  'HOME-PR-014: permission-gated, workspace-scoped, paginated Home source columns; empty arrays mark source exhaustion; no business writes.';
