import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
const adapterPath = resolve(root, "tests/fixtures/clinical-master-operational-v4-adapter-output.json");
const pricingPath = resolve(root, "tests/fixtures/clinical-master-operational-v4-pricing-adoption.json");
const orderSetPath = resolve(root, "tests/fixtures/clinical-master-operational-v4-order-set-manifest.json");
const rollbackPath = resolve(root, "supabase/snippets/clinical_master_operational_v4_phase_c_rollback.sql");
const commitPath = resolve(root, "supabase/snippets/clinical_master_operational_v4_phase_c_commit_candidate.sql");
const postflightPath = resolve(root, "supabase/snippets/clinical_master_operational_v4_phase_c_postflight.sql");
const manifestPath = resolve(root, "tests/fixtures/clinical-master-operational-v4-phase-c-operation-manifest.json");

const adapter = JSON.parse(readFileSync(adapterPath, "utf8")) as JsonObject;
const pricing = JSON.parse(readFileSync(pricingPath, "utf8")) as JsonObject;
const orderSets = JSON.parse(readFileSync(orderSetPath, "utf8")) as JsonObject;
const payload = adapter.payload as JsonObject;
const templates = orderSets.templates as JsonObject[];
const operations = orderSets.operations as JsonObject[];
const executableTemplates = templates.map((template) => ({
  ...template,
  requestIds: Object.fromEntries(operations
    .filter((operation) => String(operation.operationId).endsWith(`:${String(template.templateKey)}`))
    .map((operation) => [operation.workspaceId, (operation.headers as JsonObject)["Idempotency-Key"]])),
}));
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

if ((payload.records as unknown[]).length !== 554) throw new Error("V4 payload must contain 554 supported records");
if ((pricing.orders as unknown[]).length !== 400) throw new Error("V4 pricing must contain 400 orders");
if (templates.length !== 20) throw new Error("V4 Order Set manifest must contain 20 templates");

const remoteWorkspaceValues = [
  ["workspace-clinical-master-pilot-v1", 402, 400, 0, 20, 20],
  ["workspace-clair-cheongdam", 413, 389, 11, 24, 22],
  ["clair-demo", 419, 400, 0, 20, 20],
].map((row) => `(${row.map((value) => typeof value === "string" ? `'${value}'` : value).join(",")})`).join(",\n    ");

