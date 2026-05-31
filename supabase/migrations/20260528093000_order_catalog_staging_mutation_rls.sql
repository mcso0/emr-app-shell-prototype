-- DEN-302: enable staging-backed Order Catalog admin mutations.
-- Applies only to synthetic/staging replay until representative review closes the flow.

alter table public.order_catalog_items
  add column if not exists initial_imported_preset_version text,
  add column if not exists last_auto_merged_preset_version text,
  add column if not exists customization_state text not null default 'detached'
    check (customization_state in ('unmodified', 'customized', 'detached')),
  add column if not exists customized_fields text[] not null default '{}',
  add column if not exists last_customized_at timestamptz,
  add column if not exists last_customized_by_user_id text,
  add column if not exists preset_merge_status text not null default 'detached'
    check (preset_merge_status in ('current', 'update_available', 'conflict', 'detached'));

alter table public.order_catalog_items enable row level security;
alter table public.order_sets enable row level security;
alter table public.order_set_items enable row level security;
alter table public.lab_test_categories enable row level security;
alter table public.lab_test_items enable row level security;
alter table public.order_catalog_lab_test_item_links enable row level security;

grant select, insert, update on public.order_catalog_items to authenticated;
grant select on public.order_sets to authenticated;
grant select on public.order_set_items to authenticated;
grant select on public.lab_test_categories to authenticated;
grant select on public.lab_test_items to authenticated;
grant select on public.order_catalog_lab_test_item_links to authenticated;

drop policy if exists order_catalog_items_workspace_member_select
  on public.order_catalog_items;
create policy order_catalog_items_workspace_member_select
on public.order_catalog_items
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists order_catalog_items_workspace_admin_insert
  on public.order_catalog_items;
create policy order_catalog_items_workspace_admin_insert
on public.order_catalog_items
for insert
to authenticated
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists order_catalog_items_workspace_admin_update
  on public.order_catalog_items;
create policy order_catalog_items_workspace_admin_update
on public.order_catalog_items
for update
to authenticated
using (private.clair_is_workspace_admin(workspace_id))
with check (private.clair_is_workspace_admin(workspace_id));

drop policy if exists order_sets_workspace_member_select
  on public.order_sets;
create policy order_sets_workspace_member_select
on public.order_sets
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists order_set_items_workspace_member_select
  on public.order_set_items;
create policy order_set_items_workspace_member_select
on public.order_set_items
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists lab_test_categories_workspace_member_select
  on public.lab_test_categories;
create policy lab_test_categories_workspace_member_select
on public.lab_test_categories
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists lab_test_items_workspace_member_select
  on public.lab_test_items;
create policy lab_test_items_workspace_member_select
on public.lab_test_items
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists order_catalog_lab_links_workspace_member_select
  on public.order_catalog_lab_test_item_links;
create policy order_catalog_lab_links_workspace_member_select
on public.order_catalog_lab_test_item_links
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

comment on policy order_catalog_items_workspace_admin_insert
on public.order_catalog_items is
  'DEN-302: hospital admins can create synthetic/staging workspace order catalog rows.';

comment on policy order_catalog_items_workspace_admin_update
on public.order_catalog_items is
  'DEN-302: hospital admins can update or pause workspace order catalog rows.';
