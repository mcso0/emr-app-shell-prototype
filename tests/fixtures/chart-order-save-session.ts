import { expect, test, type Page, type Request } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../../src/features/auth/workspace-session";
import { createMockChartOrderBillingSummaryFromMutationRows } from "../../src/features/chart/chart-order-billing-summary-contract";
import type { ChartLiveQueueRecord } from "../../src/features/chart/chart-live-queue";
import type { ChartOrderDraftInput, ChartOrderRuntimeRow } from "../../src/features/chart/server-order-draft-persistence-core";
import type { LabProfileConfiguration } from "../../src/features/lab-imaging/server-result-profile-core";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../../src/features/patient-vitals/workspace-vital-settings";
import type { SoapNote } from "../../src/types/emr-domain";

export const workspaceId = "workspace-chart-save-session-synthetic";
export const workspaceBId = "workspace-chart-save-session-synthetic-b";
export const workspaceCId = "workspace-chart-save-session-synthetic-c";
const timestamp = "2026-10-05T00:00:00.000Z";
export const etags = {
  a0: `"${"a".repeat(64)}"`, a1: `"${"b".repeat(64)}"`, a2: `"${"c".repeat(64)}"`,
  b0: `"${"d".repeat(64)}"`, b1: `"${"e".repeat(64)}"`,
};
export const patients = {
  a: { encounterId: "encounter-save-session-a", chartId: "chart-save-session-a", orderId: "97070000-0000-4000-8000-000000000031", name: "합성환자 A", orderName: "합성 검사 A", amount: 1100 },
  b: { encounterId: "encounter-save-session-b", chartId: "chart-save-session-b", orderId: "97070000-0000-4000-8000-000000000032", name: "합성환자 B", orderName: "합성 검사 B", amount: 7700 },
} as const;
export const workspaceBEtags = {
  a0: `"${"f".repeat(64)}"`, a1: `"${"0".repeat(64)}"`, a2: `"${"1".repeat(64)}"`,
  b0: `"${"2".repeat(64)}"`, b1: `"${"3".repeat(64)}"`,
};
export const workspaceBPatients = {
  a: { encounterId: "encounter-workspace-b-a", chartId: "chart-workspace-b-a", orderId: "97070000-0000-4000-8000-000000000033", name: "병원B 합성환자 A", orderName: "병원B 합성 검사 A", amount: 2300 },
  b: { encounterId: "encounter-workspace-b-b", chartId: "chart-workspace-b-b", orderId: "97070000-0000-4000-8000-000000000034", name: "병원B 합성환자 B", orderName: "병원B 합성 검사 B", amount: 9900 },
} as const;
type PatientKey = keyof typeof patients;
export const workspaceCEtags = {
  a0: `"${"4".repeat(64)}"`, a1: `"${"5".repeat(64)}"`,
  b0: `"${"6".repeat(64)}"`, b1: `"${"7".repeat(64)}"`,
} as const;
export const workspaceCPatients = {
  a: { encounterId: "encounter-workspace-c-a", chartId: "chart-workspace-c-a", orderId: "97070000-0000-4000-8000-000000000035", name: "병원C 합성환자 A", orderName: "병원C 합성 검사 A", amount: 4100 },
  b: { encounterId: "encounter-workspace-c-b", chartId: "chart-workspace-c-b", orderId: "97070000-0000-4000-8000-000000000036", name: "병원C 합성환자 B", orderName: "병원C 합성 검사 B", amount: 8800 },
} as const;
const patientsForWorkspace = (id: string) => id === workspaceCId ? workspaceCPatients : id === workspaceBId ? workspaceBPatients : patients;
const scopeSuffix = (id: string, key: PatientKey) => id === workspaceId ? key : `${id === workspaceCId ? "workspace-c" : "workspace-b"}-${key}`;
const workspaceDisplayName = (id: string) => id === workspaceId ? "합성 저장 테스트 병원" : `합성 저장 테스트 병원 ${id === workspaceCId ? "C" : "B"}`;

