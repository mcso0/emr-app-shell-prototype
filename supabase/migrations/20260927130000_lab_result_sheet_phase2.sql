-- LAB-PR-003: result findings, immutable change history and private row attachments.
-- Local candidate only. No remote migration is applied by this file.
set lock_timeout = '5s';
set statement_timeout = '120s';

create table public.lab_result_overall_findings (
  workspace_id text not null,
  lab_result_entry_id uuid not null,
  finding text not null default '' check (length(finding) <= 10000),
  revision integer not null default 0 check (revision >= 0),
  updated_by_user_id uuid references public.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, lab_result_entry_id),
  foreign key (workspace_id, lab_result_entry_id)
    references public.lab_result_entries(workspace_id, id) on delete restrict
);
alter table public.lab_result_overall_findings enable row level security;
revoke all on public.lab_result_overall_findings from public, anon, authenticated;

create table public.lab_result_revision_events (
  id bigint generated always as identity primary key,
  workspace_id text not null,
  lab_result_entry_id uuid not null,
  event_kind text not null check (event_kind in ('row_changed', 'overall_changed', 'retest_requested', 'attachment_uploaded', 'attachment_deleted')),
  row_id text,
  actor_user_id uuid references public.users(id) on delete restrict,
  actor_name text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, lab_result_entry_id)
    references public.lab_result_entries(workspace_id, id) on delete restrict
);
create index lab_result_revision_events_entry_idx
  on public.lab_result_revision_events(workspace_id, lab_result_entry_id, id desc);
alter table public.lab_result_revision_events enable row level security;
revoke all on public.lab_result_revision_events from public, anon, authenticated;

create function private.clair_log_lab_result_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.result_value is distinct from new.result_value
    or old.note is distinct from new.note
    or old.result_presence is distinct from new.result_presence
    or old.result_qualifier is distinct from new.result_qualifier
    or old.device_flag is distinct from new.device_flag then
    insert into public.lab_result_revision_events
      (workspace_id, lab_result_entry_id, event_kind, row_id, actor_user_id, actor_name, before_snapshot, after_snapshot)
    values (new.workspace_id, new.lab_result_entry_id, 'row_changed', new.row_id, (select auth.uid()),
      (select display_name from public.users where id = (select auth.uid())),
      jsonb_build_object('name', old.analyte_name, 'value', old.result_value, 'finding', old.note, 'presence', old.result_presence,
        'qualifier', old.result_qualifier, 'deviceFlag', old.device_flag),
      jsonb_build_object('name', new.analyte_name, 'value', new.result_value, 'finding', new.note, 'presence', new.result_presence,
        'qualifier', new.result_qualifier, 'deviceFlag', new.device_flag));
  end if;
  return new;
end;
$$;
create trigger log_lab_result_row_change after update on public.lab_result_entry_rows
  for each row execute function private.clair_log_lab_result_row_change();

create function private.clair_log_lab_retest_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb; v_overall text; v_order jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('rowId', r.row_id, 'name', r.analyte_name,
    'value', r.result_value, 'finding', r.note, 'unit', r.result_unit, 'judgment', r.judgment)
    order by r.sort_order, r.row_id), '[]'::jsonb) into v_rows
  from public.lab_result_entry_rows r
  where r.workspace_id = new.workspace_id and r.lab_result_entry_id = new.prior_result_entry_id;
  select finding into v_overall from public.lab_result_overall_findings
  where workspace_id = new.workspace_id and lab_result_entry_id = new.prior_result_entry_id;
  select jsonb_build_object('id', o.id, 'displayName', o.display_name,
    'requestedAt', o.requested_at, 'status', o.status) into v_order
  from public.orders o where o.workspace_id = new.workspace_id and o.id = new.prior_order_id;
  insert into public.lab_result_revision_events
    (workspace_id, lab_result_entry_id, event_kind, row_id, actor_user_id, actor_name, before_snapshot, after_snapshot)
  values (new.workspace_id, new.prior_result_entry_id, 'retest_requested', new.prior_result_row_id,
    new.actor_user_id, (select display_name from public.users where id = new.actor_user_id), null,
    jsonb_build_object('priorOrder', v_order, 'priorOrderId', new.prior_order_id, 'newOrderId', new.new_order_id,
      'entryWriteRevision', new.prior_entry_write_revision, 'rows', v_rows,
      'overallFinding', coalesce(v_overall, ''), 'reason', new.reason));
  return new;
