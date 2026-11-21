-- Chart attribution is explicit for diagnoses, orders and embedded media.
create function private.clair_search_note_blocks(n public.soap_notes)
returns table(path integer[], block jsonb, section text, scope text)
language sql stable set search_path='' as $$
  with recursive scopes as (
    select ord::int as idx, value->>'systemLabel' label, value->'blocks' blocks
    from jsonb_array_elements(case when n.block_document_schema_version=2 then n.block_document else '[]'::jsonb end) with ordinality x(value,ord)
    union all select 1,'',n.block_document where n.block_document_schema_version=1
  ), nodes(path,block,section,scope) as (
    select array[s.idx,x.ord::int],x.value,case when x.value->>'type'='soapSection' then x.value#>>'{props,kind}' end,s.label
    from scopes s cross join lateral jsonb_array_elements(s.blocks) with ordinality x(value,ord)
    union all select p.path||x.ord::int,x.value,p.section,p.scope from nodes p
    cross join lateral jsonb_array_elements(p.block->'children') with ordinality x(value,ord)
  ) select * from nodes order by path
$$;
revoke all on function private.clair_search_note_blocks(public.soap_notes) from public,anon,authenticated;

create function private.clair_search_chart(n public.soap_notes) returns jsonb
language sql stable set search_path='' as $$
 with nodes as materialized (select * from private.clair_search_note_blocks(n)), paragraphs as (
   select path, jsonb_build_object('id',array_to_string(path,'.'),'section',section,'scope',coalesce(scope,''),'text',t.body,'replaceable',block->>'type'<>'table') item
   from nodes cross join lateral (
     select case when jsonb_typeof(block->'content')='string' then block->>'content' else (
       select string_agg(v#>>'{}','' order by ord) from jsonb_path_query(block->'content','strict $.**.text','{}'::jsonb,true) with ordinality x(v,ord)
     ) end body
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
     'quantity',o.quantity,'inputs',coalesce(o.detail_inputs,'{}'::jsonb)) item
   from public.orders o cross join catalog_access access
   left join public.order_catalog_items c on access.allowed and c.workspace_id=o.workspace_id and c.id=o.workspace_catalog_item_id
   where o.workspace_id=n.workspace_id and o.encounter_id=n.encounter_id and o.origin_chart_id=n.id and o.status<>'cancelled'
 ), body as (
   select jsonb_build_object('id',n.id,'encounterId',e.id,'patientId',p.id,'patient',p.name,'guardian',coalesce(g.name,''),'species',p.species,'breed',coalesce(p.breed,''),'age',case when p.birth_date is not null and p.birth_date<=n.clinical_at::date then extract(year from age(n.clinical_at::date,p.birth_date))::int end,
   'clinicalAt',n.clinical_at,'visitAt',coalesce(e.checked_in_at,e.created_at),'authorId',n.author_user_id,'author',coalesce(a.display_name,''),'doctorId',e.primary_veterinarian_id,'doctor',coalesce(v.display_name,''),'status',n.status,'purpose',coalesce(e.visit_purpose,''),'complaint',coalesce(e.chief_complaint,''),'editable',n.status in ('draft','autosaved') and e.status in ('in_consultation','ordered') and private.clair_current_user_has_workspace_permission(n.workspace_id,'chart:update'),
   'paragraphs',coalesce((select jsonb_agg(item order by path) from paragraphs),'[]'::jsonb),'media',coalesce((select jsonb_agg(item order by path) from pictures),'[]'::jsonb),'diagnoses',coalesce((select jsonb_agg(jsonb_build_object('id',diagnosis_id,'name',j->>'diagnosisText','catalogId',j->>'diagnosisCatalogId','kind',j->>'diagnosisType','primary',coalesce((j->>'isPrimary')::boolean,false),'system',coalesce(j->>'systemLabel','')) order by (j->>'sortOrder')::int,diagnosis_id) from dx),'[]'::jsonb),'orders',coalesce((select jsonb_agg(item order by sort_order,id) from orders),'[]'::jsonb)) val
   from public.encounters e join public.patients p on p.id=e.patient_id and p.workspace_id=e.workspace_id and p.status<>'soft_deleted' left join public.guardians g on g.id=e.guardian_id and g.workspace_id=e.workspace_id and g.status<>'soft_deleted' left join public.users a on a.id=n.author_user_id left join public.users v on v.id=e.primary_veterinarian_id where e.workspace_id=n.workspace_id and e.id=n.encounter_id and e.status<>'cancelled' and n.status<>'voided'
 ) select val||jsonb_build_object('version',md5(val::text||n.updated_at::text)) from body
$$;
revoke all on function private.clair_search_chart(public.soap_notes) from public,anon,authenticated;

create function public.clair_advanced_chart_search_batch(p_workspace_id text,p_after uuid default null,p_chart_id uuid default null,p_include_drafts boolean default false,p_targets boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then raise exception 'permission_missing' using errcode='42501'; end if;
 select coalesce(jsonb_agg(r order by id),'[]'::jsonb) into result from (
   select s.id,private.clair_search_chart(s) r from public.soap_notes s join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id and e.status<>'cancelled' join public.patients p on p.id=e.patient_id and p.workspace_id=e.workspace_id and p.status<>'soft_deleted'
   where s.workspace_id=p_workspace_id and (p_after is null or s.id>p_after) and (p_chart_id is null or s.id=p_chart_id) and s.status<>'voided' and (p_include_drafts or p_targets or s.status in ('signed','amended')) and (not p_targets or (s.status in ('draft','autosaved') and e.status in ('in_consultation','ordered') and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update'))) order by s.id limit 50
 ) page; return result;
end; $$;
revoke all on function public.clair_advanced_chart_search_batch(text,uuid,uuid,boolean,boolean) from public,anon;
grant execute on function public.clair_advanced_chart_search_batch(text,uuid,uuid,boolean,boolean) to authenticated;

-- The unfiltered opening screen projects documents only for the requested page.
create function public.clair_advanced_chart_recent(p_workspace_id text,p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
  then raise exception 'permission_missing' using errcode='42501'; end if;
  with eligible as materialized (
    select s.id,s.clinical_at,e.primary_veterinarian_id as doctor_id from public.soap_notes s
    join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id
    join public.patients p on p.workspace_id=s.workspace_id and p.id=e.patient_id
    where s.workspace_id=p_workspace_id and s.status in ('signed','amended') and e.status<>'cancelled' and p.status<>'soft_deleted'
  ), page as materialized (
    select x.id,x.clinical_at from eligible x left join eligible cursor_row on cursor_row.id=p_after
    where p_after is null or x.clinical_at<cursor_row.clinical_at or (x.clinical_at=cursor_row.clinical_at and x.id>p_after)
    order by x.clinical_at desc,x.id limit 26
  ), items as (select * from page order by clinical_at desc,id limit 25)
  select jsonb_build_object('total',(select count(*) from eligible),
    'items',coalesce((select jsonb_agg(private.clair_search_chart(n) order by i.clinical_at desc,i.id)
      from items i join public.soap_notes n on n.id=i.id and n.workspace_id=p_workspace_id),'[]'),
    'doctors',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name) order by u.display_name)
      from public.users u where u.id in(select doctor_id from eligible)),'[]'),
    'nextCursor',case when (select count(*) from page)>25 then (select id from items order by clinical_at,id desc limit 1) end,
    'valid',p_after is null or exists(select 1 from eligible where id=p_after)) into result;
  if not (result->>'valid')::boolean then raise exception 'invalid_cursor'; end if;
  return result-'valid';
end $$;
revoke all on function public.clair_advanced_chart_recent(text,uuid) from public,anon;
grant execute on function public.clair_advanced_chart_recent(text,uuid) to authenticated;
