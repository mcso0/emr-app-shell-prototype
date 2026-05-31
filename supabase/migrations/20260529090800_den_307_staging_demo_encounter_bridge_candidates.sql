-- DEN-307 follow-up: support the current staging synthetic encounter spine.
-- Staging already contains synthetic QA encounters with E-DEN194-* numbers.
-- Keep legacy mock encounter_no candidates first for local/demo compatibility,
-- then allow the known staging synthetic candidates used for Order Platform QA.

create or replace function private.clair_demo_encounter_no_candidates(p_encounter_id text)
returns text[]
language sql
immutable
as $$
  select case p_encounter_id
    when 'encounter-coco-260501' then array['E-260501-0001', 'E-DEN194-0005']
    when 'encounter-dubu-260501' then array['E-260501-0002', 'E-DEN194-0003']
    when 'encounter-kong-260501' then array['E-260501-0003', 'E-DEN194-0001']
    else array[]::text[]
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
  v_demo_encounter_nos text[] := private.clair_demo_encounter_no_candidates(p_encounter_id);
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
      or e.encounter_no = any(v_demo_encounter_nos)
      or e.encounter_no = p_encounter_id
    )
  order by
    case
      when v_safe_uuid is not null and e.id = v_safe_uuid then 0
      when array_position(v_demo_encounter_nos, e.encounter_no) is not null
        then array_position(v_demo_encounter_nos, e.encounter_no)
      else 100
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
  'DEN-307 bridge for resolving demo/client chart encounter IDs to workspace-scoped encounter UUIDs, including current staging synthetic QA encounter numbers.';
