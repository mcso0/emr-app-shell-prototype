import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const base = "../src/app/api/workspaces/[workspaceId]/lab-imaging/result-attachments/";
function load(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, Request, Response, URL, Uint8Array, Date,
    require: name => imports[name] ?? (name === "node:crypto" ? require(name) : {}) });
  return exports;
}

function harness({ denied = false, foreign = false, corrupt = false, cleanupFails = false } = {}) {
  const records = new Map();
  const objects = new Map();
  let actor = "actor-a";
  let owner = "actor-a";
  const core = load("../src/features/lab-imaging/lab-result-attachment-core.ts", {});
  const mutate = async (args, service = false) => {
    const record = records.get(args.p_attachment_id);
    if (args.p_action !== "discard" && (owner !== args.p_actor_user_id || args.p_action === "finalize" && !service)) return { data: null, error: { code: "42501" } };
    if (!record || record.deleted_at || args.p_action !== "delete" && record.uploaded_by_user_id !== args.p_actor_user_id) return { data: null, error: { code: "22023" } };
    if (args.p_action === "finalize") record.ready_at = new Date().toISOString();
    else if (args.p_action === "delete") record.deleted_at = new Date().toISOString();
    else record.abandoned_at = new Date().toISOString();
    return { data: { id: record.id, storage_path: record.storage_path }, error: null };
  };
  const trusted = {
    async rpc(name, args) { assert.equal(name, "clair_mutate_lab_attachment"); return mutate(args, true); },
    from(table) {
      assert.equal(table, "lab_result_attachments");
      const filters = [];
      let update;
      const execute = () => {
        const found = [...records.values()].find(record => filters.every(filter => filter(record)));
        if (found && update) Object.assign(found, update);
        return { data: found ? { ...found } : null, error: null };
      };
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(record => record[key] === value); return query; },
        is(key, value) { filters.push(record => record[key] === value); return query; },
        not(key, operator, value) { assert.equal(operator, "is"); filters.push(record => record[key] !== value); return query; },
        update(value) { update = value; return query; },
        async maybeSingle() { return execute(); },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, core.LAB_RESULT_ATTACHMENT_BUCKET);
      return {
        async createSignedUploadUrl() { return { data: { token: "synthetic-token", signedUrl: "https://storage.example.test/upload/signed" }, error: null }; },
        async download(path) { return { data: objects.get(path), error: objects.has(path) ? null : { message: "missing" } }; },
        async remove(paths) {
          if (cleanupFails) return { error: { message: "unavailable" } };
          paths.forEach(path => objects.delete(path));
          return { error: null };
        },
      };
    } },
  };
  const client = { async rpc(name, args) {
    if (name === "clair_mutate_lab_attachment") return mutate(args);
    assert.equal(name, "clair_prepare_lab_result_attachment");
    const path = core.labResultAttachmentPath("workspace-a", "entry-a", args.p_attachment_id, args.p_mime_type);
    records.set(args.p_attachment_id, { id: args.p_attachment_id, workspace_id: "workspace-a",
      lab_result_entry_id: "entry-a", row_id: args.p_row_id, uploaded_by_user_id: actor,
      file_name: args.p_file_name, mime_type: args.p_mime_type, byte_size: args.p_byte_size,
      storage_path: path, ready_at: null, abandoned_at: null, deleted_at: null, storage_deleted_at: null });
    return { data: path, error: null };
  } };
  const imports = {
    "@/features/lab-imaging/lab-result-attachment-core": core,
    "@/lib/security/rate-limit": { enforceWorkspaceMutationRateLimit: () => null },
    "@/features/lab-imaging/server-lab-result-phase2-context": {
      loadLabResultPhase2Context: async () => denied ? { ok: false, response: Response.json({}, { status: 403 }) }
        : { ok: true, actorUserId: actor, client, trusted },
      resolveLabResultEntry: async () => foreign ? null : { id: "entry-a", result_status: "entered" },
    },
  };
  const postRoute = load(`${base}route.ts`, imports);
  const fileRoute = load(`${base}[attachmentId]/route.ts`, imports);
  const post = (action, fields = {}) => postRoute.POST(new Request("https://example.test/attachments", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, resultId: "result-a", ...fields }),
  }), { params: Promise.resolve({ workspaceId: "workspace-a" }) });
  const file = (method, attachmentId, download = false) => fileRoute[method](new Request(
    `https://example.test/attachments/${attachmentId}?resultId=result-a${download ? "&download=1" : ""}`, { method }),
  { params: Promise.resolve({ workspaceId: "workspace-a", attachmentId }) });
  const prepare = async (rowId = "row-a", name = "synthetic.png") => {
    const response = await post("prepare", { rowId, name, mimeType: "image/png", size: 179 });
    assert.equal(response.status, 201);
    const body = await response.json();
    const bytes = new Uint8Array(179);
    if (!corrupt) bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    objects.set(body.objectPath, new Blob([bytes], { type: "image/png" }));
    return body.attachmentId;
  };
  return { prepare, post, file, records, objects, setActor(value) { actor = value; }, setOwner(value) { owner = value; } };
}

