import { expect, test } from "@playwright/test";
import { createSupabaseEncounterChartsGateway, manageEncounterCharts } from "../src/features/chart/server-encounter-charts-core";
import { useChartStore } from "../src/features/chart/store";
import type { SoapNote } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const actor = "user-vet";
const headers = { "x-clair-demo-session-user-id": actor };
const note = (id: string): SoapNote => ({ id, encounterId, status: "draft", createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z", authorUserId: actor });

test("chart creation rejects anonymous and foreign workspace requests", async ({ request }) => {
  const input = { encounterId, creationRequestId: crypto.randomUUID() };
  const anonymous = await request.post(`/api/workspaces/${workspaceId}/chart/encounter-charts`, { data: input });
  expect(anonymous.status()).toBe(401);
  const foreign = await request.post("/api/workspaces/clair-foreign-demo/chart/encounter-charts", { headers, data: input });
  expect(foreign.status()).toBe(403);
});

test("three API chart creates preserve distinct clinical times and idempotent retries", async ({ request }) => {
  const ids: string[] = [];
  for (const clinicalAt of ["2026-09-09T00:00:00Z", "2026-09-09T07:00:00Z", "2026-09-09T16:00:00Z"]) {
    const input = { encounterId, clinicalAt, creationRequestId: crypto.randomUUID() };
    const first = await request.post(`/api/workspaces/${workspaceId}/chart/encounter-charts`, { headers, data: input });
    expect(first.status()).toBe(200);
    const body = await first.json();
    expect(body.chart.clinicalAt).toBe(clinicalAt);
    expect(body.chart.status).toBe("draft");
    expect(body.chart.subjective ?? "").toBe("");
    const retry = await request.post(`/api/workspaces/${workspaceId}/chart/encounter-charts`, { headers, data: input });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).chart.id).toBe(body.chart.id);
    ids.push(body.chart.id);
  }
  expect(new Set(ids).size).toBe(3);
  const list = await request.get(`/api/workspaces/${workspaceId}/chart/encounter-charts?encounterId=${encounterId}`, { headers });
  expect(list.status()).toBe(200);
  expect((await list.json()).charts.map((chart: SoapNote) => chart.id)).toEqual(expect.arrayContaining(ids));
});

test("database creation replay does not append a second audit event", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseEncounterChartsGateway({ rpc: async (name) => {
    calls.push(name);
    return { error: null, data: { ...note("chart-replay"), idempotentReplay: true } };
  } });
  const result = await manageEncounterCharts({ operation: "create", workspaceId, actorUserId: actor,
    input: { encounterId, creationRequestId: crypto.randomUUID() }, gateway,
    auditGateway: { appendAuditEvent: async () => { throw new Error("replay must not append audit"); } } as never,
  });
  expect(result).toMatchObject({ ok: true, chart: { id: "chart-replay" }, auditRecorded: false });
  expect(calls).toEqual(["clair_create_encounter_chart"]);
});

test("chart selection waits for SOAP and orders, and a failed save retains the current chart", async () => {
  const store = useChartStore;
  const oldState = store.getState();
  let resolveSoap!: (saved: boolean) => void;
  const ordered: string[] = [];
  store.setState({ selectedChartId: "a", encounterChartsScope: "test-scope", encounterCharts: [note("a"), note("b")],
    diagnosisSaving: false,
    flushActiveChart: () => new Promise<boolean>((resolve) => { ordered.push("soap"); resolveSoap = resolve; }),
    flushOrderEdits: async () => { ordered.push("orders"); return false; },
  });
  try {
    const switchAttempt = store.getState().selectChart("b");
    expect(store.getState().selectedChartId).toBe("a");
    resolveSoap(true);
    await switchAttempt;
    expect(ordered).toEqual(["soap", "orders"]);
    expect(store.getState().selectedChartId).toBe("a");
    store.setState({ flushActiveChart: async () => true, flushOrderEdits: async () => true });
    await store.getState().selectChart("b");
    expect(store.getState().selectedChartId).toBe("b");
    store.setState({ diagnosisSaving: true });
    await store.getState().selectChart("a");
    expect(store.getState().selectedChartId).toBe("b");
  } finally { store.setState(oldState); }
});
