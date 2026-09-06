-- WP-07: explicitly registered workspace inpatient locations, not bed occupancy.
-- No seeded wards, name-based inference, or fallback rooms. RPC-only access.
set lock_timeout = '5s';
set statement_timeout = '120s';

create table public.workspace_inpatient_locations (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete restrict,
  label text not null check (label=btrim(label) and char_length(label) between 1 and 80),
  kind text not null check (kind in ('ward','cage')),
  active boolean not null default true,
  row_revision integer not null default 1 check (row_revision>0),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  updated_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create unique index workspace_inpatient_locations_name_idx on public.workspace_inpatient_locations(workspace_id,lower(label));
create table public.workspace_inpatient_location_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  location_id uuid not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(workspace_id,location_id) references public.workspace_inpatient_locations(workspace_id,id) on delete restrict
);
alter table public.workspace_inpatient_locations enable row level security;
alter table public.workspace_inpatient_location_events enable row level security;
revoke all on public.workspace_inpatient_locations,public.workspace_inpatient_location_events from public,anon,authenticated,service_role;

create function private.clair_read_workspace_inpatient_locations(p_workspace_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare locations jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not (private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
    or private.clair_current_user_has_workspace_permission(p_workspace_id,'hospital_settings:view')
    or private.clair_current_user_has_workspace_permission(p_workspace_id,'hospital_settings:manage')) then raise exception 'permission_missing' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'label',l.label,'kind',l.kind,'active',l.active,'rowRevision',l.row_revision) order by l.label,l.id),'[]'::jsonb)
    into locations from public.workspace_inpatient_locations l where l.workspace_id=p_workspace_id;
  return jsonb_build_object('workspaceId',p_workspace_id,'canManage',private.clair_current_user_has_workspace_permission(p_workspace_id,'hospital_settings:manage'),'locations',locations);
end $f$;
revoke all on function private.clair_read_workspace_inpatient_locations(text) from public,anon,service_role;
grant execute on function private.clair_read_workspace_inpatient_locations(text) to authenticated;
create function public.clair_get_workspace_inpatient_locations(p_workspace_id text) returns jsonb
language sql security invoker set search_path=pg_catalog,private as $f$ select private.clair_read_workspace_inpatient_locations(p_workspace_id) $f$;
revoke all on function public.clair_get_workspace_inpatient_locations(text) from public,anon,service_role;
grant execute on function public.clair_get_workspace_inpatient_locations(text) to authenticated;

