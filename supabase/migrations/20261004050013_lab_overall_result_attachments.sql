-- Explicit NULL row_id represents a result-level overall attachment.
-- Both existing result/workspace and item foreign keys remain in force.
alter table public.lab_result_attachments alter column row_id drop not null;

create or replace function public.clair_prepare_lab_result_attachment(
  p_workspace_id text, p_result_id text, p_row_id text, p_attachment_id uuid,
  p_file_name text, p_mime_type text, p_byte_size integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_entry public.lab_result_entries; v_path text; v_extension text;
begin
  if (select auth.uid()) is null
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'lab:complete')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  select * into v_entry from public.lab_result_entries
  where workspace_id = p_workspace_id and result_id = p_result_id
    and result_definition_origin = 'canonical' for update;
  if not found or v_entry.result_status not in ('received', 'entered')
  then raise exception 'result_unavailable' using errcode = '22023'; end if;
  if p_row_id is not null and not exists (select 1 from public.lab_result_entry_rows r
    where r.workspace_id = p_workspace_id and r.lab_result_entry_id = v_entry.id and r.row_id = p_row_id)
  then raise exception 'row_unavailable' using errcode = '22023'; end if;
  v_extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
    when 'image/webp' then 'webp' when 'application/pdf' then 'pdf'
    when 'text/csv' then 'csv' when 'text/plain' then 'txt' end;
  if v_extension is null or p_file_name ~ E'[\n\r]'
  then raise exception 'invalid_file_metadata' using errcode = '22023'; end if;
  v_path := p_workspace_id || '/' || v_entry.id::text || '/' || p_attachment_id::text || '.' || v_extension;
  insert into public.lab_result_attachments(id, workspace_id, lab_result_entry_id, row_id,
    uploaded_by_user_id, file_name, mime_type, byte_size, storage_path)
  values(p_attachment_id, p_workspace_id, v_entry.id, p_row_id, (select auth.uid()),
    p_file_name, p_mime_type, p_byte_size, v_path);
  return v_path;
end;
$$;
revoke all on function public.clair_prepare_lab_result_attachment(text, text, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.clair_prepare_lab_result_attachment(text, text, text, uuid, text, text, integer) to authenticated;
