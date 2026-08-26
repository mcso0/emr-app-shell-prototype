-- Keep master-backed dispensing catalog names usable in Chart and downstream
-- fulfillment snapshots without weakening the service-review clinical gate.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_sync_dispensing_catalog_human_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_english_product_name text;
  v_korean_draft_name text;
begin
  if new.source_dispensing_profile_id is null
     or new.source_dispensing_profile_revision is null then
    return new;
  end if;

  select
    product.english_product_name,
    product.korean_draft_name
  into v_english_product_name, v_korean_draft_name
  from master.dispensing_order_profiles profile
  join master.medication_products product
    on product.id = profile.product_id
   and product.revision = profile.product_revision
  where profile.id = new.source_dispensing_profile_id
    and profile.profile_revision = new.source_dispensing_profile_revision;

  if not found then
    return new;
  end if;

  if not ('*' = any(coalesce(new.customized_fields, '{}'::text[])))
     and not ('standardOrderName' = any(coalesce(new.customized_fields, '{}'::text[]))) then
    new.standard_order_name := v_english_product_name;
  end if;
  if not ('*' = any(coalesce(new.customized_fields, '{}'::text[])))
     and not ('inHospitalOrderName' = any(coalesce(new.customized_fields, '{}'::text[]))) then
    new.in_hospital_order_name := v_korean_draft_name;
  end if;
  if not ('*' = any(coalesce(new.customized_fields, '{}'::text[])))
     and not ('billingName' = any(coalesce(new.customized_fields, '{}'::text[]))) then
    new.billing_name := v_korean_draft_name;
  end if;

  return new;
end;
$function$;

revoke all on function private.clair_sync_dispensing_catalog_human_names()
  from public, anon, authenticated, service_role;

drop trigger if exists order_catalog_items_dispensing_human_names
  on public.order_catalog_items;
create trigger order_catalog_items_dispensing_human_names
before insert or update of
  source_dispensing_profile_id,
  source_dispensing_profile_revision,
  customized_fields
on public.order_catalog_items
for each row
execute function private.clair_sync_dispensing_catalog_human_names();

do $block$
declare
  v_updated_count integer;
begin
  with target_rows as (
    select
      item.workspace_id,
      item.id,
      product.english_product_name,
      product.korean_draft_name
    from public.order_catalog_items item
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    join master.medication_products product
      on product.id = profile.product_id
     and product.revision = profile.product_revision
    where item.workspace_id = any(array[
        'clair-demo',
        'workspace-clair-cheongdam',
        'workspace-clinical-master-pilot-v1'
      ])
      and profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
      and not ('*' = any(coalesce(item.customized_fields, '{}'::text[])))
      and not (coalesce(item.customized_fields, '{}'::text[]) && array[
        'standardOrderName',
        'inHospitalOrderName',
        'billingName'
      ]::text[])
  )
  update public.order_catalog_items item
  set
    standard_order_name = target.english_product_name,
    in_hospital_order_name = target.korean_draft_name,
    billing_name = target.korean_draft_name,
    catalog_revision = item.catalog_revision + 1,
    updated_at = pg_catalog.now()
  from target_rows target
  where item.workspace_id = target.workspace_id
    and item.id = target.id
    and (
      item.standard_order_name is distinct from target.english_product_name
      or item.in_hospital_order_name is distinct from target.korean_draft_name
      or item.billing_name is distinct from target.korean_draft_name
    );

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 324 then
    raise exception 'dispensing_catalog_human_name_backfill_count:%', v_updated_count;
  end if;
end;
$block$;

do $block$
begin
  if exists (
    select 1
    from public.order_catalog_items item
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    join master.medication_products product
      on product.id = profile.product_id
     and product.revision = profile.product_revision
    where item.workspace_id = any(array[
        'clair-demo',
        'workspace-clair-cheongdam',
        'workspace-clinical-master-pilot-v1'
      ])
      and profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
      and (
        item.standard_order_name is distinct from product.english_product_name
        or item.in_hospital_order_name is distinct from product.korean_draft_name
        or item.billing_name is distinct from product.korean_draft_name
        or item.availability_status <> 'pending_activation'
        or item.clinical_use_allowed
      )
  ) then
    raise exception 'dispensing_catalog_human_name_postcondition_failed';
  end if;

  if (
    select pg_catalog.count(*)
    from public.order_catalog_items item
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    where item.workspace_id = any(array[
        'clair-demo',
        'workspace-clair-cheongdam',
        'workspace-clinical-master-pilot-v1'
      ])
      and profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
  ) <> 324 then
    raise exception 'dispensing_catalog_human_name_cardinality_failed';
  end if;

  if exists (
    select 1
    from public.order_catalog_items item
    where item.workspace_id = 'clair-foreign-demo'
      and item.source_dispensing_profile_id is not null
  ) then
    raise exception 'dispensing_catalog_human_name_foreign_workspace_changed';
  end if;
end;
$block$;

comment on function private.clair_sync_dispensing_catalog_human_names() is
  'Projects uncustomized dispensing product names into workspace catalog rows while preserving workspace name overrides.';
