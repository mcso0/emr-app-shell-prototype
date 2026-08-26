\set ON_ERROR_STOP on

begin;

\ir ../migrations/20260826150000_clinical_master_dispensing_order_foundation.sql
\ir ../migrations/20260826151000_clinical_master_dispensing_order_publish_adopt.sql

create temporary table pr017_payload (
  payload jsonb not null
) on commit drop;

\copy pr017_payload(payload) from program 'tr -d ''\n'' < /workspace/docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json' with (format text, delimiter E'\x01')

do $publisher_negative_assertions$
declare
  v_payload jsonb;
  v_actor_id uuid;
  v_sqlstate text;
begin
  select payload into strict v_payload from pr017_payload;
  select id into strict v_actor_id from public.users order by id limit 1;

  begin
    perform private.publish_clinical_master_dispensing_release(
      v_payload - 'regulatoryProfiles',
      v_actor_id
    );
    raise exception 'clinical_master_dispensing_missing_key_accepted';
  exception when sqlstate '22023' then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate <> '22023' then
      raise;
    end if;
  end;

  begin
    perform private.publish_clinical_master_dispensing_release(v_payload, null);
    raise exception 'clinical_master_dispensing_null_publish_actor_accepted';
  exception when sqlstate '42501' then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate <> '42501' then
      raise;
    end if;
  end;

  v_payload := pg_catalog.jsonb_set(
    v_payload,
    '{dispensingProfiles,0,koreanTranslationReviewStatus}',
    '"approved"'::jsonb
  );
  v_payload := pg_catalog.jsonb_set(
    v_payload,
    '{payloadSha256}',
    pg_catalog.to_jsonb(
      private.clair_dispensing_payload_sha256(v_payload - 'payloadSha256')
    )
  );
  begin
    perform private.publish_clinical_master_dispensing_release(v_payload, v_actor_id);
    raise exception 'clinical_master_dispensing_early_review_state_accepted';
  exception when sqlstate '22023' then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate <> '22023' then
      raise;
    end if;
  end;
end;
$publisher_negative_assertions$;

create temporary table pr017_publish_result on commit drop as
select private.publish_clinical_master_dispensing_release(
  (select payload from pr017_payload),
  (select id from public.users order by id limit 1)
) as result;

do $publish_assertions$
declare
  v_result jsonb;
  v_release_id uuid;
begin
  select result into strict v_result from pr017_publish_result;
  v_release_id := (v_result->>'releaseId')::uuid;

  if coalesce((v_result->>'idempotent')::boolean, true)
    or coalesce((v_result->>'clinicalUseAllowed')::boolean, true)
    or (v_result->>'recordCount')::integer <> 108
    or (select record_count from master.master_releases where id = v_release_id) <> 116
    or (select count(*) from private.clinical_master_release_payload_owner_manifest
        where release_id = v_release_id) <> 116
    or (select count(*) from master.dispensing_order_profiles
        where source_release_id = v_release_id) <> 108
    or (select count(*) from master.medication_products
        where source_release_id = v_release_id) <> 108
    or (select count(*) from master.medication_ingredients
        where source_release_id = v_release_id) <> 79
    or (select count(*) from master.medication_product_ingredients
        where source_release_id = v_release_id) <> 132
    or (select count(*) from master.medication_species_applicability
        where source_release_id = v_release_id) <> 150
    or (select count(*) from master.evidence_assertions
        where source_release_id = v_release_id) <> 648
    or (select count(*) from master.clinical_reviews
        where source_release_id = v_release_id and decision = 'pending') <> 108
    or (select count(*) from master.medication_regulatory_profiles
        where source_release_id = v_release_id and review_status = 'pending') <> 108
    or exists (
      select 1
      from master.dispensing_order_profiles profile
      where profile.source_release_id = v_release_id
        and master.clair_dispensing_profile_clinical_use_allowed(
          profile.id,
          profile.profile_revision
        )
    ) then
    raise exception 'clinical_master_dispensing_publish_replay_assertion_failed';
  end if;
end;
$publish_assertions$;

create temporary table pr017_publish_retry_result on commit drop as
select private.publish_clinical_master_dispensing_release(
  (select payload from pr017_payload),
  (select id from public.users order by id limit 1)
) as result;

