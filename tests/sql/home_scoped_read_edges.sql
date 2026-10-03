-- Dedicated synthetic DB only; explicitly exercise every fulfillment state on
-- selected and prior days, plus billing's paid-before-refund precedence.
do $$begin if current_database()<>'item5_synthetic' then raise exception 'requires item5_synthetic'; end if; end$$;
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select md5('state-order-'||q||'-'||k)::uuid,'home-local-proof',md5('encounter-6003')::uuid,q,'Synthetic state order'
from unnest(array['lab','imaging','dispensing','treatment']) q cross join generate_series(1,12) k;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,
  requested_by_user_id,source_snapshot,created_at,updated_at,started_at,started_by_user_id,completed_at,cancelled_at,returned_at)
select md5('state-work-'||q||'-'||k)::uuid,'home-local-proof',md5('encounter-6003')::uuid,md5('state-order-'||q||'-'||k)::uuid,q,q,
  (array['requested','in_progress','paused','returned','completed','cancelled'])[1+(k-1)%6],
  '99500000-0000-4000-8000-000000000001',
  jsonb_build_object('billingName','State '||k,'patientName','  ','receptionType','invalid','reception_type','appointment','detail',jsonb_build_object('modality','MR','unusedHistoricalPayload',repeat('synthetic ',300))),
  case when k<=6 then '2026-10-02T15:00Z'::timestamptz else '2025-01-01Z'::timestamptz end,'2026-10-02T15:00Z',
  case when (k-1)%6 in (1,2,4) then '2026-10-02T15:00Z'::timestamptz end,
  case when (k-1)%6 in (1,2,4) then '99500000-0000-4000-8000-000000000001'::uuid end,
  case when (k-1)%6=4 then '2026-10-02T15:00Z'::timestamptz end,
  case when (k-1)%6=5 then '2026-10-02T15:00Z'::timestamptz end,
  case when (k-1)%6=3 then '2026-10-02T15:00Z'::timestamptz end
from unnest(array['lab','imaging','dispensing','treatment']) q cross join generate_series(1,12) k;
insert into public.invoices(id,workspace_id,encounter_id,invoice_no,status,payment_state,created_at,paid_at,voided_reason)
select md5('state-invoice-'||k)::uuid,'home-local-proof',md5('encounter-6003')::uuid,'SYN-STATE-'||k,
  (array['paid','voided','draft','refund_requested'])[k],(array['refunded','paid','refunded','none'])[k],
  '2024-01-01Z',case when k=2 then '2026-10-02T15:00Z'::timestamptz end,'Synthetic void reason'
from generate_series(1,4) k;
insert into public.invoice_lines(id,workspace_id,invoice_id,description,billing_candidate_id,created_at)
select md5('state-invoice-line-'||k)::uuid,'home-local-proof',md5('state-invoice-'||k)::uuid,'Synthetic state line',md5('state-candidate-'||k)::uuid,
  '2026-10-02T15:00Z' from generate_series(1,4) k;
-- Stress each *scoped* queue above the Data API's usual row cap. The scalar JSON
-- reader must still return every selected-day item when terminal flags are on.
insert into public.orders(id,workspace_id,encounter_id,order_type,display_name)
select md5('fulfillment-order-'||q||'-'||n)::uuid,'home-local-proof',md5('encounter-'||n)::uuid,q,'Synthetic cap order '||n
from unnest(array['lab','imaging','dispensing','treatment']) q cross join generate_series(6001,7200) n where n%3<>0;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,status,
  requested_by_user_id,source_snapshot,created_at,updated_at,started_at,started_by_user_id,completed_at,cancelled_at,returned_at)
select md5('fulfillment-'||q||'-'||n)::uuid,'home-local-proof',md5('encounter-'||n)::uuid,md5('fulfillment-order-'||q||'-'||n)::uuid,q,q,
  (array['requested','in_progress','paused','returned','completed','cancelled'])[1+n%6],
  '99500000-0000-4000-8000-000000000001',jsonb_build_object('orderDisplayName','Synthetic cap '||n,
    'detail',jsonb_build_object('modality','MR','unusedHistoricalPayload',repeat('synthetic ',300))),
  a.scheduled_start_at,a.scheduled_start_at,
  case when n%6 in (1,2,4) then a.scheduled_start_at end,
  case when n%6 in (1,2,4) then '99500000-0000-4000-8000-000000000001'::uuid end,
  case when n%6=4 then a.scheduled_start_at end,case when n%6=5 then a.scheduled_start_at end,
  case when n%6=3 then a.scheduled_start_at end
from unnest(array['lab','imaging','dispensing','treatment']) q cross join generate_series(6001,7200) n
join public.appointments a on a.id=md5('appointment-'||n)::uuid where n%3<>0;
analyze;
