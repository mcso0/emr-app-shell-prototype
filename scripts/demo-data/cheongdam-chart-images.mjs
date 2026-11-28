#!/usr/bin/env node
// DEMO-DATA-PR-003. Fictional image attachments for the replayed Cheongdam
// past charts (the `img` entries in cheongdam-chart-history.data.mjs).
//
// The app can only upload and attach while a visit is in consultation; the
// replayed visits are completed and their charts are signed. So the images
// are attached in place: the object is uploaded to its final storage path,
// then one SQL block adds the attachment row and the image block to the
// signed chart with the chart guards switched on. See the SQL header.
//
//   node scripts/demo-data/cheongdam-chart-images.mjs render <image-dir>
//     writes one JPEG per attachment (<image-dir>/<attachment-id>.jpg)
//   node scripts/demo-data/cheongdam-chart-images.mjs upload <image-dir> [--allow-remote] [--encounters file] [--only 1,2]
//     uploads each JPEG to chart-soap-attachments/<workspace>/<encounter>/ready/<id>.jpg
//     Reads the project URL and the service role key from the environment
//     variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//   node scripts/demo-data/cheongdam-chart-images.mjs sql [--apply] [--stand-in] [--only 1,2] [--out file]
//     prints (or writes) the attach block. Without --apply it rolls back.
//   node scripts/demo-data/cheongdam-chart-images.mjs sql --revert [--apply] [--only 1,2] [--out file]
//     prints the removal block (image block, attachment row, audit event).
//     Storage objects stay; remove them separately.
//
// Order: render, upload, sql. Upload to a non-local project and running the
// SQL with --apply each need 승욱's explicit approval for that run.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { visits } from "./cheongdam-chart-history.data.mjs";

const ws = "workspace-clair-cheongdam";
const bucketId = "chart-soap-attachments";
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

// One item per planned image, numbered in data-file order. Ids are fixed so
// every step can be repeated. The second use of an image key draws variant 1.
const seen = {};
const items = visits.flatMap((v) => (v.img ?? []).map(([key, caption]) => ({ v, key, caption }))).map(({ v, key, caption }, index) => {
  const variant = seen[key] ?? 0;
  seen[key] = variant + 1;
  // The replay moved visits after 18:30 to 18:30 (reception hours).
  const at = v.at.slice(11) > "18:30" ? `${v.at.slice(0, 11)}18:30` : v.at;
  return {
    n: index + 1,
    id: `49136000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    pat: `49121000-0000-4000-8000-${String(v.p).padStart(12, "0")}`,
    at: `${at.replace(" ", "T")}:00+09:00`,
    key, variant, caption,
    name: `${key}-${at.slice(0, 10).replaceAll("-", "")}.jpg`,
  };
});

function selected() {
  const only = option("--only")?.split(",").map(Number);
  return only ? items.filter((item) => only.includes(item.n)) : items;
}

async function render(dir) {
  const { renderImage } = await import("./cheongdam-chart-image-art.mjs");
  mkdirSync(dir, { recursive: true });
  for (const item of selected()) writeFileSync(join(dir, `${item.id}.jpg`), await renderImage(item.key, item.variant));
  console.log(JSON.stringify({ rendered: selected().length, dir }));
}

async function upload(dir) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host) && !flag("--allow-remote")) {
    throw new Error(`refusing non-local target ${host}; pass --allow-remote only with explicit approval`);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // The hosted service role has no grant on `encounters`. There, pass
  // --encounters <file> with {"<n>": "<encounter id>"} read from the database.
  const known = option("--encounters") ? JSON.parse(readFileSync(option("--encounters"), "utf8")) : null;
  const result = { uploaded: [], kept: [] };
  for (const item of selected()) {
    let encounterId = known?.[item.n];
    if (!known) {
      const { data, error } = await client.from("encounters").select("id")
        .eq("workspace_id", ws).eq("patient_id", item.pat).eq("checked_in_at", item.at);
      if (error || data?.length !== 1) throw new Error(`#${item.n}: expected one visit at ${item.at}, found ${error?.message ?? data?.length}`);
      encounterId = data[0].id;
    }
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(encounterId ?? "")) throw new Error(`#${item.n}: no encounter id`);
    const path = `${ws}/${encounterId}/ready/${item.id}.jpg`;
    // Same options as the app's finalize step. Existing objects are kept.
    const put = await client.storage.from(bucketId).upload(path, readFileSync(join(dir, `${item.id}.jpg`)), {
      contentType: "image/jpeg", cacheControl: "300", upsert: false,
    });
    if (!put.error) result.uploaded.push(item.n);
    else if (/exists|duplicate/i.test(put.error.message)) result.kept.push(item.n);
    else throw new Error(`#${item.n}: ${put.error.message}`);
  }
  console.log(JSON.stringify(result));
}

