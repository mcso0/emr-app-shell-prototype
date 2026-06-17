-- DEN-507: Cheongdam synthetic demo session reset RPC.
-- Scope: prepared empty-clinic demo workspace only. Preserves master seed data
-- and never touches external providers, auth users, memberships, catalogs, or config.

create or replace function public.clair_reset_cheongdam_demo_session(
  p_workspace_id text,
  p_actor_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_allowed_workspace_id constant text := 'workspace-clair-cheongdam';
  v_actor_uuid uuid;
  v_generated_guardian_ids uuid[] := '{}'::uuid[];
  v_appointments integer := 0;
  v_encounters integer := 0;
  v_waiting_queue_entries integer := 0;
  v_soap_notes integer := 0;
  v_diagnoses integer := 0;
  v_order_groups integer := 0;
  v_orders integer := 0;
  v_fulfillment_work_items integer := 0;
  v_billing_checkout_sessions integer := 0;
  v_billing_checkout_session_invoices integer := 0;
  v_billing_invoice_status_events integer := 0;
  v_invoice_adjustments integer := 0;
  v_payment_allocations integer := 0;
  v_invoices integer := 0;
  v_invoice_lines integer := 0;
  v_payments integer := 0;
  v_generated_patients integer := 0;
  v_generated_guardians integer := 0;
begin
  if p_workspace_id <> v_allowed_workspace_id then
    raise exception 'unsupported_workspace';
  end if;

  if auth.uid() is null then
    raise exception 'workspace_membership_missing';
  end if;

  begin
    v_actor_uuid := nullif(btrim(p_actor_user_id), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_uuid is null or v_actor_uuid <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required';
  end if;

  select coalesce(array_agg(distinct patient_guardian.guardian_id), '{}'::uuid[])
    into v_generated_guardian_ids
  from public.patient_guardians patient_guardian
  join public.patients patient
    on patient.workspace_id = patient_guardian.workspace_id
   and patient.id = patient_guardian.patient_id
  where patient.workspace_id = p_workspace_id
    and patient.patient_no ~ '^P-[0-9]{6}-[A-F0-9]{6}$';

  delete from public.order_fulfillment_work_items
  where workspace_id = p_workspace_id;
  get diagnostics v_fulfillment_work_items = row_count;

  delete from public.payment_allocations
  where workspace_id = p_workspace_id;
  get diagnostics v_payment_allocations = row_count;

  delete from public.invoice_adjustments
  where workspace_id = p_workspace_id;
  get diagnostics v_invoice_adjustments = row_count;

  delete from public.billing_checkout_session_invoices
  where workspace_id = p_workspace_id;
  get diagnostics v_billing_checkout_session_invoices = row_count;

  delete from public.billing_checkout_sessions
  where workspace_id = p_workspace_id;
  get diagnostics v_billing_checkout_sessions = row_count;

  delete from public.billing_invoice_status_transition_events
  where workspace_id = p_workspace_id;
  get diagnostics v_billing_invoice_status_events = row_count;

  delete from public.payments
  where workspace_id = p_workspace_id;
  get diagnostics v_payments = row_count;

  delete from public.invoice_lines
  where workspace_id = p_workspace_id;
  get diagnostics v_invoice_lines = row_count;

  delete from public.invoices
  where workspace_id = p_workspace_id;
  get diagnostics v_invoices = row_count;

  delete from public.order_revision_fields field
  using public.order_revisions revision
  where field.workspace_id = p_workspace_id
    and revision.workspace_id = p_workspace_id
    and field.order_revision_id = revision.id;

  delete from public.order_revisions
  where workspace_id = p_workspace_id;

  delete from public.order_events
  where workspace_id = p_workspace_id;

  delete from public.orders
  where workspace_id = p_workspace_id;
  get diagnostics v_orders = row_count;

  delete from public.order_groups
  where workspace_id = p_workspace_id;
  get diagnostics v_order_groups = row_count;

  delete from public.diagnoses
  where workspace_id = p_workspace_id;
  get diagnostics v_diagnoses = row_count;

  delete from public.soap_note_revisions
  where workspace_id = p_workspace_id;

  delete from public.soap_notes
  where workspace_id = p_workspace_id;
  get diagnostics v_soap_notes = row_count;

  delete from public.waiting_queue_entries
  where workspace_id = p_workspace_id;
  get diagnostics v_waiting_queue_entries = row_count;

  delete from public.appointment_change_logs
  where workspace_id = p_workspace_id;

  delete from public.encounters
  where workspace_id = p_workspace_id;
  get diagnostics v_encounters = row_count;

  delete from public.appointments
  where workspace_id = p_workspace_id;
  get diagnostics v_appointments = row_count;

  delete from public.patients
  where workspace_id = p_workspace_id
    and patient_no ~ '^P-[0-9]{6}-[A-F0-9]{6}$';
  get diagnostics v_generated_patients = row_count;

  delete from public.guardians guardian
  where guardian.workspace_id = p_workspace_id
    and guardian.id = any(v_generated_guardian_ids)
    and coalesce(guardian.guardian_code, '') not like 'CD-G-%'
    and not exists (
      select 1
      from public.patient_guardians patient_guardian
      where patient_guardian.workspace_id = p_workspace_id
        and patient_guardian.guardian_id = guardian.id
    );
  get diagnostics v_generated_guardians = row_count;

  return jsonb_build_object(
    'appointments', v_appointments,
    'encounters', v_encounters,
    'waitingQueueEntries', v_waiting_queue_entries,
    'soapNotes', v_soap_notes,
    'diagnoses', v_diagnoses,
    'orderGroups', v_order_groups,
    'orders', v_orders,
    'fulfillmentWorkItems', v_fulfillment_work_items,
    'billingCheckoutSessions', v_billing_checkout_sessions,
    'billingCheckoutSessionInvoices', v_billing_checkout_session_invoices,
    'billingInvoiceStatusEvents', v_billing_invoice_status_events,
    'invoiceAdjustments', v_invoice_adjustments,
    'paymentAllocations', v_payment_allocations,
    'invoices', v_invoices,
    'invoiceLines', v_invoice_lines,
    'payments', v_payments,
    'generatedPatients', v_generated_patients,
    'generatedGuardians', v_generated_guardians
  );
end;
$$;

revoke all on function public.clair_reset_cheongdam_demo_session(text, text) from public;
grant execute on function public.clair_reset_cheongdam_demo_session(text, text) to authenticated;

comment on function public.clair_reset_cheongdam_demo_session(text, text) is
  'DEN-507 admin-only reset for workspace-clair-cheongdam synthetic demo daily-work and generated registration records.';
