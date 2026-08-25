-- Phase 9 post-backfill FK indexes. These are additive and cover only the new
-- execution contract relationships reported by the Supabase advisor.

set lock_timeout = '5s';
set statement_timeout = '120s';

create index if not exists order_tasks_created_by_user_idx
  on public.order_tasks(created_by_user_id);

create index if not exists order_task_events_actor_user_idx
  on public.order_task_events(actor_user_id);

create index if not exists order_confirmation_commands_actor_user_idx
  on public.order_confirmation_commands(actor_user_id);

create index if not exists order_billing_candidates_created_by_user_idx
  on public.order_billing_candidates(created_by_user_id);
create index if not exists order_billing_candidates_invoice_line_idx
  on public.order_billing_candidates(invoice_line_id)
  where invoice_line_id is not null;
create index if not exists order_billing_candidates_command_idx
  on public.order_billing_candidates(workspace_id, confirmation_command_id);
create index if not exists order_billing_candidates_task_attempt_idx
  on public.order_billing_candidates(workspace_id, task_id, task_attempt_no);

create index if not exists order_execution_outbox_confirmation_command_idx
  on public.order_execution_outbox(workspace_id, confirmation_command_id)
  where confirmation_command_id is not null;
create index if not exists order_execution_outbox_revision_idx
  on public.order_execution_outbox(workspace_id, order_revision_id)
  where order_revision_id is not null;
create index if not exists order_execution_outbox_aggregate_idx
  on public.order_execution_outbox(workspace_id, aggregate_id);

create index if not exists order_fulfillment_work_items_task_attempt_idx
  on public.order_fulfillment_work_items(
    workspace_id, task_id, task_attempt_no
  ) where task_id is not null;
