-- DEN-34: workspace auth schema foundation.
-- Local-first draft only. RLS policies and remote Supabase application are follow-up scopes.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.clair_workspace_role_values()
returns text[]
language sql
immutable
as $$
  select array['hospital_admin', 'vet', 'technician', 'front_desk']::text[];
$$;

create or replace function public.clair_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  initial text,
  email extensions.citext,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id text primary key
    check (id ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived', 'suspended')),
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  avatar_url text,
  notification_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(notification_preferences) = 'object'),
  locale text,
  timezone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  roles text[] not null default array[]::text[]
    check (roles <@ public.clair_workspace_role_values()),
  department text,
  title text,
  hire_date date,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive')),
  invited_by_user_id uuid references public.users(id) on delete set null,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or cardinality(roles) > 0),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  email extensions.citext not null,
  invited_roles text[] not null
    check (invited_roles <@ public.clair_workspace_role_values())
    check (cardinality(invited_roles) > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by_user_id uuid references public.users(id) on delete set null,
  accepted_by_user_id uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permission_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('role', 'user')),
  target_role text check (
    target_role is null or target_role = any(public.clair_workspace_role_values())
  ),
  target_user_id uuid references public.users(id) on delete cascade,
  permissions jsonb not null default '{"allowed":[]}'::jsonb
    check (jsonb_typeof(permissions) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'role' and target_role is not null and target_user_id is null)
    or
    (scope = 'user' and target_user_id is not null and target_role is null)
  )
);

create unique index if not exists workspace_invitations_pending_email_key
  on public.workspace_invitations (workspace_id, email)
  where status = 'pending';

create unique index if not exists permission_policies_role_scope_key
  on public.permission_policies (workspace_id, target_role)
  where scope = 'role';

create unique index if not exists permission_policies_user_scope_key
  on public.permission_policies (workspace_id, target_user_id)
  where scope = 'user';

create index if not exists users_status_idx
  on public.users (status);

create index if not exists workspaces_status_idx
  on public.workspaces (status);

create index if not exists user_memberships_workspace_status_idx
  on public.user_memberships (workspace_id, status);

create index if not exists user_memberships_user_status_idx
  on public.user_memberships (user_id, status);

create index if not exists user_memberships_active_roles_gin_idx
  on public.user_memberships using gin (roles)
  where status = 'active';

create index if not exists workspace_invitations_workspace_status_idx
  on public.workspace_invitations (workspace_id, status);

create index if not exists permission_policies_workspace_scope_idx
  on public.permission_policies (workspace_id, scope);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_user_memberships_updated_at on public.user_memberships;
create trigger set_user_memberships_updated_at
before update on public.user_memberships
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_workspace_invitations_updated_at on public.workspace_invitations;
create trigger set_workspace_invitations_updated_at
before update on public.workspace_invitations
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_permission_policies_updated_at on public.permission_policies;
create trigger set_permission_policies_updated_at
before update on public.permission_policies
for each row execute function public.clair_set_updated_at();

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_memberships enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.permission_policies enable row level security;

comment on table public.users is
  'App-domain user profile. id matches auth.users.id for loginable users.';
comment on table public.workspaces is
  'Workspace route and hospital operating scope for /w/[workspaceId].';
comment on table public.user_profiles is
  'User-owned settings only. Never store authorization roles or permissions here.';
comment on table public.user_memberships is
  'Workspace-scoped membership and additive canonical role source.';
comment on table public.workspace_invitations is
  'Workspace staff invitation lifecycle. Acceptance must be handled by a server transaction.';
comment on table public.permission_policies is
  'Allow-only role or user scoped permission source. No deny rules in MVP.';
