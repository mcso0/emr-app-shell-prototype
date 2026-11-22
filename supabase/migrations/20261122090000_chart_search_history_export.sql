-- CHART-PR-042. Preserve copy versions while enriching authorized search projections.
create or replace function private.clair_search_chart(n public.soap_notes) returns jsonb
language sql stable set search_path='' as $$
 with nodes as materialized (select * from private.clair_search_note_blocks(n)), paragraphs as (
   select path, jsonb_build_object('id',array_to_string(path,'.'),'section',section,'scope',coalesce(scope,''),'text',t.body,'replaceable',block->>'type'<>'table') item
   from nodes cross join lateral (
     select private.clair_search_block_text(block) body
   ) t where block->>'type' not in ('soapSection','image','video','divider') and btrim(t.body)<>''
   union all select array[0,ordinality::int],jsonb_build_object('id','legacy:'||kind,'section',kind,'scope','','text',body)
   from unnest(array['subjective','objective','assessment','plan'],array[n.subjective,n.objective,n.assessment,n.plan]) with ordinality x(kind,body,ordinality)
   where n.block_document is null and btrim(body)<>''
 ), pictures as (
   select path,jsonb_build_object('id',a.id,'name',coalesce(nullif(block#>>'{props,name}',''),a.file_name),'caption',coalesce(block#>>'{props,caption}',''),'url',block#>>'{props,url}','video',a.mime_type like 'video/%') item
   from nodes join public.chart_soap_attachments a on a.workspace_id=n.workspace_id and a.encounter_id=n.encounter_id and a.ready_at is not null and a.cancelled_at is null
    and block#>>'{props,url}'='/api/workspaces/'||n.workspace_id||'/chart/soap-attachments/'||a.id||'?encounterId='||n.encounter_id
   where block->>'type' in ('image','video') and exists(select 1 from storage.objects o where o.bucket_id='chart-soap-attachments' and o.name=a.storage_path)
 ), dx as (
   select d.diagnosis_id, d.assessment_snapshot j from public.chart_diagnosis_assessments d where d.workspace_id=n.workspace_id and d.encounter_id=n.encounter_id and d.chart_id=n.id
 ), catalog_access as materialized (
   select private.clair_current_user_has_workspace_permission(n.workspace_id,'service_catalog:view') as allowed
 ), orders as (
   select o.id,o.sort_order,jsonb_build_object('id',o.id,'name',o.display_name,'catalogId',o.workspace_catalog_item_id,
     'kind',coalesce(o.clinical_order_type,o.order_type),'price',c.price_krw,
     'available',case when access.allowed then coalesce(c.availability_status='active' and o.row_type='individual',false) end,
     'unavailableReason',case when access.allowed then case when o.row_type<>'individual' then 'order_set' when c.id is null then 'missing' when c.availability_status<>'active' then 'inactive' end end,
     'quantity',o.quantity,'inputs',coalesce(o.detail_inputs,'{}'::jsonb)) item
   from public.orders o cross join catalog_access access
   left join public.order_catalog_items c on access.allowed and c.workspace_id=o.workspace_id and c.id=o.workspace_catalog_item_id
   where o.workspace_id=n.workspace_id and o.encounter_id=n.encounter_id and o.origin_chart_id=n.id and o.status<>'cancelled'
 ), body as (
   select jsonb_build_object('id',n.id,'encounterId',e.id,'patientId',p.id,'patient',p.name,'guardian',coalesce(g.name,''),'species',p.species,'breed',coalesce(p.breed,''),'age',case when p.birth_date is not null and p.birth_date<=n.clinical_at::date then extract(year from age(n.clinical_at::date,p.birth_date))::int end,
   'clinicalAt',n.clinical_at,'visitAt',coalesce(e.checked_in_at,e.created_at),'authorId',n.author_user_id,'author',coalesce(a.display_name,''),'doctorId',e.primary_veterinarian_id,'doctor',coalesce(v.display_name,''),'status',n.status,'purpose',coalesce(e.visit_purpose,''),'complaint',coalesce(e.chief_complaint,''),'editable',n.status in ('draft','autosaved') and e.status in ('in_consultation','ordered') and private.clair_current_user_has_workspace_permission(n.workspace_id,'chart:update'),
   'paragraphs',coalesce((select jsonb_agg(item order by path) from paragraphs),'[]'::jsonb),'media',coalesce((select jsonb_agg(item order by path) from pictures),'[]'::jsonb),'diagnoses',coalesce((select jsonb_agg(jsonb_build_object('id',diagnosis_id,'name',j->>'diagnosisText','catalogId',j->>'diagnosisCatalogId','kind',j->>'diagnosisType','primary',coalesce((j->>'isPrimary')::boolean,false),'system',coalesce(j->>'systemLabel','')) order by (j->>'sortOrder')::int,diagnosis_id) from dx),'[]'::jsonb),'orders',coalesce((select jsonb_agg(item order by sort_order,id) from orders),'[]'::jsonb)) val
   from public.encounters e join public.patients p on p.id=e.patient_id and p.workspace_id=e.workspace_id and p.status<>'soft_deleted' left join public.guardians g on g.id=e.guardian_id and g.workspace_id=e.workspace_id and g.status<>'soft_deleted' left join public.users a on a.id=n.author_user_id left join public.users v on v.id=e.primary_veterinarian_id where e.workspace_id=n.workspace_id and e.id=n.encounter_id and e.status<>'cancelled' and n.status<>'voided'
 ) select val||jsonb_build_object('version',md5(val::text||n.updated_at::text)) || jsonb_build_object(
   'createdAt', n.created_at,
   'visitType', e.reception_type,
   'primaryVet', (select u.display_name from public.users u where u.id=p.primary_attending_vet_id
      and exists (select 1 from public.user_memberships m where m.user_id=u.id and m.workspace_id=n.workspace_id)),
   'taskStatuses', coalesce((select jsonb_agg(distinct t.status order by t.status)
     from public.orders o cross join lateral (
       select task.status from public.order_tasks task
       where task.workspace_id=o.workspace_id and task.encounter_id=o.encounter_id and task.order_id=o.id
         and task.parent_task_id is null
       order by task.attempt_no desc limit 1
     ) t where o.workspace_id=n.workspace_id and o.encounter_id=e.id and o.origin_chart_id=n.id and o.status<>'cancelled'), '[]'::jsonb))
 from body join public.encounters e on e.workspace_id=n.workspace_id and e.id=n.encounter_id
 join public.patients p on p.workspace_id=n.workspace_id and p.id=e.patient_id
$$;
revoke all on function private.clair_search_chart(public.soap_notes) from public,anon,authenticated;

create or replace function public.clair_advanced_chart_search_batch(p_workspace_id text,p_after uuid default null,p_chart_id uuid default null,p_include_drafts boolean default false,p_targets boolean default false,
 p_index boolean default false,p_include_body boolean default true,p_ids uuid[] default null,p_mine boolean default false,p_doctor text default null,p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; may_edit boolean;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then raise exception 'permission_missing' using errcode='42501'; end if;
 may_edit := private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update');
 if p_ids is not null and cardinality(p_ids)>25 then raise exception 'invalid_request'; end if;
 select coalesce(jsonb_agg(r order by id),'[]'::jsonb) into result from (
   select s.id,case when p_index then
    jsonb_build_object('id',s.id,'clinicalAt',s.clinical_at,'createdAt',s.created_at,'visitAt',coalesce(e.checked_in_at,e.created_at),'authorId',s.author_user_id,'status',s.status,
      'editable',may_edit and s.status in ('draft','autosaved') and e.status in ('in_consultation','ordered'),
      'doctorId',e.primary_veterinarian_id,'doctor',coalesce(v.display_name,''),'purpose',coalesce(e.visit_purpose,''),
      'complaint',coalesce(e.chief_complaint,''),'patient',p.name,'species',p.species,'breed',coalesce(p.breed,''),'guardian',coalesce(g.name,''))
      ||private.clair_chart_index_fields(s,p_include_body)
    else private.clair_search_chart(s) end r from public.soap_notes s
   join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id and e.status<>'cancelled'
   join public.patients p on p.id=e.patient_id and p.workspace_id=e.workspace_id and p.status<>'soft_deleted'
   left join public.users v on p_index and v.id=e.primary_veterinarian_id
   left join public.guardians g on p_index and g.id=e.guardian_id and g.workspace_id=e.workspace_id and g.status<>'soft_deleted'
   where (p_ids is null or s.id=any(p_ids)) and s.workspace_id=p_workspace_id and (p_after is null or s.id>p_after) and (p_chart_id is null or s.id=p_chart_id)
     and s.status<>'voided' and (p_include_drafts or p_targets or s.status in ('signed','amended'))
     and (not p_targets or (s.status in ('draft','autosaved') and e.status in ('in_consultation','ordered') and may_edit))
     and (not p_mine or s.author_user_id=auth.uid()) and (p_doctor is null or e.primary_veterinarian_id::text=p_doctor)
     and (p_from is null or s.clinical_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
     and (p_to is null or s.clinical_at < ((p_to+1)::timestamp at time zone 'Asia/Seoul'))
   order by s.id limit case when p_index then 500 else 50 end
 ) page; return result;
end; $$;
revoke all on function public.clair_advanced_chart_search_batch(text,uuid,uuid,boolean,boolean,boolean,boolean,uuid[],boolean,text,date,date) from public,anon;
grant execute on function public.clair_advanced_chart_search_batch(text,uuid,uuid,boolean,boolean,boolean,boolean,uuid[],boolean,text,date,date) to authenticated;


-- One patient per request. The cursor orders by immutable id. The client groups by visit day.
create function public.clair_search_patient_charts(p_workspace_id text, p_patient_id uuid, p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  return (
    with eligible as materialized (
      select s.id from public.soap_notes s
      join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id
      join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id
      where s.workspace_id=p_workspace_id and p.id=p_patient_id and p.status<>'soft_deleted'
        and e.status<>'cancelled' and s.status<>'voided' and (p_after is null or s.id>p_after)
      order by s.id limit 26
    ), page as (select id from eligible order by id limit 25)
    select jsonb_build_object('items', coalesce((select jsonb_agg(private.clair_search_chart(s) order by s.id)
      from page join public.soap_notes s on s.workspace_id=p_workspace_id and s.id=page.id),'[]'),
      'nextCursor', case when (select count(*) from eligible)>25 then (select id from page order by id desc limit 1) end)
  );
end $$;
revoke all on function public.clair_search_patient_charts(text,uuid,uuid) from public,anon;
grant execute on function public.clair_search_patient_charts(text,uuid,uuid) to authenticated;

-- Like chart-copy receipts, export receipts are server-authored and contain no clinical text.
create table private.clair_chart_export_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  actor_id uuid not null,
  chart_ids uuid[] not null,
  format text not null check (format in ('csv','pdf')),
  issued_at timestamptz not null default now()
);
alter table private.clair_chart_export_receipts enable row level security;
revoke all on private.clair_chart_export_receipts from public,anon,authenticated;

create function public.clair_export_chart_summaries(p_workspace_id text,p_ids uuid[],p_format text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare summaries jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
    raise exception 'permission_missing' using errcode='42501';
  end if;
  if p_format is null or p_format not in ('csv','pdf') or coalesce(cardinality(p_ids),0) not between 1 and 500
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id) then raise exception 'invalid_selection'; end if;
  select jsonb_agg(jsonb_build_object(
    'title',coalesce(e.visit_purpose,''),'patient',p.name,'species',p.species,
    'visitAt',coalesce(e.checked_in_at,e.created_at),'doctor',coalesce(v.display_name,''),
    'author',coalesce(a.display_name,''),'diagnosis',(select string_agg(d.assessment_snapshot->>'diagnosisText',', '
      order by (d.assessment_snapshot->>'sortOrder')::int,d.diagnosis_id)
      from public.chart_diagnosis_assessments d where d.workspace_id=s.workspace_id
      and d.encounter_id=e.id and d.chart_id=s.id)) order by picked.seq)
  into summaries from unnest(p_ids) with ordinality picked(id,seq)
    join public.soap_notes s on s.workspace_id=p_workspace_id and s.id=picked.id and s.status<>'voided'
    join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id and e.status<>'cancelled'
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.status<>'soft_deleted'
    left join public.users v on v.id=e.primary_veterinarian_id
    left join public.users a on a.id=s.author_user_id;
  if coalesce(jsonb_array_length(summaries),0)<>cardinality(p_ids) then raise exception 'source_unavailable'; end if;
  insert into private.clair_chart_export_receipts(workspace_id,actor_id,chart_ids,format)
    values(p_workspace_id,auth.uid(),p_ids,p_format);
  return summaries;
end $$;
revoke all on function public.clair_export_chart_summaries(text,uuid[],text) from public,anon;
grant execute on function public.clair_export_chart_summaries(text,uuid[],text) to authenticated;
