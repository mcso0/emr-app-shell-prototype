import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../../src/features/auth/workspace-session";
import { createMockChartOrderBillingSummaryFromMutationRows } from "../../src/features/chart/chart-order-billing-summary-contract";
import type { ChartLiveQueueRecord } from "../../src/features/chart/chart-live-queue";
import type { ChartOrderDraftInput, ChartOrderRuntimeRow } from "../../src/features/chart/server-order-draft-persistence-core";
import type { LabProfileConfiguration } from "../../src/features/lab-imaging/server-result-profile-core";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../../src/features/patient-vitals/workspace-vital-settings";
import type { SoapNote } from "../../src/types/emr-domain";

export const workspaceId = "workspace-chart-save-session-synthetic";
const timestamp = "2026-10-05T00:00:00.000Z";
export const etags = {
  a0: `"${"a".repeat(64)}"`, a1: `"${"b".repeat(64)}"`, a2: `"${"c".repeat(64)}"`,
  b0: `"${"d".repeat(64)}"`, b1: `"${"e".repeat(64)}"`,
};
export const patients = {
  a: { encounterId: "encounter-save-session-a", chartId: "chart-save-session-a", orderId: "97070000-0000-4000-8000-000000000031", name: "합성환자 A", orderName: "합성 검사 A", amount: 1100 },
  b: { encounterId: "encounter-save-session-b", chartId: "chart-save-session-b", orderId: "97070000-0000-4000-8000-000000000032", name: "합성환자 B", orderName: "합성 검사 B", amount: 7700 },
} as const;
type PatientKey = keyof typeof patients;

