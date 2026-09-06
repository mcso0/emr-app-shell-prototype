-- Local synthetic fixture only. Run inside BEGIN, then migration, assertions, ROLLBACK.
create temp table wp01b_actor as
select membership.user_id from public.user_memberships membership
join public.users app_user on app_user.id = membership.user_id
where membership.workspace_id = 'clair-demo' and membership.status = 'active'
  and app_user.status = 'active' and membership.roles @> array['hospital_admin']::text[]
limit 1;
select set_config('request.jwt.claim.sub', (select user_id::text from wp01b_actor), true);
do $$ begin
  if not private.clair_current_user_has_workspace_permission('clair-demo', 'service_catalog:view') then
    raise exception 'synthetic fixture actor unavailable';
  end if;
end $$;

insert into public.order_catalog_items (
  id, workspace_id, standard_order_id, source_preset_version,
  category_group, category_label, standard_order_name, in_hospital_order_name,
  billing_name, default_destination_module, classification_path_id,
  clinical_order_type, is_external_lab, execution_mode, detail_schema_version,
  detail_field_schema, billing_eligible, price_krw
)
select fixture.id, fixture.workspace_id, fixture.id, 'wp01b-test',
  'lab', 'Synthetic laboratory', fixture.id, fixture.id, fixture.id, 'lab', path.id,
  'clinical_lab', false, 'result', 1, '{}'::jsonb, true, 0
from (values ('wp01b-taxonomy-local', 'clair-demo'),
  ('wp01b-taxonomy-foreign', 'clair-foreign-demo')) fixture(id, workspace_id)
cross join master.classification_paths path where path.path_key = 'cm.path.laboratory';

create temp table wp01b_before as
select row from public.clair_list_order_catalog_admin_v2('clair-demo') row;
