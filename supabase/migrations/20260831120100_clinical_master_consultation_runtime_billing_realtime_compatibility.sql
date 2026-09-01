-- CLINICAL-MASTER-PR-022 final current-main compatibility.
--
-- The later billing-summary Realtime migration replaces the public draft RPC.
-- Restore the server-authoritative consultation clinician resolver and carry
-- the billing-summary/realtime behavior in the same deterministic final RPC.
-- This keeps fresh and already-migrated databases equivalent regardless of
-- which earlier wrapper most recently owned the public function.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := private.clair_b3_safe_uuid(p_actor_user_id);
  v_primary_veterinarian_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_child jsonb;
  v_children jsonb;
  v_effective_orders jsonb := p_orders;
  v_result jsonb;
  v_summary jsonb;
begin
  if auth.uid() is null
    or v_actor is null
    or v_actor is distinct from auth.uid()
  then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'chart:update'
  ) or not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'chart:view'
  ) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select encounter.primary_veterinarian_id
    into v_primary_veterinarian_id
  from public.encounters encounter
  where encounter.workspace_id = p_workspace_id
    and encounter.id = p_encounter_id;
  if not found then
    raise exception 'encounter_unavailable' using errcode = 'P0002';
  end if;

  -- Keep the proven base writer's malformed-payload behavior unchanged.
  if pg_catalog.jsonb_typeof(coalesce(p_orders, '{}'::jsonb)) = 'object'
    and pg_catalog.jsonb_typeof(p_orders -> 'rows') = 'array'
  then
    for v_row in
      select entry.value
      from pg_catalog.jsonb_array_elements(p_orders -> 'rows') entry(value)
    loop
    if pg_catalog.jsonb_typeof(v_row) = 'object'
      and v_row ->> 'rowType' = 'individual'
      and v_row ? 'detailInputs'
      and exists (
        select 1
        from public.order_catalog_items catalog
        where catalog.workspace_id = p_workspace_id
          and catalog.id = v_row ->> 'workspaceCatalogItemId'
          and catalog.clinical_order_type = 'consultation'
      )
    then
      v_row := pg_catalog.jsonb_set(
        v_row,
        '{detailInputs}',
        private.clair_pr022_resolve_consultation_detail_inputs(
          v_row -> 'detailInputs',
          v_primary_veterinarian_id
        ),
        true
      );
    elsif pg_catalog.jsonb_typeof(v_row) = 'object'
      and v_row ->> 'rowType' = 'set'
      and pg_catalog.jsonb_typeof(v_row -> 'childInputs') = 'array'
    then
      v_children := '[]'::jsonb;
      for v_child in
        select entry.value
        from pg_catalog.jsonb_array_elements(v_row -> 'childInputs') entry(value)
      loop
        if pg_catalog.jsonb_typeof(v_child) = 'object'
          and v_child ? 'detailInputs'
          and exists (
            select 1
            from public.order_set_revision_items revision_item
            join public.order_catalog_items catalog
              on catalog.workspace_id = revision_item.workspace_id
             and catalog.id = revision_item.child_order_catalog_item_id
            where revision_item.workspace_id = p_workspace_id
              and revision_item.id = private.clair_b3_safe_uuid(
                v_child ->> 'revisionItemId'
              )
              and revision_item.child_kind = 'atomic'
              and catalog.clinical_order_type = 'consultation'
          )
        then
          v_child := pg_catalog.jsonb_set(
            v_child,
            '{detailInputs}',
            private.clair_pr022_resolve_consultation_detail_inputs(
              v_child -> 'detailInputs',
              v_primary_veterinarian_id
            ),
            true
          );
        end if;
        v_children := v_children || pg_catalog.jsonb_build_array(v_child);
      end loop;
      v_row := pg_catalog.jsonb_set(
        v_row,
        '{childInputs}',
        v_children,
        true
      );
    end if;
      v_rows := v_rows || pg_catalog.jsonb_build_array(v_row);
    end loop;
    v_effective_orders := pg_catalog.jsonb_set(
      p_orders,
      '{rows}',
      v_rows,
      true
    );
  end if;

  v_result := public.clair_save_chart_order_draft_billing_summary_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    v_effective_orders
  );
  v_summary := private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id,
    p_encounter_id
  );

  perform private.clair_broadcast_chart_billing_summary_changed(
    p_workspace_id,
    p_encounter_id,
    v_summary ->> 'etag',
    pg_catalog.txid_current()::text
  );

  return v_result || pg_catalog.jsonb_build_object(
    'billingSummary',
    v_summary
  );
end;
$function$;

do $owner$
declare
  v_owner text;
begin
  select pg_catalog.pg_get_userbyid(proc.proowner)
    into v_owner
  from pg_catalog.pg_proc proc
  where proc.oid =
    'private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)'::pg_catalog.regprocedure;

  if v_owner is null then
    raise exception 'billing_realtime_owner_missing';
  end if;

  execute pg_catalog.format(
    'alter function public.clair_save_chart_order_draft(text,text,uuid,jsonb) owner to %I',
    v_owner
  );
end;
$owner$;

revoke all on function public.clair_save_chart_order_draft_billing_summary_base(
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.clair_save_chart_order_draft_pr022_base(
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.clair_save_chart_order_draft_candidate_base(
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.clair_save_chart_order_draft_phase2_base(
  text,
  text,
  uuid,
  jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.clair_save_chart_order_draft(
  text,
  text,
  uuid,
  jsonb
) from public, anon, service_role;
grant execute on function public.clair_save_chart_order_draft(
  text,
  text,
  uuid,
  jsonb
) to authenticated;

comment on function public.clair_save_chart_order_draft(
  text,
  text,
  uuid,
  jsonb
) is
  'CAS draft writer with billing summary and Realtime invalidation plus server-authoritative encounter primary-veterinarian resolution for consultation roots and set children.';
