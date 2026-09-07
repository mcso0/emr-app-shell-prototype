-- WP-01B: lineage is copied from the exact workspace catalog row, never latest master.
-- Additive JSON transport only; old confirmed snapshots are not rewritten.
set lock_timeout = '5s';
set statement_timeout = '120s';
do $patch$
declare d text; anchor text := '''clinicalOrderType'', catalog.clinical_order_type,';
begin
  d := pg_get_functiondef('public.clair_list_order_catalog_chart_search_v2(text)'::regprocedure);
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'catalog_lineage_search_anchor_missing';
  end if;
  execute replace(d, anchor, anchor || E'\n        ''workspaceId'', catalog.workspace_id,\n        ''sourceMasterRecordId'', catalog.source_master_record_id,\n        ''sourceMasterRevision'', catalog.source_master_revision,\n        ''workspaceCatalogRevision'', catalog.catalog_revision,');
end;
$patch$;

alter function private.clair_build_catalog_order_snapshot(text,text,numeric)
  rename to clair_build_catalog_order_snapshot_before_read_lineage;
create function private.clair_build_catalog_order_snapshot(p_workspace_id text,p_catalog_item_id text,p_quantity numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_base jsonb; c public.order_catalog_items%rowtype;
begin
  v_base := private.clair_build_catalog_order_snapshot_before_read_lineage(p_workspace_id,p_catalog_item_id,p_quantity);
  select * into strict c from public.order_catalog_items
    where workspace_id=p_workspace_id and id=p_catalog_item_id;
  return v_base || jsonb_build_object('workspaceId',c.workspace_id,
    'sourceMasterRecordId',c.source_master_record_id,'sourceMasterRevision',c.source_master_revision,
    'workspaceCatalogRevision',c.catalog_revision);
end;
$fn$;
revoke all on function private.clair_build_catalog_order_snapshot_before_read_lineage(text,text,numeric),
  private.clair_build_catalog_order_snapshot(text,text,numeric) from public,anon,authenticated,service_role;
