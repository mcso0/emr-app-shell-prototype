\set ON_ERROR_STOP on
begin;

insert into public.appointments (
  workspace_id, patient_id, scheduled_start_at, scheduled_end_at, status, created_by_user_id
)
select 'clair-demo', p.id, '2026-07-20 10:00:00+09', '2026-07-20 10:30:00+09', 'confirmed',
  '00000000-0000-4000-8000-000000000001'::uuid
from public.patients p
where p.workspace_id = 'clair-demo'
limit 1;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select public.clair_get_effective_operating_hours('clair-demo', '2026-07-15');
update public.workspace_operating_hours
set treatment_start = time '08:00'
where workspace_id = 'clair-demo' and day_of_week = 0;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  v_settings jsonb := public.clair_get_workspace_operating_hours('clair-demo');
begin
  v_settings := jsonb_set(v_settings, '{weeklyHours,0,isOpen}', 'false'::jsonb);
  v_settings := jsonb_set(v_settings, '{weeklyHours,0,treatmentStart}', 'null'::jsonb);
  v_settings := jsonb_set(v_settings, '{weeklyHours,0,treatmentEnd}', 'null'::jsonb);
  v_settings := jsonb_set(v_settings, '{weeklyHours,0,breakStart}', 'null'::jsonb);
  v_settings := jsonb_set(v_settings, '{weeklyHours,0,breakEnd}', 'null'::jsonb);
  begin
    perform public.clair_replace_workspace_operating_hours(
      'clair-demo', '00000000-0000-4000-8000-000000000001', v_settings
    );
    raise exception 'expected future_appointment_conflict';
  exception
    when others then
      if sqlerrm not like 'future_appointment_conflict:%' then raise; end if;
  end;
end;
$$;

select count(*) = 1 as monday_still_open
from public.workspace_operating_hours
where workspace_id = 'clair-demo' and day_of_week = 0 and is_open;

rollback;
