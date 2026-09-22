import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  finalizeSoapAttachment,
  prepareSoapAttachment,
  readSoapAttachment,
  soapAttachmentUrl,
  validateSoapAttachmentMetadata,
  type SoapAttachmentGateway,
  type SoapAttachmentRecord,
} from "../src/features/chart/soap-attachment-core";
import { validateAndProjectSoapDocument } from "../src/features/chart/chart-soap-document";
import { uploadSoapAttachment } from "../src/features/chart/soap-attachment-client";

const workspaceId = "workspace-a";
const encounterId = "11111111-1111-4111-8111-111111111111";
const attachmentId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "user-vet";
const permissionAdapter = createMockWorkspacePermissionAdapter({
  users: [{ id: actorUserId, status: "active" }],
  memberships: [{ id: "member-vet", workspaceId, userId: actorUserId, roles: ["vet"], status: "active" }],
});

function gateway(status = "in_consultation") {
  let record: SoapAttachmentRecord | null = null;
  let bytes: Uint8Array = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  let mimeType = "image/png";
  const adapter: SoapAttachmentGateway = {
    async encounterStatus(requestedWorkspace, requestedEncounter) {
      return requestedWorkspace === workspaceId && requestedEncounter === encounterId ? status : null;
    },
    async insertPending(next) { record = next; return true; },
    async find(requestedWorkspace, requestedEncounter, id) {
      return record?.workspaceId === requestedWorkspace && record.encounterId === requestedEncounter && record.id === id ? record : null;
    },
    async createUploadUrl() { return "https://storage.example/upload?token=secret"; },
    async download() { return { bytes, contentType: mimeType }; },
    async markReady() { if (!record) return false; record.ready = true; return true; },
    async signRead() { return "https://storage.example/private/read?token=secret"; },
    async discard() { record = null; return true; },
  };
  return { adapter, getRecord: () => record, setBytes: (next: Uint8Array) => { bytes = next; }, setMimeType: (next: string) => { mimeType = next; } };
}

test("SOAP attachment prepares, finalizes once, and reads through scoped private URL", async () => {
  const store = gateway();
  const prepare = await prepareSoapAttachment({
    actorUserId, workspaceId, encounterId, id: attachmentId,
    mimeType: "image/png", size: 9, name: "synthetic.png", permissionAdapter, gateway: store.adapter,
  });
  expect(prepare).toMatchObject({ ok: true, status: 201, value: { attachmentId } });
  expect(store.getRecord()?.ready).toBe(false);

  const finalizeInput = { actorUserId, workspaceId, encounterId, attachmentId, permissionAdapter, gateway: store.adapter };
  const first = await finalizeSoapAttachment(finalizeInput);
  expect(first).toMatchObject({ ok: true, value: { id: attachmentId, url: soapAttachmentUrl(workspaceId, encounterId, attachmentId) } });
  expect(await finalizeSoapAttachment(finalizeInput)).toEqual(first);
  expect(await readSoapAttachment(finalizeInput)).toMatchObject({ ok: true, status: 200 });
  expect(await readSoapAttachment({ ...finalizeInput, encounterId: "33333333-3333-4333-8333-333333333333" })).toMatchObject({ ok: false });
});

test("SOAP attachment rejects unauthorized, foreign scope, invalid media and stale encounter", async () => {
  const store = gateway();
  const base = { actorUserId, workspaceId, encounterId, id: attachmentId, mimeType: "image/png", size: 9, name: "synthetic.png", permissionAdapter, gateway: store.adapter };
  expect(await prepareSoapAttachment({ ...base, actorUserId: null })).toMatchObject({ ok: false, status: 401 });
  expect(await prepareSoapAttachment({ ...base, workspaceId: "workspace-b" })).toMatchObject({ ok: false, status: 403 });
  expect(await prepareSoapAttachment({ ...base, encounterId: "33333333-3333-4333-8333-333333333333" })).toMatchObject({ ok: false, status: 409 });
  expect(await prepareSoapAttachment({ ...base, mimeType: "image/svg+xml" })).toMatchObject({ ok: false, status: 415 });
  expect(await prepareSoapAttachment({ ...base, size: 5 * 1024 * 1024 + 1 })).toMatchObject({ ok: false, status: 413 });
  expect(validateSoapAttachmentMetadata({ mimeType: "constructor", size: 1, name: "fake" })).toMatchObject({ ok: false });
  expect(validateSoapAttachmentMetadata({ mimeType: "toString", size: 1, name: "fake" })).toMatchObject({ ok: false });
  expect(await prepareSoapAttachment({ ...base, gateway: gateway("signed").adapter })).toMatchObject({ ok: false, status: 409 });
});

