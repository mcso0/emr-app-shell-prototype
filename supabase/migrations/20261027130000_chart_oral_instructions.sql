-- Local candidate: chart-scoped oral instructions, append-only revisions and
-- request/completion evidence. Existing order instructions are never rewritten.
begin;
set local lock_timeout = '5s';
create table private.chart_oral_instruction_revisions (
  workspace_id text not null,
  chart_id uuid not null references public.soap_notes(id),
  revision integer not null check (revision > 0),
  instruction text not null check (length(instruction) <= 5000),
  actor_id uuid not null references public.users(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, chart_id, revision)
);
create table private.task_oral_instruction_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  task_id uuid not null references public.order_tasks(id),
  phase text not null check (phase in ('requested','completed')),
  chart_id uuid not null references public.soap_notes(id),
  revision integer not null,
  instruction text not null,
  captured_at timestamptz not null default clock_timestamp()
);
create unique index task_oral_instruction_request_once on private.task_oral_instruction_snapshots(workspace_id,task_id) where phase='requested';
revoke all on private.chart_oral_instruction_revisions, private.task_oral_instruction_snapshots from public, anon, authenticated, service_role;

create function private.clair_chart_oral_instruction(p_workspace_id text, p_chart_id uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('chartId',p_chart_id,'revision',coalesce(max(r.revision),0),
   'instruction',coalesce((array_agg(r.instruction order by r.revision desc))[1],''),
   'history',coalesce(jsonb_agg(jsonb_build_object('revision',r.revision,'instruction',r.instruction,
     'actorId',r.actor_id,'actorName',(select u.display_name from public.users u where u.id=r.actor_id),'createdAt',r.created_at) order by r.revision desc),'[]'::jsonb))
 from private.chart_oral_instruction_revisions r where r.workspace_id=p_workspace_id and r.chart_id=p_chart_id;
$$;
revoke all on function private.clair_chart_oral_instruction(text,uuid) from public,anon,authenticated,service_role;

create function public.clair_get_chart_oral_instruction(p_workspace_id text,p_chart_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.soap_notes;
begin
 if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
   or not private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:view') then
   raise exception 'permission_missing' using errcode='42501'; end if;
 select * into n from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id and status<>'voided';
 if not found then raise exception 'chart_unavailable'; end if;
 perform private.clair_require_chart_encounter(p_workspace_id,n.encounter_id,auth.uid()::text,false);
 return private.clair_chart_oral_instruction(p_workspace_id,p_chart_id) || jsonb_build_object('canEdit',
   n.status in ('draft','autosaved') and private.clair_current_user_has_workspace_permission(p_workspace_id,'chart:update'));
end $$;

create function public.clair_save_chart_oral_instruction(p_workspace_id text,p_chart_id uuid,p_expected_revision integer,p_instruction text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; n public.soap_notes;
begin
 d:=public.clair_get_chart_oral_instruction(p_workspace_id,p_chart_id);
 if not coalesce((d->>'canEdit')::boolean,false) then raise exception 'permission_missing' using errcode='42501'; end if;
 if p_instruction is null or length(p_instruction)>5000 or p_expected_revision is null then raise exception 'invalid_input'; end if;
 select * into n from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id;
 perform private.clair_require_chart_encounter(p_workspace_id,n.encounter_id,auth.uid()::text,true);
 -- Lock queue rows before the chart, matching fulfillment writes that lock work
 -- before capturing completion evidence. This avoids a chart/queue lock inversion.
 perform wi.id from public.order_fulfillment_work_items wi
 where wi.workspace_id=p_workspace_id and wi.queue_type='dispensing' and exists (
   select 1 from public.orders o where o.workspace_id=p_workspace_id and o.origin_chart_id=p_chart_id
     and coalesce(o.detail_inputs->>'route',o.detail_inputs->>'administrationRoute')='PO'
     and (o.id=wi.order_id or o.parent_chart_order_line_id=wi.order_id))
 order by wi.id for update;
 -- Serialize instruction edits and task evidence against this exact chart.
 select * into n from public.soap_notes where workspace_id=p_workspace_id and id=p_chart_id for update;
 if n.status not in ('draft','autosaved') then raise exception 'signed_chart_read_only'; end if;
 d:=private.clair_chart_oral_instruction(p_workspace_id,p_chart_id);
 if (d->>'revision')::integer is distinct from p_expected_revision then raise exception 'revision_conflict'; end if;
 if d->>'instruction' is distinct from p_instruction then
   insert into private.chart_oral_instruction_revisions(workspace_id,chart_id,revision,instruction,actor_id)
   values(p_workspace_id,p_chart_id,p_expected_revision+1,p_instruction,auth.uid());
   -- Existing queue invalidation wakes other open clients without changing work status.
   update public.order_fulfillment_work_items wi set row_revision=wi.row_revision+1,updated_at=clock_timestamp()
   where wi.workspace_id=p_workspace_id and wi.queue_type='dispensing' and exists (
     select 1 from public.orders o where o.workspace_id=p_workspace_id and o.origin_chart_id=p_chart_id
       and coalesce(o.detail_inputs->>'route',o.detail_inputs->>'administrationRoute')='PO'
       and (o.id=wi.order_id or o.parent_chart_order_line_id=wi.order_id));
 end if;
 return public.clair_get_chart_oral_instruction(p_workspace_id,p_chart_id);
end $$;
revoke all on function public.clair_get_chart_oral_instruction(text,uuid),public.clair_save_chart_oral_instruction(text,uuid,integer,text) from public,anon,service_role;
grant execute on function public.clair_get_chart_oral_instruction(text,uuid),public.clair_save_chart_oral_instruction(text,uuid,integer,text) to authenticated;

create function private.clair_capture_task_oral_instruction()
returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; d jsonb; phase text;
begin
 if new.task_role='aggregate' or new.destination_module<>'dispensing' then return new; end if;
 select * into o from public.orders where workspace_id=new.workspace_id and id=new.order_id;
 if o.origin_chart_id is null or coalesce(new.effective_snapshot#>>'{detailInputs,route}',
   new.effective_snapshot#>>'{detailInputs,administrationRoute}',o.detail_inputs->>'route',o.detail_inputs->>'administrationRoute','')<>'PO' then return new; end if;
 phase:=case when TG_OP='INSERT' then 'requested' when new.status='complete' and old.status is distinct from new.status then 'completed' end;
 if phase is null then return new; end if;
 perform 1 from public.soap_notes where workspace_id=new.workspace_id and id=o.origin_chart_id for update;
 d:=private.clair_chart_oral_instruction(new.workspace_id,o.origin_chart_id);
 insert into private.task_oral_instruction_snapshots(workspace_id,task_id,phase,chart_id,revision,instruction)
 values(new.workspace_id,new.id,phase,o.origin_chart_id,(d->>'revision')::integer,d->>'instruction')
 on conflict do nothing; -- Each completion appends evidence; a request is captured once.
 return new;
end $$;
revoke all on function private.clair_capture_task_oral_instruction() from public,anon,authenticated,service_role;
create trigger capture_task_oral_instruction after insert or update of status on public.order_tasks
 for each row execute function private.clair_capture_task_oral_instruction();

-- Extend the authorized document read; do not expose a new unguarded read path.
do $patch$
declare d text; anchor text:=$a$'instruction',coalesce(root_order.instruction,''),'finalized',finalized,$a$;
begin
 d:=pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'oral_instruction_reader_anchor'; end if;
 d:=replace(d,anchor,$r$'instruction',coalesce(root_order.instruction,''),'finalized',finalized,
 'oralInstruction',case when wi.queue_type='dispensing' and root_order.origin_chart_id is not null
   and exists(select 1 from jsonb_array_elements(items) i where coalesce(i#>>'{plan,detailInputs,route}',
     i#>>'{plan,detailInputs,administrationRoute}',i#>>'{sourceSnapshot,detailInputs,route}',i#>>'{sourceSnapshot,detailInputs,administrationRoute}')='PO')
 then private.clair_chart_oral_instruction(p_workspace_id,root_order.origin_chart_id) || jsonb_build_object('snapshots',
   coalesce((select jsonb_agg(jsonb_build_object('taskId',s.task_id,'phase',s.phase,'revision',s.revision,
     'instruction',s.instruction,'capturedAt',s.captured_at,'orderName',oral_snapshot_order.display_name,'attemptNo',oral_snapshot_task.attempt_no) order by s.captured_at)
     from private.task_oral_instruction_snapshots s
     join public.order_tasks oral_snapshot_task on oral_snapshot_task.workspace_id=s.workspace_id and oral_snapshot_task.id=s.task_id
     join public.orders oral_snapshot_order on oral_snapshot_order.workspace_id=oral_snapshot_task.workspace_id and oral_snapshot_order.id=oral_snapshot_task.order_id
     where s.workspace_id=p_workspace_id
       and oral_snapshot_task.order_id in (select (i->>'orderId')::uuid from jsonb_array_elements(items) i)),'[]'::jsonb)) else null end,$r$);
 execute d;
end $patch$;
commit;
