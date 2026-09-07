-- Compare result AND SQLSTATE/message, not merely truthiness. SQL NULL differs
-- from JSON null and absent keys. This deliberately preserves legacy errors.
do $test$
declare
  v jsonb; policies jsonb; key text; kind text; version integer; schema_doc jsonb;
  old_value jsonb; new_value jsonb; old_error text; new_error text;
  cells integer:=0; schemas integer:=0;
begin
  if exists(select 1 from scalar_test_metadata m join pg_proc p on p.oid=m.oid
    where m.metadata is distinct from to_jsonb(p)-array['prosrc','prolang']) then
    raise exception 'scalar_test_metadata_changed'; end if;
  foreach v in array array[null::jsonb,'null','{}','[]','"key"','1','true',
    '{"key":null}','{"key":false}','{"key":0}','{"key":""}',
    '{"key":[1,null]}','{"key":{"nested":"한글"}}'] loop
    foreach policies in array array[null::jsonb,'null','{}','[]','"key"',
      '{"key":null}','{"key":"workspace"}','{"key":{"source":"master"}}'] loop
      foreach key in array array[null::text,'key','missing',''] loop
        old_error:=null; new_error:=null; old_value:=null; new_value:=null;
        begin old_value:=pg_temp.original_clair_execution_field_cell(v,policies,key);
        exception when others then old_error:=sqlstate||':'||sqlerrm; end;
        begin new_value:=private.clair_execution_field_cell(v,policies,key);
        exception when others then new_error:=sqlstate||':'||sqlerrm; end;
        if old_value is distinct from new_value or old_error is distinct from new_error then
          raise exception 'scalar_cell_differential_mismatch case %',cells; end if;
        cells:=cells+1;
      end loop;
    end loop;
  end loop;
  foreach kind in array array[null::text,'lab','dispensing','treatment','imaging','consultation','vaccine','surgery','hospitalization','invalid',''] loop
    foreach version in array array[null::integer,0,1,2] loop
      for schema_doc in
        select x from unnest(array[null::jsonb,'null','{}','[]','1','true','"schema"',
          '{"clinicalOrderType":"lab","version":1,"fields":[]}',
          '{"clinicalOrderType":"lab","version":"bad","fields":[{}]}',
          '{"clinicalOrderType":"lab","version":2147483648,"fields":[{}]}',
          '{"clinicalOrderType":"lab","version":1,"fields":{}}',
          '{"clinicalOrderType":"lab","version":1,"fields":null}',
          '{"clinicalOrderType":"lab","version":1,"fields":[{},null,1]}']) x
        union all select private.clair_order_detail_field_schema_v1(t)
          from unnest(array['lab','dispensing','treatment','imaging','consultation','vaccine','surgery','hospitalization']) t
        union all select private.clair_order_detail_field_schema('treatment',2)
        union all select private.clair_order_detail_field_schema('treatment',2)||'{"label":"changed"}'::jsonb
        union all select jsonb_set(private.clair_order_detail_field_schema('treatment',2),'{fields,0,required}','null')
        union all select jsonb_set(private.clair_order_detail_field_schema('treatment',2),'{fields,0}',
          (private.clair_order_detail_field_schema('treatment',2)#>'{fields,0}')-'key')
      loop
        old_error:=null; new_error:=null; old_value:=null; new_value:=null;
        begin old_value:=to_jsonb(pg_temp.original_clair_order_field_schema_is_valid(kind,version,schema_doc));
        exception when others then old_error:=sqlstate||':'||sqlerrm; end;
        begin new_value:=to_jsonb(private.clair_order_field_schema_is_valid(kind,version,schema_doc));
        exception when others then new_error:=sqlstate||':'||sqlerrm; end;
        if old_value is distinct from new_value or old_error is distinct from new_error then
          raise exception 'scalar_schema_differential_mismatch case %, old %, new %',schemas,old_error,new_error; end if;
        schemas:=schemas+1;
      end loop;
    end loop;
  end loop;
  raise notice 'PASS scalar differential: % field cells, % schema cases, unchanged metadata/ACL/owner',cells,schemas;
end $test$;
