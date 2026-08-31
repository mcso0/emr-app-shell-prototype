import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import {
  createChartBillingSummaryRealtimeCoordinator,
  getChartBillingSummaryRealtimeTopic,
  parseChartBillingSummaryRealtimePayload,
  type ChartBillingSummaryRealtimePayload,
} from "@/features/chart/chart-order-billing-summary-realtime";

const workspaceId = "workspace-clair-cheongdam";
const encounterId = "449d09b4-945a-4f1f-97a9-418f6d845e50";
const firstEtag = `"${"1".repeat(64)}"`;
const secondEtag = `"${"2".repeat(64)}"`;

function payload(
  transactionId: string,
  etag: string | undefined = firstEtag,
): ChartBillingSummaryRealtimePayload {
  return {
    encounterId,
    etag,
    occurredAt: "2026-08-31T07:45:00.000Z",
    transactionId,
    version: 1,
    workspaceId,
  };
}

function wait(milliseconds = 30) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("billing summary realtime payload accepts only the scoped minimal v1 contract", () => {
  expect(getChartBillingSummaryRealtimeTopic(workspaceId, encounterId)).toBe(
    `workspace:${workspaceId}:encounter:${encounterId}:billing-summary`,
  );
  expect(
    parseChartBillingSummaryRealtimePayload(payload("tx-1"), {
      encounterId,
      workspaceId,
    }),
  ).toEqual(payload("tx-1"));
  expect(
    parseChartBillingSummaryRealtimePayload(
      { ...payload("tx-2"), amount: 201_000 },
      { encounterId, workspaceId },
    ),
  ).toBeNull();
  expect(
    parseChartBillingSummaryRealtimePayload(payload("tx-3"), {
      encounterId: "00000000-0000-0000-0000-000000000000",
      workspaceId,
    }),
  ).toBeNull();
  expect(
    parseChartBillingSummaryRealtimePayload(
      { ...payload("tx-4"), etag: "weak-etag" },
      { encounterId, workspaceId },
    ),
  ).toBeNull();
});

test("billing summary realtime coordinator coalesces event bursts and duplicate transactions", async () => {
  let refreshCount = 0;
  const coordinator = createChartBillingSummaryRealtimeCoordinator({
    debounceMs: 5,
    getCurrentEtag: () => undefined,
    isRefreshBlocked: () => false,
    onInvalidated: () => {
      refreshCount += 1;
    },
  });

  coordinator.handle(payload("tx-1"));
  coordinator.handle(payload("tx-1"));
  for (let index = 2; index <= 25; index += 1) {
    coordinator.handle(payload(`tx-${index}`, secondEtag));
  }

  await wait();
  expect(refreshCount).toBe(1);
  coordinator.dispose();
});

test("billing summary realtime coordinator ignores current ETags and defers unsafe edits", async () => {
  let currentEtag: string | undefined = firstEtag;
  let blocked = false;
  let refreshCount = 0;
  const coordinator = createChartBillingSummaryRealtimeCoordinator({
    debounceMs: 5,
    getCurrentEtag: () => currentEtag,
    isRefreshBlocked: () => blocked,
    onInvalidated: () => {
      refreshCount += 1;
    },
  });

  coordinator.handle(payload("same-etag"));
  await wait();
  expect(refreshCount).toBe(0);

  blocked = true;
  coordinator.handle(payload("own-mutation", secondEtag));
  await wait();
  expect(refreshCount).toBe(0);

  currentEtag = secondEtag;
  blocked = false;
  coordinator.flush();
  await wait();
  expect(refreshCount).toBe(0);

  blocked = true;
  coordinator.handle(payload("remote-mutation", firstEtag));
  blocked = false;
  coordinator.flush();
  await wait();
  expect(refreshCount).toBe(1);
  coordinator.dispose();
});

test("billing summary realtime coordinator performs one follow-up after an in-flight refresh", async () => {
  let releaseFirstRefresh: (() => void) | undefined;
  let refreshCount = 0;
  const coordinator = createChartBillingSummaryRealtimeCoordinator({
    debounceMs: 5,
    getCurrentEtag: () => undefined,
    isRefreshBlocked: () => false,
    onInvalidated: async () => {
      refreshCount += 1;
      if (refreshCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstRefresh = resolve;
        });
      }
    },
  });

  coordinator.handle(payload("first"));
  await wait();
  expect(refreshCount).toBe(1);

  coordinator.handle(payload("during-flight", secondEtag));
  await wait();
  expect(refreshCount).toBe(1);

  releaseFirstRefresh?.();
  await wait();
  expect(refreshCount).toBe(2);
  coordinator.dispose();
});

test("billing summary realtime teardown cancels pending refreshes", async () => {
  let refreshCount = 0;
  const coordinator = createChartBillingSummaryRealtimeCoordinator({
    debounceMs: 20,
    getCurrentEtag: () => undefined,
    isRefreshBlocked: () => false,
    onInvalidated: () => {
      refreshCount += 1;
    },
  });

  coordinator.handle(payload("dispose"));
  coordinator.dispose();
  await wait(40);
  expect(refreshCount).toBe(0);
});

test("billing summary realtime migration keeps the channel private and permission scoped", () => {
  const migrationName = readdirSync("supabase/migrations").find((fileName) =>
    fileName.endsWith("_chart_order_billing_summary_realtime.sql"),
  );
  expect(migrationName).toBeTruthy();
  const migration = readFileSync(
    `supabase/migrations/${migrationName}`,
    "utf8",
  );

  expect(migration).toContain("on realtime.messages");
  expect(migration).toContain("for select");
  expect(migration).toContain("to authenticated");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("'chart:view'");
  expect(migration).toContain("realtime.send");
  expect(migration).toContain("'billing_summary_changed'");
  expect(migration).toContain("true\n  );");
  expect(migration).not.toMatch(/for\s+insert\s+to\s+authenticated/i);
  expect(migration).not.toContain("realtime.broadcast_changes");
  expect(migration).not.toMatch(/create\s+(table|function).*realtime\./i);

  for (const table of [
    "invoices",
    "invoice_lines",
    "payments",
    "invoice_adjustments",
  ]) {
    expect(migration).toContain(`on public.${table}`);
  }
});

test("chart consumes private invalidations through the existing authoritative GET fallback", () => {
  const realtimeSource = readFileSync(
    "src/features/chart/chart-order-billing-summary-realtime.ts",
    "utf8",
  );
  const chartSource = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(realtimeSource).toContain("config: { private: true }");
  expect(realtimeSource).toContain("realtime.setAuth");
  expect(realtimeSource).toContain("removeChannel");
  expect(realtimeSource).not.toMatch(/\.send\s*\(/);
  expect(chartSource).toContain("useChartBillingSummaryRealtime({");
  expect(chartSource).toContain("onInvalidated: refreshBillingSummary");
  expect(chartSource).toContain('window.addEventListener("focus", refreshIfSafe)');
});
