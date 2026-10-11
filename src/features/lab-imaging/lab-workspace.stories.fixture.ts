import type { FulfillmentWorkItem } from "@/features/fulfillment/server-fulfillment-work-item-core";
import type { LabResultRow } from "@/types/emr-domain";
import { createPhase2Fixture } from "./components/lab-result-phase2.stories.fixture";
import { evaluateLabProfileValue, type LabProfileRule } from "./result-profile-contract";
import { parsePersistedLabResult } from "./persisted-result-contract";
import { parseLabProfileConfiguration } from "./server-result-profile-core";

export type LabWorkspaceScenario = "ready" | "readonly" | "queue-error" | "queue-denied" | "empty" | "entries-error" | "row-save-error";
const workItemId = "97000000-0000-4000-8000-000000000001";
const pendingWorkItemId = "97000000-0000-4000-8000-000000000002";
const numeric: LabProfileRule = { testMasterKey: "synthetic-numeric", code: "SYN-N", resultValueKind: "numeric", unit: "synthetic-unit", decimalScale: 1, supported: true, numericMin: 0, numericMax: 100, referenceInterval: { low: 1, high: 5, lowInclusive: true, highInclusive: true }, displayRange: { low: 0, high: 20 }, codes: [], referenceStatus: "synthetic_functional_fixture", provenance: {}, allowedQualifiers: ["exact", "less_than", "greater_than"] };
const coded: LabProfileRule = { ...numeric, testMasterKey: "synthetic-coded", code: "SYN-C", resultValueKind: "coded", unit: null, decimalScale: null, numericMin: null, numericMax: null, referenceInterval: null, displayRange: null, codes: [{ code: "synthetic-clear", label: "합성 선택 A", judgment: "normal" }, { code: "synthetic-flag", label: "합성 선택 B", judgment: "abnormal" }], allowedQualifiers: undefined };
const text: LabProfileRule = { ...coded, testMasterKey: "synthetic-text", code: "SYN-T", resultValueKind: "text", codes: [] };

