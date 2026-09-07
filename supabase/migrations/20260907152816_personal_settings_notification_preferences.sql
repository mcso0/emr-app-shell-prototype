-- AUTH-PR-036: preferences never change inbox persistence or recipient policy.
create table public.workspace_notification_preferences (
  workspace_id text not null,
  user_id uuid not null,
  popup boolean not null default true,
  sound boolean not null default false,
  categories jsonb not null default '{"order_recheck_requested":true,"clinical_result_completed":true,"waiting_over_30m":true,"clinical_master_update_available":true}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id) references public.user_memberships(workspace_id, user_id) on delete cascade,
  constraint workspace_notification_categories_check check (
    jsonb_typeof(categories) = 'object'
    and categories ?& array['order_recheck_requested','clinical_result_completed','waiting_over_30m','clinical_master_update_available']
    and categories - array['order_recheck_requested','clinical_result_completed','waiting_over_30m','clinical_master_update_available'] = '{}'::jsonb
    and jsonb_typeof(categories->'order_recheck_requested') = 'boolean'
    and jsonb_typeof(categories->'clinical_result_completed') = 'boolean'
    and jsonb_typeof(categories->'waiting_over_30m') = 'boolean'
    and jsonb_typeof(categories->'clinical_master_update_available') = 'boolean'
  )
);
alter table public.workspace_notification_preferences enable row level security;
revoke all on public.workspace_notification_preferences from public, anon;
grant select, insert, update on public.workspace_notification_preferences to authenticated;
create policy workspace_notification_preferences_select_self on public.workspace_notification_preferences
for select to authenticated using (user_id = (select auth.uid()) and private.clair_is_active_workspace_member(workspace_id));
create policy workspace_notification_preferences_insert_self on public.workspace_notification_preferences
for insert to authenticated with check (user_id = (select auth.uid()) and private.clair_is_active_workspace_member(workspace_id));
create policy workspace_notification_preferences_update_self on public.workspace_notification_preferences
for update to authenticated using (user_id = (select auth.uid()) and private.clair_is_active_workspace_member(workspace_id))
with check (user_id = (select auth.uid()) and private.clair_is_active_workspace_member(workspace_id));
create trigger set_workspace_notification_preferences_updated_at before update on public.workspace_notification_preferences
for each row execute function public.clair_set_updated_at();
