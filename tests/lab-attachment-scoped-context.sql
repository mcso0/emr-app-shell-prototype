\set ON_ERROR_STOP on
-- Run only in a disposable, empty local PostgreSQL database. This fixture
-- models RPC-only result tables; it is not a full Supabase schema replay.
begin;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.actor', true), '')::uuid;
$$;
create function private.clair_is_active_workspace_member(scope text) returns boolean language sql stable as $$
  select auth.uid() is not null and scope = current_setting('test.workspace', true);
$$;
create function private.clair_current_user_has_workspace_permission(scope text, permission text) returns boolean language sql stable as $$
  select private.clair_is_active_workspace_member(scope)
    and (permission = 'lab:view' or current_setting('test.editor', true) = 'yes');
$$;
create table public.lab_result_entries(id uuid primary key, workspace_id text, result_id text,
  result_status text, result_definition_origin text);
create table public.lab_result_entry_rows(lab_result_entry_id uuid, workspace_id text, row_id text,
  primary key(lab_result_entry_id, row_id));
create table public.lab_result_attachments(id uuid primary key, workspace_id text,
  lab_result_entry_id uuid references public.lab_result_entries, row_id text,
  uploaded_by_user_id uuid not null, file_name text not null check(length(file_name) between 1 and 200),
  mime_type text not null, byte_size integer not null check(byte_size between 1 and 20971520), storage_path text not null unique,
  foreign key(lab_result_entry_id, row_id) references public.lab_result_entry_rows,
  check(mime_type='application/pdf' or byte_size <= 5242880));
revoke all on public.lab_result_entries, public.lab_result_entry_rows, public.lab_result_attachments
  from public, anon, authenticated, service_role;
insert into public.lab_result_entries values('00000000-0000-4000-8000-000000000001','scope-a','result-a','entered','canonical'),
  ('00000000-0000-4000-8000-000000000002','scope-b','result-b','entered','canonical'),
  ('00000000-0000-4000-8000-000000000003','scope-a','result-closed','completed','canonical');
insert into public.lab_result_entry_rows values('00000000-0000-4000-8000-000000000001','scope-a','row-a'),
  ('00000000-0000-4000-8000-000000000002','scope-b','row-b'),
  ('00000000-0000-4000-8000-000000000003','scope-a','row-closed');
\ir ../supabase/migrations/20260929060000_lab_attachment_scoped_context.sql
set local test.actor = '00000000-0000-4000-8000-000000000099';
set local test.workspace = 'scope-a';
set local test.editor = 'yes';
set local role authenticated;
do $$ begin
  begin perform id from public.lab_result_entries; raise exception 'direct read unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  if public.clair_get_lab_result_attachment_context('scope-a','result-a','row-a')->>'row_id' <> 'row-a'
  then raise exception 'authorized RPC failed'; end if;
  if public.clair_get_lab_result_attachment_context('scope-a','result-a','row-b') is not null
  then raise exception 'foreign row allowed'; end if;
  if public.clair_get_lab_result_attachment_context('scope-a','result-b',null) is not null
  then raise exception 'foreign result allowed'; end if;
  begin perform public.clair_get_lab_result_attachment_context('scope-b','result-b',null);
    raise exception 'foreign workspace allowed';
  exception when insufficient_privilege then null; end;
  perform public.clair_prepare_lab_result_attachment('scope-a','result-a','row-a',
    '00000000-0000-4000-8000-000000000010','synthetic.png','image/png',179);
  begin perform public.clair_prepare_lab_result_attachment('scope-a','result-closed','row-closed',
    '00000000-0000-4000-8000-000000000011','synthetic.png','image/png',179);
    raise exception 'closed result allowed';
  exception when invalid_parameter_value then null; end;
  begin perform public.clair_prepare_lab_result_attachment('scope-a','result-a','row-b',
    '00000000-0000-4000-8000-000000000012','synthetic.png','image/png',179);
    raise exception 'foreign upload row allowed';
  exception when invalid_parameter_value then null; end;
end $$;
set local test.editor = 'no';
do $$ begin
  perform public.clair_get_lab_result_attachment_context('scope-a','result-a',null);
  begin perform public.clair_prepare_lab_result_attachment('scope-a','result-a','row-a',
    '00000000-0000-4000-8000-000000000013','synthetic.png','image/png',179);
    raise exception 'viewer upload allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local test.actor = '';
do $$ begin
  begin perform public.clair_get_lab_result_attachment_context('scope-a','result-a',null);
    raise exception 'anonymous context allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.lab_result_attachments) <> 1 then raise exception 'unexpected metadata residue'; end if;
  if not exists(select 1 from public.lab_result_attachments
    where uploaded_by_user_id='00000000-0000-4000-8000-000000000099'
      and storage_path='scope-a/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000010.png')
  then raise exception 'owner or path mismatch'; end if;
  if has_function_privilege('anon','public.clair_get_lab_result_attachment_context(text,text,text)','execute')
    or has_table_privilege('authenticated','public.lab_result_entries','select')
  then raise exception 'privilege widened'; end if;
end $$;
rollback;
