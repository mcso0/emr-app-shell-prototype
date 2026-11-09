-- Render clinical change labels from the order field schema when reading the
-- review. Historical snapshots keep their saved text and acknowledgement keys.
begin;
set local lock_timeout = '5s';

create function private.clair_localize_task_instruction_changes(p_task public.order_tasks, p_document jsonb)
returns jsonb language sql stable set search_path = '' as $function$
  select coalesce(jsonb_set(p_document, '{entries}', (
    select jsonb_agg(case when revision.revision is null then entry else
      jsonb_set(entry, '{instruction}', to_jsonb(
        coalesce(changes.description, '요청 조제량 또는 조제량 입력 방식 변경') || E'\n사유: ' || revision.reason
      )) end order by position)
    from jsonb_array_elements(p_document->'entries') with ordinality entries(entry, position)
    left join private.order_clinical_edit_revisions revision
      on entry->>'kind' = 'clinical_edit' and entry->>'orderId' = p_task.order_id::text
      and revision.workspace_id = p_task.workspace_id and revision.order_id = p_task.order_id
      and revision.revision::text = entry->>'revision'
    left join lateral (
      select string_agg(
        coalesce(field->>'label', legacy.label, '기타 업무 항목') || ': ' ||
        coalesce(before_input.value#>>'{}', '—') || ' → ' || coalesce(after_input.value#>>'{}', '—'),
        E'\n' order by key
      ) as description
      from jsonb_each(coalesce(revision.before_values->'detailInputs', '{}')) before_input
      full join jsonb_each(coalesce(revision.after_values->'detailInputs', '{}')) after_input using (key)
      left join jsonb_array_elements(private.clair_order_detail_field_schema(
        p_task.clinical_order_type, coalesce(
          (revision.after_values->>'detailSchemaVersion')::integer,
          (revision.before_values->>'detailSchemaVersion')::integer,
          (p_task.effective_snapshot->>'detailSchemaVersion')::integer,
          1
        )
      )->'fields') fields(field) on field->>'key' = key
      left join (values ('instruction', '지시'), ('memo', '메모'), ('administrationTiming', '복용 시점'),
        ('administeredUnit', '투여 단위'), ('totalOccurrences', '총 시행 횟수'),
        ('maximumAuthorizedCount', '최대 허용 횟수')) legacy(field_key, label) on legacy.field_key = key
      where before_input.value is distinct from after_input.value
    ) changes on revision.revision is not null
  )), p_document);
$function$;
revoke all on function private.clair_localize_task_instruction_changes(public.order_tasks,jsonb)
  from public, anon, authenticated, service_role;

do $patch$
declare
  definition text := pg_get_functiondef('public.clair_get_task_instruction_review(text,uuid)'::regprocedure);
  anchor text := $old$'current',d,'previous',previous,'snapshots',history,$old$;
  replacement text := $new$
   'current',private.clair_localize_task_instruction_changes(t,d),
   'previous',private.clair_localize_task_instruction_changes(t,previous),
   'snapshots',(
     select coalesce(jsonb_agg(jsonb_set(snapshot,'{document}',
       private.clair_localize_task_instruction_changes(t,snapshot->'document')
     ) order by position),'[]'::jsonb)
     from jsonb_array_elements(history) with ordinality snapshots(snapshot,position)
   ),$new$;
begin
  if (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 then
    raise exception 'task_instruction_review_label_projection_anchor';
  end if;
  execute replace(definition, anchor, replacement);
end $patch$;

commit;
