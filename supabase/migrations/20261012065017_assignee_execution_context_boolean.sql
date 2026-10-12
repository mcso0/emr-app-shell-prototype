-- Preserve the owner boundary while making unassigned read capability boolean.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $patch$
declare d text; old text; new text;
begin
 d:=pg_get_functiondef('public.clair_get_order_execution_context(text,uuid,uuid)'::regprocedure);
 old:='and wi.assigned_to_user_id=auth.uid() and private.clair_current_user_has_workspace_permission';
 new:='and coalesce(wi.assigned_to_user_id=auth.uid(),false) and private.clair_current_user_has_workspace_permission';
 if strpos(d,new)=0 then
  if (length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'execution_owner_boolean_anchor_mismatch'; end if;
  execute replace(d,old,new);
 end if;
end $patch$;
commit;
