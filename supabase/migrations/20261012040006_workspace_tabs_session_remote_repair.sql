-- Restore the missing hosted table using the existing self/member contract.
-- Workspace tab session persistence for account-based shell restore.
-- Stores user-owned shell navigation state only. Do not store patient/guardian display names here.

create table if not exists public.user_workspace_tab_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  tabs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tabs) = 'array'),
  active_tab_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists user_workspace_tab_sessions_user_updated_idx
  on public.user_workspace_tab_sessions (user_id, updated_at desc);

drop trigger if exists set_user_workspace_tab_sessions_updated_at on public.user_workspace_tab_sessions;
create trigger set_user_workspace_tab_sessions_updated_at
before update on public.user_workspace_tab_sessions
for each row execute function public.clair_set_updated_at();

alter table public.user_workspace_tab_sessions enable row level security;

drop policy if exists user_workspace_tab_sessions_select_self_member on public.user_workspace_tab_sessions;
create policy user_workspace_tab_sessions_select_self_member
on public.user_workspace_tab_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  and private.clair_is_active_workspace_member(workspace_id)
);

drop policy if exists user_workspace_tab_sessions_insert_self_member on public.user_workspace_tab_sessions;
create policy user_workspace_tab_sessions_insert_self_member
on public.user_workspace_tab_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.clair_is_active_workspace_member(workspace_id)
);

drop policy if exists user_workspace_tab_sessions_update_self_member on public.user_workspace_tab_sessions;
create policy user_workspace_tab_sessions_update_self_member
on public.user_workspace_tab_sessions
for update
to authenticated
using (
  user_id = auth.uid()
  and private.clair_is_active_workspace_member(workspace_id)
)
with check (
  user_id = auth.uid()
  and private.clair_is_active_workspace_member(workspace_id)
);

comment on table public.user_workspace_tab_sessions is
  'User-owned workspace shell tab restore state. Stores route/object identifiers only, not patient or guardian display names.';

-- Do not depend on environment-specific default table privileges.
revoke all on public.user_workspace_tab_sessions from anon, authenticated;
grant select, insert, update on public.user_workspace_tab_sessions to authenticated;
