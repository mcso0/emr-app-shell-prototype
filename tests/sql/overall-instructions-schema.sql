-- Minimal chart dependencies; actual overall/oral/transition functions are loaded.
create table public.soap_notes(id uuid primary key,workspace_id text,encounter_id uuid,status text);
alter table public.orders add column origin_chart_id uuid,add column display_name text;
-- Chart result validation/context dependencies are unrelated to acknowledgement.
create function private.clair_chart_actual_payload_valid(text,jsonb) returns boolean language sql as $$select jsonb_typeof($2)='object'$$;
create function public.clair_get_chart_actual_context(text,uuid) returns jsonb language sql as $$select jsonb_build_object('taskId',$2,'status',status) from public.order_tasks where workspace_id=$1 and id=$2$$;

-- Unchanged queue list projection; the assertions inspect persisted rows directly.
create function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text) returns jsonb language sql as $$select '[]'::jsonb$$;

alter table public.order_fulfillment_work_items add column due_at timestamptz;
