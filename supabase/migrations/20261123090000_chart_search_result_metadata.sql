-- Chart-content edit time is independent of workflow timestamps and copy versions.
-- Earlier edits cannot be reliably distinguished from status transitions.
create table private.chart_content_edits (
  chart_id uuid primary key references public.soap_notes(id) on delete cascade,
  edited_at timestamptz not null
);
revoke all on private.chart_content_edits from public, anon, authenticated;

create function private.clair_touch_chart_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_id uuid;
  current_id uuid;
begin
  if tg_table_name = 'soap_notes' then
    current_id := new.id;
  elsif tg_table_name = 'clair_chart_copy_receipts' then
    current_id := (new.result->>'chartId')::uuid;
  elsif tg_table_name = 'orders' then
    if tg_op <> 'INSERT' then previous_id := old.origin_chart_id; end if;
    if tg_op <> 'DELETE' then current_id := new.origin_chart_id; end if;
  end if;

  insert into private.chart_content_edits(chart_id, edited_at)
    select n.id, clock_timestamp() from public.soap_notes n
    where n.id in (previous_id, current_id) order by n.id
  on conflict(chart_id) do update
    set edited_at = greatest(chart_content_edits.edited_at, excluded.edited_at);
  return null;
end; $$;
revoke all on function private.clair_touch_chart_content() from public, anon, authenticated;

create trigger chart_content_note_insert after insert on public.soap_notes
  for each row when (new.block_document is not null or
    concat_ws('',new.subjective,new.objective,new.assessment,new.plan) <> '')
  execute function private.clair_touch_chart_content();
create trigger chart_content_note_update after update on public.soap_notes
  for each row when ((old.subjective,old.objective,old.assessment,old.plan,old.block_document,old.diagnosis_assessment_revision)
    is distinct from (new.subjective,new.objective,new.assessment,new.plan,new.block_document,new.diagnosis_assessment_revision))
  execute function private.clair_touch_chart_content();

-- Diagnosis saves replace snapshot rows in bulk. Their chart revision changes only
-- when the final snapshot differs. Copy uses a separate receipt for actual additions.
create trigger chart_content_diagnosis_copy after insert on private.clair_chart_copy_receipts
  for each row when (jsonb_path_exists(new.changes, '$[*].originalDiagnosis'))
  execute function private.clair_touch_chart_content();

create trigger chart_content_order_change after insert or delete on public.orders
  for each row execute function private.clair_touch_chart_content();
create trigger chart_content_order_update after update on public.orders
  for each row when (
    (old.origin_chart_id,old.display_name,old.workspace_catalog_item_id,old.clinical_order_type,
     old.detail_inputs,old.quantity,old.instruction,old.priority,old.sort_order,old.applied_snapshot,
     old.calculation_inputs,old.status='cancelled') is distinct from
    (new.origin_chart_id,new.display_name,new.workspace_catalog_item_id,new.clinical_order_type,
     new.detail_inputs,new.quantity,new.instruction,new.priority,new.sort_order,new.applied_snapshot,
     new.calculation_inputs,new.status='cancelled'))
  execute function private.clair_touch_chart_content();

-- Keep the original authorized projection and its version hash intact.
create function private.clair_chart_result_metadata(n public.soap_notes) returns jsonb
language sql stable set search_path='' as $$
  with counted as (
    select case when coalesce(o.clinical_order_type,o.order_type)='external_lab' then '원외' else '임상' end as kind,
      count(distinct r.result_id) as total
    from public.orders o join public.lab_result_entries r
      on (r.workspace_id,r.encounter_id,r.order_id)=(o.workspace_id,o.encounter_id,o.id)
    left join public.order_tasks t on (t.workspace_id,t.order_id,t.id,t.attempt_no) =
      (r.workspace_id,r.order_id,r.task_id,r.task_attempt_no)
    where private.clair_current_user_has_workspace_permission(n.workspace_id,'lab:view')
      and (o.workspace_id,o.encounter_id,o.origin_chart_id)=(n.workspace_id,n.encounter_id,n.id)
      and o.status <> 'cancelled' and coalesce(o.clinical_order_type,o.order_type) in ('lab','clinical_lab','external_lab')
      and r.result_definition_origin <> 'quarantined'
      and (r.result_status in ('reviewed','corrected') or (r.result_status='entered' and t.status='complete'))
      and (t.id is null or t.status <> 'cancelled')
    group by 1
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'guardianId', (select g.id from public.encounters e join public.guardians g
       on g.workspace_id=e.workspace_id and g.id=e.guardian_id and g.status<>'soft_deleted'
       where e.workspace_id=n.workspace_id and e.id=n.encounter_id
       and private.clair_current_user_has_workspace_permission(n.workspace_id,'patient:view')),
    'lastContentEditedAt', (select edited_at from private.chart_content_edits where chart_id=n.id),
    'extraTags', coalesce((select jsonb_agg(jsonb_build_object(
      'label',kind||' '||total||'건','detail',kind||'검사 최종 결과 '||total||'건')
      order by kind='임상' desc) from counted),'[]'::jsonb)
  ))
$$;
revoke all on function private.clair_chart_result_metadata(public.soap_notes) from public, anon, authenticated;

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
 ) select val||jsonb_build_object('version',md5(val::text||n.updated_at::text)) || private.clair_chart_result_metadata(n) || jsonb_build_object(
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