end;
$$;
create trigger log_lab_retest_snapshot after insert on public.lab_atomic_retest_requests
  for each row execute function private.clair_log_lab_retest_snapshot();

create function public.clair_get_lab_result_phase2(p_workspace_id text, p_result_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entry public.lab_result_entries; v_overall public.lab_result_overall_findings;
  v_events jsonb; v_attachments jsonb;
begin
  if (select auth.uid()) is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'lab:view')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  select * into v_entry from public.lab_result_entries
  where workspace_id = p_workspace_id and result_id = p_result_id and result_definition_origin = 'canonical';
  if not found then raise exception 'lab_result_not_found' using errcode = '22023'; end if;
  select * into v_overall from public.lab_result_overall_findings
  where workspace_id = p_workspace_id and lab_result_entry_id = v_entry.id;
  -- Follow the retest order chain so the new result can show the frozen prior
  -- order/result snapshot before another retest is requested.
  with recursive lineage as (
    select r.prior_result_entry_id, r.prior_order_id, r.new_order_id, 1 as depth
    from public.lab_atomic_retest_requests r
    where r.workspace_id = p_workspace_id and r.new_order_id = v_entry.order_id
    union all
    select r.prior_result_entry_id, r.prior_order_id, r.new_order_id, l.depth + 1
    from public.lab_atomic_retest_requests r
    join lineage l on r.workspace_id = p_workspace_id and r.new_order_id = l.prior_order_id
    where l.depth < 20
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', e.event_kind, 'rowId', e.row_id,
    'resultId', event_entry.result_id,
    'actorUserId', e.actor_user_id, 'actorName', e.actor_name,
    'before', e.before_snapshot, 'after', e.after_snapshot,
    'createdAt', e.created_at) order by e.id desc), '[]'::jsonb) into v_events
  from public.lab_result_revision_events e
  join public.lab_result_entries event_entry on event_entry.workspace_id = e.workspace_id and event_entry.id = e.lab_result_entry_id
  where e.workspace_id = p_workspace_id and (
    (e.lab_result_entry_id = v_entry.id and e.event_kind in ('row_changed', 'overall_changed', 'retest_requested'))
    or (e.event_kind = 'retest_requested' and exists (
      select 1 from lineage l where l.prior_result_entry_id = e.lab_result_entry_id
        and e.after_snapshot->>'newOrderId' = l.new_order_id::text)));
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'rowId', a.row_id,
    'name', a.file_name, 'mimeType', a.mime_type, 'size', a.byte_size,
    'uploadedAt', a.ready_at, 'uploadedByUserId', a.uploaded_by_user_id,
    'uploadedByName', (select display_name from public.users where id = a.uploaded_by_user_id))
    order by a.ready_at, a.id), '[]'::jsonb) into v_attachments
  from public.lab_result_attachments a
  where a.workspace_id = p_workspace_id and a.lab_result_entry_id = v_entry.id
    and a.ready_at is not null and a.deleted_at is null;
  return jsonb_build_object('resultId', v_entry.result_id, 'orderId', v_entry.order_id,
    'editable', v_entry.result_status in ('received', 'entered'),
    'overallFinding', coalesce(v_overall.finding, ''), 'overallRevision', coalesce(v_overall.revision, 0),
    'events', v_events, 'attachments', v_attachments);
end;
$$;

