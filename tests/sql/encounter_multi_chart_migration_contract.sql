\set ON_ERROR_STOP on
begin;
do $preservation$
begin
 if (select count(*) from public.soap_notes)<>(select count(*) from multi_chart_before_notes)
 or exists(select 1 from public.soap_notes n join multi_chart_before_notes b using(id)
   where to_jsonb(n)-'clinical_at'-'creation_request_id' is distinct from b.row
     or n.clinical_at is distinct from n.created_at or n.creation_request_id is not null)
 then raise exception 'legacy_notes_changed_or_fabricated'; end if;
 if exists((select to_jsonb(r) from public.soap_note_revisions r except select row from multi_chart_before_revisions)
   union all (select row from multi_chart_before_revisions except select to_jsonb(r) from public.soap_note_revisions r)) then raise exception 'legacy_revisions_changed'; end if;
 if (select count(*) from public.orders)<>(select count(*) from multi_chart_before_orders)
 or exists(select 1 from public.orders o join multi_chart_before_orders b using(id)
   where to_jsonb(o)-'origin_chart_id' is distinct from b.row or o.origin_chart_id is not null)
 then raise exception 'legacy_orders_reassigned_or_changed'; end if;
 if (select count(*) from public.diagnoses)<>(select count(*) from multi_chart_before_diagnoses)
 or exists(select 1 from public.diagnoses d join multi_chart_before_diagnoses b using(id)
   where to_jsonb(d)-'retired_at' is distinct from b.row or d.retired_at is not null)
 then raise exception 'legacy_diagnoses_changed'; end if;
end $preservation$;
select 'PASS encounter_multi_chart_migration_contract';
rollback;