/** Coherent local queue and canonical result reads layered on the phase2 transport. */
export function createLabWorkspaceFixture(scenario: LabWorkspaceScenario) {
  const workspaceId = `storybook-lab-${crypto.randomUUID()}`;
  let queueHealthy = scenario !== "queue-error", entriesHealthy = scenario !== "entries-error";
  let failSave = scenario === "row-save-error";
  const writes: Array<Record<string, unknown>> = [];
  const lifecycle: Array<Record<string, unknown>> = [];
  const copied: string[] = [];
  let queueReads = 0, entryReads = 0;
  const instance = createPhase2Fixture(scenario === "readonly" ? "readonly" : "ready", { workspaceId, handleAdditionalRequest: async (url, method, body) => {
    const queuePath = `/api/workspaces/${workspaceId}/fulfillment/work-items`;
    const entriesPath = `/api/workspaces/${workspaceId}/lab-imaging/result-entries`;
    if (url.pathname === queuePath && method === "GET") {
      queueReads++;
      if (url.searchParams.get("queueType") !== "lab") throw new Error("Synthetic queue type mismatch");
      if (scenario === "queue-denied") return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
      if (!queueHealthy) return Response.json({ ok: false }, { status: 503 });
      const patientId = url.searchParams.get("patientId");
      const date = url.searchParams.get("date");
      const items = scenario === "empty" || (date && date !== "2026-10-11") ? [] : workItems.filter(item => !patientId || item.patientId === patientId);
      return Response.json({ ok: true, workItems: structuredClone(items), summary: { totalCount: items.length } });
    }
    if (url.pathname === `/api/workspaces/${workspaceId}/staff` && method === "GET") return Response.json({ ok: true, staff: [{ id: "user-tech", displayName: "합성 검사 담당" }] });
    const commandItem = workItems.find(item => url.pathname === `${queuePath}/${item.id}`);
    if (commandItem && method === "PATCH") {
      if (!body || body.expectedRevision !== commandItem.rowRevision || typeof body.commandId !== "string") throw new Error("Synthetic lifecycle revision mismatch");
      const action = String(body.action); const item = commandItem; lifecycle.push(structuredClone(body));
      const statuses: Record<string, FulfillmentWorkItem["status"]> = { start: "in_progress", resume: "in_progress", pause: "paused", complete: "completed", return: "returned", claim: "requested", assign: "requested", handoff: item.status, unassign: "requested" };
      if (!(action in statuses)) throw new Error("Unsupported synthetic lifecycle command");
      item.status = statuses[action]; item.rowRevision++;
      if (["claim", "start"].includes(action)) item.assignedToUserId = "user-tech";
      if (action === "unassign" || action === "return") item.assignedToUserId = null;
      if (action === "assign" || action === "handoff") item.assignedToUserId = String(body.assignedToUserId ?? "");
      return Response.json({ ok: true, workItems: structuredClone(workItems) });
    }
    const assigneeItem = workItems.find(item => url.pathname === `${queuePath}/${item.id}/assignees`);
    if (assigneeItem && method === "GET") return Response.json({ ok: true, workspaceId, workItemId: assigneeItem.id, assignees: [] });
    if (url.pathname === entriesPath && method === "GET") {
      entryReads++;
      const pendingItem = workItems.find(item => item.id === pendingWorkItemId)!;
      if (url.searchParams.get("workItemId") === pendingItem.id && url.searchParams.get("orderId") === pendingItem.orderId) return Response.json({ ok: true, savedResult: null });
      if (url.searchParams.get("workItemId") !== workItemId || url.searchParams.get("orderId") !== instance.result.orderId) throw new Error("Synthetic result selector mismatch");
      if (!entriesHealthy) return Response.json({ ok: false }, { status: 503 });
      return Response.json(payload());
    }
    if (url.pathname === entriesPath && method === "POST") {
      if (!body || body.resultId !== instance.result.id || body.workItemId !== workItemId || body.orderId !== instance.result.orderId || body.encounterId !== instance.result.encounterId || body.expectedEntryWriteRevision !== instance.result.entryWriteRevision || typeof body.requestId !== "string" || !Array.isArray(body.rows)) throw new Error("Synthetic row command identity/revision mismatch");
      writes.push(structuredClone(body));
      if (failSave) { failSave = false; return Response.json({ ok: false }, { status: 503 }); }
      instance.result.rows = instance.result.rows.map(row => {
        const update = (body.rows as Array<Record<string, unknown>>).find(candidate => candidate.rowId === row.id);
        if (!update || !(update.value === null || typeof update.value === "string")) throw new Error("Synthetic result row mismatch");
        const next = { ...row, value: update.value === null ? undefined : update.value, note: typeof update.note === "string" ? update.note : undefined, qualifier: update.qualifier as LabResultRow["qualifier"], deviceFlag: typeof update.deviceFlag === "string" ? update.deviceFlag : undefined, resultPresence: update.resultState as LabResultRow["resultPresence"] };
        return evaluated(next);
      });
      instance.result.entryWriteRevision = (instance.result.entryWriteRevision ?? 0) + 1;
      return Response.json({ ok: true, entryWriteRevision: instance.result.entryWriteRevision });
    }
    if (url.pathname === `/api/workspaces/${workspaceId}/lab-imaging/result-profiles` && method === "GET") {
      const item = workItems.find(item => item.orderId === url.searchParams.get("orderId"));
      if (!item) throw new Error("Synthetic profile selector mismatch");
      const configuration = { workspaceId, catalogItemId: null, canConfigure: false, canSelect: false, canRetest: false, order: { id: item.orderId, updatedAt: "2026-10-11T00:00:00Z", confirmationStatus: "confirmed", species: "cat", requiresProfile: false, selectedProfileVersionId: null, selectedDeviceId: null }, profiles: [], devices: [], bindings: [] };
      if (!parseLabProfileConfiguration(configuration, workspaceId, item.orderId)) throw new Error("Invalid synthetic readonly retest configuration");
      return Response.json({ ok: true, configuration });
    }
    return undefined;
  } });
  instance.result.resultName = "합성 기능 확인 프로필";
  instance.result.entryWriteRevision = 3;
  const initialRows: LabResultRow[] = [
    { ...instance.result.rows[0], analyteName: "합성 수치", resultValueKind: "numeric", interpretationRule: numeric, value: "2", unit: "synthetic-unit", decimalScale: 1, referenceRange: "1 - 5", resultPresence: "value", qualifier: "exact" },
    { id: "97000000-0000-4000-8001-000000000002", analyteName: "합성 선택", resultValueKind: "coded", interpretationRule: coded, value: "synthetic-clear", resultPresence: "value", qualifier: "exact", judgment: "normal" },
    { id: "97000000-0000-4000-8001-000000000003", analyteName: "합성 관찰", resultValueKind: "text", interpretationRule: text, value: "합성 관찰 내용", resultPresence: "value", qualifier: "exact", judgment: "not_judged" },
  ];
  instance.result.rows = initialRows.map(evaluated);
  const baseItem: FulfillmentWorkItem = { id: workItemId, workspaceId, orderId: instance.result.orderId!, encounterId: instance.result.encounterId, patientId: instance.result.patientId, patientName: "합성 환자 A", guardianName: "합성 보호자 A", queueType: "lab", orderType: "lab", priority: "normal", status: "in_progress", assignedToUserId: "user-tech", requestedByUserId: "synthetic-vet", requesterName: "합성 수의사", requestCycle: 1, rowRevision: 2, createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z", sourceSnapshot: { billingReflectionEnabled: false, orderDisplayName: instance.result.resultName, instruction: "합성 직원 전달 사항", detail: { breed: "합성 품종", age: "합성 나이" } } };
  const workItems: FulfillmentWorkItem[] = [baseItem, { ...baseItem, id: pendingWorkItemId, orderId: "97000000-0000-4000-8004-000000000002", patientId: "97000000-0000-4000-8002-000000000002", patientName: "합성 환자 B", guardianName: "합성 보호자 B", status: "requested", assignedToUserId: null }];
  function evaluated(row: LabResultRow): LabResultRow {
    const evaluation = evaluateLabProfileValue(row.interpretationRule!, { value: row.value ?? null, qualifier: row.qualifier, deviceFlag: row.deviceFlag, resultState: row.resultPresence });
    if (!evaluation.valid) throw new Error("Invalid synthetic interpreted row");
    return { ...row, judgment: evaluation.judgment, resultState: evaluation.state };
  }
  function payload() {
    const value = { ok: true, workspaceId, workItemId, orderId: instance.result.orderId, encounterId: instance.result.encounterId, resultId: instance.result.id, entryWriteRevision: instance.result.entryWriteRevision, resultDefinitionSnapshot: { schemaVersion: 2, resultProfile: { profileKey: "synthetic-functional", revision: 1, clinicalUseAllowed: false, integrationStatus: "not_integrated", device: { name: "합성 수동 입력" } } }, rows: instance.result.rows.map(row => ({ ...row, value: row.value ?? null, unit: row.interpretationRule!.unit, decimalScale: row.interpretationRule!.decimalScale, deviceFlag: row.deviceFlag ?? null })) };
    if (!parsePersistedLabResult(value, { workspaceId, workItemId, orderId: instance.result.orderId!, encounterId: instance.result.encounterId }, instance.result)) throw new Error("Invalid synthetic canonical readback");
    return value;
  }
  return { ...instance, workItems, writes, lifecycle, copied, get queueReads() { return queueReads; }, get entryReads() { return entryReads; }, selectedLabResultId: `live-lab-${workItemId}`, recoverQueue: () => { queueHealthy = true; }, recoverEntries: () => { entriesHealthy = true; } };
}
