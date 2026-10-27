import { expect, test } from "@playwright/test";
import { readChartOrderRequester, resolveChartOrderRequester } from "../src/features/chart/order-requester";
import { createSupabaseChartOrderActionGateway } from "../src/features/chart/server-order-action-persistence-core";

const legacyName = (id?: string) => id === "mock-vet" ? "예시 수의사" : undefined;

test("persisted requester wins over fallback and never uses the confirming clinician", () => {
  expect(resolveChartOrderRequester({ requestedByUserId: "live-vet", requestedByDisplayName: "실제 요청자" }, "mock-vet", legacyName))
    .toEqual({ id: "live-vet", name: "실제 요청자" });
  expect(resolveChartOrderRequester({ requestedByUserId: null, requestedByDisplayName: "orphan name" }, "mock-vet", legacyName))
    .toEqual({ id: "", name: "미기록" });
});

test("unknown live name is distinguished from missing requester without borrowing mock names", () => {
  expect(resolveChartOrderRequester({ requestedByUserId: "mock-vet", requestedByDisplayName: null }, "mock-vet", legacyName).name).toBe("이름 미확인");
  expect(resolveChartOrderRequester(undefined, "mock-vet", legacyName).name).toBe("예시 수의사");
  expect(resolveChartOrderRequester(undefined, undefined, legacyName).name).toBe("미기록");
});

test("requester parsing discards invalid/orphan names and preserves absent legacy metadata", () => {
  expect(readChartOrderRequester({ requestedByDisplayName: "orphan" })).toEqual({});
  expect(readChartOrderRequester({ requestedByUserId: 42, requestedByDisplayName: "orphan" })).toEqual({ requestedByUserId: null, requestedByDisplayName: null });
  expect(readChartOrderRequester({ requestedByUserId: " live-vet ", requestedByDisplayName: " 실제 요청자 " })).toEqual({ requestedByUserId: "live-vet", requestedByDisplayName: "실제 요청자" });
});

test("action hydration preserves persisted requester on individual, set and child rows", async () => {
  const rows = ["individual", "set", "set_child"].map((rowType, index) => ({
    orderId: `order-${index}`, encounterId: "encounter-a", rowType, orderType: rowType === "set" ? "set" : "dispensing",
    quantity: 1, lineTotalSnapshot: 0, quantitySource: "fixed_one", updatedAt: "2026-10-27T00:00:00Z",
    requestedByUserId: "live-vet", requestedByDisplayName: "실제 요청자",
  }));
  const gateway = createSupabaseChartOrderActionGateway({ rpc: async () => ({ data: { etag: '"requesters"', rows }, error: null }) });
  const result = await gateway.readOrderActions({ workspaceId: "workspace-a", encounterId: "encounter-a" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.rows).toHaveLength(3);
  for (const row of result.rows) expect(resolveChartOrderRequester(row, "mock-vet", legacyName)).toEqual({ id: "live-vet", name: "실제 요청자" });
});