function render(mode: "local" | "remote", terminal: "rollback" | "commit") {
  const workspaceValues = mode === "local"
    ? [
        ["workspace-clinical-master-pilot-v1", 400, 400, 0, 20, 20],
        ["workspace-clair-cheongdam", 400, 400, 0, 20, 20],
        ["clair-demo", 400, 400, 0, 20, 20],
      ].map((row) => `(${row.map((value) => typeof value === "string" ? `'${value}'` : value).join(",")})`).join(",\n    ")
    : remoteWorkspaceValues;
  const localBootstrap = mode === "local" ? `
  select membership.user_id into v_bootstrap_actor
  from public.user_memberships membership
  where membership.workspace_id='workspace-clair-cheongdam'
    and membership.status='active' and membership.archived_at is null
    and membership.roles @> array['hospital_admin']::text[]
  order by membership.created_at,membership.user_id limit 1;
  if v_bootstrap_actor is null then raise exception 'clinical_master_v4_local_admin_missing'; end if;
  insert into public.workspaces(id,display_name,status,created_by_user_id)
  values ('workspace-clinical-master-pilot-v1','Clinical Master Pilot','active',v_bootstrap_actor),('clair-demo','CLAiR Demo','active',v_bootstrap_actor),('clair-foreign-demo','CLAiR Foreign Demo','active',v_bootstrap_actor)
  on conflict (id) do nothing;
  insert into public.user_memberships(workspace_id,user_id,roles,status,activated_at)
  values ('workspace-clinical-master-pilot-v1',v_bootstrap_actor,array['hospital_admin']::text[],'active',now()),('clair-demo',v_bootstrap_actor,array['hospital_admin']::text[],'active',now())
  on conflict do nothing;` : `
  if (select count(*) from master.master_releases)<>6
     or (select max(release_no) from master.master_releases)<>10
     or (select release_key from master.master_releases order by release_no desc limit 1)<>'cm.release.airtable.operational-master.v3.diagnosis-runtime-v1'
     or (select source_fingerprint from master.master_releases order by release_no desc limit 1)<>'c6309d0ed739acc0ea4bd095b621c3c5db4cb6509542d78bd886d67c0ea304a0' then
    raise exception 'clinical_master_v4_remote_release_baseline_mismatch';
  end if;
  if (select count(*) from public.order_catalog_items where workspace_id='workspace-clinical-master-pilot-v1')<>122
     or (select count(*) from public.order_catalog_items where workspace_id='workspace-clair-cheongdam')<>133
     or (select count(*) from public.order_catalog_items where workspace_id='clair-demo')<>139 then
    raise exception 'clinical_master_v4_remote_catalog_baseline_mismatch';
  end if;`;

  return `-- GENERATED by scripts/generate-clinical-master-operational-v4-phase-c.ts; do not edit.
-- Exact ${mode} ${terminal} candidate. All workspace mutations use existing guarded RPCs.
begin;
do $clinical_master_v4$
declare
  v_payload jsonb := ${sqlJson(payload)};
  v_pricing jsonb := ${sqlJson(pricing)};
  v_templates jsonb := ${sqlJson(executableTemplates)};
  v_publish jsonb;
  v_retry jsonb;
  v_release_id uuid;
  v_workspace text;
  v_actor uuid;
  v_bootstrap_actor uuid;
  v_item record;
  v_update record;
  v_template jsonb;
  v_definition jsonb;
  v_definition_item jsonb;
  v_resolved_items jsonb;
  v_price jsonb;
  v_result jsonb;
  v_set_id text;
  v_set_revision uuid;
  v_catalog_id text;
  v_catalog_revision integer;
  v_master_key text;
  v_custom_id text;
  v_previous_sub text := current_setting('request.jwt.claim.sub',true);
  v_previous_claims text := current_setting('request.jwt.claims',true);
  v_expected record;
begin
  ${localBootstrap}
  if exists (
    select 1 from (values
      ((select count(*) from public.order_catalog_items where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.lab_test_items where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.lab_test_item_versions where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.order_catalog_lab_test_item_links where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_master_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_lab_item_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_lab_catalog_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.notification_events where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.notification_user_states where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.audit_events where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.order_sets where workspace_id='clair-foreign-demo'))
    ) foreign_surface(row_count) where row_count<>0
  ) then raise exception 'clinical_master_v4_foreign_baseline_not_empty'; end if;

  if has_function_privilege('authenticated','private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,'execute')
     or has_function_privilege('service_role','private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,'execute')
     or not has_function_privilege('authenticated','public.clair_create_order_set(text,jsonb,text,uuid)'::regprocedure,'execute') then
    raise exception 'clinical_master_v4_rpc_acl_invalid';
  end if;

  v_publish := private.publish_clinical_master_release(v_payload,null);
  v_retry := private.publish_clinical_master_release(v_payload,null);
  if coalesce(v_publish->>'releaseId','')<>coalesce(v_retry->>'releaseId','')
     or coalesce((v_publish->>'recordCount')::integer,-1)<>554
     or not exists (select 1 from master.master_releases where id=(v_publish->>'releaseId')::uuid and release_key='cm.release.airtable.operational-master.v4' and status='published' and record_count=554 and adoption_scope='payload') then
    raise exception 'clinical_master_v4_publish_or_retry_invalid:%:%',v_publish,v_retry;
  end if;
  v_release_id := (v_publish->>'releaseId')::uuid;
  if (select count(*) from private.clinical_master_release_payload_owner_manifest where release_id=v_release_id)<>554 then
    raise exception 'clinical_master_v4_owner_manifest_invalid';
  end if;

  create temporary table cm_v4_created_sets(workspace_id text,template_key text,order_set_id text,current_revision_id uuid,primary key(workspace_id,template_key)) on commit drop;

  for v_expected in select * from (values
    ${workspaceValues}
  ) expected(workspace_id,total_catalogs,payload_active,payload_paused,total_sets,total_revisions)
  loop
    v_workspace := v_expected.workspace_id;
    select membership.user_id into v_actor
    from public.user_memberships membership
    where membership.workspace_id=v_workspace and membership.status='active' and membership.archived_at is null
      and membership.roles @> array['hospital_admin']::text[]
    order by (membership.roles @> array['owner']::text[]) desc,membership.created_at,membership.user_id limit 1;
    if v_actor is null then raise exception 'clinical_master_v4_admin_missing:%',v_workspace; end if;

    v_result := private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id);
    v_retry := private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id);
    if coalesce(v_result->>'ok','false')<>'true' or coalesce(v_retry->>'ok','false')<>'true' then
      raise exception 'clinical_master_v4_adoption_failed:%:%:%',v_workspace,v_result,v_retry;
    end if;
    if (select count(*) from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order' where item.workspace_id=v_workspace and item.origin_type='clair_master')<>400 then
      raise exception 'clinical_master_v4_payload_catalog_count_invalid:%',v_workspace;
    end if;

    for v_item in
      select item.* from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order'
      where item.workspace_id=v_workspace and item.origin_type='clair_master'
      order by item.id for update
    loop
      select price.value into v_price from jsonb_array_elements(v_pricing->'orders') price(value) where price.value->>'masterKey'=v_item.standard_order_id limit 1;
      if v_price is null then raise exception 'clinical_master_v4_price_missing:%',v_item.standard_order_id; end if;
      if v_item.price_krw is distinct from (v_price->>'syntheticWorkspacePriceKrw')::integer then
        perform set_config('request.jwt.claim.sub',v_actor::text,true);
        perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
        execute 'set local role authenticated';
        v_result := public.clair_update_order_catalog_item(v_workspace,v_item.id,v_item.catalog_revision,jsonb_build_object('priceKrw',(v_price->>'syntheticWorkspacePriceKrw')::integer));
        execute 'set local role postgres';
      end if;
    end loop;

    for v_update in
      select update_row.id,item.catalog_revision
      from public.workspace_master_updates update_row
      join public.order_catalog_items item on item.workspace_id=update_row.workspace_id and item.id=update_row.order_catalog_item_id
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order'
      where update_row.workspace_id=v_workspace and update_row.status='pending'
      order by update_row.created_at,update_row.id for update of update_row
    loop
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
      execute 'set local role authenticated';
      v_result := public.clair_resolve_workspace_master_update(v_workspace,v_update.id,v_update.catalog_revision,'accept_source');
      execute 'set local role postgres';
      if coalesce(v_result->>'ok','false')<>'true' then raise exception 'clinical_master_v4_master_review_failed:%:%',v_workspace,v_update.id; end if;
    end loop;

    for v_update in select * from public.workspace_lab_item_updates where workspace_id=v_workspace and source_release_id=v_release_id and status='pending' order by created_at,id for update loop
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
      execute 'set local role authenticated';
      v_result := public.clair_resolve_workspace_lab_definition_update(v_workspace,v_update.id,v_actor,v_update.expected_workspace_result_revision,'accept');
      execute 'set local role postgres';
    end loop;
    for v_update in select update_row.*,item.catalog_revision from public.workspace_lab_catalog_updates update_row join public.order_catalog_items item on item.workspace_id=update_row.workspace_id and item.id=update_row.order_catalog_item_id where update_row.workspace_id=v_workspace and update_row.source_release_id=v_release_id and update_row.status='pending' order by update_row.created_at,update_row.id for update of update_row loop
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
      execute 'set local role authenticated';
      v_result := public.clair_resolve_workspace_lab_definition_update(v_workspace,v_update.id,v_actor,v_update.catalog_revision,'accept');
      execute 'set local role postgres';
    end loop;

    for v_item in
      select item.* from public.order_catalog_items item
      join master.master_records master_row on master_row.id=item.source_master_record_id and master_row.record_type='order'
      join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order'
      where item.workspace_id=v_workspace and item.origin_type='clair_master' and item.availability_status='inactive'
      order by item.id for update
    loop
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
      execute 'set local role authenticated';
      v_result := public.clair_update_order_catalog_item(v_workspace,v_item.id,v_item.catalog_revision,jsonb_build_object('availabilityStatus','active'));
      execute 'set local role postgres';
    end loop;

    for v_template in select value from jsonb_array_elements(v_templates) loop
      v_definition := v_template->'definitionTemplate';
      v_resolved_items := '[]'::jsonb;
      for v_definition_item in select value from jsonb_array_elements(v_definition->'items') order by (value->>'sortOrder')::integer loop
        if v_definition_item->>'childKind'='atomic' then
          v_master_key := v_definition_item->'childOrderCatalogItemId'->>'masterKey';
          select item.id,item.catalog_revision into v_catalog_id,v_catalog_revision
          from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id
          where item.workspace_id=v_workspace and master_row.master_key=v_master_key and item.origin_type='clair_master';
          if v_workspace='workspace-clair-cheongdam' and exists (select 1 from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id and availability_status='paused') then
            v_custom_id := case v_master_key
              when 'cm.order.consult.first-visit' then 'cd-consult-first'
              when 'cm.order.consult.followup' then 'cd-consult-revisit'
              when 'cm.order.dispensing.oral' then 'cd-dispensing-oral-basic'
              when 'cm.order.imaging.abdominal-ultrasound' then 'cd-imaging-us-abdomen'
              when 'cm.order.lab.panel.cbc-basic' then 'cd-lab-cbc'
              when 'cm.order.lab.panel.chemistry-basic' then 'cd-lab-chem10'
              when 'cm.order.lab.panel.urinalysis' then 'cd-lab-ua'
              when 'cm.order.treatment.ear-cleaning' then 'cd-treatment-ear-clean'
              when 'cm.order.synthetic.treatment-02' then 'cd-treatment-fluid-sc'
              when 'cm.order.synthetic.preventive-01' then 'cd-vaccine-core'
              when 'cm.order.synthetic.inpatient-01' then 'cd-hospitalization-day'
              else null end;
            if v_custom_id is not null then
              select item.id,item.catalog_revision into v_catalog_id,v_catalog_revision from public.order_catalog_items item where item.workspace_id=v_workspace and item.id=v_custom_id and item.origin_type='workspace_custom' and item.availability_status='active' and item.price_krw>0;
            end if;
          end if;
          if v_catalog_id is null then raise exception 'clinical_master_v4_set_atomic_missing:%:%',v_workspace,v_definition_item; end if;
          v_definition_item := jsonb_set(jsonb_set(v_definition_item,'{childOrderCatalogItemId}',to_jsonb(v_catalog_id)),'{childOrderCatalogRevision}',to_jsonb(v_catalog_revision));
        else
          select order_set_id,current_revision_id into v_set_id,v_set_revision from cm_v4_created_sets where workspace_id=v_workspace and template_key=v_definition_item->'childOrderSetId'->>'templateKey';
          if v_set_id is null then raise exception 'clinical_master_v4_set_dependency_missing:%:%',v_workspace,v_definition_item; end if;
          v_definition_item := jsonb_set(jsonb_set(v_definition_item,'{childOrderSetId}',to_jsonb(v_set_id)),'{childSetRevisionId}',to_jsonb(v_set_revision::text));
        end if;
        v_resolved_items := v_resolved_items || jsonb_build_array(v_definition_item);
      end loop;
      v_definition := jsonb_set(v_definition,'{items}',v_resolved_items);
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
      execute 'set local role authenticated';
      v_result := public.clair_create_order_set(v_workspace,v_definition,v_template->>'availabilityStatus',(v_template->'requestIds'->>v_workspace)::uuid);
      v_retry := public.clair_create_order_set(v_workspace,v_definition,v_template->>'availabilityStatus',(v_template->'requestIds'->>v_workspace)::uuid);
      execute 'set local role postgres';
      if coalesce(v_result->>'ok','false')<>'true' or v_retry is distinct from v_result then raise exception 'clinical_master_v4_set_create_invalid:%:%:%',v_workspace,v_result,v_retry; end if;
      v_set_id := v_result->'result'->'orderSet'->>'id';
      v_set_revision := (v_result->'result'->'current'->>'revisionId')::uuid;
      insert into cm_v4_created_sets values(v_workspace,v_template->>'templateKey',v_set_id,v_set_revision);
    end loop;

    if (select count(*) from public.order_catalog_items where workspace_id=v_workspace)<>v_expected.total_catalogs then raise exception 'clinical_master_v4_total_catalog_invalid:%',v_workspace; end if;
    if (select count(*) from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order' where item.workspace_id=v_workspace and item.availability_status='active')<>v_expected.payload_active then raise exception 'clinical_master_v4_active_count_invalid:%',v_workspace; end if;
    if (select count(*) from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order' where item.workspace_id=v_workspace and item.availability_status='paused')<>v_expected.payload_paused then raise exception 'clinical_master_v4_paused_count_invalid:%',v_workspace; end if;
    if exists (select 1 from public.order_catalog_items item join master.master_records master_row on master_row.id=item.source_master_record_id join jsonb_array_elements(v_pricing->'orders') price(value) on price.value->>'masterKey'=master_row.master_key where item.workspace_id=v_workspace and item.price_krw is distinct from (price.value->>'syntheticWorkspacePriceKrw')::integer) then raise exception 'clinical_master_v4_price_readback_invalid:%',v_workspace; end if;
    if (select count(*) from public.order_sets where workspace_id=v_workspace)<>v_expected.total_sets or (select count(*) from public.order_set_revisions where workspace_id=v_workspace)<>v_expected.total_revisions then raise exception 'clinical_master_v4_order_set_total_invalid:%',v_workspace; end if;
    if (select count(*) from cm_v4_created_sets where workspace_id=v_workspace)<>20 or exists (select 1 from cm_v4_created_sets created join public.order_sets s on s.workspace_id=created.workspace_id and s.id=created.order_set_id where created.workspace_id=v_workspace and (s.availability_status<>'active' or s.needs_composition_review)) then raise exception 'clinical_master_v4_order_set_readback_invalid:%',v_workspace; end if;
    if exists (select 1 from public.workspace_master_updates update_row join public.order_catalog_items item on item.workspace_id=update_row.workspace_id and item.id=update_row.order_catalog_item_id join master.master_records master_row on master_row.id=item.source_master_record_id join jsonb_array_elements(v_payload->'records') p(value) on p.value->>'masterKey'=master_row.master_key and p.value->>'recordType'='order' where update_row.workspace_id=v_workspace and update_row.status='pending') then raise exception 'clinical_master_v4_pending_review_remains:%',v_workspace; end if;
  end loop;

  perform set_config('request.jwt.claim.sub',coalesce(v_previous_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(v_previous_claims,'{}'),true);
  if exists (
    select 1 from (values
      ((select count(*) from public.order_catalog_items where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.lab_test_items where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.lab_test_item_versions where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.order_catalog_lab_test_item_links where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_master_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_lab_item_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.workspace_lab_catalog_updates where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.notification_events where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.notification_user_states where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.audit_events where workspace_id='clair-foreign-demo')),
      ((select count(*) from public.order_sets where workspace_id='clair-foreign-demo'))
    ) foreign_surface(row_count) where row_count<>0
  ) then raise exception 'clinical_master_v4_foreign_postflight_changed'; end if;
end
$clinical_master_v4$;
${terminal};
select 'clinical_master_operational_v4_phase_c_${terminal}_ok' as result;
`;
}

