-- Disposable local clone only; never run against a hosted project.
do $$begin if current_database() <> 'queue_patient_20261006' then raise exception 'local clone required'; end if; end$$;
alter table public.orders add column if not exists origin_chart_id uuid;
drop index if exists public.soap_notes_workspace_encounter_active_key;
insert into public.soap_notes(id,workspace_id,encounter_id,created_at) values
(md5('queue-origin-a')::uuid,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033','2026-10-02T01:00:00Z'),
(md5('queue-origin-b')::uuid,'fulfillment-queue-local-proof','99300000-0000-4000-8000-000000000033','2026-10-02T01:00:00Z'),
(md5('queue-origin-foreign')::uuid,'fulfillment-queue-foreign-proof','99300000-0000-4000-8000-000000000034','2026-10-01T01:00:00Z');
update public.orders set origin_chart_id=case
 when id in (md5('lab:1:order')::uuid,md5('lab:2:order')::uuid) then md5('queue-origin-a')::uuid
 when id=md5('lab:3:order')::uuid then md5('queue-origin-b')::uuid
 when id=md5('lab:4:order')::uuid then md5('queue-origin-foreign')::uuid
 when id=md5('lab:5:order')::uuid then md5('queue-origin-missing')::uuid end
where id in (select md5('lab:'||n||':order')::uuid from generate_series(1,5) n);
