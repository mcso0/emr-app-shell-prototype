-- HOSPITAL-ADMIN-LIVE-PR-020: workspace-scoped space categories and spaces.
-- Categories and spaces are archived instead of hard-deleted.

create table public.workspace_space_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  icon_key text not null default 'default'
    check (icon_key in ('consult', 'treatment', 'exam', 'surgery', 'default')),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create unique index workspace_space_categories_active_name_uidx
  on public.workspace_space_categories (workspace_id, lower(name))
  where archived_at is null;

create index workspace_space_categories_active_order_idx
  on public.workspace_space_categories (workspace_id, sort_order, id)
  where archived_at is null;

create table public.workspace_spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  sort_order integer not null check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_spaces_category_workspace_fk
    foreign key (category_id, workspace_id)
    references public.workspace_space_categories(id, workspace_id)
    on delete restrict
);

create unique index workspace_spaces_active_name_uidx
  on public.workspace_spaces (workspace_id, category_id, lower(name))
  where archived_at is null;

create index workspace_spaces_active_category_order_idx
  on public.workspace_spaces (workspace_id, category_id, sort_order, id)
  where archived_at is null;

with category_seed(name, icon_key, sort_order) as (
  values
    ('진료 공간', 'consult', 0),
    ('처치 공간', 'treatment', 1),
    ('검사 공간', 'exam', 2),
    ('수술 공간', 'surgery', 3)
)
insert into public.workspace_space_categories (
  workspace_id,
  name,
  icon_key,
  sort_order
)
select
  workspace.id,
  category_seed.name,
  category_seed.icon_key,
  category_seed.sort_order
from public.workspaces workspace
cross join category_seed
where not exists (
  select 1
  from public.workspace_space_categories category
  where category.workspace_id = workspace.id
    and lower(category.name) = lower(category_seed.name)
    and category.archived_at is null
)
on conflict do nothing;

with space_seed(category_name, space_name, sort_order) as (
  values
    ('진료 공간', '진료실 1', 0),
    ('진료 공간', '진료실 2', 1),
    ('처치 공간', '처치실 1', 0),
    ('검사 공간', '검사실 1', 0),
    ('검사 공간', '영상 검사실', 1),
    ('수술 공간', '수술실 1', 0)
)
insert into public.workspace_spaces (
  workspace_id,
  category_id,
  name,
  sort_order
)
select
  category.workspace_id,
  category.id,
  space_seed.space_name,
  space_seed.sort_order
from public.workspace_space_categories category
join space_seed on lower(space_seed.category_name) = lower(category.name)
where category.archived_at is null
  and not exists (
    select 1
    from public.workspace_spaces space
    where space.workspace_id = category.workspace_id
      and space.category_id = category.id
      and lower(space.name) = lower(space_seed.space_name)
      and space.archived_at is null
  )
on conflict do nothing;

alter table public.workspace_space_categories enable row level security;
alter table public.workspace_spaces enable row level security;

create policy workspace_space_categories_member_select
on public.workspace_space_categories for select to authenticated
using (
  archived_at is null
  and private.clair_is_active_workspace_member(workspace_id)
);

create policy workspace_spaces_member_select
on public.workspace_spaces for select to authenticated
using (
  archived_at is null
  and private.clair_is_active_workspace_member(workspace_id)
);

revoke all privileges on table public.workspace_space_categories from public, anon, authenticated;
revoke all privileges on table public.workspace_spaces from public, anon, authenticated;
grant select on table public.workspace_space_categories to authenticated;
grant select on table public.workspace_spaces to authenticated;

