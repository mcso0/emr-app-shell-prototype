create or replace function public.clair_save_personal_profile(
  p_display_name text,
  p_initials text,
  p_phone text default null,
  p_notification_opt_in boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_initials text := upper(trim(coalesce(p_initials, '')));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_actor_user_id is null then
    raise exception 'unauthenticated';
  end if;

  if v_display_name = '' then
    raise exception 'invalid_profile_display_name';
  end if;

  if length(v_initials) < 1 or length(v_initials) > 3 then
    raise exception 'invalid_profile_initials';
  end if;

  update public.users
  set display_name = v_display_name,
      initial = v_initials,
      phone = v_phone,
      updated_at = v_now
  where id = v_actor_user_id;

  if not found then
    raise exception 'user_profile_missing';
  end if;

  insert into public.user_profiles (
    user_id,
    notification_preferences,
    updated_at
  )
  values (
    v_actor_user_id,
    jsonb_build_object('notificationOptIn', p_notification_opt_in),
    v_now
  )
  on conflict (user_id) do update
  set notification_preferences = jsonb_build_object('notificationOptIn', p_notification_opt_in),
      updated_at = v_now;

  return jsonb_build_object(
    'sessionId', v_actor_user_id::text,
    'displayName', v_display_name,
    'initials', v_initials,
    'phone', v_phone,
    'notificationOptIn', p_notification_opt_in,
    'updatedAt', v_now
  );
end;
$$;

revoke all on function public.clair_save_personal_profile(text, text, text, boolean) from public, anon;
grant execute on function public.clair_save_personal_profile(text, text, text, boolean) to authenticated;
