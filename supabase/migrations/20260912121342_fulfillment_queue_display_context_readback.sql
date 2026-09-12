begin;

create or replace function public.clair_list_fulfillment_work_items(
  p_workspace_id text,
  p_queue_type text,
  p_encounter_id uuid default null,
  p_order_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_queue_type not in (
    'consultation','lab','imaging','external_lab','dispensing',
    'treatment','hospitalization','other'
  ) then raise exception 'unsupported_order_type'; end if;
  if p_status is not null and p_status not in (
    'requested','in_progress','paused','completed','returned','cancelled'
  ) then raise exception 'invalid_status'; end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(p_queue_type, 'read')
  ) then raise exception 'permission_missing'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'workspaceId', item.workspace_id,
    'patientId', encounter.patient_id,
    'patientName', patient.name,
    'guardianName', guardian.name,
    'requesterName', requester.display_name,
    'encounterId', item.encounter_id, 'orderId', item.order_id,
    'taskId', item.task_id, 'taskAttemptNo', item.task_attempt_no,
    'taskStatus', task.status,
    'clinicalOrderType', item.clinical_order_type,
    'destinationModule', item.destination_module,
    'orderType', item.order_type, 'queueType', item.queue_type,
    'status', item.status, 'priority', item.priority,
    'requestedByUserId', item.requested_by_user_id,
    'assignedToUserId', item.assigned_to_user_id,
    'assignedByUserId', item.assigned_by_user_id,
    'assignedAt', item.assigned_at,
    'startedByUserId', item.started_by_user_id,
    'startedAt', item.started_at,
    'detailedPhase', item.detailed_phase,
    'pausedFromPhase', item.paused_from_phase,
    'requestCycle', item.request_cycle,
    'rowRevision', item.row_revision,
    'dueAt', item.due_at, 'completedAt', item.completed_at,
    'cancelledAt', item.cancelled_at, 'returnedAt', item.returned_at,
    'reason', item.reason, 'sourceSnapshot', item.source_snapshot,
    'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.updated_at desc, item.id), '[]'::jsonb)
  into v_rows
  from public.order_fulfillment_work_items item
  join public.encounters encounter
    on encounter.workspace_id = item.workspace_id
   and encounter.id = item.encounter_id
  left join public.patients patient
    on patient.workspace_id = encounter.workspace_id
   and patient.id = encounter.patient_id
  left join public.guardians guardian
    on guardian.workspace_id = encounter.workspace_id
   and guardian.id = encounter.guardian_id
  left join public.order_tasks task
    on task.workspace_id = item.workspace_id
   and task.id = item.task_id
   and task.attempt_no = item.task_attempt_no
  left join public.user_memberships requester_membership
    on requester_membership.workspace_id = item.workspace_id
   and requester_membership.user_id = item.requested_by_user_id
   and requester_membership.status = 'active'
  left join public.users requester
    on requester.id = requester_membership.user_id
  where item.workspace_id = p_workspace_id
    and item.queue_type = p_queue_type
    and (p_encounter_id is null or item.encounter_id = p_encounter_id)
    and (p_order_id is null or item.order_id = p_order_id)
    and (p_status is null or item.status = p_status);
  return v_rows;
end;
$function$;

revoke all on function public.clair_list_fulfillment_work_items(
  text,text,uuid,uuid,text
) from public, anon, service_role;
grant execute on function public.clair_list_fulfillment_work_items(
  text,text,uuid,uuid,text
) to authenticated;

comment on function public.clair_list_fulfillment_work_items(
  text,text,uuid,uuid,text
) is
  'Permission-checked fulfillment queue readback with workspace-scoped patient, guardian, requester, and task display context kept separate from the frozen source snapshot.';

commit;