create or replace function public.clair_get_workspace_space_management(
  p_workspace_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  return jsonb_build_object(
    'workspaceId', p_workspace_id,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'iconKey', category.icon_key,
          'sortOrder', category.sort_order,
          'spaces', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', space.id,
                'categoryId', space.category_id,
                'name', space.name,
                'sortOrder', space.sort_order
              )
              order by space.sort_order, space.name, space.id
            )
            from public.workspace_spaces space
            where space.workspace_id = p_workspace_id
              and space.category_id = category.id
              and space.archived_at is null
          ), '[]'::jsonb)
        )
        order by category.sort_order, category.name, category.id
      )
      from public.workspace_space_categories category
      where category.workspace_id = p_workspace_id
        and category.archived_at is null
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
  'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
  'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
  'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
  'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
  'workspace.permission_role_created','workspace.permission_role_updated',
  'workspace.job_position_deactivated','workspace.job_position_reactivated',
  'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
  'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
  'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
  'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
  'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
  'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
  'order.billing_candidate_requested','order.status_changed','order_catalog.created',
  'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
  'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
  'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
  'hospital.schedule_revision_mutated','hospital.vital_settings_updated',
  'hospital.space_category_created','hospital.space_category_renamed',
  'hospital.space_category_archived','hospital.space_created',
  'hospital.space_updated','hospital.space_archived'
));

