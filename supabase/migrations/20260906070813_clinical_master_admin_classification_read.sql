-- Additive read metadata only. No master/catalog values or write policies change.
create or replace function public.clair_list_order_catalog_admin_v2(p_workspace_id text)
returns setof jsonb
language sql stable security definer
set search_path = ''
as $function$
  select pg_catalog.to_jsonb(item) || pg_catalog.jsonb_build_object(
    'service_review_only', (
      item.source_dispensing_profile_id is not null
      and item.clinical_use_allowed = false
      and private.clair_dispensing_service_review_allowed(p_workspace_id, profile.source_release_id)
    ),
    'service_review_release_id', case
      when item.source_dispensing_profile_id is not null
        and item.clinical_use_allowed = false
        and private.clair_dispensing_service_review_allowed(p_workspace_id, profile.source_release_id)
      then profile.source_release_id else null end,
    'classification_path', case when path.id is null then null else
      pg_catalog.jsonb_build_object(
        'id', path.id, 'key', path.path_key,
        'actionCode', action.action_code, 'actionName', action_name.name,
        'itemType', action.item_type, 'isUnclassified', action.is_other_unclassified,
        'tCategoryCode', category.category_code,
        'chartGroupCode', chart_group.group_code, 'taskRouteCode', task_route.route_code,
        'retired', path.retired_in_release_id is not null
      ) end
  )
  from public.order_catalog_items item
  left join master.dispensing_order_profiles profile
    on profile.id = item.source_dispensing_profile_id
   and profile.profile_revision = item.source_dispensing_profile_revision
  -- Resolve this catalog row's path, not the current master order's newer path.
  left join master.classification_paths path on path.id = item.classification_path_id
  left join master.clinical_actions action on action.master_record_id = path.clinical_action_id
  left join master.order_categories category on category.master_record_id = action.t_category_id
  left join master.chart_groups chart_group on chart_group.master_record_id = path.chart_group_id
  left join master.task_routes task_route on task_route.master_record_id = path.task_route_id
  left join lateral (
    select name.name from master.master_record_names name
    where name.master_record_id = action.master_record_id
      and name.language_code = 'ko' and name.name_kind = 'preferred'
    order by name.sort_order, name.id limit 1
  ) action_name on true
  where item.workspace_id = p_workspace_id
    and private.clair_current_user_has_workspace_permission(p_workspace_id, 'service_catalog:view')
  order by item.category_group, item.standard_order_name, item.id;
$function$;

revoke all on function public.clair_list_order_catalog_admin_v2(text) from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_admin_v2(text) to authenticated;
