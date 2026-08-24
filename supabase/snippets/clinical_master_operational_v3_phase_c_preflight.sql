-- PR-014 read-only remote preflight. This query only selects current
-- fingerprints; it contains no INSERT/UPDATE/DELETE/TRUNCATE/DDL and must be
-- run before supplying the exact values to a reviewed rollback/commit
-- candidate. This file intentionally contains no client-side variables.

select jsonb_build_object(
  'releaseCount', count(*)::integer,
  'maxReleaseNo', coalesce(max(release_no), 0),
  'latestSourceFingerprint', (
    select source_fingerprint
    from master.master_releases
    order by release_no desc
    limit 1
  )
) as release_baseline
from master.master_releases;

select jsonb_build_object(
  'name', 'master.master_releases_release_no_seq',
  'lastValue', last_value,
  'isCalled', is_called,
  'nextReleaseNo', case when is_called then last_value + 1 else last_value end
) as release_no_sequence_baseline
from master.master_releases_release_no_seq;

select jsonb_object_agg(record_type, row_count order by record_type) as master_record_type_counts
from (
  select record_type, count(*)::integer as row_count
  from master.master_records
  where record_type in (
    'order_category','clinical_action','chart_group','task_route','order',
    'species','unit','specimen_type','result_input_type','lab_test','lab_panel'
  )
  group by record_type
) counts;

select
  count(*)::integer as lab_publish_stage_count,
  encode(
    extensions.digest(
      convert_to(
        coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) as lab_publish_stage_fingerprint
from private.clinical_master_lab_publish_stage stage;

with target(workspace_id) as (
  values
    ('workspace-clinical-master-pilot-v1'),
    ('workspace-clair-cheongdam'),
    ('clair-demo'),
    ('clair-foreign-demo')
), catalog as (
  select
    item.workspace_id,
    count(*)::integer as row_count,
    encode(
      extensions.digest(
        convert_to(
          coalesce(jsonb_agg(to_jsonb(item) order by item.id),'[]'::jsonb)::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as fingerprint
  from public.order_catalog_items item
  where item.workspace_id in (
    'workspace-clinical-master-pilot-v1',
    'workspace-clair-cheongdam',
    'clair-demo',
    'clair-foreign-demo'
  )
  group by item.workspace_id
)
select
  target.workspace_id,
  coalesce(catalog.row_count,0) as catalog_row_count,
  coalesce(
    catalog.fingerprint,
    encode(
      extensions.digest(convert_to('[]','UTF8'),'sha256'),
      'hex'
    )
  ) as catalog_fingerprint
from target
left join catalog using (workspace_id)
order by target.workspace_id;
