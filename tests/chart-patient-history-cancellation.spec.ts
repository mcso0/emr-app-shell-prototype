import { expect, test } from "@playwright/test";
import {
  loadChartPatientHistoryPage,
  loadCompleteChartPatientHistory,
} from "../src/features/chart/chart-patient-history-client";
import type { ChartPatientHistoryResponse } from "../src/features/chart/chart-patient-history";

type Page = Extract<ChartPatientHistoryResponse, { ok: true }>;
const patientId = "synthetic-patient-a";
const workspaceId = "synthetic-workspace";
const records: Page["items"] = Array.from({ length: 125 }, (_, index) => ({
  chart: {
    id: `chart-${String(index).padStart(3, "0")}`,
    encounterId: `encounter-${index}`,
    authorUserId: "synthetic-vet",
    authorDisplayName: "합성 수의사",
    assessment: `합성 이력 ${index}`,
    status: "signed",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  encounter: {
    id: `encounter-${index}`, workspaceId, patientId,
    encounterNo: `SYN-${index}`, receptionType: "walk_in", status: "completed",
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  },
  primaryGuardian: undefined,
  veterinarianName: "합성 수의사",
  diagnoses: [],
}));
function pageAt(cursor?: string, totalCount = records.length): Page {
  const start = Number(cursor ?? 0);
  return {
    ok: true, status: 200, enforcedBy: "chart-patient-history-read",
    items: records.slice(start, start + 50), totalCount,
    nextCursor: start + 50 < records.length ? String(start + 50) : null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("125 synthetic records still load completely with stable ordering and signal propagation", async () => {
  const controller = new AbortController();
  const cursors: Array<string | undefined> = [];
  const result = await loadCompleteChartPatientHistory({
    patientId, workspaceId, signal: controller.signal,
    loadPage: async ({ cursor, signal }) => {
      expect(signal).toBe(controller.signal);
      cursors.push(cursor);
      return pageAt(cursor);
    },
  });
  expect(cursors).toEqual([undefined, "50", "100"]);
  expect(result.ok && result.totalCount).toBe(125);
  expect(result.ok && result.items.map((record) => record.chart?.id)).toEqual(
    [...records].reverse().map((record) => record.chart?.id),
  );
});

for (const heldPage of [1, 2]) {
  test(`switching patients during page ${heldPage} stops the old traversal despite a late response`, async () => {
    const controller = new AbortController();
    const held = deferred<Page>();
    const started = deferred<void>();
    const calls: Array<string | undefined> = [];
    const oldRequest = loadCompleteChartPatientHistory({
      patientId, workspaceId, signal: controller.signal,
      loadPage: async ({ cursor }) => {
        calls.push(cursor);
        if (calls.length === heldPage) { started.resolve(); return held.promise; }
        return pageAt(cursor);
      },
    });
    // Attach the rejection observer before aborting.
    const outcome = oldRequest.then(() => "completed", (error) => error.name);
    await started.promise;
    controller.abort();
    const next = await loadCompleteChartPatientHistory({
      patientId: "synthetic-patient-b", workspaceId,
      loadPage: async () => ({ ...pageAt(), items: [], nextCursor: null, totalCount: 0 }),
    });
    expect(next.ok).toBe(true);
    held.resolve(pageAt(heldPage === 1 ? undefined : "50"));
    expect(await outcome).toBe("AbortError");
    expect(calls).toEqual(heldPage === 1 ? [undefined] : [undefined, "50"]);
  });
}

test("pre-aborted signals never invoke a page loader or fetch", async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await expect(loadCompleteChartPatientHistory({
    patientId, workspaceId, signal: controller.signal,
    loadPage: async () => { calls++; return pageAt(); },
  })).rejects.toMatchObject({ name: "AbortError" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; throw new Error("must not fetch"); };
  try {
    await expect(loadChartPatientHistoryPage({ patientId, workspaceId, signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
  } finally { globalThis.fetch = originalFetch; }
  expect(calls).toBe(0);
});

for (const abortAt of [3, 4]) {
  test(`abort at ${abortAt === 3 ? "count mismatch" : "retry page"} prevents subsequent retry pages`, async () => {
    const controller = new AbortController(); let calls = 0;
    await expect(loadCompleteChartPatientHistory({
      patientId, workspaceId, signal: controller.signal,
      loadPage: async ({ cursor }) => {
        calls++;
        if (calls === abortAt) controller.abort();
        return pageAt(cursor, 126);
      },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(abortAt);
  });
}

test("page fetch receives the signal and cancellation is not converted into a DB failure", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController(); const started = deferred<void>();
  globalThis.fetch = async (_url, init) => {
    expect(init?.signal).toBe(controller.signal);
    started.resolve();
    return new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true });
    });
  };
  try {
    const request = loadChartPatientHistoryPage({ patientId, workspaceId, signal: controller.signal });
    const outcome = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await started.promise; controller.abort(); await outcome;
  } finally { globalThis.fetch = originalFetch; }
});

test("abort during JSON body reading rejects even when a slow mock ignores the signal", async () => {
  const originalFetch = globalThis.fetch; const controller = new AbortController();
  const body = deferred<Page>(); const started = deferred<void>();
  globalThis.fetch = async () => ({ ok: true, status: 200, json: () => {
    started.resolve(); return body.promise;
  } }) as Response;
  try {
    const request = loadChartPatientHistoryPage({ patientId, workspaceId, signal: controller.signal });
    const outcome = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await started.promise; controller.abort(); body.resolve(pageAt()); await outcome;
  } finally { globalThis.fetch = originalFetch; }
});

test("real network and permission failures retain their existing response contract", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("network unavailable"); };
    expect(await loadChartPatientHistoryPage({ patientId, workspaceId })).toEqual({
      ok: false, status: 500, error: "db_read_failed",
    });
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false, error: "permission_denied", denialReason: "permission_missing",
    }), { status: 403 });
    expect(await loadChartPatientHistoryPage({ patientId, workspaceId })).toEqual({
      ok: false, status: 403, error: "permission_denied", denialReason: "permission_missing",
    });
  } finally { globalThis.fetch = originalFetch; }
});
