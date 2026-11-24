-- The new RPC keeps the existing selection, workspace permission and receipt transaction.
-- Keep the old summary RPC unchanged for the DB-first rollout and app rollback.
-- Both formats add the saved selected chart, never the whole encounter or patient history.
begin;
set local lock_timeout = '5s';

create function private.clair_chart_export_record(n public.soap_notes)
returns jsonb language sql stable set search_path='' as $$
  with chart as materialized (select private.clair_search_chart(n) as record),
  access as materialized (
    select private.clair_current_user_has_workspace_permission(n.workspace_id,'lab:view') as lab,
      private.clair_current_user_has_workspace_permission(n.workspace_id,'imaging:view') as imaging
  ), orders as materialized (
    select o.id, o.display_name, o.sort_order, coalesce(o.clinical_order_type,o.order_type) as kind
    from public.orders o
    where (o.workspace_id,o.encounter_id,o.origin_chart_id)=(n.workspace_id,n.encounter_id,n.id)
      and o.status <> 'cancelled'
  ), lab as (
    select o.display_name, o.sort_order, r.task_attempt_no as attempt, r.created_at as stamp, r.id, o.kind,
      jsonb_strip_nulls(jsonb_build_object(
        'order',o.display_name,'kind',o.kind,'attempt',r.task_attempt_no,'status',r.result_status,
        'finding',nullif(f.finding,''),'rows',coalesce((select jsonb_agg(jsonb_build_object(
          'name',v.analyte_name,
          'value',coalesce((select code->>'label'
            from jsonb_array_elements(r.result_definition_snapshot->'rows') def
            cross join lateral jsonb_array_elements(def#>'{interpretationRule,codes}') code
            where def->>'rowId'=v.row_id and code->>'code'=v.result_value limit 1),v.result_value),
          'unit',v.result_unit,'reference',v.reference_range,'judgment',v.judgment,
          'note',v.note,'presence',v.result_presence,'qualifier',v.result_qualifier,'deviceFlag',v.device_flag)
          order by coalesce(v.effective_sort_order,v.sort_order),v.row_id)
          from public.lab_result_entry_rows v
          where v.workspace_id=r.workspace_id and v.lab_result_entry_id=r.id),'[]'::jsonb))) as item
    from access a join orders o on a.lab and o.kind in ('lab','clinical_lab','external_lab')
    join public.lab_result_entries r
      on (r.workspace_id,r.encounter_id,r.order_id)=(n.workspace_id,n.encounter_id,o.id)
    left join public.order_tasks t
      on (t.workspace_id,t.encounter_id,t.order_id,t.id,t.attempt_no)=(r.workspace_id,r.encounter_id,r.order_id,r.task_id,r.task_attempt_no)
    left join public.lab_result_overall_findings f on f.workspace_id=r.workspace_id and f.lab_result_entry_id=r.id
    -- Same result readiness as chart history's result counts. An old final attempt stays labelled as such.
    where r.result_definition_origin <> 'quarantined'
      and (r.result_status in ('reviewed','corrected') or (r.result_status='entered' and t.status='complete'))
      and (r.task_id is null or (t.id is not null and t.status<>'cancelled'))
  ), imaging as (
    select o.display_name, o.sort_order, t.attempt_no as attempt, r.performed_at as stamp, r.id, o.kind,
      jsonb_strip_nulls(jsonb_build_object(
        'order',o.display_name,'kind',o.kind,'attempt',t.attempt_no,'performedAt',r.performed_at,
        'protocol',r.payload->'performedProtocol','views',r.payload->'acquiredViews',
        'finding',r.payload->'findings','interpretation',r.payload->'interpretation','note',r.payload->'note')) as item
    from access a join orders o on a.imaging and o.kind='imaging'
    join public.order_tasks t on (t.workspace_id,t.encounter_id,t.order_id)=(n.workspace_id,n.encounter_id,o.id)
      and t.task_role='execution' and t.status='complete'
    join lateral (
      select v.id,v.performed_at,v.payload from public.order_execution_result_versions v
      where (v.workspace_id,v.encounter_id,v.order_id,v.task_id,v.task_attempt_no)=
        (t.workspace_id,t.encounter_id,t.order_id,t.id,t.attempt_no) and v.clinical_order_type='imaging'
      order by v.version desc limit 1
    ) r on true
  ), results as (select * from lab union all select * from imaging)
  select jsonb_build_object('chartId',n.id,'status',n.status,
    'purpose',record->'purpose','complaint',record->'complaint','visitType',record->'visitType',
    'primaryVet',record->'primaryVet','taskStatuses',record->'taskStatuses',
    'paragraphs',record->'paragraphs','diagnoses',coalesce((select jsonb_agg(
      d - 'catalogId' - 'id' order by seq) from jsonb_array_elements(record->'diagnoses') with ordinality dx(d,seq)), '[]'::jsonb),
    -- Only fields already presented by the chart history; no raw inputs, catalog pricing or access URLs.
    'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'name',o->'name','kind',o->'kind','quantity',o->'quantity','inputs',jsonb_strip_nulls(jsonb_build_object(
        'dose',o#>'{inputs,dose}','doseUnit',o#>'{inputs,doseUnit}','doseBasis',o#>'{inputs,doseBasis}',
        'frequency',o#>'{inputs,frequency}','durationDays',o#>'{inputs,durationDays}'))) order by seq)
      from jsonb_array_elements(record->'orders') with ordinality ord(o,seq)), '[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object(
      'name',m->'name','caption',m->'caption','video',m->'video') order by seq)
      from jsonb_array_elements(record->'media') with ordinality media(m,seq)), '[]'::jsonb),
    'results',coalesce((select jsonb_agg(item order by sort_order, display_name, attempt nulls first,stamp,id) from results), '[]'::jsonb),
    'resultAccess',jsonb_build_object('lab',access.lab,'imaging',access.imaging))
  from chart cross join access
$$;
revoke all on function private.clair_chart_export_record(public.soap_notes) from public,anon,authenticated,service_role;

create function public.clair_export_chart_records(p_workspace_id text,p_ids uuid[],p_format text)
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
      and d.encounter_id=e.id and d.chart_id=s.id))
    || private.clair_chart_export_record(s)
    order by picked.seq)
  into summaries from unnest(p_ids) with ordinality picked(id,seq)
    join public.soap_notes s on s.workspace_id=p_workspace_id and s.id=picked.id and s.status<>'voided'
    join public.encounters e on e.workspace_id=s.workspace_id and e.id=s.encounter_id and e.status<>'cancelled'
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.status<>'soft_deleted'
    left join public.users v on v.id=e.primary_veterinarian_id
    left join public.users a on a.id=s.author_user_id;
  if coalesce(jsonb_array_length(summaries),0)<>cardinality(p_ids) then raise exception 'source_unavailable'; end if;
  -- Leave headroom for the response envelope below Vercel's 4.5 MB limit.
  -- Reject before the receipt; never silently truncate the chart.
  if octet_length(summaries::text)>4000000 then raise exception 'chart_export_too_large'; end if;
  insert into private.clair_chart_export_receipts(workspace_id,actor_id,chart_ids,format)
    values(p_workspace_id,auth.uid(),p_ids,p_format);
  return summaries;
end $$;

revoke all on function public.clair_export_chart_records(text,uuid[],text) from public,anon,service_role;
grant execute on function public.clair_export_chart_records(text,uuid[],text) to authenticated;

commit;
