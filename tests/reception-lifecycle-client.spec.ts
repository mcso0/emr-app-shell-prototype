import { expect, test } from "@playwright/test";
import { submitReceptionEncounterCancel, submitReceptionEncounterRestore, submitReceptionAppointmentRestore } from "../src/features/reception/reception-lifecycle-client";

import type { ReceptionEncounterCancelResponse } from "../src/features/reception/encounter-cancel";
import type { ReceptionEncounterRestoreResponse } from "../src/features/reception/encounter-restore";
import type { ReceptionAppointmentRestoreResponse } from "../src/features/reception/appointment-restore";

type EncounterInput = { actorRole?: string; encounterId: string; workspaceId: string };
type AppointmentInput = { actorRole?: string; appointmentId: string; workspaceId: string };
type Client = {
  submitReceptionEncounterCancel: (input: EncounterInput) => Promise<ReceptionEncounterCancelResponse>;
  submitReceptionEncounterRestore: (input: EncounterInput) => Promise<ReceptionEncounterRestoreResponse>;
  submitReceptionAppointmentRestore: (input: AppointmentInput) => Promise<ReceptionAppointmentRestoreResponse>;
};

const client: Client = { submitReceptionEncounterCancel, submitReceptionEncounterRestore, submitReceptionAppointmentRestore };

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; init?: RequestInit }> = [];
test.afterEach(() => { globalThis.fetch = originalFetch; requests.length = 0; });
function respond(body: unknown, status = 200, options?: { networkError?: boolean; jsonError?: boolean }) {
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (options?.networkError) throw new Error("offline");
    return { ok: status >= 200 && status < 300, status, async json() {
      if (options?.jsonError) throw new SyntaxError("invalid-json");
      return body;
    } } as Response;
  };
}
const workspaceId = "workspace /한글?#";
const id = "record /한글?#";
const cases = [
  { name: "cancel", resource: "encounters", action: "cancel", invoke: (workspace: string, record: string, actorRole?: string) => client.submitReceptionEncounterCancel({ workspaceId: workspace, encounterId: record, actorRole }),
    extraOptions: { body: JSON.stringify({ cancelReason: "접수 화면에서 취소" }) }, extraHeaders: { "Content-Type": "application/json" } },
  { name: "encounter restore", resource: "encounters", action: "restore", invoke: (workspace: string, record: string, actorRole?: string) => client.submitReceptionEncounterRestore({ workspaceId: workspace, encounterId: record, actorRole }), extraOptions: {}, extraHeaders: {} },
  { name: "appointment restore", resource: "appointments", action: "restore", invoke: (workspace: string, record: string, actorRole?: string) => client.submitReceptionAppointmentRestore({ workspaceId: workspace, appointmentId: record, actorRole }), extraOptions: {}, extraHeaders: {} },
];

for (const item of cases) {
  test(item.name + " preserves encoded scope, exact request options and returned success identity", async () => {
    const body = { ok: true, status: 200, workspaceId, serverMetadata: { version: 1 } };
    respond(body);
    expect(await item.invoke(workspaceId, id)).toBe(body);
    expect(requests).toEqual([{ url: "/api/workspaces/" + encodeURIComponent(workspaceId) + "/reception/" + item.resource + "/" + encodeURIComponent(id) + "/" + item.action,
      init: { method: "POST", headers: { ...item.extraHeaders, "x-clair-demo-session-user-id": "user-front-desk" }, ...item.extraOptions } }]);
  });

  for (const status of [200, 403]) {
    test(item.name + " preserves domain failure fields and takes HTTP status " + status, async () => {
      const body = { ok: false, status: 409, error: "invalid_input", denialReason: "permission_missing", fieldErrors: { record: "invalid" }, metadata: { retry: false } };
      respond(body, status);
      const result = await item.invoke(workspaceId, id);
      expect(result).toEqual({ ...body, status });
      expect(result).not.toBe(body);
      expect(requests).toHaveLength(1);
    });
  }

  test(item.name + " maps HTTP failure with success body to the existing write failure", async () => {
    respond({ ok: true, status: 200 }, 502);
    expect(await item.invoke(workspaceId, id)).toEqual({ ok: false, status: 502, error: "db_write_failed" });
    expect(requests).toHaveLength(1);
  });

  for (const failure of ["networkError", "jsonError"] as const) {
    test(item.name + " maps " + failure + " to 500 without retries", async () => {
      respond({ ok: true }, 200, { [failure]: true });
      expect(await item.invoke(workspaceId, id)).toEqual({ ok: false, status: 500, error: "db_write_failed" });
      expect(requests).toHaveLength(1);
    });
  }

  test(item.name + " catches malformed scope encoding before sending a request", async () => {
    respond({ ok: true });
    for (const [workspace, record] of [["\ud800", id], [workspaceId, "\ud800"]]) {
      expect(await item.invoke(workspace, record)).toEqual({ ok: false, status: 500, error: "db_write_failed" });
    }
    expect(requests).toHaveLength(0);
  });
}

test("all three requests preserve admin, vet and default demo actor mapping", async () => {
  respond({ ok: true, status: 200 });
  for (const [role, actor] of [[undefined, "user-front-desk"], ["hospital_admin", "user-admin"], ["billing_admin", "user-admin"], ["vet", "user-vet"], ["front_desk", "user-front-desk"], ["technician", "user-front-desk"], ["unknown", "user-front-desk"]]) {
    for (const item of cases) {
      await item.invoke(workspaceId, id, role);
      expect(requests.at(-1)?.init?.headers).toEqual({ ...item.extraHeaders, "x-clair-demo-session-user-id": actor });
    }
  }
  expect(requests).toHaveLength(21);
});
