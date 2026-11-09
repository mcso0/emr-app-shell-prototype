-- Complete dispensing and treatment through the authorized instruction command.
-- The existing result schema and historical results are retained.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $patch$
declare
  definition text := pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
  anchor text := $old$'resultRequired',child.execution_result_schema_version=1 and not exists$old$;
  replacement text := $new$'resultRequired',child.execution_result_schema_version=1
     and child.clinical_order_type not in ('dispensing','treatment') and not exists$new$;
begin
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'instruction_result_required_anchor_mismatch';
  end if;
  execute replace(definition,anchor,replacement);
end $patch$;

create or replace function private.clair_guard_execution_result_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if new.execution_result_schema_version is distinct from old.execution_result_schema_version then
    raise exception 'execution_result_schema_immutable' using errcode='55000';
  end if;
  if new.status='complete' and old.status is distinct from 'complete'
    and new.task_role='execution' and new.execution_result_schema_version=1
    and new.clinical_order_type not in ('clinical_lab','external_lab')
    and not (
      new.clinical_order_type in ('dispensing','treatment')
      and exists(select 1 from private.fulfillment_instruction_completion_scope s
        where s.transaction_id=txid_current() and s.workspace_id=new.workspace_id
          and s.task_id=new.id and s.actor_id=auth.uid())
    )
    and not exists(select 1 from public.order_execution_result_versions r
      where r.workspace_id=new.workspace_id and r.task_id=new.id and r.task_attempt_no=new.attempt_no
        and r.version=1 and r.plan_snapshot=new.effective_snapshot
        and new.result_snapshot->>'executionResultId'=r.id::text) then
    raise exception 'actual_execution_result_required';
  end if;
  return new;
end $f$;

commit;
