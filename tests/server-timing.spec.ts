import { expect, test } from "@playwright/test";

import { createServerTimingRecorder } from "../src/lib/http/server-timing";

test("server timing reports ordered privacy-safe metrics and one structured log", async () => {
  let currentTime = 0;
  const logs: Array<{ message: string; details: Record<string, unknown> }> = [];
  const timing = createServerTimingRecorder({
    logger(message, details) {
      logs.push({ message, details });
    },
    method: "PATCH",
    now: () => currentTime,
    route: "chart_order_draft",
  });

  await timing.measure("session", async () => {
    currentTime = 3;
  });
  await timing.measure("permission", async () => {
    currentTime = 7;
  });
  await timing.measure("rpc", async () => {
    currentTime = 12;
  });

  const response = timing.respond(Response.json({ ok: true }, { status: 200 }));
  expect(response.headers.get("server-timing")).toBe(
    "session;dur=3.0, permission;dur=4.0, rpc;dur=5.0, total;dur=12.0",
  );
  expect(logs).toEqual([
    {
      message: "clair_request_timing",
      details: {
        durations: { session: 3, permission: 4, rpc: 5, total: 12 },
        method: "PATCH",
        route: "chart_order_draft",
        status: 200,
      },
    },
  ]);
  expect(JSON.stringify(logs)).not.toContain("workspace-");
  expect(JSON.stringify(logs)).not.toContain("encounter-");
  expect(JSON.stringify(logs)).not.toContain("user-");
});

test("server timing includes zeroed downstream metrics on an early denial", () => {
  let currentTime = 0;
  const timing = createServerTimingRecorder({
    logger() {},
    method: "GET",
    now: () => currentTime,
    route: "chart_order_billing_summary",
  });
  currentTime = 2;

  const response = timing.respond(
    Response.json({ ok: false, denialReason: "unauthenticated" }, { status: 401 }),
  );
  expect(response.headers.get("server-timing")).toBe(
    "session;dur=0.0, permission;dur=0.0, rpc;dur=0.0, total;dur=2.0",
  );
});