create function private.clair_write_workspace_inpatient_location(p_workspace_id text,p_command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare location public.workspace_inpatient_locations; before_value jsonb; location_id uuid; expected integer;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'hospital_settings:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>4000
    or p_command-array['id','label','kind','active','expectedRevision']<>'{}'::jsonb
    or jsonb_typeof(p_command->'label') is distinct from 'string'
    or char_length(p_command->>'label') not between 1 and 80 or p_command->>'label'<>btrim(p_command->>'label')
    or coalesce(p_command->>'kind','') not in ('ward','cage') or jsonb_typeof(p_command->'active') is distinct from 'boolean'
    or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number'
    or coalesce(p_command->>'expectedRevision','') !~ '^[0-9]{1,9}$'
    or coalesce(p_command->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'inpatient_location_invalid'; end if;
  location_id:=(p_command->>'id')::uuid; expected:=(p_command->>'expectedRevision')::integer;
  perform pg_advisory_xact_lock(hashtextextended('inpatient-location:'||p_workspace_id,0));
  select * into location from public.workspace_inpatient_locations where workspace_id=p_workspace_id and id=location_id for update;
  if found then
    -- An exact retry is harmless; a stale changed command never overwrites a row.
    if location.row_revision=expected+1 and location.label=p_command->>'label' and location.kind=p_command->>'kind'
      and location.active=(p_command->>'active')::boolean then return private.clair_read_workspace_inpatient_locations(p_workspace_id); end if;
    if location.row_revision<>expected then raise exception 'inpatient_location_revision_conflict'; end if;
    before_value:=to_jsonb(location);
    update public.workspace_inpatient_locations set label=p_command->>'label',kind=p_command->>'kind',active=(p_command->>'active')::boolean,
      row_revision=row_revision+1,updated_by_user_id=auth.uid(),updated_at=clock_timestamp()
      where workspace_id=p_workspace_id and id=location_id returning * into location;
  else
    if expected<>0 then raise exception 'inpatient_location_revision_conflict'; end if;
    insert into public.workspace_inpatient_locations(id,workspace_id,label,kind,active,created_by_user_id,updated_by_user_id)
      values(location_id,p_workspace_id,p_command->>'label',p_command->>'kind',(p_command->>'active')::boolean,auth.uid(),auth.uid()) returning * into location;
  end if;
  insert into public.workspace_inpatient_location_events(workspace_id,location_id,actor_user_id,before_snapshot,after_snapshot)
    values(p_workspace_id,location_id,auth.uid(),before_value,to_jsonb(location));
  return private.clair_read_workspace_inpatient_locations(p_workspace_id);
exception when unique_violation then raise exception 'inpatient_location_name_conflict';
end $f$;
revoke all on function private.clair_write_workspace_inpatient_location(text,jsonb) from public,anon,service_role;
grant execute on function private.clair_write_workspace_inpatient_location(text,jsonb) to authenticated;
create function public.clair_save_workspace_inpatient_location(p_workspace_id text,p_command jsonb) returns jsonb
language sql security invoker set search_path=pg_catalog,private as $f$ select private.clair_write_workspace_inpatient_location(p_workspace_id,p_command) $f$;
revoke all on function public.clair_save_workspace_inpatient_location(text,jsonb) from public,anon,service_role;
grant execute on function public.clair_save_workspace_inpatient_location(text,jsonb) to authenticated;

create function private.clair_freeze_order_inpatient_location() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare location public.workspace_inpatient_locations; requested text; should_resolve boolean;
begin
  if new.clinical_order_type<>'hospitalization' or new.order_confirmation_status not in ('confirmed','billed') then return new; end if;
  should_resolve:=tg_op='INSERT';
  if tg_op='UPDATE' then
    should_resolve:=old.order_confirmation_status not in ('confirmed','billed')
      -- Existing atomic confirmation first marks status, then builds revision1.
      -- Match its established snapshot guard so both phases retain the same pin.
      or (old.revision_no=0 and new.revision_no=1 and new.order_confirmation_status=old.order_confirmation_status)
      or (new.confirmed_snapshot is distinct from old.confirmed_snapshot
        and coalesce(current_setting('clair.confirmed_snapshot_mutation_id',true),'') like 'revision:%');
    if not should_resolve then
      if new.detail_inputs->>'wardOrCage' is distinct from old.detail_inputs->>'wardOrCage'
        or new.confirmed_snapshot->'inpatientLocation' is distinct from old.confirmed_snapshot->'inpatientLocation'
        then raise exception 'confirmed_inpatient_location_immutable'; end if;
      return new;
    end if;
  end if;
  requested:=new.detail_inputs->>'wardOrCage';
  if coalesce(requested,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'inpatient_location_required'; end if;
  select * into location from public.workspace_inpatient_locations where workspace_id=new.workspace_id and id=requested::uuid and active for share;
  if not found then raise exception 'inpatient_location_unavailable'; end if;
  new.confirmed_snapshot:=coalesce(new.confirmed_snapshot,'{}'::jsonb)||jsonb_build_object('inpatientLocation',jsonb_build_object(
    'id',location.id,'label',location.label,'kind',location.kind,'rowRevision',location.row_revision));
  return new;
end $f$;
revoke all on function private.clair_freeze_order_inpatient_location() from public,anon,authenticated,service_role;
create trigger orders_aa_inpatient_location_guard before insert or update on public.orders for each row execute function private.clair_freeze_order_inpatient_location();

create function private.clair_guard_inpatient_location_event_history() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin raise exception 'inpatient_location_event_immutable' using errcode='55000'; end $f$;
revoke all on function private.clair_guard_inpatient_location_event_history() from public,anon,authenticated,service_role;
create trigger inpatient_location_event_history_immutable before update or delete on public.workspace_inpatient_location_events
  for each row execute function private.clair_guard_inpatient_location_event_history();
