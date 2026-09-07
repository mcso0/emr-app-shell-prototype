\set ON_ERROR_STOP on
begin;
insert into auth.users(id, email) values
 ('91000000-0000-4000-8000-000000000001','settings-one@example.test'),
 ('91000000-0000-4000-8000-000000000002','settings-two@example.test'),
 ('91000000-0000-4000-8000-000000000003','settings-inactive@example.test');
insert into public.users(id,display_name,status) values
 ('91000000-0000-4000-8000-000000000001','Synthetic settings one','active'),
 ('91000000-0000-4000-8000-000000000002','Synthetic settings two','active'),
 ('91000000-0000-4000-8000-000000000003','Synthetic inactive','active') on conflict (id) do nothing;
insert into public.workspaces(id,display_name) values ('settings-alpha','Synthetic Alpha'),('settings-beta','Synthetic Beta');
insert into public.user_memberships(workspace_id,user_id,roles,status) values
 ('settings-alpha','91000000-0000-4000-8000-000000000001',array['vet'],'active'),
 ('settings-beta','91000000-0000-4000-8000-000000000001',array['vet'],'active'),
 ('settings-alpha','91000000-0000-4000-8000-000000000002',array['vet'],'active'),
 ('settings-alpha','91000000-0000-4000-8000-000000000003',array['vet'],'inactive');
insert into public.workspace_notification_preferences(workspace_id,user_id) values ('settings-alpha','91000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
insert into public.workspace_notification_preferences(workspace_id,user_id,popup,sound) values
 ('settings-alpha','91000000-0000-4000-8000-000000000001',false,true),
 ('settings-beta','91000000-0000-4000-8000-000000000001',true,false);
do $$ begin
  if (select count(*) from public.workspace_notification_preferences) <> 2 then raise exception 'own rows not readable'; end if;
  if not (select popup and not sound from public.workspace_notification_preferences where workspace_id='settings-beta') then raise exception 'workspace isolation failed'; end if;
  begin
    insert into public.workspace_notification_preferences(workspace_id,user_id) values ('settings-alpha','91000000-0000-4000-8000-000000000002');
    raise exception 'foreign insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspace_notification_preferences set user_id='91000000-0000-4000-8000-000000000002' where workspace_id='settings-alpha';
    raise exception 'owner reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspace_notification_preferences set categories='{"order_recheck_requested":null}' where workspace_id='settings-alpha';
    raise exception 'invalid category allowed';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.workspace_notification_preferences) then raise exception 'foreign rows readable'; end if;
  update public.workspace_notification_preferences set popup=true;
  if found then raise exception 'foreign update allowed'; end if;
  begin
    insert into public.workspace_notification_preferences(workspace_id,user_id) values ('settings-beta','91000000-0000-4000-8000-000000000002');
    raise exception 'foreign workspace insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.workspace_notification_preferences where workspace_id='settings-alpha') then raise exception 'inactive member read allowed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.workspace_notification_preferences;
    raise exception 'anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: own read/write, foreign owner, foreign workspace, inactive, anonymous, strict categories' as verification;
