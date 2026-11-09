-- Let 담당하기 reopen released work with one assignment command.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $patch$
declare
  definition text:=pg_get_functiondef('public.clair_mutate_fulfillment_instruction(text,uuid,jsonb)'::regprocedure);
  old text:=$old$ if start_on_assignment and (jsonb_array_length(doc->'items')=0
   or exists(select 1 from jsonb_array_elements(doc->'items') x where x->>'status'<>'requested')) then
   raise exception 'invalid_transition'; end if;$old$;
  replacement text:=$new$ if start_on_assignment and (jsonb_array_length(doc->'items')=0
   or (exists(select 1 from jsonb_array_elements(doc->'items') x where x->>'status'<>'requested')
     and (action<>'claim'
       or not exists(select 1 from jsonb_array_elements(doc->'items') x where x->>'status'='paused')
       or exists(select 1 from jsonb_array_elements(doc->'items') x
         where x->>'status' not in ('completed','cancelled','returned')
           and (x->>'status' not in ('requested','paused') or x->>'assigneeId' is not null))))) then
   raise exception 'invalid_transition'; end if;$new$;
begin
  if (length(definition)-length(replace(definition,old,'')))/length(old)<>1 then
    raise exception 'fulfillment_reassign_waiting_work patch drift';
  end if;
  execute replace(definition,old,replacement);
end $patch$;

commit;