create or replace function public.clair_mutate_workspace_space_management(
  p_workspace_id text,
  p_actor_user_id text,
  p_command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_membership_id uuid;
  v_action text := p_command->>'action';
  v_name text := regexp_replace(btrim(coalesce(p_command->>'name', '')), '\s+', ' ', 'g');
  v_category_id uuid;
  v_space_id uuid;
  v_move_target_category_id uuid;
  v_category public.workspace_space_categories%rowtype;
  v_space public.workspace_spaces%rowtype;
  v_entity_id uuid;
  v_space_count integer;
  v_next_sort_order integer;
  v_now timestamptz := now();
  v_before jsonb;
  v_after jsonb;
  v_event_type text;
  v_entity_type text;
begin
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'hospital_settings:manage') then
    raise exception 'permission_missing';
  end if;
  if p_command is null or jsonb_typeof(p_command) <> 'object' or v_action is null then
    raise exception 'invalid_input';
  end if;

  select membership.id
  into v_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor_user_id
    and membership.status = 'active';

  if v_action = 'category.create' then
    if char_length(v_name) not between 1 and 50 then
      raise exception 'invalid_input';
    end if;
    if exists (
      select 1 from public.workspace_space_categories category
      where category.workspace_id = p_workspace_id
        and lower(category.name) = lower(v_name)
        and category.archived_at is null
    ) then
      raise exception 'duplicate_category_name';
    end if;

    select coalesce(max(category.sort_order), -1) + 1
    into v_next_sort_order
    from public.workspace_space_categories category
    where category.workspace_id = p_workspace_id
      and category.archived_at is null;

    insert into public.workspace_space_categories (
      workspace_id, name, icon_key, sort_order
    ) values (
      p_workspace_id, v_name, 'default', v_next_sort_order
    )
    returning id into v_entity_id;

    v_event_type := 'hospital.space_category_created';
    v_entity_type := 'workspace_space_category';
    v_after := jsonb_build_object('id', v_entity_id, 'name', v_name);

  elsif v_action = 'category.rename' then
    begin
      v_category_id := nullif(p_command->>'categoryId', '')::uuid;
    exception
      when invalid_text_representation then raise exception 'invalid_input';
    end;
    if v_category_id is null or char_length(v_name) not between 1 and 50 then
      raise exception 'invalid_input';
    end if;

    select * into v_category
    from public.workspace_space_categories category
    where category.id = v_category_id
      and category.workspace_id = p_workspace_id
      and category.archived_at is null
    for update;
    if not found then raise exception 'category_not_found'; end if;

    if exists (
      select 1 from public.workspace_space_categories category
      where category.workspace_id = p_workspace_id
        and category.id <> v_category_id
        and lower(category.name) = lower(v_name)
        and category.archived_at is null
    ) then
      raise exception 'duplicate_category_name';
    end if;

    v_before := jsonb_build_object('id', v_category.id, 'name', v_category.name);
    update public.workspace_space_categories
    set name = v_name, updated_at = v_now
    where id = v_category_id and workspace_id = p_workspace_id;

    v_entity_id := v_category_id;
    v_event_type := 'hospital.space_category_renamed';
    v_entity_type := 'workspace_space_category';
    v_after := jsonb_build_object('id', v_category_id, 'name', v_name);

  elsif v_action = 'category.delete' then
    begin
      v_category_id := nullif(p_command->>'categoryId', '')::uuid;
      v_move_target_category_id := nullif(p_command->>'moveTargetCategoryId', '')::uuid;
    exception
      when invalid_text_representation then raise exception 'invalid_input';
    end;
    if v_category_id is null then raise exception 'invalid_input'; end if;

    select * into v_category
    from public.workspace_space_categories category
    where category.id = v_category_id
      and category.workspace_id = p_workspace_id
      and category.archived_at is null
    for update;
    if not found then raise exception 'category_not_found'; end if;

    select count(*) into v_space_count
    from public.workspace_spaces space
    where space.workspace_id = p_workspace_id
      and space.category_id = v_category_id
      and space.archived_at is null;

    if v_space_count > 0 and v_move_target_category_id is null then
      raise exception 'category_move_target_required';
    end if;

    if v_move_target_category_id is not null then
      if v_move_target_category_id = v_category_id then
        raise exception 'invalid_move_target';
      end if;
      perform 1
      from public.workspace_space_categories category
      where category.id = v_move_target_category_id
        and category.workspace_id = p_workspace_id
        and category.archived_at is null
      for update;
      if not found then raise exception 'invalid_move_target'; end if;

      if exists (
        select 1
        from public.workspace_spaces moving
        join public.workspace_spaces target
          on target.workspace_id = moving.workspace_id
          and target.category_id = v_move_target_category_id
          and lower(target.name) = lower(moving.name)
          and target.archived_at is null
        where moving.workspace_id = p_workspace_id
          and moving.category_id = v_category_id
          and moving.archived_at is null
      ) then
        raise exception 'duplicate_space_name';
      end if;

      select coalesce(max(space.sort_order), -1) + 1
      into v_next_sort_order
      from public.workspace_spaces space
      where space.workspace_id = p_workspace_id
        and space.category_id = v_move_target_category_id
        and space.archived_at is null;

      with moving as (
        select
          space.id,
          row_number() over (order by space.sort_order, space.name, space.id) - 1 as offset
        from public.workspace_spaces space
        where space.workspace_id = p_workspace_id
          and space.category_id = v_category_id
          and space.archived_at is null
      )
      update public.workspace_spaces space
      set category_id = v_move_target_category_id,
        sort_order = v_next_sort_order + moving.offset,
        updated_at = v_now
      from moving
      where space.id = moving.id;
    end if;

    v_before := jsonb_build_object(
      'id', v_category.id,
      'name', v_category.name,
      'spaceCount', v_space_count
    );
    update public.workspace_space_categories
    set archived_at = v_now, updated_at = v_now
    where id = v_category_id and workspace_id = p_workspace_id;

    v_entity_id := v_category_id;
    v_event_type := 'hospital.space_category_archived';
    v_entity_type := 'workspace_space_category';
    v_after := jsonb_build_object(
      'archivedAt', v_now,
      'moveTargetCategoryId', v_move_target_category_id
    );

  elsif v_action = 'space.create' then
    begin
      v_category_id := nullif(p_command->>'categoryId', '')::uuid;
    exception
      when invalid_text_representation then raise exception 'invalid_input';
    end;
    if v_category_id is null or char_length(v_name) not between 1 and 50 then
      raise exception 'invalid_input';
    end if;
    if not exists (
      select 1 from public.workspace_space_categories category
      where category.id = v_category_id
        and category.workspace_id = p_workspace_id
        and category.archived_at is null
    ) then
      raise exception 'category_not_found';
    end if;
    if exists (
      select 1 from public.workspace_spaces space
      where space.workspace_id = p_workspace_id
        and space.category_id = v_category_id
        and lower(space.name) = lower(v_name)
        and space.archived_at is null
    ) then
      raise exception 'duplicate_space_name';
    end if;

    select coalesce(max(space.sort_order), -1) + 1
    into v_next_sort_order
    from public.workspace_spaces space
    where space.workspace_id = p_workspace_id
      and space.category_id = v_category_id
      and space.archived_at is null;

    insert into public.workspace_spaces (
      workspace_id, category_id, name, sort_order
    ) values (
      p_workspace_id, v_category_id, v_name, v_next_sort_order
    )
    returning id into v_entity_id;

    v_event_type := 'hospital.space_created';
    v_entity_type := 'workspace_space';
    v_after := jsonb_build_object(
      'id', v_entity_id,
      'categoryId', v_category_id,
      'name', v_name
    );

  elsif v_action = 'space.update' then
    begin
      v_space_id := nullif(p_command->>'spaceId', '')::uuid;
      v_category_id := nullif(p_command->>'categoryId', '')::uuid;
    exception
      when invalid_text_representation then raise exception 'invalid_input';
    end;
    if v_space_id is null or v_category_id is null or char_length(v_name) not between 1 and 50 then
      raise exception 'invalid_input';
    end if;

    select * into v_space
    from public.workspace_spaces space
    where space.id = v_space_id
      and space.workspace_id = p_workspace_id
      and space.archived_at is null
    for update;
    if not found then raise exception 'space_not_found'; end if;
    if not exists (
      select 1 from public.workspace_space_categories category
      where category.id = v_category_id
        and category.workspace_id = p_workspace_id
        and category.archived_at is null
    ) then
      raise exception 'category_not_found';
    end if;
    if exists (
      select 1 from public.workspace_spaces space
      where space.workspace_id = p_workspace_id
        and space.category_id = v_category_id
        and space.id <> v_space_id
        and lower(space.name) = lower(v_name)
        and space.archived_at is null
    ) then
      raise exception 'duplicate_space_name';
    end if;

    v_next_sort_order := v_space.sort_order;
    if v_category_id <> v_space.category_id then
      select coalesce(max(space.sort_order), -1) + 1
      into v_next_sort_order
      from public.workspace_spaces space
      where space.workspace_id = p_workspace_id
        and space.category_id = v_category_id
        and space.archived_at is null;
    end if;

    v_before := jsonb_build_object(
      'id', v_space.id,
      'categoryId', v_space.category_id,
      'name', v_space.name
    );
    update public.workspace_spaces
    set category_id = v_category_id,
      name = v_name,
      sort_order = v_next_sort_order,
      updated_at = v_now
    where id = v_space_id and workspace_id = p_workspace_id;

    v_entity_id := v_space_id;
    v_event_type := 'hospital.space_updated';
    v_entity_type := 'workspace_space';
    v_after := jsonb_build_object(
      'id', v_space_id,
      'categoryId', v_category_id,
      'name', v_name
    );

  elsif v_action = 'space.delete' then
    begin
      v_space_id := nullif(p_command->>'spaceId', '')::uuid;
    exception
      when invalid_text_representation then raise exception 'invalid_input';
    end;
    if v_space_id is null then raise exception 'invalid_input'; end if;

    select * into v_space
    from public.workspace_spaces space
    where space.id = v_space_id
      and space.workspace_id = p_workspace_id
      and space.archived_at is null
    for update;
    if not found then raise exception 'space_not_found'; end if;

    v_before := jsonb_build_object(
      'id', v_space.id,
      'categoryId', v_space.category_id,
      'name', v_space.name
    );
    update public.workspace_spaces
    set archived_at = v_now, updated_at = v_now
    where id = v_space_id and workspace_id = p_workspace_id;

    v_entity_id := v_space_id;
    v_event_type := 'hospital.space_archived';
    v_entity_type := 'workspace_space';
    v_after := jsonb_build_object('archivedAt', v_now);

  else
    raise exception 'invalid_input';
  end if;

  perform public.clair_append_audit_event(
    'space-management-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor_user_id,
    v_membership_id,
    v_event_type,
    v_entity_type,
    v_entity_id::text,
    p_before_snapshot => v_before,
    p_after_snapshot => v_after
  );

  return public.clair_get_workspace_space_management(p_workspace_id);
end;
$$;

revoke all on function public.clair_get_workspace_space_management(text)
  from public, anon;
revoke all on function public.clair_mutate_workspace_space_management(text, text, jsonb)
  from public, anon;
grant execute on function public.clair_get_workspace_space_management(text)
  to authenticated;
grant execute on function public.clair_mutate_workspace_space_management(text, text, jsonb)
  to authenticated;