// Removal of what the attach block wrote. The chart text is untouched; the
// chart timestamps are put back the same way as in the attach block.
function revertSql(apply) {
  return `-- DEMO-DATA-PR-003 chart image removal (Cheongdam only). Generated by
-- scripts/demo-data/cheongdam-chart-images.mjs sql --revert${apply ? " --apply" : ""}. Run as postgres.
-- Removes the image block, the attachment row and its audit event for each
-- listed attachment id. Storage objects stay; remove them through the
-- storage API afterwards. dry = true ends with CHART_IMAGES_DRY_ROLLBACK.
do $images$
declare
  w constant text := '${ws}';
  dry constant boolean := ${!apply};
  ids constant uuid[] := array[${selected().map((item) => `'${item.id}'`).join(", ")}]::uuid[];
  a uuid; c uuid; idx integer; doc jsonb; kids text[]; old_updated timestamptz; old_edited timestamptz;
  restore jsonb := '[]'::jsonb; removed integer := 0;
begin
  foreach a in array ids loop
    select sn.id, sn.updated_at, sn.block_document, ce.edited_at into c, old_updated, doc, old_edited
      from public.chart_soap_attachments x
      join public.soap_notes sn on sn.workspace_id = x.workspace_id and sn.encounter_id = x.encounter_id and sn.status <> 'voided'
      left join private.chart_content_edits ce on ce.chart_id = sn.id
      where x.id = a and x.workspace_id = w and pg_catalog.strpos(sn.block_document::text, 'img-' || a) > 0;
    if not found then continue; end if;
    select (b.ord - 1)::integer into idx from pg_catalog.jsonb_array_elements(doc #> '{0,blocks}') with ordinality b(value, ord)
      where b.value->>'type' = 'soapSection' and b.value #>> '{props,kind}' = 'objective';
    kids := array['0', 'blocks', idx::text, 'children'];
    doc := pg_catalog.jsonb_set(doc, kids, coalesce((select pg_catalog.jsonb_agg(k.value order by k.ord)
      from pg_catalog.jsonb_array_elements(doc #> kids) with ordinality k(value, ord) where k.value->>'id' <> 'img-' || a), '[]'::jsonb));
    perform pg_catalog.set_config('clair.soap_editor_capability', 'media_table_v1', true);
    update public.soap_notes set block_document = doc where id = c and workspace_id = w;
    perform pg_catalog.set_config('clair.soap_editor_capability', '', true);
    delete from public.audit_events ev where ev.workspace_id = w and ev.id = 'chart-soap-attachment-' || a;
    delete from public.chart_soap_attachments x where x.workspace_id = w and x.id = a;
    restore := restore || pg_catalog.jsonb_build_object('c', c, 'u', old_updated, 'ed', old_edited);
    removed := removed + 1;
  end loop;
  set local session_replication_role = replica;
  update public.soap_notes sn set updated_at = (x.value->>'u')::timestamptz
    from pg_catalog.jsonb_array_elements(restore) x where sn.id = (x.value->>'c')::uuid;
  update private.chart_content_edits ce set edited_at = (x.value->>'ed')::timestamptz
    from pg_catalog.jsonb_array_elements(restore) x where ce.chart_id = (x.value->>'c')::uuid and x.value->>'ed' is not null;
  set local session_replication_role = origin;
  if dry then raise exception 'CHART_IMAGES_DRY_ROLLBACK %', pg_catalog.jsonb_build_object('removed', removed)::text; end if;
end $images$;
`;
}

