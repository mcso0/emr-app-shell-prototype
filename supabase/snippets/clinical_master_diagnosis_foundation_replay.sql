-- CLINICAL-MASTER-PR-007 schema-only replay.
-- The synthetic rows and every negative probe are transaction-scoped.

\set ON_ERROR_STOP on

begin;
set constraints all deferred;

do $$
declare
  v_release uuid := 'd7000000-0000-4000-8000-000000000001'::uuid;
  v_system uuid := 'd7000000-0000-4000-8000-000000000010'::uuid;
  v_group uuid := 'd7000000-0000-4000-8000-000000000011'::uuid;
  v_group_two uuid := 'd7000000-0000-4000-8000-000000000012'::uuid;
  v_diagnosis uuid := 'd7000000-0000-4000-8000-000000000020'::uuid;
  v_diag_missing uuid := 'd7000000-0000-4000-8000-000000000021'::uuid;
  v_diag_zero uuid := 'd7000000-0000-4000-8000-000000000022'::uuid;
  v_diag_multi uuid := 'd7000000-0000-4000-8000-000000000023'::uuid;
  v_diag_rekey uuid := 'd7000000-0000-4000-8000-000000000024'::uuid;
  v_other_master uuid := 'd7000000-0000-4000-8000-000000000030'::uuid;
  v_new_id uuid := 'd7000000-0000-4000-8000-000000000031'::uuid;
  v_error text;
  v_sqlstate text;
  v_constraint_name text;
  v_role text;
  v_table text;
  v_function text;
  v_releases_before bigint;
  v_records_before bigint;
  v_versions_before bigint;
  v_review_events_before bigint;
  v_releases_after bigint;
  v_records_after bigint;
  v_versions_after bigint;
  v_review_events_after bigint;
  v_catalog_exists boolean;
  v_catalog_exists_after boolean;
  v_catalog_rows_before bigint;
  v_catalog_rows_after bigint;
  v_catalog_fingerprint_before text;
  v_catalog_fingerprint_after text;
  v_public_diagnoses_exists boolean;
  v_public_diagnoses_exists_after boolean;
  v_public_diagnoses_rows_before bigint;
  v_public_diagnoses_rows_after bigint;
  v_public_diagnoses_fingerprint_before text;
  v_public_diagnoses_fingerprint_after text;