do $publish_retry_assertions$
declare
  v_first jsonb;
  v_retry jsonb;
  v_release_id uuid;
begin
  select result into strict v_first from pr017_publish_result;
  select result into strict v_retry from pr017_publish_retry_result;
  v_release_id := (v_first->>'releaseId')::uuid;
  if not coalesce((v_retry->>'idempotent')::boolean, false)
    or v_retry->>'releaseId' is distinct from v_first->>'releaseId'
    or v_retry->>'payloadSha256' is distinct from v_first->>'payloadSha256'
    or (select count(*) from master.dispensing_order_profiles
        where source_release_id = v_release_id) <> 108 then
    raise exception 'clinical_master_dispensing_publish_retry_not_idempotent';
  end if;
end;
$publish_retry_assertions$;

create temporary table pr017_foreign_baseline on commit drop as
select
  count(*)::integer as row_count,
  private.clinical_master_sha256(
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', catalog.id,
          'sourceMasterRecordId', catalog.source_master_record_id,
          'sourceMasterRevision', catalog.source_master_revision,
          'catalogRevision', catalog.catalog_revision,
          'availabilityStatus', catalog.availability_status,
          'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
          'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
        ) order by catalog.id
      ),
      '[]'::jsonb
    )
  ) as fingerprint
from public.order_catalog_items catalog
where catalog.workspace_id = 'clair-foreign-demo';

do $approval_scope_assertion$
declare
  v_release_id uuid;
  v_sqlstate text;
begin
  select (result->>'releaseId')::uuid into strict v_release_id
  from pr017_publish_result;
  begin
    perform private.adopt_clinical_master_dispensing_release(
      'clair-demo',
      v_release_id,
      (select id from public.users order by id limit 1),
      array['clair-foreign-demo']
    );
    raise exception 'expected approval scope rejection';
  exception when sqlstate '42501' then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate <> '42501' then
      raise;
    end if;
  end;
end;
$approval_scope_assertion$;

create temporary table pr017_adopt_result on commit drop as
select private.adopt_clinical_master_dispensing_release(
  'clair-demo',
  (select (result->>'releaseId')::uuid from pr017_publish_result),
  (select id from public.users order by id limit 1),
  array['clair-demo']
) as result;

create temporary table pr017_first_adoption_state on commit drop as
select
  count(*)::integer as row_count,
  private.clinical_master_sha256(
    jsonb_agg(
      jsonb_build_object(
        'id', catalog.id,
        'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
        'sourceDispensingProfileRevision', catalog.source_dispensing_profile_revision,
        'catalogRevision', catalog.catalog_revision,
        'availabilityStatus', catalog.availability_status,
        'clinicalUseAllowed', catalog.clinical_use_allowed,
        'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
      ) order by catalog.id
    )
  ) as fingerprint
from public.order_catalog_items catalog
join master.dispensing_order_profiles profile
  on profile.id = catalog.source_dispensing_profile_id
 and profile.profile_revision = catalog.source_dispensing_profile_revision
where catalog.workspace_id = 'clair-demo'
  and profile.source_release_id = (
    select (result->>'releaseId')::uuid from pr017_publish_result
  );

create temporary table pr017_adopt_retry_result on commit drop as
select private.adopt_clinical_master_dispensing_release(
  'clair-demo',
  (select (result->>'releaseId')::uuid from pr017_publish_result),
  (select id from public.users order by id limit 1),
  array['clair-demo']
) as result;

do $adoption_assertions$
declare
  v_release_id uuid;
  v_adopt_result jsonb;
  v_adopt_retry_result jsonb;
  v_first_count integer;
  v_first_fingerprint text;
  v_retry_count integer;
  v_retry_fingerprint text;
  v_foreign_count integer;
  v_foreign_fingerprint text;
  v_sqlstate text;