function sql() {
  const apply = flag("--apply"), standIn = flag("--stand-in");
  if (apply && standIn) throw new Error("--stand-in is for dry runs only");
  if (flag("--revert")) return revertSql(apply);
  const list = selected().map(({ n, id, pat, at, name, caption }) => ({ n, id, pat, at, name, caption }));
  return `-- DEMO-DATA-PR-003 chart image attach (Cheongdam only). Generated by
-- scripts/demo-data/cheongdam-chart-images.mjs sql${apply ? " --apply" : ""}${standIn ? " --stand-in" : ""}. Run as postgres.
--
-- Why not the app path: upload (chart_soap_attachments insert policy and
-- ready guard) and chart save (clair_save_chart_soap_note_v4, also for an
-- amendment) both require the visit to be in_consultation or ordered. These
-- visits are completed, so the image is attached in place:
--   1. the uploaded object must already exist at its final path (same
--      mimetype check as the app's ready guard; size is read from the object),
--   2. the attachment row is inserted as ready, with the audit event the
--      app's ready trigger would write,
--   3. the image block is appended to the objective section. The chart guards
--      (guard_soap_attachment_references, guard_soap_editor_capability) and
--      the document validator run on that update. The chart stays signed.
--   4. soap_notes.updated_at and chart_content_edits.edited_at are put back,
--      so the chart does not look edited on the run day. Triggers are off
--      only for that one statement pair.
-- Existing attachment ids are skipped, so the block can be repeated.
-- dry = true ends with CHART_IMAGES_DRY_ROLLBACK {...}: nothing is saved.
-- stand_in = true (dry only) writes placeholder storage rows instead of
-- needing uploaded objects; they are rolled back with everything else.
do $images$
declare
  w constant text := '${ws}';
  dry constant boolean := ${!apply};
  stand_in constant boolean := ${standIn};
  items constant jsonb := $json$${JSON.stringify(list)}$json$::jsonb;
  it jsonb; a uuid; e uuid; c uuid; vet uuid; mem uuid; t_in timestamptz; t_up timestamptz;
  old_updated timestamptz; old_edited timestamptz; old_objective text; found_count integer;
  doc jsonb; full_doc jsonb; idx integer; path text; url text; size integer;
  restore jsonb := '[]'::jsonb; done jsonb := '[]'::jsonb; media jsonb;
begin
  if stand_in and not dry then raise exception 'stand_in_requires_dry'; end if;
  for it in select value from pg_catalog.jsonb_array_elements(items) loop
    a := (it->>'id')::uuid;
    select pg_catalog.count(*) into found_count
      from public.encounters en join public.soap_notes sn on sn.workspace_id = en.workspace_id and sn.encounter_id = en.id and sn.status <> 'voided'
      where en.workspace_id = w and en.patient_id = (it->>'pat')::uuid and en.checked_in_at = (it->>'at')::timestamptz;
    if found_count <> 1 then raise exception 'chart_image_visit_not_unique n=% found=%', it->>'n', found_count; end if;
    select en.id, en.checked_in_at, sn.id, sn.author_user_id, sn.updated_at, sn.objective, sn.block_document
      into e, t_in, c, vet, old_updated, old_objective, doc
      from public.encounters en join public.soap_notes sn on sn.workspace_id = en.workspace_id and sn.encounter_id = en.id and sn.status <> 'voided'
      where en.workspace_id = w and en.patient_id = (it->>'pat')::uuid and en.checked_in_at = (it->>'at')::timestamptz
        and en.status = 'completed' and sn.status = 'signed' and sn.block_document_schema_version = 2;
    if not found then raise exception 'chart_image_visit_not_signed_v2 n=%', it->>'n'; end if;
    url := '/api/workspaces/' || w || '/chart/soap-attachments/' || a || '?encounterId=' || e;
    if exists (select 1 from public.chart_soap_attachments x where x.id = a) then
      done := done || pg_catalog.jsonb_build_object('n', it->'n', 'chart', c, 'skipped', true,
        'inDocument', pg_catalog.strpos(doc::text, url) > 0);
      continue;
    end if;

    path := w || '/' || e || '/ready/' || a || '.jpg';
    if stand_in then
      insert into storage.objects (bucket_id, name, metadata)
        values ('${bucketId}', path, pg_catalog.jsonb_build_object('mimetype', 'image/jpeg', 'size', 1));
    end if;
    select (o.metadata->>'size')::integer into size from storage.objects o
      where o.bucket_id = '${bucketId}' and o.name = path and o.metadata->>'mimetype' = 'image/jpeg';
    if not found then raise exception 'chart_image_object_missing n=% path=%', it->>'n', path; end if;

    select m.id into mem from public.user_memberships m
      where m.workspace_id = w and m.user_id = vet and m.status = 'active' order by m.created_at limit 1;
    if mem is null then raise exception 'chart_image_author_membership_missing n=%', it->>'n'; end if;
    -- Chart opened at +7 min and signed at +28 min; the upload sits between.
    t_up := t_in + interval '16 minutes';
    insert into public.chart_soap_attachments (id, workspace_id, encounter_id, actor_user_id, storage_path, pending_path,
        mime_type, byte_size, file_name, ready_at, created_at)
      values (a, w, e, vet, path, pg_catalog.replace(path, '/ready/', '/pending/'), 'image/jpeg', size, it->>'name',
        t_up + interval '4 seconds', t_up);
    insert into public.audit_events (id, workspace_id, actor_user_id, actor_membership_id, event_type, target_type, target_id,
        encounter_id, after_snapshot, metadata, occurred_at, created_at)
      values ('chart-soap-attachment-' || a, w, vet, mem, 'chart.soap_attachment_uploaded', 'soap_attachment', a::text, e,
        pg_catalog.jsonb_build_object('mimeType', 'image/jpeg', 'byteSize', size),
        pg_catalog.jsonb_build_object('source', 'chart-soap-attachment-finalize'), t_up + interval '4 seconds', t_up + interval '4 seconds');

    if pg_catalog.jsonb_array_length(doc) <> 1 then raise exception 'chart_image_unexpected_scopes n=%', it->>'n'; end if;
    select (b.ord - 1)::integer into idx from pg_catalog.jsonb_array_elements(doc #> '{0,blocks}') with ordinality b(value, ord)
      where b.value->>'type' = 'soapSection' and b.value #>> '{props,kind}' = 'objective';
    if idx is null then raise exception 'chart_image_objective_missing n=%', it->>'n'; end if;
    doc := pg_catalog.jsonb_insert(doc, array['0', 'blocks', idx::text, 'children', '-1'], pg_catalog.jsonb_build_object(
      'id', 'img-' || a, 'type', 'image', 'children', '[]'::jsonb,
      'props', pg_catalog.jsonb_build_object('name', it->>'name', 'url', url, 'caption', it->>'caption',
        'showPreview', true, 'backgroundColor', 'default', 'textAlignment', 'left')), true);
    full_doc := pg_catalog.jsonb_build_object('schemaVersion', 2, 'scopes', doc);
    if private.clair_soap_document_is_valid(full_doc) is distinct from true then raise exception 'chart_image_document_invalid n=%', it->>'n'; end if;
    if nullif(private.clair_soap_document_field_v2(full_doc, 'objective'), '') is distinct from old_objective then
      raise exception 'chart_image_objective_text_changed n=%', it->>'n';
    end if;

    select ce.edited_at into old_edited from private.chart_content_edits ce where ce.chart_id = c;
    perform pg_catalog.set_config('clair.soap_editor_capability', 'media_table_v1', true);
    update public.soap_notes set block_document = doc where id = c and workspace_id = w;
    perform pg_catalog.set_config('clair.soap_editor_capability', '', true);
    restore := restore || pg_catalog.jsonb_build_object('c', c, 'u', old_updated, 'ed', old_edited);
    done := done || pg_catalog.jsonb_build_object('n', it->'n', 'chart', c, 'vet', vet, 'bytes', size);
  end loop;

  set local session_replication_role = replica;
  update public.soap_notes sn set updated_at = (x.value->>'u')::timestamptz
    from pg_catalog.jsonb_array_elements(restore) x where sn.id = (x.value->>'c')::uuid;
  update private.chart_content_edits ce set edited_at = (x.value->>'ed')::timestamptz
    from pg_catalog.jsonb_array_elements(restore) x where ce.chart_id = (x.value->>'c')::uuid and x.value->>'ed' is not null;
  set local session_replication_role = origin;

  -- Readback through the search RPC, as each chart's author.
  for it in select value from pg_catalog.jsonb_array_elements(done) loop
    if it ? 'skipped' then continue; end if;
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    perform pg_catalog.set_config('request.jwt.claim.sub', it->>'vet', true);
    perform pg_catalog.set_config('request.jwt.claims', pg_catalog.json_build_object('sub', it->>'vet', 'role', 'authenticated')::text, true);
    select pg_catalog.jsonb_path_query_first(public.clair_advanced_chart_search_batch(w, p_chart_id => (it->>'chart')::uuid), '$.**.media')
      into media;
    if media is null or pg_catalog.jsonb_array_length(media) = 0 then raise exception 'chart_image_not_in_search n=%', it->>'n'; end if;
    restore := restore || pg_catalog.jsonb_build_object('n', it->'n', 'media', media);
  end loop;
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '', true);

  if dry then
    raise exception 'CHART_IMAGES_DRY_ROLLBACK %', pg_catalog.jsonb_build_object('done', done,
      'media', (select pg_catalog.jsonb_agg(x.value) from pg_catalog.jsonb_array_elements(restore) x where x.value ? 'media'),
      'stamps', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('chart', sn.id, 'status', sn.status, 'updatedAt', sn.updated_at, 'editedAt', ce.edited_at))
                 from public.soap_notes sn left join private.chart_content_edits ce on ce.chart_id = sn.id
                 where sn.id in (select (x.value->>'chart')::uuid from pg_catalog.jsonb_array_elements(done) x)))::text;
  end if;
end $images$;
`;
}

const [command, target] = args.filter((arg, i) => !arg.startsWith("--") && !["--only", "--out", "--encounters"].includes(args[i - 1]));
try {
  if (command === "render" && target) await render(target);
  else if (command === "upload" && target) await upload(target);
  else if (command === "sql") {
    const out = option("--out");
    if (out) writeFileSync(out, sql());
    else process.stdout.write(sql());
  } else {
    console.error("usage: cheongdam-chart-images.mjs render <image-dir> | upload <image-dir> [--allow-remote] | sql [--revert] [--apply] [--stand-in] [--only n,n] [--out file]");
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