test("SOAP attachment rejects mismatched bytes before ready and direct forged document references", async () => {
  const store = gateway();
  const base = { actorUserId, workspaceId, encounterId, attachmentId, permissionAdapter, gateway: store.adapter };
  await prepareSoapAttachment({ ...base, id: attachmentId, mimeType: "image/png", size: 9, name: "synthetic.png" });
  store.setBytes(Uint8Array.from([60, 115, 118, 103, 32, 32, 32, 32, 32]));
  expect(await finalizeSoapAttachment(base)).toMatchObject({ ok: false, status: 415 });
  expect(store.getRecord()?.ready).toBe(false);
  expect(await readSoapAttachment(base)).toMatchObject({ ok: false, status: 403 });

  const media = {
    id: "image-1", type: "image", props: {
      backgroundColor: "default", textAlignment: "left", name: "synthetic.png",
      url: soapAttachmentUrl(workspaceId, encounterId, attachmentId),
      caption: "", showPreview: true,
    }, children: [],
  };
  const document = { schemaVersion: 2, scopes: [{ scopeKey: "default", scope: "default", systemLabel: "기본 SOAP", blocks: [media] }] };
  expect(validateAndProjectSoapDocument(document, { workspaceId, encounterId })).toMatchObject({ ok: true });
  expect(validateAndProjectSoapDocument(document, { workspaceId: "workspace-b", encounterId })).toMatchObject({ ok: false });
  expect(validateAndProjectSoapDocument({ ...document, scopes: [{ ...document.scopes[0], blocks: [{ ...media, props: { ...media.props, url: "https://evil.example/image.png" } }] }] }, { workspaceId, encounterId })).toMatchObject({ ok: false });
});

test("SOAP table accepts native cells and rejects oversized or forged structures", () => {
  const cell = (content: unknown[] = []) => ({ type: "tableCell", props: {
    backgroundColor: "default", textColor: "default", textAlignment: "left", colspan: 1, rowspan: 1,
  }, content });
  const table = {
    id: "table-1", type: "table", props: { textColor: "default" },
    content: { type: "tableContent", columnWidths: [null, null], rows: [
      { cells: [cell([{ type: "text", text: "검사", styles: {} }]), cell([{ type: "text", text: "정상", styles: {} }])] },
      { cells: [cell(), cell()] },
    ] }, children: [],
  };
  const document = { schemaVersion: 1, blocks: [
    { id: "section-1", type: "soapSection", props: { kind: "objective", label: "객관적", systemLabel: "기본 SOAP", scope: "default" }, children: [table] },
  ] };
  expect(validateAndProjectSoapDocument(document)).toMatchObject({ ok: true, projection: { objective: "검사\t정상" } });
  const replace = (next: unknown) => ({ ...document, blocks: [{ ...document.blocks[0], children: [next] }] });
  expect(validateAndProjectSoapDocument(replace({ ...table, content: { ...table.content, headerRows: "1" } }))).toMatchObject({ ok: false });
  expect(validateAndProjectSoapDocument(replace({ ...table, content: { ...table.content, rows: [{ cells: [cell([],), { ...cell(), props: { ...cell().props, colspan: "1" } }] }] } }))).toMatchObject({ ok: false });
  expect(validateAndProjectSoapDocument(replace({ ...table, content: { ...table.content, rows: [{ cells: [cell(), { ...cell(), props: { ...cell().props, rowspan: 2 } }] }] } }))).toMatchObject({ ok: false });
  expect(validateAndProjectSoapDocument(replace({ ...table, children: [{ id: "nested", type: "paragraph", props: {}, content: [], children: [] }] }))).toMatchObject({ ok: false });
  expect(validateAndProjectSoapDocument(replace({ ...table, content: { ...table.content, columnWidths: [null, null, null] } }))).toMatchObject({ ok: false });
});

test("SOAP upload abort after prepare never starts Storage transfer", async () => {
  const originalFetch = globalThis.fetch;
  const originalXhr = Object.getOwnPropertyDescriptor(globalThis, "XMLHttpRequest");
  const controller = new AbortController();
  const actions: string[] = [];
  let transferStarted = false;
  globalThis.fetch = async (_input, options) => {
    const body = JSON.parse(String(options?.body)) as { action: string };
    actions.push(body.action);
    if (body.action === "prepare") {
      controller.abort();
      return Response.json({ ok: true, attachmentId, uploadUrl: "https://storage.example/upload" });
    }
    return Response.json({ ok: true });
  };
  Object.defineProperty(globalThis, "XMLHttpRequest", {
    configurable: true,
    value: class { constructor() { transferStarted = true; } },
  });
  try {
    await expect(uploadSoapAttachment({
      workspaceId, encounterId,
      file: { type: "image/png", size: 9, name: "synthetic.png" } as File,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(transferStarted).toBe(false);
    expect(actions).toEqual(["prepare", "discard"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalXhr) Object.defineProperty(globalThis, "XMLHttpRequest", originalXhr);
    else Reflect.deleteProperty(globalThis, "XMLHttpRequest");
  }
});