const rollback = render("local", "rollback");
const commit = render("remote", "commit");
const postflight = `select release_key,release_no,record_count,adoption_scope,source_fingerprint from master.master_releases where release_key='cm.release.airtable.operational-master.v4';\nselect workspace_id,count(*) as catalog_count,count(*) filter(where availability_status='active') as active_count,count(*) filter(where availability_status='paused') as paused_count from public.order_catalog_items where workspace_id in ('workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo','clair-foreign-demo') group by workspace_id order by workspace_id;\nselect workspace_id,count(*) as set_count,count(*) filter(where availability_status='active') as active_set_count from public.order_sets where workspace_id in ('workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo','clair-foreign-demo') group by workspace_id order by workspace_id;\n`;

writeFileSync(rollbackPath, rollback);
writeFileSync(commitPath, commit);
writeFileSync(postflightPath, postflight);
const manifest = {
  schemaVersion: "clinical-master-operational-v4-phase-c/v1",
  status: "commit_candidate_pending_exact_execution",
  writeAllowed: false,
  remoteWritesPerformed: false,
  projectRef: "qmerxgzrwaaahpkhjqlc",
  payloadRecords: 554,
  atomicOrders: 400,
  workspaces: 3,
  orderSets: 60,
  excludedWorkspace: "clair-foreign-demo",
  files: {
    rollback: { sha256: sha256(rollback), bytes: Buffer.byteLength(rollback) },
    commit: { sha256: sha256(commit), bytes: Buffer.byteLength(commit) },
    postflight: { sha256: sha256(postflight), bytes: Buffer.byteLength(postflight) },
  },
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