function queueRecord(key: PatientKey, sortOrder: number, targetWorkspaceId = workspaceId): ChartLiveQueueRecord {
  const p = patientsForWorkspace(targetWorkspaceId)[key];
  const suffix = scopeSuffix(targetWorkspaceId, key);
  const patientId = `patient-${suffix}`;
  const guardianId = `guardian-${suffix}`;
  return {
    encounter: { id: p.encounterId, workspaceId: targetWorkspaceId, patientId, guardianId, primaryVeterinarianId: "user-vet", encounterNo: `E-SYNTHETIC-${suffix}`, visitPurpose: "합성 저장 테스트", status: "in_consultation", checkedInAt: timestamp, startedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    patient: { id: patientId, workspaceId: targetWorkspaceId, patientNo: `P-SYNTHETIC-${suffix}`, name: p.name, species: "dog", breed: "Pomeranian", estimatedAgeText: "1세", sex: "male", handlingCautionLocked: false, status: "active", createdAt: timestamp, updatedAt: timestamp },
    primaryGuardian: { id: guardianId, workspaceId: targetWorkspaceId, name: `합성 보호자 ${suffix}`, mobilePhone: "010-0000-0000", createdAt: timestamp, updatedAt: timestamp },
    queueEntry: { id: `queue-${suffix}`, workspaceId: targetWorkspaceId, encounterId: p.encounterId, queueType: "consultation", status: "in_progress", priority: "normal", sortOrder, enteredAt: timestamp },
    veterinarianName: "합성 수의사",
  };
}

function chart(key: PatientKey, targetWorkspaceId = workspaceId): SoapNote {
  const p = patientsForWorkspace(targetWorkspaceId)[key];
  return { id: p.chartId, encounterId: p.encounterId, authorUserId: "user-vet", subjective: "합성 저장 테스트", objective: "", assessment: "", plan: "", status: "autosaved", clinicalAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
}

export function runtimeRow(key: PatientKey, quantity = 1, targetWorkspaceId = workspaceId): ChartOrderRuntimeRow {
  const p = patientsForWorkspace(targetWorkspaceId)[key];
  const catalogItemId = `catalog-synthetic-${scopeSuffix(targetWorkspaceId, key)}`;
  // Fixed synthetic prices distinguish scopes; these tests do not exercise pricing policy.
  const lineTotal = p.amount * quantity;
  const detailInputs = { specimenType: "blood", testPanel: "CBC", collectionCondition: "합성 검체" };
  return {
    orderId: p.orderId, workspaceId: targetWorkspaceId, encounterId: p.encounterId, originChartId: p.chartId,
    rowType: "individual", orderType: "lab", clinicalOrderType: "clinical_lab", destinationModule: "lab", executionMode: "routed",
    detailInputs, detailSchemaVersion: 1, priority: "normal", billingEligible: true, revisionNo: 0, parentOrderId: null,
    sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null,
    workspaceCatalogItemId: catalogItemId, workspaceCatalogRevision: 1, dispensingLineage: null,
    quantity, quantitySource: "manual", unitPriceSnapshot: p.amount, lineTotalSnapshot: lineTotal, snapshotSchemaVersion: 0, snapshotHash: null,
    appliedSnapshot: { billingName: p.orderName, inHospitalOrderName: p.orderName, standardOrderName: p.orderName, billingReflectionEnabled: true, categoryGroup: "laboratory", clinicalOrderType: "clinical_lab", destinationModule: "lab", detailInputs, detailSchemaVersion: 1, executionMode: "routed", lineTotalSnapshot: lineTotal, orderType: "lab", priceKrw: p.amount, quantity, rowType: "individual", workspaceCatalogItemId: catalogItemId, workspaceCatalogRevision: 1 },
    appliedPriceSnapshot: {}, calculationInputs: {}, calculationOutputs: {}, billingReflectionEnabled: true, orderConfirmationStatus: "draft", status: "requested", updatedAt: timestamp,
  };
}

function gate() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}
export type HeldSave = {
  workspaceId: string;
  ownerKey: string;
  input: ChartOrderDraftInput;
  headers: Record<string, string>;
  succeed: (etag: string) => Promise<void>;
  fail: (status: 409 | 503) => Promise<void>;
};

export async function installChartSaveSession(page: Page, { holdOldReads = false, includeSecondWorkspace = false, includeThirdWorkspace = false } = {}) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Synthetic chart tests require a local baseURL");
  const server = new URL(baseURL);
  if (server.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(server.hostname)) {
    throw new Error("Synthetic chart tests require an HTTP localhost server");
  }
  const origin = server.origin;
  const workspaceIds = includeThirdWorkspace ? [workspaceId, workspaceBId, workspaceCId] : includeSecondWorkspace ? [workspaceId, workspaceBId] : [workspaceId];
  const scopes = new Map(workspaceIds.map(id => {
    const tags = id === workspaceCId ? workspaceCEtags : id === workspaceBId ? workspaceBEtags : etags;
    return [id, {
      queue: [queueRecord("a", 10, id), queueRecord("b", 20, id)],
      state: { a: { etag: tags.a0, rows: [runtimeRow("a", 1, id)] }, b: { etag: tags.b0, rows: [runtimeRow("b", 1, id)] } },
    }];
  }));
  const scopeFor = (id: string) => {
    const scope = scopes.get(id);
    if (!scope) throw new Error(`Unknown synthetic workspace: ${id}`);
    return scope;
  };
  const saves: HeldSave[] = [];
  const requests: Array<{ method: string; path: string; workspaceId?: string; url: string }> = [];
  const saveEvents: Array<{ phase: "started" | "responded"; ownerKey: string; status?: number }> = [];
  const scopedReadDenials: Array<{ workspaceId: string; encounterId: string; status: 404 }> = [];
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  const pendingScriptRequests = new Set<Request>();
  let activeSaves = 0;
  let maximumActiveSaves = 0;
  const activeSavesByOwner = new Map<string, number>();
  const maximumActiveSavesByOwner = new Map<string, number>();
  const oldReads = gate();
  let heldOldReadCount = 0;
  const summary = (id: string, key: PatientKey, rows = scopeFor(id).state[key].rows, etag = scopeFor(id).state[key].etag) => createMockChartOrderBillingSummaryFromMutationRows({ encounterId: patientsForWorkspace(id)[key].encounterId, etag, generatedAt: timestamp, rows, workspaceId: id });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (request.resourceType() === "script") pendingScriptRequests.add(request);
  });
  page.on("requestfinished", request => pendingScriptRequests.delete(request));
  page.on("requestfailed", request => pendingScriptRequests.delete(request));

  await page.addInitScript(({ storageKey, workspaceId, workspaceIds, workspaceNames, timestamp }) => {
    const sessionId = "playwright-default-session";
    localStorage.setItem("clair.mockAuth.session.v1", JSON.stringify({ id: sessionId, role: "hospital_admin", roleLabel: "병원 관리자", storageMode: "local", issuedAt: timestamp }));
    localStorage.setItem(storageKey, JSON.stringify({ currentWorkspaceId: workspaceId,
      workspaces: workspaceIds.map(id => ({ id, displayName: workspaceNames[id], representativeName: "합성 관리자", contactEmail: "admin@save-session.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: sessionId, createdAt: timestamp })),
      memberships: workspaceIds.map(id => ({ id: `membership-save-session-${id}`, workspaceId: id, userSessionId: sessionId, displayName: "합성 관리자", email: "admin@save-session.test", roles: ["hospital_admin"], status: "active", createdAt: timestamp, activatedAt: timestamp })), invitations: [], updatedAt: timestamp,
    }));
  }, { storageKey: SESSION_WORKSPACES_STORAGE_KEY, workspaceId, workspaceIds, workspaceNames: Object.fromEntries(workspaceIds.map(id => [id, workspaceDisplayName(id)])), timestamp });

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
    const requestWorkspaceId = workspaceIds.find(id => url.pathname.startsWith(`/api/workspaces/${id}/`));
    const path = requestWorkspaceId ? url.pathname.slice(`/api/workspaces/${requestWorkspaceId}/`.length) : url.pathname;
    requests.push({ method, path, workspaceId: requestWorkspaceId, url: url.pathname + url.search });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (url.pathname === "/api/workspaces" && method === "GET") return reply({ ok: true, workspaces: workspaceIds.map(id => ({ id, displayName: workspaceDisplayName(id) })) });
    if (!requestWorkspaceId) return reject();
    const { queue, state } = scopeFor(requestWorkspaceId);
    const scopePatients = patientsForWorkspace(requestWorkspaceId);
    if (path === "app-shell/workspace-tabs" && (method === "GET" || method === "PUT")) {
      // Client tab persistence is intercepted too; it never reaches the local API.
      return reply({ ok: true, payload: method === "PUT" ? request.postDataJSON() : null });
    }
    if (method === "GET" && path === "chart/live-queue") return reply({ ok: true, status: 200, enforcedBy: "chart-live-queue-read", queue });
    if (method === "GET" && path === "chart/consultation-rooms") return reply({ workspaceId: requestWorkspaceId, rooms: [] });
    if (method === "GET" && path === "chart/diagnosis-catalog") return reply({ ok: true, status: 200, catalog: [], systems: [], diseaseGroups: [], nextCursor: null });
    if (method === "GET" && path === "notifications") return reply({ ok: true, status: 200, workspaceId: requestWorkspaceId, notifications: [], counts: { badge: 0, unread: 0, important: 0, archived: 0 }, nextCursor: null, enforcedBy: "live-notification-reader" });
    if (method === "GET" && path === "hospital-admin/order-catalog") return reply({ ok: true, status: 200, rows: [] });
    if (method === "GET" && path === "lab-imaging/result-profiles") {
      const orderId = url.searchParams.get("orderId");
      const catalogItemId = url.searchParams.get("catalogItemId") ??
        runtimeRow(orderId === scopePatients.a.orderId ? "a" : "b", 1, requestWorkspaceId).workspaceCatalogItemId;
      const configuration: LabProfileConfiguration = {
        workspaceId: requestWorkspaceId, catalogItemId, canConfigure: true, canSelect: true,
        order: orderId ? { id: orderId, updatedAt: timestamp, confirmationStatus: "draft", species: "dog", requiresProfile: false, selectedProfileVersionId: null, selectedDeviceId: null } : null,
        profiles: [], devices: [], bindings: [],
      };
      return reply({ ok: true, configuration });
    }
    if (method === "GET" && path === "vital-settings") return reply({ ok: true, status: 200, ...createDefaultWorkspaceVitalSettingsSnapshot() });
    if (method === "GET" && path === "chart/history") return reply({ ok: true, status: 200, enforcedBy: "chart-patient-history-read", items: [], nextCursor: null, totalCount: 0 });

    const encounterId = method === "GET" ? url.searchParams.get("encounterId") : request.postDataJSON()?.encounterId;
    const key = (Object.keys(scopePatients) as PatientKey[]).find(candidate => scopePatients[candidate].encounterId === encounterId);
    // SPA workspace changes briefly request the old encounter's latest vital.
    // Match the real reader's encounter_unavailable/404 contract; never return foreign data.
    if (!key && method === "GET" && path === "patient-vitals/latest" && typeof encounterId === "string" &&
      workspaceIds.some(id => Object.values(patientsForWorkspace(id)).some(patient => patient.encounterId === encounterId))) {
      scopedReadDenials.push({ workspaceId: requestWorkspaceId, encounterId, status: 404 });
      return reply({ ok: false, status: 404, error: "encounter_unavailable" }, 404);
    }
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
        const lineTotalSnapshot = scopePatients[key].amount * submitted.quantity;
        return { ...row, quantity: submitted.quantity, lineTotalSnapshot, detailInputs: submitted.detailInputs ?? row.detailInputs, priority: submitted.priority ?? row.priority, appliedSnapshot: { ...row.appliedSnapshot, quantity: submitted.quantity, lineTotalSnapshot } };
      });
      activeSaves += 1;
      maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves);
      const ownerKey = `${requestWorkspaceId}:${input.encounterId}:${input.chartId}:${request.headers()["x-clair-demo-session-user-id"]}`;
      const activeForOwner = (activeSavesByOwner.get(ownerKey) ?? 0) + 1;
      activeSavesByOwner.set(ownerKey, activeForOwner);
      maximumActiveSavesByOwner.set(ownerKey, Math.max(maximumActiveSavesByOwner.get(ownerKey) ?? 0, activeForOwner));
      saveEvents.push({ phase: "started", ownerKey });
      saves.push({ workspaceId: requestWorkspaceId, ownerKey, input, headers: request.headers(),
        succeed: async etag => { state[key] = { etag, rows }; response = { status: 200, json: { ok: true, status: 200, etag, rows, billingSummary: summary(requestWorkspaceId, key, rows, etag) } }; release.release(); await completed.pending; },
        fail: async status => { response = { status, json: { ok: false, status, error: status === 409 ? "revision_conflict" : "db_write_failed" } }; release.release(); await completed.pending; },
      });
      await release.pending;
      activeSaves -= 1;
      activeSavesByOwner.set(ownerKey, (activeSavesByOwner.get(ownerKey) ?? 1) - 1);
      await route.fulfill(response!);
      saveEvents.push({ phase: "responded", ownerKey, status: response!.status });
      completed.release();
      return;
    }
    if (method !== "GET") return reject();
    if (path === "chart/order-drafts" || path === "chart/order-billing-summary") {
      const snapshot = path === "chart/order-drafts" ? { ok: true, status: 200, ...state[key] } : { ok: true, status: 200, summary: summary(requestWorkspaceId, key) };
      if (holdOldReads && key === "a") { heldOldReadCount += 1; await oldReads.pending; }
      return reply(snapshot);
    }
    if (path === "chart/order-actions") return reply({ ok: true, status: 200, etag: state[key].etag, rows: [], orderActions: [] });
    if (path === "chart/order-lifecycle") return reply({ ok: true, status: 200, lifecycles: [] });
    if (path === "chart/order-execution") return reply({ ok: true, status: 200, execution: { workspaceId: requestWorkspaceId, encounterId, tasks: [], events: [], revisions: [], queues: [], billingCandidates: [] } });
    if (path === "billing/invoice-candidates") return reply({ ok: true, status: 200, candidates: [] });
    if (path === "chart/encounter-charts") return reply({ ok: true, status: 200, charts: [chart(key, requestWorkspaceId)] });
    if (path === "chart/soap-notes") return reply({ ok: true, status: 200, soapNote: chart(key, requestWorkspaceId), enforcedBy: "chart-soap-note-persistence" });
    if (path === "chart/diagnoses") return reply({ ok: true, status: 200, diagnoses: [], assessments: [] });
    if (path === "chart/completion") return reply({ ok: true, status: 200, completion: { encounterId, workspaceId: requestWorkspaceId, status: "in_consultation", updatedAt: timestamp } });
    if (path === "patient-vitals/latest") return reply({ ok: true, status: 200, canWriteVitals: true, vital: null });
    if (path === "chart/preconsultation-context") return reply({ ok: true, status: 200, canWriteVitals: true, enforcedBy: "chart-preconsultation-context-read", context: { encounter: { ...record.encounter, receptionType: "walk_in" }, queue: record.queueEntry, patient: record.patient, guardian: record.primaryGuardian, veterinarian: { id: "user-vet", displayName: "합성 수의사" }, priorEncounterCount: 0, vitals: [], history: [] } });
    return reject();
  });

  return {
    saves, requests, unexpected, pageErrors, saveEvents, scopedReadDenials, maximumActiveSavesByOwner,
    get maximumActiveSaves() { return maximumActiveSaves; },
    get heldOldReadCount() { return heldOldReadCount; },
    releaseOldReads: oldReads.release,
    setServerRow: (key: PatientKey, quantity: number, etag: string, targetWorkspaceId = workspaceId) => { scopeFor(targetWorkspaceId).state[key] = { etag, rows: [runtimeRow(key, quantity, targetWorkspaceId)] }; },
    goto: async () => {
      await page.clock.install({ time: new Date("2026-10-05T00:00:00.000Z") });
      await page.goto(`/w/${workspaceId}/treatment?date=2026-10-05&patientId=patient-a&encounterId=${patients.a.encounterId}&chartId=${patients.a.chartId}&modulePanel=open&aside=closed`);
    },
    pauseReadyClock: async () => {
      await expect(page.getByTestId("chart-order-save-status")).toHaveText("저장됨");
      // The one-hour jump must not expire a still-downloading webpack chunk.
      // Leave intentionally held API reads/saves pending for the regression.
      await expect.poll(() => pendingScriptRequests.size).toBe(0);
      await page.clock.pauseAt(new Date("2026-10-05T01:00:00.000Z"));
    },
    assertNoUnexpectedTraffic: () => { expect(unexpected).toEqual([]); expect(pageErrors).toEqual([]); },
  };
}
