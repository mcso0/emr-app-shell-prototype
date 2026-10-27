-- Isolated wrapper test: dependencies are explicit synthetic stubs.
create schema private;
create table public.orders(id uuid,workspace_id text,encounter_id uuid,origin_chart_id uuid);
create table public.test_mutations(key text primary key);
create table public.test_broadcasts(etag text);
insert into public.orders values('00000000-0000-4000-8000-000000000001','workspace-a','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
create function private.clair_require_order_chart(text,text,uuid,uuid,boolean) returns void language plpgsql as $$
begin if $2<>'00000000-0000-4000-8000-000000000004' then raise exception 'actor_mismatch'; end if; end $$;
create function public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text) returns jsonb language plpgsql as $$
begin insert into public.test_mutations values($8) on conflict do nothing;
return jsonb_build_object('action',$4,'orderId',$3,'revisionNo',2,'orderRevisionId','revision-2','confirmedSnapshotPreserved',true,'affectedTasks','[]'::jsonb,'billingImpact','{}'::jsonb,'order','{}'::jsonb); end $$;
create function private.clair_get_chart_order_billing_summary_internal(text,uuid) returns jsonb language plpgsql as $$
begin if current_setting('test.summary_failure',true)='true' then raise exception 'summary_unavailable'; end if;
return jsonb_build_object('workspaceId',$1,'encounterId',$2,'etag','summary-after-mutation','mutationCount',(select count(*) from public.test_mutations)); end $$;
create function private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text) returns void language sql as $$ insert into public.test_broadcasts values($3); $$;
-- WRAPPER
create function pg_temp.mutate(key text, workspace text default 'workspace-a', actor uuid default '00000000-0000-4000-8000-000000000004') returns jsonb language sql as $$
select public.clair_mutate_chart_order_execution_for_chart(workspace,actor,'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','re_request','synthetic regression',1,'{}',key); $$;
do $$ declare result jsonb; begin
result:=pg_temp.mutate('first');
if result->'billingSummary'->>'etag' is distinct from 'summary-after-mutation' then raise exception 'missing_authoritative_summary'; end if;
if (result->'billingSummary'->>'mutationCount')::int<>1 then raise exception 'summary_precedes_mutation'; end if;
perform pg_temp.mutate('first');
if (select count(*) from public.test_mutations)<>1 then raise exception 'duplicate_mutation'; end if;
if (select count(*) from public.test_broadcasts)<>2 then raise exception 'missing_broadcast'; end if;
begin perform pg_temp.mutate('foreign','workspace-b'); raise exception 'scope_not_checked'; exception when raise_exception then if sqlerrm<>'order_chart_mismatch' then raise; end if; end;
begin perform pg_temp.mutate('actor','workspace-a','00000000-0000-4000-8000-000000000005'); raise exception 'actor_not_checked'; exception when raise_exception then if sqlerrm<>'actor_mismatch' then raise; end if; end;
perform set_config('test.summary_failure','true',true);
begin perform pg_temp.mutate('must-rollback'); raise exception 'summary_failure_committed'; exception when raise_exception then if sqlerrm<>'summary_unavailable' then raise; end if; end;
if exists(select 1 from public.test_mutations where key<>'first') then raise exception 'failed_call_committed'; end if;
end $$;