begin
  select (result->>'releaseId')::uuid into strict v_release_id
  from pr017_publish_result;
  select result into strict v_adopt_result from pr017_adopt_result;
  select result into strict v_adopt_retry_result from pr017_adopt_retry_result;
  select row_count, fingerprint into strict v_first_count, v_first_fingerprint
  from pr017_first_adoption_state;
  select
    count(*)::integer,
    private.clinical_master_sha256(
      jsonb_agg(
        jsonb_build_object(
          'id', catalog.id,
          'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
          'sourceDispensingProfileRevision', catalog.source_dispensing_profile_revision,
          'catalogRevision', catalog.catalog_revision,
          'availabilityStatus', catalog.availability_status,
          'clinicalUseAllowed', catalog.clinical_use_allowed,
          'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
        ) order by catalog.id
      )
    )
  into v_retry_count, v_retry_fingerprint
  from public.order_catalog_items catalog
  join master.dispensing_order_profiles profile
    on profile.id = catalog.source_dispensing_profile_id
   and profile.profile_revision = catalog.source_dispensing_profile_revision
  where catalog.workspace_id = 'clair-demo'
    and profile.source_release_id = v_release_id;

  select count(*)::integer,
    private.clinical_master_sha256(
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', catalog.id,
            'sourceMasterRecordId', catalog.source_master_record_id,
            'sourceMasterRevision', catalog.source_master_revision,
            'catalogRevision', catalog.catalog_revision,
            'availabilityStatus', catalog.availability_status,
            'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
            'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
          ) order by catalog.id
        ),
        '[]'::jsonb
      )
    )
  into v_foreign_count, v_foreign_fingerprint
  from public.order_catalog_items catalog
  where catalog.workspace_id = 'clair-foreign-demo';

  if (v_adopt_result->>'dispensingProfileCount')::integer <> 108
    or coalesce((v_adopt_result->>'clinicalUseAllowedCount')::integer, -1) <> 0
    or v_adopt_result->>'availabilityStatus' <> 'pending_activation'
    or v_adopt_retry_result->>'adoptionEventId'
      is distinct from v_adopt_result->>'adoptionEventId'
    or (select count(*) from private.clinical_master_dispensing_adoption_events
        where workspace_id = 'clair-demo' and release_id = v_release_id) <> 1
    or (select actor_user_id from private.clinical_master_dispensing_adoption_events
        where workspace_id = 'clair-demo' and release_id = v_release_id)
      is distinct from (select id from public.users order by id limit 1)
    or v_first_count <> 108
    or v_retry_count <> 108
    or v_retry_fingerprint is distinct from v_first_fingerprint
    or exists (
      select 1
      from public.order_catalog_items catalog
      join master.dispensing_order_profiles profile
        on profile.id = catalog.source_dispensing_profile_id
       and profile.profile_revision = catalog.source_dispensing_profile_revision
      where catalog.workspace_id = 'clair-demo'
        and profile.source_release_id = v_release_id
        and (
          catalog.availability_status <> 'pending_activation'
          or catalog.clinical_use_allowed
          or catalog.source_clinical_review_id is not null
          or catalog.dispensing_profile_snapshot->>'clinicalUseAllowed' <> 'false'
        )
    )
    or exists (
      select 1
      from public.clair_list_order_catalog_chart_search_v2('clair-demo') search_row
      where search_row.applied_snapshot->'dispensingLineage'->>'sourceDispensingProfileId'
        in (
          select profile.id::text
          from master.dispensing_order_profiles profile
          where profile.source_release_id = v_release_id
        )
    )
    or (select row_count from pr017_foreign_baseline) is distinct from v_foreign_count
    or (select fingerprint from pr017_foreign_baseline) is distinct from v_foreign_fingerprint then
    raise exception 'clinical_master_dispensing_adoption_replay_assertion_failed';
  end if;

  begin
    update private.clinical_master_dispensing_adoption_events
    set profile_count = profile_count + 1
    where workspace_id = 'clair-demo' and release_id = v_release_id;
    raise exception 'clinical_master_dispensing_adoption_event_mutation_accepted';
  exception when sqlstate '55000' then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    if v_sqlstate <> '55000' then
      raise;
    end if;
  end;
end;
$adoption_assertions$;

\set PR017_EMBEDDED_POSTFLIGHT true
\ir clinical_master_dispensing_v1_postflight.sql
\unset PR017_EMBEDDED_POSTFLIGHT

do $$
begin
  raise notice 'clinical_master_dispensing_release_replay_ok';
end;
$$;

rollback;
