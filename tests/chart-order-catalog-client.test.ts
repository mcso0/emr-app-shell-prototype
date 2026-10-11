import { afterEach, beforeEach, expect, it, vi } from "vitest";

const key = (actor: string, workspace: string) => JSON.stringify([actor, workspace]);
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, status: 200, rows: [] })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const client = () => import("@/features/chart/chart-order-catalog-client");
const input = { cacheKey: key("synthetic-admin", "synthetic-a"), workspaceId: "synthetic-a" };

it("preserves the encoded workspace URL, actor headers and no-store request", async () => {
  const { loadCachedChartOrderCatalog } = await client();
  const actorHeaders = { "x-clair-demo-session-user-id": "synthetic-admin" };
  await loadCachedChartOrderCatalog({ cacheKey: "encoded", workspaceId: "synthetic /a", actorHeaders });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "/api/workspaces/synthetic%20%2Fa/hospital-admin/order-catalog?mode=chart-search",
    { cache: "no-store", headers: actorHeaders },
  );
});

it("shares one pending request for concurrent consumers, including force refresh", async () => {
  const { loadCachedChartOrderCatalog } = await client();
  let release!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  const first = loadCachedChartOrderCatalog(input);
  const second = loadCachedChartOrderCatalog(input);
  const forced = loadCachedChartOrderCatalog({ ...input, force: true });
  expect(second).toBe(first);
  expect(forced).toBe(first);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  release(new Response(JSON.stringify({ ok: true, rows: [] })));
  await expect(first).resolves.toEqual({ ok: true, rows: [] });
});

it("reuses a successful empty catalog and expires it at the existing 60-second boundary", async () => {
  const { loadCachedChartOrderCatalog, getFreshChartOrderCatalog } = await client();
  await loadCachedChartOrderCatalog(input);
  vi.advanceTimersByTime(59_999);
  await expect(loadCachedChartOrderCatalog(input)).resolves.toEqual({ ok: true, rows: [] });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(getFreshChartOrderCatalog(input.cacheKey)).toBeNull();
  await loadCachedChartOrderCatalog(input);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("forces a fresh authority read even when cached rows are warm", async () => {
  const { loadCachedChartOrderCatalog } = await client();
  await loadCachedChartOrderCatalog(input);
  await loadCachedChartOrderCatalog({ ...input, force: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("evicts a failed forced read and releases its pending slot so retry can recover", async () => {
  const { loadCachedChartOrderCatalog, getFreshChartOrderCatalog } = await client();
  await loadCachedChartOrderCatalog(input);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "synthetic-failure" }), { status: 503 }));
  await expect(loadCachedChartOrderCatalog({ ...input, force: true })).resolves.toEqual({ ok: false, status: 503, error: "synthetic-failure" });
  expect(getFreshChartOrderCatalog(input.cacheKey)).toBeNull();
  await expect(loadCachedChartOrderCatalog(input)).resolves.toEqual({ ok: true, status: 200, rows: [] });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

for (const status of [401, 403]) {
  it(`retains denial metadata and uses HTTP ${status} as the failure status`, async () => {
    const { loadCachedChartOrderCatalog, getFreshChartOrderCatalog } = await client();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, status: 200, denialReason: "synthetic-denied" }), { status }));
    await expect(loadCachedChartOrderCatalog(input)).resolves.toEqual({ ok: false, status, denialReason: "synthetic-denied" });
    expect(getFreshChartOrderCatalog(input.cacheKey)).toBeNull();
  });
}

it("fails closed when HTTP failure carries a success-shaped body", async () => {
  const { loadCachedChartOrderCatalog } = await client();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rows: [] }), { status: 503 }));
  await expect(loadCachedChartOrderCatalog(input)).resolves.toEqual({ ok: false, status: 503, error: "db_read_failed" });
});

for (const failure of ["network", "json"] as const) {
  it(`retains the existing fallback for a ${failure} failure without caching it`, async () => {
    const { loadCachedChartOrderCatalog, getFreshChartOrderCatalog } = await client();
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("synthetic-network"));
    else fetchMock.mockResolvedValueOnce(new Response("synthetic-invalid-json"));
    await expect(loadCachedChartOrderCatalog(input)).resolves.toEqual({ ok: false, status: 500, error: "db_read_failed" });
    expect(getFreshChartOrderCatalog(input.cacheKey)).toBeNull();
    await loadCachedChartOrderCatalog(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
}

it("keeps caches and failed refreshes separate across the caller's actor/workspace keys", async () => {
  const { loadCachedChartOrderCatalog, getFreshChartOrderCatalog } = await client();
  const otherActor = { ...input, cacheKey: key("synthetic-vet", "synthetic-a") };
  const otherWorkspace = { cacheKey: key("synthetic-admin", "synthetic-b"), workspaceId: "synthetic-b" };
  await Promise.all([loadCachedChartOrderCatalog(input), loadCachedChartOrderCatalog(otherActor), loadCachedChartOrderCatalog(otherWorkspace)]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 403 }));
  await loadCachedChartOrderCatalog({ ...otherActor, force: true });
  expect(getFreshChartOrderCatalog(otherActor.cacheKey)).toBeNull();
  expect(getFreshChartOrderCatalog(input.cacheKey)).toEqual([]);
  expect(getFreshChartOrderCatalog(otherWorkspace.cacheKey)).toEqual([]);
  await loadCachedChartOrderCatalog(input);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
