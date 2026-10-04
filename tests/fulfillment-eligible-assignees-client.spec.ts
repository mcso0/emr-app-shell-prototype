import { expect, test } from "@playwright/test";

import { loadFulfillmentEligibleAssigneesRoute } from "../src/features/fulfillment/client-eligible-assignees";

const input = { workspaceId: "synthetic-workspace", workItemId: "synthetic-work-item" };
const originalFetch = globalThis.fetch;
let calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>;
let responseOk: boolean;
let body: unknown;
let fetchError: Error | undefined;
let jsonError: Error | undefined;
let jsonReads: number;
let expectedRequests: number;

test.beforeEach(() => {
  calls = [];
  responseOk = true;
  body = { ok: true, assignees: [] };
  fetchError = undefined;
  jsonError = undefined;
  jsonReads = 0;
  expectedRequests = 1;
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (fetchError) throw fetchError;
    return {
      ok: responseOk,
      json: async () => {
        jsonReads += 1;
        if (jsonError) throw jsonError;
        return body;
      },
    } as Response;
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(calls).toEqual(Array.from({ length: expectedRequests }, () => ({
    input: "/api/workspaces/synthetic-workspace/fulfillment/work-items/synthetic-work-item/assignees",
    init: { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  })));
});

test("returns the response candidates without copying or normalizing them", async () => {
  const assignees = [{ userId: "synthetic-tech", displayName: "합성 담당자", title: null }];
  body = { ok: true, assignees };
  expect(await loadFulfillmentEligibleAssigneesRoute(input)).toBe(assignees);
  expect(jsonReads).toBe(1);
});

test("accepts an empty eligible list", async () => {
  await expect(loadFulfillmentEligibleAssigneesRoute(input)).resolves.toEqual([]);
});

test("preserves the existing truthy ok check", async () => {
  body = { ok: 1, assignees: [] };
  await expect(loadFulfillmentEligibleAssigneesRoute(input)).resolves.toEqual([]);
});

for (const invalid of [
  { name: "HTTP failure", responseOk: false, body: { ok: true, assignees: [] } },
  { name: "domain failure", responseOk: true, body: { ok: false, assignees: [] } },
  { name: "missing ok", responseOk: true, body: { assignees: [] } },
  { name: "missing candidates", responseOk: true, body: { ok: true } },
  { name: "non-array candidates", responseOk: true, body: { ok: true, assignees: {} } },
]) {
  test(`rejects ${invalid.name} after reading JSON`, async () => {
    responseOk = invalid.responseOk;
    body = invalid.body;
    await expect(loadFulfillmentEligibleAssigneesRoute(input)).rejects.toThrow("eligible_assignees_unavailable");
    expect(jsonReads).toBe(1);
  });
}

test("propagates the original network rejection without retrying", async () => {
  fetchError = new Error("synthetic network rejection");
  await expect(loadFulfillmentEligibleAssigneesRoute(input)).rejects.toBe(fetchError);
  expect(jsonReads).toBe(0);
});

for (const ok of [true, false]) {
  test(`propagates the original JSON rejection when HTTP ok is ${ok}`, async () => {
    responseOk = ok;
    jsonError = new SyntaxError("synthetic JSON rejection");
    await expect(loadFulfillmentEligibleAssigneesRoute(input)).rejects.toBe(jsonError);
    expect(jsonReads).toBe(1);
  });
}

test("keeps one fetch per invocation without sharing a previous response", async () => {
  expectedRequests = 2;
  const first = [{ userId: "synthetic-first", displayName: "첫 합성 담당자" }];
  const second = [{ userId: "synthetic-second", displayName: "다음 합성 담당자" }];
  body = { ok: true, assignees: first };
  expect(await loadFulfillmentEligibleAssigneesRoute(input)).toBe(first);
  body = { ok: true, assignees: second };
  expect(await loadFulfillmentEligibleAssigneesRoute(input)).toBe(second);
  expect(jsonReads).toBe(2);
});
