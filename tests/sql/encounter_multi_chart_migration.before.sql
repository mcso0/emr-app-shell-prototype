-- Synthetic schema-only rehearsal baseline; capture every existing note and linkage.
create temp table multi_chart_before_notes as select id,to_jsonb(n) row from public.soap_notes n;
create temp table multi_chart_before_revisions as select to_jsonb(r) row from public.soap_note_revisions r;
create temp table multi_chart_before_orders as select id,to_jsonb(o) row from public.orders o;
create temp table multi_chart_before_diagnoses as select id,to_jsonb(d) row from public.diagnoses d;
