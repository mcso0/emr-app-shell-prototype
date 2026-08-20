-- Phase 1B-3 forward fix: restore the canonical B1 result freeze at chart
-- confirmation without changing B3 order authority, snapshots, or retry
-- semantics.  The B3 6-argument implementation is retained as a private
-- base; the public authenticated wrapper freezes only selected lab orders
-- (individual roots and direct set children) in the same transaction.

begin;

do $$
begin
  if to_regprocedure(
       'public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)'
     ) is null then
    raise exception 'clinical_master_phase1b3_confirm_freeze_action_missing';
  end if;
  if to_regprocedure(
       'private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)'
     ) is null then
    raise exception 'clinical_master_phase1b3_confirm_freeze_hook_missing';
  end if;
  if to_regprocedure(
       'private.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)'
     ) is null then
    alter function public.clair_save_chart_order_action(
      text,uuid,uuid,text,uuid[],text
    ) set schema private;
  else
    raise exception 'clinical_master_phase1b3_confirm_freeze_base_exists';
  end if;
end
$$;

-- The moved B3 body is callable only by the wrapper below.  The wrapper keeps
-- the existing authenticated public boundary; callers cannot bypass freezing
-- through the private base.
revoke all on function private.clair_save_chart_order_action(
  text,uuid,uuid,text,uuid[],text
) from public, anon, authenticated, service_role;

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[],
  p_expected_etag text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp, pg_catalog
as $$
declare
  v_base jsonb;
  v_freeze jsonb;
  v_order_id uuid;
begin
  -- B3 remains the sole order/action authority.  Any authorization, ETag,
  -- selection, snapshot, lifecycle, or terminal-retry failure is raised by
  -- the existing base before the B1 hook can run.
  v_base := private.clair_save_chart_order_action(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_action,
    p_order_ids,
    p_expected_etag
  );

  if p_action = 'confirm' then
    -- An individual lab order is a selected root.  A set parent is the
    -- selected root for B3, so freeze only its direct canonical lab children.
    -- The non-null master lineage is intentional: legacy/workspace_custom
    -- lab rows are not B1 canonical input and must remain untouched.  The
    -- deterministic order keeps the existing workspace lock/row-lock order.
    for v_order_id in
      select order_row.id
      from public.orders order_row
      where order_row.workspace_id = p_workspace_id
        and order_row.encounter_id = p_encounter_id
        and order_row.status <> 'cancelled'
        and order_row.order_confirmation_status in ('confirmed', 'billed')
        and order_row.order_type = 'lab'
        and order_row.row_type in ('individual', 'set_child')
        and order_row.workspace_catalog_item_id is not null
        and order_row.workspace_catalog_revision is not null
        and order_row.source_master_record_id is not null
        and order_row.source_master_revision is not null
        and order_row.service_item_id is null
        and (
          (
            order_row.row_type = 'individual'
            and order_row.id = any(p_order_ids)
          )
          or (
            order_row.row_type = 'set_child'
            and order_row.parent_chart_order_line_id = any(p_order_ids)
          )
        )
      order by order_row.workspace_catalog_item_id, order_row.id
    loop
      v_freeze := private.clair_create_lab_result_entry_for_confirmed_order(
        p_workspace_id,
        p_actor_user_id,
        v_order_id,
        p_encounter_id
      );
    end loop;
  end if;

  return v_base;
end
$$;

revoke all on function public.clair_save_chart_order_action(
  text,uuid,uuid,text,uuid[],text
) from public, anon, service_role;
grant execute on function public.clair_save_chart_order_action(
  text,uuid,uuid,text,uuid[],text
) to authenticated;

comment on function public.clair_save_chart_order_action(
  text,uuid,uuid,text,uuid[],text
) is
  'B3 chart action authority with same-transaction canonical B1 lab freeze for individual and direct set-child lab orders.';

commit;