begin
  v_catalog_exists := to_regclass('public.diagnosis_catalog') is not null;
  v_public_diagnoses_exists := to_regclass('public.diagnoses') is not null;
  if v_catalog_exists then
    execute 'select count(*) from public.diagnosis_catalog' into v_catalog_rows_before;
    execute $sql$
      select md5(coalesce(
        (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text
         from public.diagnosis_catalog as r), '[]'
      ))
    $sql$ into v_catalog_fingerprint_before;
  end if;
  if v_public_diagnoses_exists then
    execute 'select count(*) from public.diagnoses' into v_public_diagnoses_rows_before;
    execute $sql$
      select md5(coalesce(
        (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text
         from public.diagnoses as r), '[]'
      ))
    $sql$ into v_public_diagnoses_fingerprint_before;
  end if;

  insert into master.master_releases(
    id, release_key, record_count, source_fingerprint, status,
    published_by_label, published_at
  ) values (
    v_release, 'clinical-master-pr-007-replay', 10,
    repeat('d', 64), 'published', 'PR-007 replay', now()
  );

  insert into master.master_records(
    id, master_key, record_type, lifecycle_status, safety_status,
    current_revision, current_release_id, published_at
  ) values
    (v_system, 'pr007.replay.system', 'diagnosis_category', 'published', 'normal', 1, v_release, now()),
    (v_group, 'pr007.replay.group', 'diagnosis_category', 'published', 'normal', 1, v_release, now()),
    (v_group_two, 'pr007.replay.group.two', 'diagnosis_category', 'published', 'normal', 1, v_release, now()),
    (v_diagnosis, 'pr007.replay.diagnosis', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_diag_missing, 'pr007.replay.diagnosis.missing', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_diag_zero, 'pr007.replay.diagnosis.zero', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_diag_multi, 'pr007.replay.diagnosis.multi', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_diag_rekey, 'pr007.replay.diagnosis.rekey', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_other_master, 'pr007.replay.other', 'diagnosis', 'published', 'normal', 1, v_release, now()),
    (v_new_id, 'pr007.replay.unused-category', 'diagnosis_category', 'published', 'normal', 1, v_release, now());

  insert into master.master_record_versions(
    master_record_id, revision, release_id, snapshot,
    authored_by_label, reviewed_by_label
  )
  select id, 1, v_release,
    jsonb_build_object('masterKey', master_key, 'recordType', record_type),
    'PR-007 replay', 'PR-007 replay'
  from master.master_records
  where id in (v_system, v_group, v_group_two, v_diagnosis, v_diag_missing,
               v_diag_zero, v_diag_multi, v_diag_rekey, v_other_master, v_new_id);

  -- Valid system -> disease_group -> diagnosis and one primary link.
  insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
  values (v_system, 'system', null, 0), (v_group, 'disease_group', v_system, 0),
         (v_group_two, 'disease_group', v_system, 1);
  insert into master.diagnoses(master_record_id) values (v_diagnosis);
  insert into master.diagnosis_category_links(
    diagnosis_record_id, diagnosis_category_id, is_primary, sort_order
  ) values (v_diagnosis, v_group, true, 0);

  if (select count(*) from master.diagnosis_category_links where diagnosis_record_id = v_diagnosis) <> 1
     or (select count(*) from master.diagnosis_category_links where diagnosis_record_id = v_diagnosis and is_primary) <> 1 then
    raise exception 'clinical_master_diagnosis_foundation_replay_valid_link_failed';
  end if;
  set constraints all immediate;
  set constraints all deferred;

  -- Parent and type guards.
  begin
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_new_id, 'system', v_group, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_system_parent_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_system_parent_forbidden' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_system_parent_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_new_id, 'disease_group', null, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_missing_parent_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_disease_group_parent_required' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_missing_parent_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_new_id, 'disease_group', v_group, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_group_under_group_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_parent_must_be_system' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_group_under_group_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_other_master, 'system', null, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_type_mismatch_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_record_type_mismatch' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_type_mismatch_error:%:%', v_sqlstate, v_error;
    end if;
  end;

  -- Link target, duplicate pair, and duplicate sort guards.
  begin
    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
    values (v_diagnosis, v_system, false, 1);
    raise exception 'clinical_master_diagnosis_foundation_replay_system_link_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_link_target_must_be_disease_group' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_system_link_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
    values (v_diagnosis, v_group, false, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_duplicate_link_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate,
      v_constraint_name = constraint_name;
    if v_error <> 'duplicate key value violates unique constraint "master_diagnosis_category_links_pkey"'
       or v_sqlstate <> '23505'
       or v_constraint_name <> 'master_diagnosis_category_links_pkey' then
      raise exception 'clinical_master_diagnosis_foundation_replay_duplicate_link_error:%:%:%',
        v_sqlstate, v_constraint_name, v_error;
    end if;
  end;
  begin
    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
    values (v_diagnosis, v_group_two, false, 0);
    raise exception 'clinical_master_diagnosis_foundation_replay_duplicate_sort_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate,
      v_constraint_name = constraint_name;
    if v_error <> 'duplicate key value violates unique constraint "master_diagnosis_category_links_diagnosis_sort_key"'
       or v_sqlstate <> '23505'
       or v_constraint_name <> 'master_diagnosis_category_links_diagnosis_sort_key' then
      raise exception 'clinical_master_diagnosis_foundation_replay_duplicate_sort_error:%:%:%',
        v_sqlstate, v_constraint_name, v_error;
    end if;
  end;

  -- Deferred completeness: no link, zero primary, and multiple primary.
  begin
    insert into master.diagnoses(master_record_id) values (v_diag_missing);
    set constraints all immediate;
    raise exception 'clinical_master_diagnosis_foundation_replay_missing_link_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_link_required_at_commit' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_missing_link_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  set constraints all deferred;

  begin
    insert into master.diagnoses(master_record_id) values (v_diag_zero);
    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
    values (v_diag_zero, v_group, false, 0);
    set constraints all immediate;
    raise exception 'clinical_master_diagnosis_foundation_replay_zero_primary_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_exactly_one_primary_at_commit' or v_sqlstate <> '23514' then
      raise exception 'clinical_master_diagnosis_foundation_replay_zero_primary_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  set constraints all deferred;

  set constraints all deferred;
  insert into master.diagnoses(master_record_id) values (v_diag_multi), (v_diag_rekey);
  insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
  values (v_diag_multi, v_group, true, 0), (v_diag_rekey, v_group, true, 0);
  set constraints all immediate;
  set constraints all deferred;
  begin
    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)
    values (v_diag_multi, v_group_two, true, 1);
    raise exception 'clinical_master_diagnosis_foundation_replay_multiple_primary_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate,
      v_constraint_name = constraint_name;
    if v_error <> 'duplicate key value violates unique constraint "master_diagnosis_category_links_one_primary_key"'
       or v_sqlstate <> '23505'
       or v_constraint_name <> 'master_diagnosis_category_links_one_primary_key' then
      raise exception 'clinical_master_diagnosis_foundation_replay_multiple_primary_error:%:%:%',
        v_sqlstate, v_constraint_name, v_error;
    end if;
  end;
  set constraints all deferred;

  -- Typed identity guards reject re-key, delete, and category-kind mutation.
  begin
    update master.diagnosis_categories set category_kind = 'system', parent_category_id = null
    where master_record_id = v_group;
    raise exception 'clinical_master_diagnosis_foundation_replay_kind_mutation_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_diagnosis_category_kind_immutable' or v_sqlstate <> '55000' then
      raise exception 'clinical_master_diagnosis_foundation_replay_kind_mutation_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    update master.diagnosis_categories set master_record_id = v_new_id where master_record_id = v_group_two;
    raise exception 'clinical_master_diagnosis_foundation_replay_category_rekey_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_typed_identity_immutable' or v_sqlstate <> '55000' then
      raise exception 'clinical_master_diagnosis_foundation_replay_category_rekey_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    delete from master.diagnosis_categories where master_record_id = v_group_two;
    raise exception 'clinical_master_diagnosis_foundation_replay_category_delete_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_typed_projection_immutable' or v_sqlstate <> '55000' then
      raise exception 'clinical_master_diagnosis_foundation_replay_category_delete_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    update master.diagnoses set master_record_id = v_new_id where master_record_id = v_diag_rekey;
    raise exception 'clinical_master_diagnosis_foundation_replay_diagnosis_rekey_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_typed_identity_immutable' or v_sqlstate <> '55000' then
      raise exception 'clinical_master_diagnosis_foundation_replay_diagnosis_rekey_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  begin
    delete from master.diagnoses where master_record_id = v_diag_rekey;
    raise exception 'clinical_master_diagnosis_foundation_replay_diagnosis_delete_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_typed_projection_immutable' or v_sqlstate <> '55000' then
      raise exception 'clinical_master_diagnosis_foundation_replay_diagnosis_delete_error:%:%', v_sqlstate, v_error;
    end if;
  end;

  -- The current B1 publisher still rejects diagnosis payloads before creating
  -- a release, version, or review event.
  select count(*) into v_releases_before from master.master_releases;
  select count(*) into v_records_before from master.master_records;
  select count(*) into v_versions_before from master.master_record_versions;
  select count(*) into v_review_events_before from master.master_review_events;
  begin
    perform private.publish_clinical_master_release(
      jsonb_build_object(
        'releaseKey', 'clinical-master-pr-007-publisher-rejected',
        'publishedByLabel', 'PR-007 replay',
        'records', jsonb_build_array(jsonb_build_object(
          'masterKey', 'pr007.replay.publisher-diagnosis',
          'recordType', 'diagnosis',
          'lifecycleStatus', 'published',
          'safetyStatus', 'normal',
          'names', jsonb_build_array(jsonb_build_object(
            'languageCode', 'ko', 'nameKind', 'preferred', 'name', '재현 진단',
            'searchable', true, 'sortOrder', 0
          )),
          'source', jsonb_build_object(
            'sourceType', 'synthetic', 'title', 'PR-007 replay'
          ),
          'detail', '{}'::jsonb
        ))
      ), null
    );
    raise exception 'clinical_master_diagnosis_foundation_replay_publisher_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_record_type_not_allowed' or v_sqlstate <> '22023' then
      raise exception 'clinical_master_diagnosis_foundation_replay_publisher_error:%:%', v_sqlstate, v_error;
    end if;
  end;
  select count(*) into v_releases_after from master.master_releases;
  select count(*) into v_records_after from master.master_records;
  select count(*) into v_versions_after from master.master_record_versions;
  select count(*) into v_review_events_after from master.master_review_events;
  if v_releases_after <> v_releases_before
     or v_records_after <> v_records_before
     or v_versions_after <> v_versions_before
     or v_review_events_after <> v_review_events_before then
    raise exception 'clinical_master_diagnosis_foundation_replay_publisher_global_counts_changed';
  end if;

  v_catalog_exists_after := to_regclass('public.diagnosis_catalog') is not null;
  v_public_diagnoses_exists_after := to_regclass('public.diagnoses') is not null;
  if v_catalog_exists_after then
    execute 'select count(*) from public.diagnosis_catalog' into v_catalog_rows_after;
    execute $sql$
      select md5(coalesce(
        (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text
         from public.diagnosis_catalog as r), '[]'
      ))
    $sql$ into v_catalog_fingerprint_after;
  end if;
  if v_public_diagnoses_exists_after then
    execute 'select count(*) from public.diagnoses' into v_public_diagnoses_rows_after;
    execute $sql$
      select md5(coalesce(
        (select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text
         from public.diagnoses as r), '[]'
      ))
    $sql$ into v_public_diagnoses_fingerprint_after;
  end if;
  if v_catalog_exists_after is distinct from v_catalog_exists
     or v_public_diagnoses_exists_after is distinct from v_public_diagnoses_exists
     or v_catalog_rows_after is distinct from v_catalog_rows_before
     or v_catalog_fingerprint_after is distinct from v_catalog_fingerprint_before
     or v_public_diagnoses_rows_after is distinct from v_public_diagnoses_rows_before
     or v_public_diagnoses_fingerprint_after is distinct from v_public_diagnoses_fingerprint_before then
    raise exception 'clinical_master_diagnosis_foundation_replay_public_diagnosis_changed';
  end if;
  if exists (
    select 1 from master.master_releases
    where release_key = 'clinical-master-pr-007-publisher-rejected'
  ) or exists (
    select 1 from master.master_records
    where master_key = 'pr007.replay.publisher-diagnosis'
  ) then
    raise exception 'clinical_master_diagnosis_foundation_replay_publisher_residue';
  end if;

  -- Diagnosis tables are RLS-protected with no policies and no direct role grants.
  if not (
    (select relrowsecurity from pg_class where oid = 'master.diagnosis_categories'::regclass)
    and (select relrowsecurity from pg_class where oid = 'master.diagnoses'::regclass)
    and (select relrowsecurity from pg_class where oid = 'master.diagnosis_category_links'::regclass)
  ) then
    raise exception 'clinical_master_diagnosis_foundation_replay_rls_missing';
  end if;
  if exists (
    select 1 from pg_policy policy
    where policy.polrelid in (
      'master.diagnosis_categories'::regclass,
      'master.diagnoses'::regclass,
      'master.diagnosis_category_links'::regclass
    )
  ) then
    raise exception 'clinical_master_diagnosis_foundation_replay_policy_present';
  end if;
  for v_role in select unnest(array['public', 'anon', 'authenticated', 'service_role']) loop
    if v_role = 'public' then
      if exists (
        select 1
        from pg_namespace namespace
        cross join lateral aclexplode(
          coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
        ) privilege
        where namespace.nspname = 'master'
          and privilege.grantee = 0
          and privilege.privilege_type = 'USAGE'
      ) then
        raise exception 'clinical_master_diagnosis_foundation_replay_schema_usage_present:%', v_role;
      end if;
    elsif has_schema_privilege(v_role, 'master', 'USAGE') then
      raise exception 'clinical_master_diagnosis_foundation_replay_schema_usage_present:%', v_role;
    end if;
    for v_table in select unnest(array[
      'master.diagnosis_categories', 'master.diagnoses', 'master.diagnosis_category_links'
    ]) loop
      if v_role = 'public' then
        if exists (
          select 1
          from pg_class relation
          cross join lateral aclexplode(
            coalesce(relation.relacl, acldefault('r', relation.relowner))
          ) privilege
          where relation.oid = v_table::regclass
            and privilege.grantee = 0
            and privilege.privilege_type in (
              'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
            )
        ) then
          raise exception 'clinical_master_diagnosis_foundation_replay_table_privilege_present:%:%', v_role, v_table;
        end if;
      elsif has_table_privilege(v_role, v_table, 'SELECT')
         or has_table_privilege(v_role, v_table, 'INSERT')
         or has_table_privilege(v_role, v_table, 'UPDATE')
         or has_table_privilege(v_role, v_table, 'DELETE')
         or has_table_privilege(v_role, v_table, 'TRUNCATE')
         or has_table_privilege(v_role, v_table, 'REFERENCES')
         or has_table_privilege(v_role, v_table, 'TRIGGER') then
        raise exception 'clinical_master_diagnosis_foundation_replay_table_privilege_present:%:%', v_role, v_table;
      end if;
    end loop;
    for v_function in select unnest(array[
      'master.assert_diagnosis_category_parent()',
      'master.reject_diagnosis_category_kind_mutation()',
      'master.assert_diagnosis_link_target()',
      'master.assert_diagnosis_link_completeness()'
    ]) loop
      if v_role = 'public' then
        if exists (
          select 1
          from pg_proc routine
          cross join lateral aclexplode(
            coalesce(routine.proacl, acldefault('f', routine.proowner))
          ) privilege
          where routine.oid = to_regprocedure(v_function)
            and privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
        ) then
          raise exception 'clinical_master_diagnosis_foundation_replay_function_privilege_present:%:%', v_role, v_function;
        end if;
      elsif has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception 'clinical_master_diagnosis_foundation_replay_function_privilege_present:%:%', v_role, v_function;
      end if;
    end loop;
  end loop;
end
$$;

rollback;
select 'clinical_master_diagnosis_foundation_replay_cleanup_ok' as marker;