function queueRecord(key: PatientKey, sortOrder: number): ChartLiveQueueRecord {
  const p = patients[key];
  const patientId = `patient-${key}`;
  const guardianId = `guardian-${key}`;
  return {
    encounter: { id: p.encounterId, workspaceId, patientId, guardianId, primaryVeterinarianId: "user-vet", encounterNo: `E-SYNTHETIC-${key}`, visitPurpose: "합성 저장 테스트", status: "in_consultation", checkedInAt: timestamp, startedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    patient: { id: patientId, workspaceId, patientNo: `P-SYNTHETIC-${key}`, name: p.name, species: "dog", breed: "Pomeranian", estimatedAgeText: "1세", sex: "male", handlingCautionLocked: false, status: "active", createdAt: timestamp, updatedAt: timestamp },
    primaryGuardian: { id: guardianId, workspaceId, name: `합성 보호자 ${key}`, mobilePhone: "010-0000-0000", createdAt: timestamp, updatedAt: timestamp },
    queueEntry: { id: `queue-${key}`, workspaceId, encounterId: p.encounterId, queueType: "consultation", status: "in_progress", priority: "normal", sortOrder, enteredAt: timestamp },
    veterinarianName: "합성 수의사",
  };
}

function chart(key: PatientKey): SoapNote {
  return { id: patients[key].chartId, encounterId: patients[key].encounterId, authorUserId: "user-vet", subjective: "합성 저장 테스트", objective: "", assessment: "", plan: "", status: "autosaved", clinicalAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
}

export function runtimeRow(key: PatientKey, quantity = 1): ChartOrderRuntimeRow {
  const p = patients[key];
  // Fixed synthetic prices distinguish scopes; these tests do not exercise pricing policy.
  const lineTotal = p.amount * quantity;
  const detailInputs = { specimenType: "blood", testPanel: "CBC", collectionCondition: "합성 검체" };
  return {
    orderId: p.orderId, workspaceId, encounterId: p.encounterId, originChartId: p.chartId,
    rowType: "individual", orderType: "lab", clinicalOrderType: "clinical_lab", destinationModule: "lab", executionMode: "routed",
    detailInputs, detailSchemaVersion: 1, priority: "normal", billingEligible: true, revisionNo: 0, parentOrderId: null,
    sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null,
    workspaceCatalogItemId: `catalog-synthetic-${key}`, workspaceCatalogRevision: 1, dispensingLineage: null,
    quantity, quantitySource: "manual", unitPriceSnapshot: p.amount, lineTotalSnapshot: lineTotal, snapshotSchemaVersion: 0, snapshotHash: null,
    appliedSnapshot: { billingName: p.orderName, inHospitalOrderName: p.orderName, standardOrderName: p.orderName, billingReflectionEnabled: true, categoryGroup: "laboratory", clinicalOrderType: "clinical_lab", destinationModule: "lab", detailInputs, detailSchemaVersion: 1, executionMode: "routed", lineTotalSnapshot: lineTotal, orderType: "lab", priceKrw: p.amount, quantity, rowType: "individual", workspaceCatalogItemId: `catalog-synthetic-${key}`, workspaceCatalogRevision: 1 },
    appliedPriceSnapshot: {}, calculationInputs: {}, calculationOutputs: {}, billingReflectionEnabled: true, orderConfirmationStatus: "draft", status: "requested", updatedAt: timestamp,
  };
}

function gate() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}
export type HeldSave = {
  input: ChartOrderDraftInput;
  headers: Record<string, string>;
  succeed: (etag: string) => Promise<void>;
  fail: (status: 409 | 503) => Promise<void>;
};

export async function installChartSaveSession(page: Page, { holdOldReads = false } = {}) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Synthetic chart tests require a local baseURL");
  const server = new URL(baseURL);
  if (server.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(server.hostname)) {
    throw new Error("Synthetic chart tests require an HTTP localhost server");
  }
  const origin = server.origin;
  const queue = [queueRecord("a", 10), queueRecord("b", 20)];
  const state = { a: { etag: etags.a0, rows: [runtimeRow("a")] }, b: { etag: etags.b0, rows: [runtimeRow("b")] } };
  const saves: HeldSave[] = [];
  const requests: Array<{ method: string; path: string }> = [];
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  let activeSaves = 0;
  let maximumActiveSaves = 0;
  const oldReads = gate();
  let heldOldReadCount = 0;
  const summary = (key: PatientKey, rows = state[key].rows, etag = state[key].etag) => createMockChartOrderBillingSummaryFromMutationRows({ encounterId: patients[key].encounterId, etag, generatedAt: timestamp, rows, workspaceId });
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.addInitScript(({ storageKey, workspaceId, timestamp }) => {
    const sessionId = "playwright-default-session";
    localStorage.setItem("clair.mockAuth.session.v1", JSON.stringify({ id: sessionId, role: "hospital_admin", roleLabel: "병원 관리자", storageMode: "local", issuedAt: timestamp }));
    localStorage.setItem(storageKey, JSON.stringify({ currentWorkspaceId: workspaceId,
      workspaces: [{ id: workspaceId, displayName: "합성 저장 테스트 병원", representativeName: "합성 관리자", contactEmail: "admin@save-session.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: sessionId, createdAt: timestamp }],
      memberships: [{ id: "membership-save-session", workspaceId, userSessionId: sessionId, displayName: "합성 관리자", email: "admin@save-session.test", roles: ["hospital_admin"], status: "active", createdAt: timestamp, activatedAt: timestamp }], invitations: [], updatedAt: timestamp,
    }));
  }, { storageKey: SESSION_WORKSPACES_STORAGE_KEY, workspaceId, timestamp });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reject = async () => { unexpected.push(`${method} ${url.origin}${url.pathname}`); await route.abort("blockedbyclient"); };
    if (url.origin !== origin) return reject();
    if (!url.pathname.startsWith("/api/")) {
      // Next's local source-frame lookup is a read despite its POST method.
      if (url.pathname === "/__nextjs_original-stack-frames" && method === "POST") return route.continue();
      if (method !== "GET") return reject();
      return route.continue();
    }
    const path = url.pathname.replace(`/api/workspaces/${workspaceId}/`, "");
    requests.push({ method, path });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (url.pathname === "/api/workspaces" && method === "GET") return reply({ ok: true, workspaces: [{ id: workspaceId, displayName: "합성 저장 테스트 병원" }] });
    if (!url.pathname.startsWith(`/api/workspaces/${workspaceId}/`)) return reject();
    if (path === "app-shell/workspace-tabs" && (method === "GET" || method === "PUT")) {
      // Client tab persistence is intercepted too; it never reaches the local API.
      return reply({ ok: true, payload: method === "PUT" ? request.postDataJSON() : null });
    }
    if (method === "GET" && path === "chart/live-queue") return reply({ ok: true, status: 200, enforcedBy: "chart-live-queue-read", queue });
    if (method === "GET" && path === "chart/consultation-rooms") return reply({ workspaceId, rooms: [] });
    if (method === "GET" && path === "chart/diagnosis-catalog") return reply({ ok: true, status: 200, catalog: [], systems: [], diseaseGroups: [], nextCursor: null });
    if (method === "GET" && path === "notifications") return reply({ ok: true, status: 200, workspaceId, notifications: [], counts: { badge: 0, unread: 0, important: 0, archived: 0 }, nextCursor: null, enforcedBy: "live-notification-reader" });
    if (method === "GET" && path === "hospital-admin/order-catalog") return reply({ ok: true, status: 200, rows: [] });
    if (method === "GET" && path === "lab-imaging/result-profiles") {
      const orderId = url.searchParams.get("orderId");
      const catalogItemId = url.searchParams.get("catalogItemId") ??
        (orderId === patients.a.orderId ? "catalog-synthetic-a" : "catalog-synthetic-b");
      const configuration: LabProfileConfiguration = {
        workspaceId, catalogItemId, canConfigure: true, canSelect: true,
        order: orderId ? { id: orderId, updatedAt: timestamp, confirmationStatus: "draft", species: "dog", requiresProfile: false, selectedProfileVersionId: null, selectedDeviceId: null } : null,
        profiles: [], devices: [], bindings: [],
      };
      return reply({ ok: true, configuration });
    }
    if (method === "GET" && path === "vital-settings") return reply({ ok: true, status: 200, ...createDefaultWorkspaceVitalSettingsSnapshot() });
    if (method === "GET" && path === "chart/history") return reply({ ok: true, status: 200, enforcedBy: "chart-patient-history-read", items: [], nextCursor: null, totalCount: 0 });

    const encounterId = method === "GET" ? url.searchParams.get("encounterId") : request.postDataJSON()?.encounterId;
    const key = (Object.keys(patients) as PatientKey[]).find(candidate => patients[candidate].encounterId === encounterId);
    if (!key) return reject();
    const record = queue[key === "a" ? 0 : 1];
    if (path === "chart/order-drafts" && method === "PATCH") {
      const input = request.postDataJSON() as ChartOrderDraftInput;
      const release = gate();
      const completed = gate();
      let response: { json: unknown; status: number } | undefined;
      // Snapshot the submitted version before any later local edit or reply.
      const rows = state[key].rows.map(row => {
        const submitted = input.rows?.find(candidate => candidate.orderId === row.orderId);
        if (submitted?.rowType !== "individual") return row;
        const lineTotalSnapshot = patients[key].amount * submitted.quantity;
        return { ...row, quantity: submitted.quantity, lineTotalSnapshot, detailInputs: submitted.detailInputs ?? row.detailInputs, priority: submitted.priority ?? row.priority, appliedSnapshot: { ...row.appliedSnapshot, quantity: submitted.quantity, lineTotalSnapshot } };
      });
      activeSaves += 1;
      maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves);
      saves.push({ input, headers: request.headers(),
        succeed: async etag => { state[key] = { etag, rows }; response = { status: 200, json: { ok: true, status: 200, etag, rows, billingSummary: summary(key, rows, etag) } }; release.release(); await completed.pending; },
        fail: async status => { response = { status, json: { ok: false, status, error: status === 409 ? "revision_conflict" : "db_write_failed" } }; release.release(); await completed.pending; },
      });
      await release.pending;
      activeSaves -= 1;
      await route.fulfill(response!);
      completed.release();
      return;
    }
    if (method !== "GET") return reject();
    if (path === "chart/order-drafts" || path === "chart/order-billing-summary") {
      const snapshot = path === "chart/order-drafts" ? { ok: true, status: 200, ...state[key] } : { ok: true, status: 200, summary: summary(key) };
      if (holdOldReads && key === "a") { heldOldReadCount += 1; await oldReads.pending; }
      return reply(snapshot);
    }
    if (path === "chart/order-actions") return reply({ ok: true, status: 200, etag: state[key].etag, rows: [], orderActions: [] });
    if (path === "chart/order-lifecycle") return reply({ ok: true, status: 200, lifecycles: [] });
    if (path === "chart/order-execution") return reply({ ok: true, status: 200, execution: { workspaceId, encounterId, tasks: [], events: [], revisions: [], queues: [], billingCandidates: [] } });
    if (path === "billing/invoice-candidates") return reply({ ok: true, status: 200, candidates: [] });
    if (path === "chart/encounter-charts") return reply({ ok: true, status: 200, charts: [chart(key)] });
    if (path === "chart/soap-notes") return reply({ ok: true, status: 200, soapNote: chart(key), enforcedBy: "chart-soap-note-persistence" });
    if (path === "chart/diagnoses") return reply({ ok: true, status: 200, diagnoses: [], assessments: [] });
    if (path === "chart/completion") return reply({ ok: true, status: 200, completion: { encounterId, workspaceId, status: "in_consultation", updatedAt: timestamp } });
    if (path === "patient-vitals/latest") return reply({ ok: true, status: 200, canWriteVitals: true, vital: null });
    if (path === "chart/preconsultation-context") return reply({ ok: true, status: 200, canWriteVitals: true, enforcedBy: "chart-preconsultation-context-read", context: { encounter: { ...record.encounter, receptionType: "walk_in" }, queue: record.queueEntry, patient: record.patient, guardian: record.primaryGuardian, veterinarian: { id: "user-vet", displayName: "합성 수의사" }, priorEncounterCount: 0, vitals: [], history: [] } });
    return reject();
  });

  return {
    saves, requests, unexpected, pageErrors,
    get maximumActiveSaves() { return maximumActiveSaves; },
    get heldOldReadCount() { return heldOldReadCount; },
    releaseOldReads: oldReads.release,
    setServerRow: (key: PatientKey, quantity: number, etag: string) => { state[key] = { etag, rows: [runtimeRow(key, quantity)] }; },
    goto: async () => {
      await page.clock.install({ time: new Date("2026-10-05T00:00:00.000Z") });
      await page.goto(`/w/${workspaceId}/treatment?date=2026-10-05&patientId=patient-a&encounterId=${patients.a.encounterId}&chartId=${patients.a.chartId}&modulePanel=open&aside=closed`);
    },
    pauseReadyClock: async () => {
      await expect(page.getByTestId("chart-order-save-status")).toHaveText("저장됨");
      await page.clock.pauseAt(new Date("2026-10-05T01:00:00.000Z"));
    },
    assertNoUnexpectedTraffic: () => { expect(unexpected).toEqual([]); expect(pageErrors).toEqual([]); },
  };
}