create function public.clair_save_lab_result_overall_finding(
  p_workspace_id text, p_result_id text, p_expected_revision integer, p_finding text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_entry public.lab_result_entries; v_old public.lab_result_overall_findings; v_next integer;
begin
  if (select auth.uid()) is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'lab:complete')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_finding is null
    or length(p_finding) > 10000 then raise exception 'invalid_finding' using errcode = '22023'; end if;
  select * into v_entry from public.lab_result_entries
  where workspace_id = p_workspace_id and result_id = p_result_id
    and result_definition_origin = 'canonical' for update;
  if not found or v_entry.result_status not in ('received', 'entered')
  then raise exception 'lab_result_read_only' using errcode = '22023'; end if;
  select * into v_old from public.lab_result_overall_findings
  where workspace_id = p_workspace_id and lab_result_entry_id = v_entry.id for update;
  if coalesce(v_old.revision, 0) <> p_expected_revision
  then raise exception 'finding_revision_conflict' using errcode = '40001'; end if;
  if coalesce(v_old.finding, '') = p_finding
  then return jsonb_build_object('revision', p_expected_revision, 'finding', p_finding); end if;
  v_next := p_expected_revision + 1;
  insert into public.lab_result_overall_findings
    (workspace_id, lab_result_entry_id, finding, revision, updated_by_user_id, updated_at)
  values (p_workspace_id, v_entry.id, p_finding, v_next, (select auth.uid()), now())
  on conflict (workspace_id, lab_result_entry_id) do update set
    finding = excluded.finding, revision = excluded.revision,
    updated_by_user_id = excluded.updated_by_user_id, updated_at = excluded.updated_at;
  insert into public.lab_result_revision_events
    (workspace_id, lab_result_entry_id, event_kind, actor_user_id, actor_name, before_snapshot, after_snapshot)
  values (p_workspace_id, v_entry.id, 'overall_changed', (select auth.uid()),
    (select display_name from public.users where id = (select auth.uid())),
    jsonb_build_object('finding', coalesce(v_old.finding, ''), 'revision', p_expected_revision),
    jsonb_build_object('finding', p_finding, 'revision', v_next));
  return jsonb_build_object('revision', v_next, 'finding', p_finding);
end;
$$;

revoke all on function public.clair_get_lab_result_phase2(text,text) from public, anon, service_role;
grant execute on function public.clair_get_lab_result_phase2(text,text) to authenticated;
revoke all on function public.clair_save_lab_result_overall_finding(text,text,integer,text) from public, anon, service_role;
grant execute on function public.clair_save_lab_result_overall_finding(text,text,integer,text) to authenticated;

create table public.lab_result_attachments (
  id uuid primary key,
  workspace_id text not null,
  lab_result_entry_id uuid not null,
  row_id text not null,
  uploaded_by_user_id uuid not null references public.users(id) on delete restrict,
  deleted_by_user_id uuid references public.users(id) on delete restrict,
  file_name text not null check (length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv', 'text/plain')),
  byte_size integer not null check (byte_size between 1 and 20971520),
  storage_path text not null unique,
  ready_at timestamptz,
  abandoned_at timestamptz,
  deleted_at timestamptz,
  storage_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, lab_result_entry_id)
    references public.lab_result_entries(workspace_id, id) on delete restrict,
  foreign key (lab_result_entry_id, row_id)
    references public.lab_result_entry_rows(lab_result_entry_id, row_id) on delete restrict,
  constraint lab_result_attachment_size check (mime_type = 'application/pdf' or byte_size <= 5242880),
  constraint lab_result_attachment_terminal check (deleted_at is null or ready_at is not null),
  constraint lab_result_attachment_abandoned check (abandoned_at is null or (ready_at is null and deleted_at is null)),
  constraint lab_result_attachment_path check
    (storage_path = workspace_id || '/' || lab_result_entry_id::text || '/' || id::text || '.' ||
      case mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
        when 'image/webp' then 'webp' when 'application/pdf' then 'pdf'
        when 'text/csv' then 'csv' when 'text/plain' then 'txt' end)
);
create index lab_result_attachments_active_idx on public.lab_result_attachments
  (workspace_id, lab_result_entry_id, row_id, ready_at) where deleted_at is null;
alter table public.lab_result_attachments enable row level security;
grant select, insert on public.lab_result_attachments to authenticated;
create policy lab_result_attachments_select on public.lab_result_attachments
  for select to authenticated using (
    private.clair_is_active_workspace_member(workspace_id) and deleted_at is null
    and ((ready_at is not null and private.clair_current_user_has_workspace_permission(workspace_id, 'lab:view'))
      or (ready_at is null and abandoned_at is null and uploaded_by_user_id = (select auth.uid())
        and private.clair_current_user_has_workspace_permission(workspace_id, 'lab:complete')))
  );
