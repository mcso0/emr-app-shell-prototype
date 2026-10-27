-- Read names from canonical confirmation snapshots; preserve existing access rules.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $patch$
declare
  definition text;
  item_anchor text := $anchor$'name',coalesce(w.source_snapshot->>'orderDisplayName','')$anchor$;
  root_anchor text := $anchor$'name',coalesce(root.effective_snapshot->>'orderDisplayName',root.effective_snapshot->>'name','오더')$anchor$;
begin
  definition := pg_get_functiondef('public.clair_get_fulfillment_instruction(text,uuid)'::regprocedure);
  if (length(definition)-length(replace(definition,item_anchor,'')))/length(item_anchor) <> 1
    or (length(definition)-length(replace(definition,root_anchor,'')))/length(root_anchor) <> 1 then
    raise exception 'instruction_display_name_anchor';
  end if;
  definition := replace(definition,item_anchor,$replacement$'name',coalesce(
    nullif(btrim(w.source_snapshot->>'displayName'),''),
    nullif(btrim(child.effective_snapshot->>'displayName'),''),
    nullif(btrim(w.source_snapshot->>'orderDisplayName'),''),
    nullif(btrim(child.effective_snapshot->>'orderDisplayName'),''),
    nullif(btrim(w.source_snapshot->>'name'),''),'오더')$replacement$);
  definition := replace(definition,root_anchor,$replacement$'name',coalesce(
    nullif(btrim(root.effective_snapshot->>'displayName'),''),
    nullif(btrim(root.effective_snapshot->>'orderDisplayName'),''),
    nullif(btrim(root.effective_snapshot->>'name'),''),'오더')$replacement$);
  execute definition;
end $patch$;

commit;
