-- Runs after the candidate migration in the same rollback-only transaction.
set local role authenticated;
do $$ declare rows jsonb; descriptor jsonb; begin
  select jsonb_agg(row) into rows from public.clair_list_order_catalog_admin_v2('clair-demo') row;
  if jsonb_array_length(rows) <> 1 then raise exception 'row count changed or missing fixture'; end if;
  descriptor := rows->0->'classification_path';
  if descriptor->>'id' is distinct from rows->0->>'classification_path_id'
    or descriptor->>'key' is distinct from 'cm.path.laboratory'
    or descriptor->>'itemType' is distinct from 'lab'
    or descriptor->>'isUnclassified' is distinct from 'false'
    or descriptor->>'retired' is distinct from 'false' then
    raise exception 'exact path lookup mismatch';
  end if;
  if rows->0->>'workspace_id' <> 'clair-demo' then raise exception 'foreign row'; end if;
end $$;
reset role;
do $$ begin
  if exists (
    (select row from wp01b_before except select row - 'classification_path' from public.clair_list_order_catalog_admin_v2('clair-demo') row)
    union all
    (select row - 'classification_path' from public.clair_list_order_catalog_admin_v2('clair-demo') row except select row from wp01b_before)
  ) then raise exception 'existing catalog projection changed'; end if;
  if has_function_privilege('anon', 'public.clair_list_order_catalog_admin_v2(text)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.clair_list_order_catalog_admin_v2(text)', 'EXECUTE') then
    raise exception 'execute grants widened';
  end if;
end $$;
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.clair_list_order_catalog_admin_v2('clair-demo')) then
    raise exception 'non-member received rows';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.clair_list_order_catalog_admin_v2('clair-demo')) then
    raise exception 'absent auth received rows';
  end if;
end $$;
reset role;
select 'WP01B taxonomy SQL assertions passed; transaction must roll back' as result;
