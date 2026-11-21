-- Receipts and parked selections are private. Only scoped RPCs may access them.
create table private.clair_chart_copy_receipts (
  workspace_id text not null, actor_id uuid not null, request_id uuid not null,
  payload jsonb not null, result jsonb not null, changes jsonb not null,
  created_at timestamptz not null default now(), primary key(workspace_id,actor_id,request_id)
);
create table private.clair_chart_copy_pending (
  id uuid primary key, workspace_id text not null, actor_id uuid not null,
  encounter_id uuid not null, patient_id uuid not null, source_id uuid not null, intent jsonb not null,
  unique(workspace_id,actor_id,encounter_id)
);
revoke all on private.clair_chart_copy_receipts,private.clair_chart_copy_pending from public,anon,authenticated;

create function private.clair_copy_paragraph(t text) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('id',gen_random_uuid(),'type','paragraph','props',jsonb_build_object('backgroundColor','default','textColor','default','textAlignment','left'),'children','[]'::jsonb,
 'content',jsonb_build_array(jsonb_build_object('type','text','text',t,'styles','{}'::jsonb)))
$$;

create function private.clair_copy_soap(w text,src jsonb,dest public.soap_notes,picks jsonb,req uuid) returns jsonb
language plpgsql set search_path='' as $$
declare doc jsonb:=private.clair_chart_note_json(dest)->'blockDocument'; pick jsonb; item jsonb; prior jsonb;
  sec text; top_path text[]; target_path text[]; pieces text[]; n integer; k integer; block jsonb;
  pos integer; child_path text[]; content jsonb; changes jsonb:='[]'; replaced text[]:='{}'; kind text;
