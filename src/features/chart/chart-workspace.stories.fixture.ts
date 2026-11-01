import { createEditableDispenseRow, recalculateEditableDispenseRow } from "./dispense-edit.stories.fixture";
import { waitFor } from "storybook/test";
import { toast } from "sonner";
import { useMockAuthStore } from "@/features/auth/session-store";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import { parseLabProfileConfiguration, type LabProfileConfiguration } from "@/features/lab-imaging/server-result-profile-core";
import { useLayoutStore } from "@/stores/layout-store";
import { useChartStore } from "./store";
import { createMockChartOrderBillingSummaryFromMutationRows } from "./chart-order-billing-summary-contract";
import type { ChartLiveQueueRecord } from "./chart-live-queue";
import type { ChartPatientHistoryRecord } from "./chart-patient-history";
import type { ChartOrderRuntimeRow } from "./server-order-draft-persistence-core";
import type { Diagnosis, Encounter, Patient, SoapNote } from "@/types/emr-domain";

export type ChartWorkspaceScenario = "historical" | "order-read-error" | "empty-orders" | "dispense-edit";
const id = (kind: number, index = 1) => `98000000-0000-4000-${kind}-${String(index).padStart(12, "0")}`;
const now = "2026-10-11T00:00:00Z";

/** Actual historical chart contracts. Historical completion makes writes unavailable in main. */
export function createChartWorkspaceFixture(scenario: ChartWorkspaceScenario) {
  const editable = scenario === "dispense-edit";
  const workspaceId = `storybook-chart-${crypto.randomUUID()}`;
  const patient: Patient = { id: id(8000), workspaceId, patientNo: "SYN-CHART-P1", name: "합성 차트 환자", species: "cat", sex: "unknown", handlingCautionLocked: false, status: "active", createdAt: now, updatedAt: now };
  const activeEncounter: Encounter = { id: id(8001), workspaceId, patientId: patient.id, encounterNo: "SYN-CURRENT", receptionType: "walk_in", status: editable ? "in_consultation" : "waiting", checkedInAt: now, createdAt: now, updatedAt: now, visitPurpose: "합성 현재 접수" };
  const historicalEncounter: Encounter = { ...activeEncounter, id: editable ? activeEncounter.id : id(8001, 2), encounterNo: "SYN-HISTORY", status: editable ? "in_consultation" : "completed", checkedInAt: "2026-10-09T00:00:00Z", completedAt: "2026-10-09T01:00:00Z", createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T01:00:00Z", visitPurpose: "합성 과거 진료" };
  const chart: SoapNote = { id: id(8002), encounterId: historicalEncounter.id, authorUserId: "synthetic-chart-vet", authorDisplayName: "합성 수의사", subjective: "합성 기록 확인", objective: "합성 관찰 기록", assessment: "합성 평가 기록", plan: "합성 계획 기록", status: editable ? "autosaved" : "signed", signedAt: historicalEncounter.updatedAt, clinicalAt: historicalEncounter.checkedInAt, createdAt: historicalEncounter.createdAt, updatedAt: historicalEncounter.updatedAt };
  const current: ChartLiveQueueRecord = { encounter: activeEncounter, patient, veterinarianName: "합성 수의사", queueEntry: { id: id(8003), workspaceId, encounterId: activeEncounter.id, queueType: "consultation", status: editable ? "in_progress" : "waiting", priority: "normal", enteredAt: now } };
  const historicalDiagnoses: Diagnosis[] = [{ id: id(8006), encounterId: historicalEncounter.id, diagnosisText: "합성 이전 평가", diagnosisType: "confirmed", isPrimary: true, sortOrder: 0, createdByUserId: "synthetic-chart-vet", createdAt: historicalEncounter.createdAt, updatedAt: historicalEncounter.updatedAt }];
  const priorEncounter: Encounter = { ...historicalEncounter, id: id(8001, 3), encounterNo: "SYN-PRIOR", checkedInAt: "2026-10-07T00:00:00Z", completedAt: "2026-10-07T01:00:00Z", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T01:00:00Z" };
  const priorChart: SoapNote = { ...chart, id: id(8002, 2), encounterId: priorEncounter.id, clinicalAt: priorEncounter.checkedInAt, signedAt: priorEncounter.completedAt, createdAt: priorEncounter.createdAt, updatedAt: priorEncounter.updatedAt };
  const history: ChartPatientHistoryRecord[] = [{ encounter: priorEncounter, chart: priorChart, veterinarianName: "합성 수의사", diagnoses: [{ diagnosisText: "합성 이전 평가" }] }, { encounter: historicalEncounter, chart, veterinarianName: "합성 수의사", diagnoses: historicalDiagnoses }, { encounter: activeEncounter, chart: null, queueEntry: current.queueEntry, diagnoses: [] }];
  const rows: ChartOrderRuntimeRow[] = (scenario === "empty-orders" ? [] : ["clinical_lab", "treatment"] as const).map((clinicalOrderType, index) => ({
    requestedByUserId: "synthetic-chart-requester", requestedByDisplayName: "합성 요청 수의사",
    orderId: id(8004, index + 1), originChartId: chart.id, workspaceId, encounterId: historicalEncounter.id, rowType: "individual", orderType: clinicalOrderType === "clinical_lab" ? "lab" : "treatment", clinicalOrderType, destinationModule: clinicalOrderType === "clinical_lab" ? "lab" : "treatment", executionMode: "routed", detailInputs: {}, detailSchemaVersion: 1, priority: "normal", billingEligible: false, revisionNo: 1,
    parentOrderId: null, sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null, workspaceCatalogItemId: id(8005, index + 1), workspaceCatalogRevision: 1, dispensingLineage: null, quantity: 1, quantitySource: "fixed_one", unitPriceSnapshot: 1000, lineTotalSnapshot: 1000, snapshotSchemaVersion: 1, snapshotHash: "a".repeat(64), appliedSnapshot: { displayName: index === 0 ? "합성 임상 검사" : "합성 처치", billingName: index === 0 ? "합성 임상 청구명" : "합성 처치 청구명", standardOrderName: "합성 오더", internalInstruction: "합성 전달 사항" }, appliedPriceSnapshot: {}, calculationInputs: {}, calculationOutputs: {}, billingReflectionEnabled: false, orderConfirmationStatus: "confirmed", status: "completed", updatedAt: historicalEncounter.updatedAt,
  }));
  if (editable) {
    rows.splice(0, rows.length, createEditableDispenseRow(workspaceId, activeEncounter.id, chart.id));
    history.splice(0, history.length, { encounter: activeEncounter, chart, queueEntry: current.queueEntry, diagnoses: [] });
  }
  let saveVersion = 0;
  let etag = editable ? `"${"0".repeat(64)}"` : '"synthetic-chart-orders-v1"';
  const readBillingSummary = () => createMockChartOrderBillingSummaryFromMutationRows({ workspaceId, encounterId: historicalEncounter.id, etag, generatedAt: now, rows: editable ? rows.map(row => ({ ...row, lineTotalSnapshot: Number(row.calculationOutputs.actualDispenseQuantity) * Number(row.unitPriceSnapshot) })) : rows });
  const requests: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
  const unhandled: string[] = [];
  const routes: string[] = [];
  let orderHealthy = scenario !== "order-read-error", orderReads = 0, pending = 0, activeOrderReadWorkflows = 0;
  let unmount: (() => void) | undefined;
  function install() {
    const oldFetch = globalThis.fetch, oldAuth = useMockAuthStore.getState(), oldChart = useChartStore.getState(), oldLayout = useLayoutStore.getState(), oldProfile = usePatientProfileStore.getState(), oldUrl = window.location.href;
    const oldToastIds = new Set(toast.getToasts().map(item => item.id));
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-chart-vet", role: "vet", roleLabel: "합성 수의사", storageMode: "session", issuedAt: now }, hydrate: () => {} });
    useChartStore.setState({ selectedEncounterId: activeEncounter.id, historyViewEncounterId: editable ? "" : historicalEncounter.id, historyViewChartId: editable ? "" : chart.id, selectedChartId: editable ? chart.id : "", encounterCharts: [], encounterChartsStatus: "idle", encounterChartsScope: undefined, chartHistoryRecords: history, chartHistoryScope: { patientId: patient.id, workspaceId }, chartHistoryStatus: "ready", chartHistoryTotalCount: history.length, chartHistoryRefreshNonce: 0, chartHistoryError: undefined, liveQueueRecords: [current], liveQueueScope: { workspaceId, date: "2026-10-11" }, liveQueueStatus: "ready", liveQueueError: undefined, selectedOperatingDateByWorkspace: { [workspaceId]: "2026-10-11" }, pendingConsultationCallEncounterId: "", newChartDialogOpen: false, diagnosisSaving: false, flushActiveChart: undefined, flushOrderEdits: undefined, encounterChartCreating: false });
    useLayoutStore.setState({ contentAsideOpen: false, rightPanelOpen: false, modulePanelOpen: false, activeDrawer: null });
    // The actual queue coordinator reselects the live encounter after its read.
    // Main preserves a requested historical chart only with all three IDs in
    // the route; ChartContent then reapplies that request after hydration.
    const query = new URLSearchParams({ date: "2026-10-11", encounterId: activeEncounter.id, historyEncounterId: historicalEncounter.id, chartId: chart.id });
    if (editable) query.delete("historyEncounterId");
    window.history.replaceState(window.history.state, "", `/w/${workspaceId}/treatment?${query}`);
    const handle: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return oldFetch(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      requests.push({ method, url: `${url.pathname}${url.search}`, body });
      const root = `/api/workspaces/${workspaceId}`;
      const target = url.searchParams.get("encounterId");
      const encounter = target === activeEncounter.id ? activeEncounter : historicalEncounter;
      if (!url.pathname.startsWith(root)) throw new Error("Unexpected synthetic chart workspace");
      if (editable && method === "PATCH" && url.pathname === `${root}/chart/orders/${rows[0].orderId}/actual-dispense`) {
        const row = rows[0];
        if (body?.expectedOrderUpdatedAt !== row.updatedAt) return Response.json({ ok: false, error: "revision_conflict" }, { status: 409 });
        const automatic = body?.mode === "automatic";
        const quantity = automatic ? Number(row.calculationOutputs.proposedActualDispenseQuantity) : Number(body?.actualQuantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ ok: false, error: "invalid_quantity" }, { status: 400 });
        saveVersion++;
        etag = `"${saveVersion.toString(16).padStart(64, "0")}"`;
        row.updatedAt = new Date(Date.parse("2026-10-31T00:00:00Z") + saveVersion * 1000).toISOString();
        row.calculationOutputs = { ...row.calculationOutputs, actualDispenseQuantity: quantity, requiresReconfirmation: false,
          actualDispenseSource: automatic ? "preparation_policy" : "manual_override",
          actualDispenseOverride: automatic ? null : { versionNo: saveVersion },
          totalRequiredDispenseQuantity: quantity, plannedPracticalTotalQuantity: quantity };
        return Response.json({ ok: true, status: 200, enforcedBy: "order-actual-dispense", state: {
          ...row.calculationOutputs, orderId: row.orderId, updatedAt: row.updatedAt,
          overrideId: `synthetic-override-${saveVersion}`, versionNo: saveVersion,
        } });
      }
      if (editable && method === "PATCH" && url.pathname === `${root}/chart/order-drafts`) {
        if (body?.expectedEtag !== etag) return Response.json({ ok: false, status: 412, error: "revision_conflict" }, { status: 412 });
        const inputs = Array.isArray(body.rows) ? body.rows : [];
        const draft = inputs[0] as { orderId?: string; detailInputs?: Record<string, unknown> } | undefined;
        const updated = inputs.length === 1 && draft?.orderId === rows[0].orderId && draft.detailInputs
          ? recalculateEditableDispenseRow(rows[0], draft.detailInputs) : null;
        if (!updated || body.encounterId !== activeEncounter.id || body.chartId !== chart.id) {
          return Response.json({ ok: false, status: 422, error: "invalid_detail_inputs" }, { status: 422 });
        }
        saveVersion++;
        etag = `"${saveVersion.toString(16).padStart(64, "0")}"`;
        updated.updatedAt = new Date(Date.parse("2026-10-31T00:00:00Z") + saveVersion * 1000).toISOString();
        rows[0] = updated;
        return Response.json({ ok: true, status: 200, rows, etag, billingSummary: readBillingSummary() }, { headers: { ETag: etag } });
      }
      if (method !== "GET") return Response.json({ ok: false, denialReason: "permission_missing", status: 403 }, { status: 403 });
      if (editable && url.pathname === `${root}/hospital-admin/order-catalog`) return Response.json({ ok: true, status: 200, rows: [] });
      if (url.pathname === `${root}/chart/live-queue`) return Response.json({ ok: true, status: 200, queue: [current], enforcedBy: "chart-live-queue-read" });
      if (url.pathname === `${root}/chart/history` && url.searchParams.get("patientId") === patient.id) return Response.json({ ok: true, status: 200, items: history, totalCount: history.length, nextCursor: null, enforcedBy: "chart-patient-history-read" });
      if (url.pathname === `${root}/chart/consultation-rooms`) return Response.json({ workspaceId, rooms: [] });
      if (url.pathname === `${root}/vital-settings`) return Response.json(createDefaultWorkspaceVitalSettingsSnapshot(false));
      if (url.pathname === `${root}/patient-vitals/latest`) return Response.json({ ok: true, vital: null, canWriteVitals: false });
      if (url.pathname === `${root}/chart/diagnosis-catalog`) return Response.json({ ok: true, catalog: [], systems: [], diseaseGroups: [], nextCursor: null });
      if (url.pathname === `${root}/lab-imaging/result-profiles` && url.searchParams.get("orderId") === rows[0]?.orderId) {
        const configuration: LabProfileConfiguration = { workspaceId, catalogItemId: null, canConfigure: false, canSelect: false, canRetest: false, order: { id: rows[0].orderId, updatedAt: historicalEncounter.updatedAt, confirmationStatus: "confirmed", species: patient.species, requiresProfile: false, selectedProfileVersionId: null, selectedDeviceId: null }, profiles: [], devices: [], bindings: [] };
        if (!parseLabProfileConfiguration(configuration, workspaceId, rows[0].orderId)) throw new Error("Invalid synthetic confirmed order profile");
        return Response.json({ ok: true, configuration });
      }
      if (url.pathname === `${root}/chart/encounter-charts`) return Response.json({ ok: true, status: 200, charts: target === historicalEncounter.id ? [chart] : [] });
      if (url.pathname === `${root}/chart/soap-notes`) return Response.json({ ok: true, status: 200, soapNote: target === historicalEncounter.id ? chart : null });
      if (url.pathname === `${root}/chart/diagnoses`) return Response.json({ ok: true, status: 200, diagnoses: target === historicalEncounter.id ? historicalDiagnoses : [], assessments: target === historicalEncounter.id ? historicalDiagnoses : [], version: "synthetic-diagnoses-v1" });
      if (url.pathname === `${root}/chart/completion`) return Response.json({ ok: true, status: 200, completion: { encounterId: encounter.id, workspaceId, status: encounter.status, updatedAt: encounter.updatedAt } });
      if (url.pathname === `${root}/chart/order-drafts`) { orderReads++; return orderHealthy ? Response.json({ ok: true, status: 200, rows, etag }) : Response.json({ ok: false, status: 503, error: "db_read_failed" }, { status: 503 }); }
      if (url.pathname === `${root}/chart/order-actions`) return Response.json({ ok: true, status: 200, rows: [], orderActions: [], etag });
      if (url.pathname === `${root}/chart/order-lifecycle`) return Response.json({ ok: true, status: 200, lifecycles: [] });
      if (url.pathname === `${root}/chart/order-execution`) return Response.json({ ok: true, status: 200, execution: { tasks: [], queues: [], billingCandidates: [] } });
      if (url.pathname === `${root}/billing/invoice-candidates`) return Response.json({ ok: true, status: 200, candidates: [] });
      if (url.pathname === `${root}/chart/order-billing-summary`) return Response.json({ ok: true, status: 200, summary: readBillingSummary() });
      if (url.pathname === `${root}/chart/preconsultation-context`) return Response.json({ ok: true, status: 200, context: { encounter: activeEncounter, queue: { id: current.queueEntry.id, status: "waiting" }, patient, guardian: null, priorEncounterCount: 2, vitals: [], history: [] }, canWriteVitals: false, enforcedBy: "chart-preconsultation-context-read" });
      unhandled.push(`${method} ${url.pathname}`);
      return Response.json({ ok: false, status: 503, error: "storybook-unhandled-api" }, { status: 503 });
    };
    const interceptor: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const root = `/api/workspaces/${workspaceId}`;
      // Main checks cancellation after order-drafts and after the complete
      // actions -> lifecycle -> execution -> invoice-candidates read chain.
      // Retain the transport between its awaited requests, even after unmount.
      const startsOrderRead = method === "GET" && url.pathname === `${root}/chart/order-actions`;
      const endsOrderRead = method === "GET" && url.pathname === `${root}/billing/invoice-candidates`;
      if (startsOrderRead) activeOrderReadWorkflows++;
      let released = false;
      const releaseOrderRead = () => {
        if (!endsOrderRead || released) return;
        released = true;
        if (!activeOrderReadWorkflows) throw new Error("Synthetic order read chain ended without its start");
        activeOrderReadWorkflows--;
      };
      pending++;
      try {
        const response = await handle(input, init);
        const json = response.json.bind(response);
        response.json = async () => {
          pending++;
          try { return await json(); }
          finally { pending--; releaseOrderRead(); }
        };
        return response;
      } catch (error) {
        // The final loader catches transport failures and finishes its chain.
        // Earlier loader failures continue to the same final read in main.
        releaseOrderRead();
        throw error;
      } finally { pending--; }
    };
    globalThis.fetch = interceptor;
    return async () => {
      try { unmount?.(); await waitFor(() => { if (pending || activeOrderReadWorkflows) throw new Error("Synthetic chart requests or order read workflow still settling"); }, { timeout: 5000 }); }
      finally { if (globalThis.fetch === interceptor) globalThis.fetch = oldFetch; useMockAuthStore.setState(oldAuth, true); useChartStore.setState(oldChart, true); useLayoutStore.setState(oldLayout, true); usePatientProfileStore.setState(oldProfile, true); window.history.replaceState(window.history.state, "", oldUrl); for (const item of toast.getToasts()) if (!oldToastIds.has(item.id)) toast.dismiss(item.id); }
    };
  }
  return { editable, workspaceId, chart, current, history, rows, requests, unhandled, routes, install, recoverOrders: () => { orderHealthy = true; }, get orderReads() { return orderReads; }, get activeOrderReadWorkflows() { return activeOrderReadWorkflows; }, setUnmount: (callback: () => void) => { unmount = callback; } };
}