create policy lab_result_attachments_insert on public.lab_result_attachments
  for insert to authenticated with check (
    uploaded_by_user_id = (select auth.uid()) and ready_at is null and abandoned_at is null and deleted_at is null
    and private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'lab:complete')
    and exists (select 1 from public.lab_result_entries e
      where e.workspace_id = lab_result_attachments.workspace_id
        and e.id = lab_result_attachments.lab_result_entry_id
        and e.result_definition_origin = 'canonical' and e.result_status in ('received', 'entered'))
  );

create function private.clair_guard_lab_result_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id
    or new.lab_result_entry_id is distinct from old.lab_result_entry_id
    or new.row_id is distinct from old.row_id
    or new.uploaded_by_user_id is distinct from old.uploaded_by_user_id
    or new.file_name is distinct from old.file_name or new.mime_type is distinct from old.mime_type
    or new.byte_size is distinct from old.byte_size or new.storage_path is distinct from old.storage_path
    or new.created_at is distinct from old.created_at
    or (old.ready_at is null and new.ready_at is null
      and not (old.abandoned_at is null and new.abandoned_at is not null))
    or (old.ready_at is not null and new.ready_at is distinct from old.ready_at)
    or (old.abandoned_at is not null and new.abandoned_at is distinct from old.abandoned_at)
    or (new.ready_at is not null and new.abandoned_at is not null)
    or (old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at)
    or (old.deleted_at is not null and new.deleted_by_user_id is distinct from old.deleted_by_user_id)
    or (new.deleted_at is not null and (old.ready_at is null or new.deleted_by_user_id is null))
    or (new.deleted_at is null and new.deleted_by_user_id is not null)
    or (new.storage_deleted_at is not null and (new.deleted_at is null or old.storage_deleted_at is not null))
  then raise exception 'attachment_immutable' using errcode = '42501'; end if;
  return new;
end;
$$;
create trigger guard_lab_result_attachment before update on public.lab_result_attachments
  for each row execute function private.clair_guard_lab_result_attachment();

create function private.clair_log_lab_result_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.ready_at is null and new.ready_at is not null then
    insert into public.lab_result_revision_events
      (workspace_id, lab_result_entry_id, event_kind, row_id, actor_user_id, actor_name, after_snapshot)
    values (new.workspace_id, new.lab_result_entry_id, 'attachment_uploaded', new.row_id,
      new.uploaded_by_user_id, (select display_name from public.users where id = new.uploaded_by_user_id),
      jsonb_build_object('attachmentId', new.id, 'fileName', new.file_name));
  elsif old.deleted_at is null and new.deleted_at is not null then
    insert into public.lab_result_revision_events
      (workspace_id, lab_result_entry_id, event_kind, row_id, actor_user_id, actor_name, before_snapshot)
    values (new.workspace_id, new.lab_result_entry_id, 'attachment_deleted', new.row_id,
      new.deleted_by_user_id, (select display_name from public.users where id = new.deleted_by_user_id),
      jsonb_build_object('attachmentId', new.id, 'fileName', new.file_name));
  end if;
  return new;
end;
$$;
create trigger log_lab_result_attachment after update on public.lab_result_attachments
  for each row execute function private.clair_log_lab_result_attachment();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('lab-result-attachments', 'lab-result-attachments', false, 20971520,
  array['image/jpeg','image/png','image/webp','application/pdf','text/csv','text/plain']::text[])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy lab_result_attachment_object_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'lab-result-attachments' and owner_id = (select auth.uid()::text)
    and exists (select 1 from public.lab_result_attachments a
      where a.storage_path = storage.objects.name and a.uploaded_by_user_id = (select auth.uid())
        and a.ready_at is null and a.abandoned_at is null and a.deleted_at is null)
  );
create policy lab_result_attachment_object_pending_read on storage.objects
  for select to authenticated using (
    bucket_id = 'lab-result-attachments'
    and exists (select 1 from public.lab_result_attachments a
      where a.storage_path = storage.objects.name and a.uploaded_by_user_id = (select auth.uid())
        and a.ready_at is null and a.abandoned_at is null and a.deleted_at is null)
  );
