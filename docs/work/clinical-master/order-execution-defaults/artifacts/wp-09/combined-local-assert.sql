-- Complete release proof in the named synthetic local database; transaction rolls back.
do $complete$
declare p jsonb := (select payload from wp09_complete_payload); published jsonb; rid uuid;
  before_retry text; foreign_before text; history_before text; n integer; r jsonb;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.id)::text,'[]')) into foreign_before
    from public.order_catalog_items c where workspace_id='clair-foreign-demo';
  select md5(coalesce(jsonb_agg(jsonb_build_object('id',o.id,'snapshot',o.confirmed_snapshot) order by o.id)::text,'[]')) into history_before
    from public.orders o where o.confirmed_snapshot is not null;
  select count(*) into n from jsonb_array_elements(p->'records') item where item->>'recordType'='order';
  if n<>524 then raise exception 'complete candidate expected524'; end if;
  published := private.publish_clinical_master_release(p); rid := (published->>'releaseId')::uuid;
  if (private.publish_clinical_master_release(p)->>'releaseId')::uuid is distinct from rid then raise exception 'complete release retry mismatch'; end if;
  perform private.clair_adopt_master_release_to_workspace('clair-demo',rid);
  select count(*) into n from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
    where c.workspace_id='clair-demo' and m.master_key in (select item->>'masterKey' from jsonb_array_elements(p->'records') item where item->>'recordType'='order');
  if n<>524 then raise exception 'complete candidate adopted count: %',n; end if;
  for r in select value from jsonb_array_elements(p->'records') where value->>'recordType'='order' loop
    if not exists(select 1 from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
      where c.workspace_id='clair-demo' and m.master_key=r->>'masterKey'
      and c.clinical_order_type=r#>>'{detail,executionPreset,clinicalOrderType}'
      and c.detail_schema_version=(r#>>'{detail,executionPreset,detailSchemaVersion}')::integer) then
      raise exception 'complete candidate typed adoption mismatch: %',r->>'masterKey';
    end if;
  end loop;
  select md5(jsonb_agg(to_jsonb(c) order by id)::text) into before_retry from public.order_catalog_items c where workspace_id='clair-demo';
  perform private.clair_adopt_master_release_to_workspace('clair-demo',rid);
  if before_retry is distinct from (select md5(jsonb_agg(to_jsonb(c) order by id)::text) from public.order_catalog_items c where workspace_id='clair-demo') then raise exception 'complete retry catalog mutated'; end if;
  if foreign_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.id)::text,'[]')) from public.order_catalog_items c where workspace_id='clair-foreign-demo') then raise exception 'complete foreign catalog changed'; end if;
  if history_before is distinct from (select md5(coalesce(jsonb_agg(jsonb_build_object('id',o.id,'snapshot',o.confirmed_snapshot) order by o.id)::text,'[]')) from public.orders o where o.confirmed_snapshot is not null) then raise exception 'complete confirmed history changed'; end if;
  raise notice 'WP09 original522 reconciled to524 candidate orders: full publication/adoption/retries/typed rows/foreign catalog/confirmed history passed locally; activation/retirement not claimed';
end $complete$;