for (const rowId of ["row-a", null]) test(`generated ${rowId === null ? "overall" : "item"} prepare UUID completes finalize, preview, download and deletion`, async () => {
  const h = harness();
  const attachmentId = await h.prepare(rowId);
  assert.equal(h.records.get(attachmentId).row_id, rowId);
  assert.equal((await h.file("GET", attachmentId)).status, 404);
  assert.equal((await h.post("finalize", { attachmentId })).status, 200);
  const readyAt = h.records.get(attachmentId).ready_at;
  assert.ok(readyAt);
  assert.equal((await h.post("finalize", { attachmentId })).status, 200);
  assert.equal(h.records.get(attachmentId).ready_at, readyAt);
  const preview = await h.file("GET", attachmentId);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("Content-Disposition"), /^inline;/);
  assert.equal((await preview.arrayBuffer()).byteLength, 179);
  const download = await h.file("GET", attachmentId, true);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("Content-Disposition"), /^attachment;/);
  assert.equal(download.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await h.file("DELETE", attachmentId)).status, 200);
  assert.equal(h.objects.size, 0);
  assert.ok(h.records.get(attachmentId).storage_deleted_at);
  assert.equal((await h.file("GET", attachmentId)).status, 404);
});

for (const [label, name, fallback] of [
  ["ASCII", "report.png", "report.png"],
  ["Korean", "검사 결과.png", "__ __.png"],
  ["decomposed Korean", "생성된 이미지 1 (2).png".normalize("NFD"), "_________ ______ 1 (2).png"],
  ["emoji", "검사🧪.png", "____.png"],
  ["quoted ASCII", "report's (review)!* \"quoted\" \\copy.png", "report's (review)!* _quoted_ _copy.png"],
]) test(`${label} filename survives protected preview and download headers`, async () => {
  const h = harness();
  const attachmentId = await h.prepare(null, name);
  assert.equal((await h.post("finalize", { attachmentId })).status, 200);
  for (const download of [false, true]) {
    const response = await h.file("GET", attachmentId, download);
    assert.equal(response.status, 200);
    const disposition = response.headers.get("Content-Disposition");
    assert.ok(disposition.startsWith(`${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''`));
    assert.match(disposition, /^[\x20-\x7E]+$/);
    const encodedName = disposition.split("filename*=UTF-8''")[1];
    assert.equal(decodeURIComponent(encodedName), name);
    assert.doesNotMatch(encodedName, /[!'()*]/);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(await h.objects.values().next().value.arrayBuffer()));
  }
  assert.equal(h.records.get(attachmentId).file_name, name);
});

test("generated pending UUID can be discarded idempotently and cannot then finalize", async () => {
  const h = harness();
  const attachmentId = await h.prepare();
  const discarded = await h.post("discard", { attachmentId });
  assert.equal(discarded.status, 200);
  assert.equal((await discarded.json()).storageCleanupPending, true);
  assert.ok(h.records.get(attachmentId).abandoned_at);
  assert.equal((await h.post("discard", { attachmentId })).status, 200);
  assert.equal((await h.post("finalize", { attachmentId })).status, 404);
});

test("invalid UUIDs are rejected across finalize, discard, preview and delete", async () => {
  const h = harness();
  for (const attachmentId of ["not-a-uuid", "be479a88-5cc5-487c-94b96c4dad31f660", "../file"]) {
    for (const action of ["finalize", "discard"]) assert.equal((await h.post(action, { attachmentId })).status, 400);
    for (const method of ["GET", "DELETE"]) assert.equal((await h.file(method, attachmentId)).status, 400);
  }
});

test("another uploader cannot finalize or discard a pending file", async () => {
  const h = harness();
  const attachmentId = await h.prepare();
  h.setActor("actor-b");
  for (const action of ["finalize", "discard"]) assert.equal((await h.post(action, { attachmentId })).status, 404);
  assert.equal(h.records.get(attachmentId).ready_at, null);
  assert.equal(h.records.get(attachmentId).abandoned_at, null);
});

test("invalid file content cannot become ready and remains discardable", async () => {
  const h = harness({ corrupt: true });
  const attachmentId = await h.prepare();
  assert.equal((await h.post("finalize", { attachmentId })).status, 415);
  assert.equal(h.records.get(attachmentId).ready_at, null);
  assert.equal((await h.post("discard", { attachmentId })).status, 200);
});

test("a failed storage removal still tombstones the file and blocks reads", async () => {
  const h = harness({ cleanupFails: true });
  const attachmentId = await h.prepare();
  assert.equal((await h.post("finalize", { attachmentId })).status, 200);
  const removed = await h.file("DELETE", attachmentId);
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).storageCleanupPending, true);
  assert.equal(h.objects.size, 1);
  assert.equal((await h.file("GET", attachmentId)).status, 404);
});

test("permission and result ownership denials stop file actions", async () => {
  const attachmentId = "be479a88-5cc5-487c-94b9-6c4dad31f660";
  for (const [options, postStatus, fileStatus] of [[{ denied: true }, 403, 403], [{ foreign: true }, 409, 404]]) {
    const h = harness(options);
    for (const action of ["finalize", "discard"]) assert.equal((await h.post(action, { attachmentId })).status, postStatus);
    for (const method of ["GET", "DELETE"]) assert.equal((await h.file(method, attachmentId)).status, fileStatus);
    assert.equal(h.records.size, 0);
  }
});

 test("handoff blocks the old uploader from publication and deletion while allowing pending cleanup", async () => {
  const h = harness();
  const id = await h.prepare();
  h.setOwner("actor-b");
  assert.equal((await h.post("finalize", { attachmentId: id })).status, 403);
  assert.equal(h.records.get(id).ready_at, null);
  assert.equal((await h.post("discard", { attachmentId: id })).status, 200);
  const next = harness();
  const ready = await next.prepare();
  assert.equal((await next.post("finalize", { attachmentId: ready })).status, 200);
  next.setOwner("actor-b");
  assert.equal((await next.file("DELETE", ready)).status, 403);
  assert.equal(next.records.get(ready).deleted_at, null);
  next.setActor("actor-b");
  assert.equal((await next.file("DELETE", ready)).status, 200);
 });
