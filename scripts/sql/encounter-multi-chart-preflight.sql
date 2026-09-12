-- Read-only. Run immediately before and after the approved migration.
-- Compare hashes; added multi-chart metadata is deliberately excluded.
begin read only;
with records as (
  select workspace_id,'soap_notes' as relation,id::text as id,
    to_jsonb(s)-array['clinical_at','creation_request_id'] as body from public.soap_notes s
  union all select workspace_id,'soap_note_revisions',id::text,to_jsonb(r) from public.soap_note_revisions r
  union all select workspace_id,'orders',id::text,to_jsonb(o)-'origin_chart_id' from public.orders o
  union all select workspace_id,'diagnoses',id::text,to_jsonb(d)-'retired_at' from public.diagnoses d
  union all select workspace_id,'encounters',id::text,to_jsonb(e) from public.encounters e
)
select jsonb_build_object(
 'preservedRecords',(select jsonb_agg(f order by workspace_id,relation) from (
   select workspace_id,relation,count(*) as row_count,
     md5(string_agg(md5(body::text),',' order by id)) as preserved_fields_fingerprint
   from records group by workspace_id,relation
 ) f),
 'latestMigrations',(select jsonb_agg(m order by version desc) from (
   select version,name from supabase_migrations.schema_migrations order by version desc limit 5
 ) m),
 'soapIndexes',(select jsonb_agg(i order by indexname) from (
   select indexname,indexdef from pg_indexes where schemaname='public' and tablename='soap_notes'
 ) i),
 'newColumns',(select coalesce(jsonb_agg(c order by table_name,column_name),'[]'::jsonb) from (
   select table_name,column_name from information_schema.columns where table_schema='public'
   and (table_name,column_name) in (('soap_notes','clinical_at'),('soap_notes','creation_request_id'),
      ('orders','origin_chart_id'),('diagnoses','retired_at'))
 ) c)
) as preflight;
rollback;