begin
 if jsonb_array_length(picks)=0 then return changes; end if;
 if doc is null then
   doc:=jsonb_build_object('schemaVersion',1,'blocks','[]'::jsonb);
   foreach kind in array array['subjective','objective','assessment','plan'] loop
     content:=to_jsonb(dest)->kind;
     block:=jsonb_build_object('id',gen_random_uuid(),'type','soapSection','props',jsonb_build_object('kind',kind,'scope','default','systemLabel','기본 SOAP','label',case kind when 'subjective' then 'S' when 'objective' then 'O' when 'assessment' then 'A' else 'P' end),'children',case when btrim(coalesce(content#>>'{}',''))='' then '[]'::jsonb else jsonb_build_array(private.clair_copy_paragraph(content#>>'{}')) end);
     doc:=jsonb_set(doc,'{blocks}',(doc->'blocks')||jsonb_build_array(block));
   end loop;
 end if;
 for pick in select value from jsonb_array_elements(picks) loop
   select value into item from jsonb_array_elements(src->'paragraphs') where value->>'id'=pick->>'id';
   sec:=item->>'section';
   if sec is null or sec not in ('subjective','objective','assessment','plan') then raise exception 'invalid_selection'; end if;
   prior:=null;
   if pick ? 'replaceId' then
     if sec not in ('assessment','plan') or pick->>'replaceId'=any(replaced) then raise exception 'invalid_replacement'; end if;
     replaced:=array_append(replaced,pick->>'replaceId');
     select value into prior from jsonb_array_elements(private.clair_search_chart(dest)->'paragraphs') where value->>'id'=pick->>'replaceId' and value->>'section'=sec;
     if prior is null then raise exception 'revision_conflict'; end if;
     if prior->>'id' like 'legacy:%' then
       select ord::int-1 into pos from jsonb_array_elements(doc->'blocks') with ordinality x(b,ord) where b#>>'{props,kind}'=sec;
       target_path:=array['blocks',pos::text,'children','0'];
     else
       pieces:=string_to_array(prior->>'id','.');
       if cardinality(pieces)<2 then raise exception 'invalid_replacement'; end if;
       target_path:=case when doc->>'schemaVersion'='2' then array['scopes',(pieces[1]::int-1)::text,'blocks'] else array['blocks'] end || (pieces[2]::int-1)::text;
       for n in 3..cardinality(pieces) loop target_path:=target_path||array['children',(pieces[n]::int-1)::text]; end loop;
     end if;
     -- Replace the selected text only; nested sections/files remain in place.
     if doc#>target_path is null or doc#>> (target_path||'type'::text)='table' then raise exception 'invalid_replacement'; end if;
     doc:=jsonb_set(doc,target_path||'content'::text,private.clair_copy_paragraph(item->>'text')->'content');
   else
     if doc->>'schemaVersion'='2' then
       select ord::int-1 into k from jsonb_array_elements(doc->'scopes') with ordinality x(v,ord) where v->>'scopeKey'='default';
       if k is null then raise exception 'invalid_soap_document'; end if;
       top_path:=array['scopes',k::text,'blocks'];
     else top_path:=array['blocks']; end if;
     select ord::int-1 into pos from jsonb_array_elements(doc#>top_path) with ordinality x(b,ord) where b->>'type'='soapSection' and b#>>'{props,kind}'=sec and b#>>'{props,scope}'='default';
     if pos is null then
       pos:=jsonb_array_length(doc#>top_path);
       block:=jsonb_build_object('id',gen_random_uuid(),'type','soapSection','props',jsonb_build_object('kind',sec,'scope','default','systemLabel','기본 SOAP','label',case sec when 'subjective' then 'S' when 'objective' then 'O' when 'assessment' then 'A' else 'P' end),'children','[]'::jsonb);
       doc:=jsonb_set(doc,top_path,(doc#>top_path)||jsonb_build_array(block));
     end if;
     child_path:=top_path||array[pos::text,'children'];
     doc:=jsonb_set(doc,child_path,coalesce(doc#>child_path,'[]'::jsonb)||jsonb_build_array(private.clair_copy_paragraph(item->>'text')));
   end if;
   changes:=changes||jsonb_build_array(jsonb_build_object('section',sec,'before',prior,'after',item));
 end loop;
 content:=jsonb_build_object('blockDocument',doc,'editorCapability','media_table_v1');
 foreach kind in array array['subjective','objective','assessment','plan'] loop
   content:=content||jsonb_build_object(kind,private.clair_soap_document_field_v2(doc,kind));
 end loop;
 perform public.clair_save_chart_soap_note_v4(w,auth.uid()::text,dest.encounter_id,dest.id,content,dest.updated_at,'manual_save',req::text,null);
 return changes;
end; $$;
revoke all on function private.clair_copy_paragraph(text),private.clair_copy_soap(text,jsonb,public.soap_notes,jsonb,uuid) from public,anon,authenticated;

create function private.clair_copy_diagnoses(w text,src jsonb,dest public.soap_notes,picks jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare pick jsonb; item jsonb; cat public.diagnosis_catalog; diag public.diagnoses; snap jsonb; pos int;
  changes jsonb:='[]';
begin
 for pick in select value from jsonb_array_elements(picks) loop
   select value into item from jsonb_array_elements(src->'diagnoses') where value->>'id'=pick->>'id';
   if item is null or (pick->>'kind') is null or pick->>'kind' not in ('confirmed','suspected','differential') then raise exception 'invalid_diagnosis'; end if;
   if exists(select 1 from public.chart_diagnosis_assessments a where a.workspace_id=w and a.chart_id=dest.id and
     ((item->>'catalogId' is not null and a.assessment_snapshot->>'diagnosisCatalogId'=item->>'catalogId') or lower(a.assessment_snapshot->>'diagnosisText')=lower(item->>'name'))) then continue; end if;
   select * into cat from public.diagnosis_catalog where workspace_id=w and id=(item->>'catalogId')::uuid and is_active and availability_state='active';
   if item->>'catalogId' is not null and cat.id is null then raise exception 'catalog_item_unavailable'; end if;
   select * into diag from public.diagnoses where workspace_id=w and encounter_id=dest.encounter_id and retired_at is null and
     (diagnosis_catalog_id=cat.id or (cat.id is null and diagnosis_catalog_id is null and lower(diagnosis_text)=lower(item->>'name'))) order by id limit 1;
   if diag.id is null then
     select coalesce(max(sort_order),-1)+1 into pos from public.diagnoses where workspace_id=w and encounter_id=dest.encounter_id;
     snap:=case when cat.id is not null then jsonb_build_object('catalogId',cat.id,'catalogRevision',cat.catalog_revision,'sourceMasterRevision',cat.last_applied_revision,'diagnosisName',cat.name,'systemId',cat.system_master_record_id,'systemLabel',cat.system_name,'diseaseGroupId',cat.disease_group_master_record_id,'diseaseGroupLabel',cat.disease_group_name,'sourceMasterRecordId',cat.source_master_record_id) end;
     insert into public.diagnoses(id,workspace_id,encounter_id,diagnosis_catalog_id,diagnosis_catalog_revision,diagnosis_snapshot,diagnosis_text,diagnosis_type,is_primary,sort_order,created_by_user_id,updated_by_user_id)
     values(gen_random_uuid(),w,dest.encounter_id,cat.id,cat.catalog_revision,snap,coalesce(cat.name,item->>'name'),pick->>'kind',coalesce((pick->>'primary')::boolean,false),pos,auth.uid(),auth.uid()) returning * into diag;
   end if;
   select coalesce(max((assessment_snapshot->>'sortOrder')::int),-1)+1 into pos from public.chart_diagnosis_assessments where workspace_id=w and chart_id=dest.id;
   select v into snap from jsonb_array_elements(public.clair_get_chart_diagnoses(w,dest.encounter_id)) x(v) where v->>'id'=diag.id::text;
   snap:=(snap-'closedAt'-'closedByUserId')||jsonb_build_object('isPrimary',coalesce((pick->>'primary')::boolean,false),'diagnosisType',pick->>'kind','sortOrder',pos);
   insert into public.chart_diagnosis_assessments(workspace_id,encounter_id,chart_id,diagnosis_id,assessment_snapshot,assessed_by_user_id) values(w,dest.encounter_id,dest.id,diag.id,snap,auth.uid());
   changes:=changes||jsonb_build_array(jsonb_build_object('originalDiagnosis',item->>'id','after',snap));
 end loop;
 if jsonb_array_length(changes)>0 then update public.soap_notes set updated_at=clock_timestamp() where workspace_id=w and id=dest.id; end if;
 return changes;
end; $$;
revoke all on function private.clair_copy_diagnoses(text,jsonb,public.soap_notes,jsonb) from public,anon,authenticated;

create function private.clair_copy_orders(w text,src jsonb,dest public.soap_notes,picks jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare pick jsonb; item jsonb; inputs jsonb; row_data jsonb; rows jsonb:='[]'; changes jsonb:='[]'; days integer; dose numeric; freq text; new_id uuid; snapshot jsonb;
begin
 if jsonb_array_length(picks)=0 then return changes; end if;
 for pick in select value from jsonb_array_elements(picks) loop
   select value into item from jsonb_array_elements(src->'orders') where value->>'id'=pick->>'id';
   if item is null or not (item->>'available')::boolean then raise exception 'catalog_item_unavailable'; end if;
   if not coalesce((pick->>'duplicate')::boolean,false) and exists(select 1 from public.orders o where o.workspace_id=w and o.origin_chart_id=dest.id and o.workspace_catalog_item_id=item->>'catalogId' and o.status<>'cancelled') then raise exception 'duplicate_order'; end if;
   snapshot:=private.clair_build_catalog_order_snapshot(w,item->>'catalogId',(item->>'quantity')::numeric);
   if (snapshot->>'priceKrw')::numeric is distinct from (pick->>'price')::numeric then raise exception 'price_changed'; end if;
   new_id:=gen_random_uuid();
   row_data:=jsonb_build_object('rowType','individual','orderId',new_id,'workspaceCatalogItemId',item->>'catalogId','quantity',(item->>'quantity')::numeric,'priority','normal');
   if item->>'kind' in ('medication','dispensing') then
     dose:=(pick->>'dose')::numeric; days:=(pick->>'days')::integer; freq:=pick->>'frequency';
     if dose is null or dose<=0 or dose::text in ('NaN','Infinity') or days is null or days<1 or freq is null or freq not in ('once','sid','bid','tid','qid','prn','custom') or (freq='once' and days<>1) then raise exception 'invalid_prescription'; end if;
     -- Keep the reviewed prescription's units and basis. Clinical measurements and fulfillment state stay in the source encounter.
     select coalesce(jsonb_object_agg(key,value),'{}') into inputs from jsonb_each(item->'inputs') where key in ('doseUnit','doseBasis','route');
     if nullif(inputs->>'doseUnit','') is null then raise exception 'dose_unit_required'; end if;
     inputs:=inputs||jsonb_build_object('dose',dose,'frequency',freq,'durationDays',days);
     row_data:=row_data||jsonb_build_object('detailInputs',inputs,'detailSchemaVersion',1);
   end if;
   rows:=rows||jsonb_build_array(row_data); changes:=changes||jsonb_build_array(jsonb_build_object('originalOrder',item->>'id','name',item->>'name','after',row_data,'unitPrice',snapshot->'priceKrw'));
 end loop;
 perform public.clair_save_chart_order_draft_for_chart(w,auth.uid()::text,dest.encounter_id,dest.id,jsonb_build_object('expectedEtag',private.clair_b3_order_draft_etag(w,dest.encounter_id),'removedOrderIds','[]'::jsonb,'rows',rows));
 return changes;
end; $$;
revoke all on function private.clair_copy_orders(text,jsonb,public.soap_notes,jsonb) from public,anon,authenticated;

create function public.clair_advanced_chart_transfer(p_workspace_id text,p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w text:=p_workspace_id; actor uuid:=auth.uid(); src public.soap_notes; dest public.soap_notes; e public.encounters;
  source_row jsonb; target_row jsonb; changes jsonb; req uuid:=(p_input->>'requestId')::uuid; selection jsonb:=p_input->'selection';
  pending private.clair_chart_copy_pending; receipt private.clair_chart_copy_receipts; result jsonb; k text; tot int:=0; first_id uuid;
begin
 if actor is null or not private.clair_is_active_workspace_member(w) or not private.clair_current_user_has_workspace_permission(w,'chart:view') or not private.clair_current_user_has_workspace_permission(w,'chart:update') then raise exception 'permission_missing' using errcode='42501'; end if;
 if p_action='visits' then
   select coalesce(jsonb_agg(v order by dt desc),'[]'::jsonb) into result from (
    select e1.created_at dt,jsonb_build_object('id',e1.id,'patientId',p.id,'patient',p.name,'guardian',coalesce(g.name,''),'status',e1.status,'visitAt',coalesce(e1.checked_in_at,e1.created_at),'purpose',e1.visit_purpose) v
    from public.encounters e1 join public.patients p on p.workspace_id=w and p.id=e1.patient_id and p.status<>'soft_deleted' left join public.guardians g on g.id=e1.guardian_id and g.workspace_id=w and g.status<>'soft_deleted'
    where e1.workspace_id=w and e1.status in ('waiting','in_consultation','ordered') order by e1.created_at desc,e1.id) list; return result;
 end if;
 if p_action='discard' then delete from private.clair_chart_copy_pending where workspace_id=w and actor_id=actor and id=(p_input->>'id')::uuid; return '{}'::jsonb; end if;
 select * into e from public.encounters where workspace_id=w and id=(p_input->>'encounterId')::uuid for update;
 if e.id is null or e.patient_id is distinct from (p_input->>'patientId')::uuid or e.status='cancelled' then raise exception 'encounter_unavailable'; end if;
 if p_action='pending' then
   select s.id into first_id from public.soap_notes s where s.workspace_id=w and s.encounter_id=e.id and s.status<>'voided' order by s.created_at,s.id limit 1;
   if first_id is null or first_id is distinct from (p_input->>'targetId')::uuid then return 'null'::jsonb; end if;
   select p.intent||jsonb_build_object('id',p.id) into result from private.clair_chart_copy_pending p
   join public.patients target on target.workspace_id=w and target.id=e.patient_id and target.status<>'soft_deleted'
   join public.soap_notes n on n.workspace_id=p.workspace_id and n.id=p.source_id and n.status<>'voided'
   where p.workspace_id=w and p.actor_id=actor and p.encounter_id=e.id and p.patient_id=e.patient_id;
   if jsonb_array_length(result#>'{selection,orders}')>0 and not private.clair_current_user_has_workspace_permission(w,'service_catalog:view') then
     return jsonb_set(result,'{selection,orders}','[]') || jsonb_build_object('orderPermissionRequired',true);
   end if;
   return coalesce(result,'null'::jsonb);
 end if;
 if pg_column_size(p_input)>100000 or req is null or p_action not in ('apply','park') then raise exception 'invalid_request'; end if;
 if jsonb_typeof(selection->'orders')='array' and selection->'orders'<>'[]'::jsonb
    and not private.clair_current_user_has_workspace_permission(w,'service_catalog:view') then
   raise exception 'catalog_permission_missing' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(w||actor::text||req::text,0));
 select * into receipt from private.clair_chart_copy_receipts where workspace_id=w and actor_id=actor and request_id=req;
 if found then if receipt.payload is distinct from p_input or p_action<>'apply' then raise exception 'request_conflict'; end if; return receipt.result; end if;
 -- Keep patient archival and this transfer in transaction order, including first-chart resumes.
 perform 1 from public.patients p where p.workspace_id=w and p.id=e.patient_id and p.status<>'soft_deleted' for share;
 if not found then raise exception 'target_patient_deleted'; end if;
 select * into src from public.soap_notes where workspace_id=w and id=(p_input->>'sourceId')::uuid and status<>'voided' for share;
 if src.id is null then raise exception 'source_unavailable'; end if;
 source_row:=private.clair_search_chart(src);
 if source_row is null or source_row->>'version' is distinct from p_input->>'sourceVersion' then raise exception 'revision_conflict'; end if;
 foreach k in array array['paragraphs','diagnoses','orders'] loop
   if jsonb_typeof(selection->k) is distinct from 'array' then raise exception 'invalid_selection'; end if;
   tot:=tot+jsonb_array_length(selection->k);
   if exists(select 1 from jsonb_array_elements(selection->k) x(a) where not exists(
     select 1 from jsonb_array_elements(source_row->k) y(b) where b->>'id'=a->>'id'
       and (k<>'paragraphs' or b->>'section' is not null) and (k<>'orders' or (b->>'available')::boolean)
   )) then raise exception 'invalid_selection'; end if;
   if exists(select 1 from jsonb_array_elements(selection->k) x(a) group by a->>'id' having count(*)>1) then raise exception 'invalid_selection'; end if;
 end loop;
 if (selection - array['paragraphs','diagnoses','orders']) <> '{}'::jsonb or tot<1 or tot>200 then raise exception 'invalid_selection'; end if;
 if p_action='park' then
   if e.status<>'waiting' then raise exception 'stale_status'; end if;
   select * into pending from private.clair_chart_copy_pending where workspace_id=w and actor_id=actor and encounter_id=e.id;
   if found then if pending.id=req and pending.intent=p_input then return jsonb_build_object('id',req); end if; raise exception 'pending_exists'; end if;
   insert into private.clair_chart_copy_pending values(req,w,actor,e.id,e.patient_id,src.id,p_input);return jsonb_build_object('id',req);
 end if;
 perform private.clair_require_chart_encounter(w,e.id,actor::text,true);
 if p_input->>'pendingId' is not null then
   select * into pending from private.clair_chart_copy_pending where workspace_id=w and actor_id=actor and encounter_id=e.id and patient_id=e.patient_id and id=(p_input->>'pendingId')::uuid for update;
   select s.id into first_id from public.soap_notes s where s.workspace_id=w and s.encounter_id=e.id and s.status<>'voided' order by s.created_at,s.id limit 1;
   if pending.id is null or pending.source_id<>src.id or pending.intent->>'sourceVersion' is distinct from source_row->>'version' or first_id is null or first_id is distinct from (p_input->>'targetId')::uuid or coalesce((p_input->>'newChart')::boolean,false) then raise exception 'invalid_resume'; end if;
 end if;
 if coalesce((p_input->>'newChart')::boolean,false) then
   if p_input->>'targetId' is not null then raise exception 'invalid_request'; end if;
   result:=public.clair_create_encounter_chart(w,actor::text,e.id,req,now());
   if coalesce((result->>'idempotentReplay')::boolean,false) then raise exception 'request_conflict'; end if;
   select * into dest from public.soap_notes where id=(result->>'id')::uuid and workspace_id=w;
 else
   select * into dest from public.soap_notes where workspace_id=w and encounter_id=e.id and id=(p_input->>'targetId')::uuid for update;
   target_row:=private.clair_search_chart(dest);
   if dest.id is null or target_row is null or target_row->>'version' is distinct from p_input->>'targetVersion' then raise exception 'revision_conflict'; end if;
 end if;
 if dest.id is null or src.id=dest.id or dest.status not in ('draft','autosaved') then raise exception 'target_unavailable'; end if;
 changes:=private.clair_copy_soap(w,source_row,dest,selection->'paragraphs',req);
 changes:=changes||private.clair_copy_diagnoses(w,source_row,dest,selection->'diagnoses');
 changes:=changes||private.clair_copy_orders(w,source_row,dest,selection->'orders');
 result:=jsonb_build_object('chartId',dest.id,'encounterId',e.id,'patientId',e.patient_id,'visitAt',coalesce(e.checked_in_at,e.created_at),'requestId',req,'unchanged',jsonb_array_length(changes)=0);
 insert into private.clair_chart_copy_receipts values(w,actor,req,p_input,result,changes,now());
 if pending.id is not null then delete from private.clair_chart_copy_pending where id=pending.id; end if;
 return result;
end; $$;
revoke all on function public.clair_advanced_chart_transfer(text,text,jsonb) from public,anon;
grant execute on function public.clair_advanced_chart_transfer(text,text,jsonb) to authenticated;

-- Expose a chart's copy receipts through the same chart visibility boundary.
create index clair_chart_copy_receipts_target
  on private.clair_chart_copy_receipts(workspace_id, (result->>'chartId'), created_at desc);

create function public.clair_advanced_chart_copy_history(p_workspace_id text, p_chart_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare history jsonb;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view')
  then raise exception 'permission_missing' using errcode='42501'; end if;
  if not exists(select 1 from public.soap_notes n join public.encounters e on e.workspace_id=n.workspace_id and e.id=n.encounter_id
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id
    where n.workspace_id=p_workspace_id and n.id=p_chart_id and n.status<>'voided' and e.status<>'cancelled' and p.status<>'soft_deleted')
  then raise exception 'target_unavailable'; end if;
  select coalesce(jsonb_agg(item order by created_at desc),'[]') into history from (
    select r.created_at, jsonb_build_object('id',r.request_id,'at',r.created_at,'actor',u.display_name,
      'source',p.name,'sourceId',n.id,'changes',r.changes) item
    from private.clair_chart_copy_receipts r
    join public.soap_notes n on n.workspace_id=r.workspace_id and n.id=(r.payload->>'sourceId')::uuid and n.status<>'voided'
    join public.encounters e on e.workspace_id=n.workspace_id and e.id=n.encounter_id and e.status<>'cancelled'
    join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.status<>'soft_deleted'
    left join public.users u on u.id=r.actor_id
    where r.workspace_id=p_workspace_id and r.result->>'chartId'=p_chart_id::text
    order by r.created_at desc limit 50
  ) receipts;
  return history;
end $$;
revoke all on function public.clair_advanced_chart_copy_history(text,uuid) from public,anon;
grant execute on function public.clair_advanced_chart_copy_history(text,uuid) to authenticated;
