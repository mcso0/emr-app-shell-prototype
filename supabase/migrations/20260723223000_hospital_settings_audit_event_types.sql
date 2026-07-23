-- Preserve the latest audit event catalog after workspace space-management
-- and add the hospital profile/logo mutation events used by the settings RPCs.
alter table public.audit_events
  drop constraint if exists audit_events_event_type_check;

alter table public.audit_events
  add constraint audit_events_event_type_check check (event_type in (
    'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
    'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
    'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
    'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
    'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
    'workspace.permission_role_created','workspace.permission_role_updated',
    'workspace.job_position_deactivated','workspace.job_position_reactivated',
    'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
    'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
    'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
    'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
    'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
    'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
    'order.billing_candidate_requested','order.status_changed','order_catalog.created',
    'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
    'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
    'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
    'hospital.schedule_revision_mutated','hospital.vital_settings_updated',
    'hospital.space_category_created','hospital.space_category_renamed',
    'hospital.space_category_archived','hospital.space_created',
    'hospital.space_updated','hospital.space_archived',
    'hospital.profile_contact_updated','hospital.profile_change_requested',
    'hospital.logo_updated','hospital.logo_removed'
  ));
