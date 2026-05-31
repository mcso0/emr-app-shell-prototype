-- DEN-307: bridge client/demo chart encounter IDs to persisted encounter UUIDs.
-- The chart UI can carry demo IDs such as encounter-kong-260501, while live
-- chart/order RPCs use public.encounters.id UUIDs for FK and RLS boundaries.

create or replace function private.clair_safe_uuid(p_value text)
returns uuid
language sql
immutable
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then p_value::uuid
    else null
  end
$$;

create or replace function private.clair_demo_encounter_no(p_encounter_id text)
returns text
language sql
immutable
as $$
  select case p_encounter_id
    when 'encounter-coco-260501' then 'E-260501-0001'
    when 'encounter-dubu-260501' then 'E-260501-0002'
    when 'encounter-kong-260501' then 'E-260501-0003'
    else null
  end
$$;

create or replace function public.clair_resolve_encounter_id(
  p_workspace_id text,
  p_encounter_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_safe_uuid uuid := private.clair_safe_uuid(p_encounter_id);
  v_demo_encounter_no text := private.clair_demo_encounter_no(p_encounter_id);
  v_encounter_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select e.id
    into v_encounter_id
  from public.encounters e
  where e.workspace_id = p_workspace_id
    and e.status <> 'cancelled'
    and (
      (v_safe_uuid is not null and e.id = v_safe_uuid)
      or (v_demo_encounter_no is not null and e.encounter_no = v_demo_encounter_no)
      or e.encounter_no = p_encounter_id
    )
  order by
    case
      when v_safe_uuid is not null and e.id = v_safe_uuid then 0
      when v_demo_encounter_no is not null and e.encounter_no = v_demo_encounter_no then 1
      else 2
    end
  limit 1;

  if v_encounter_id is null then
    raise exception 'encounter_unavailable';
  end if;

  return v_encounter_id;
end;
$$;

revoke all on function public.clair_resolve_encounter_id(text, text) from public;
grant execute on function public.clair_resolve_encounter_id(text, text) to authenticated;

comment on function public.clair_resolve_encounter_id(text, text) is
  'DEN-307 bridge for resolving demo/client chart encounter IDs to workspace-scoped encounter UUIDs before chart draft/action RPCs.';
