import { existsSync, readdirSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const realtimeRefreshPath = "src/features/work-queue/queue-realtime-refresh.ts";

test("queue realtime refresh hook subscribes to private broadcast topics and refetches through server APIs", () => {
  expect(existsSync(realtimeRefreshPath)).toBe(true);

  const source = readFileSync(realtimeRefreshPath, "utf8");

  expect(source).toContain("getBrowserSupabaseClient");
  expect(source).toContain("broadcast");
  expect(source).toContain("config: { private: true }");
  expect(source).toContain("queue_changed");
  expect(source).toContain("onQueueChange");
  expect(source).toContain("realtime.setAuth");
  expect(source).toContain("workspace:");
  expect(source).toContain("setTimeout");
  expect(source).not.toMatch(/payload\.(new|old)\.(patient|guardian|name|mobile|email)/i);
});

test("queue screens opt into realtime refresh without consuming database payloads directly", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");
  const dispensingModule = readFileSync("src/features/dispensing/module.tsx", "utf8");
  const labImagingModule = readFileSync("src/features/lab-imaging/module.tsx", "utf8");

  expect(chartModule).toContain("useQueueRealtimeRefresh({");
  expect(dispensingModule).toContain("useQueueRealtimeRefresh({");
  expect(labImagingModule).toContain("useQueueRealtimeRefresh({");
});

test("queue realtime migration broadcasts minimal private events without exposing queue row payloads", () => {
  const migrationFiles = readdirSync("supabase/migrations").filter((fileName) =>
    fileName.endsWith("_queue_realtime_broadcast.sql"),
  );

  expect(migrationFiles.length).toBeGreaterThan(0);

  const migrationSource = migrationFiles
    .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, "utf8"))
    .join("\n");

  expect(migrationSource).toContain("realtime.messages");
  expect(migrationSource).toContain("realtime.send");
  expect(migrationSource).toContain("'queue_changed'");
  expect(migrationSource).toContain("private.clair_is_active_workspace_member");
  expect(migrationSource).toContain("public.waiting_queue_entries");
  expect(migrationSource).toContain("public.order_fulfillment_work_items");
  expect(migrationSource).toContain("public.encounters");
  expect(migrationSource).not.toContain("realtime.broadcast_changes");
  expect(migrationSource).not.toContain("using (true)");
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
  expect(migrationSource).not.toMatch(/patient|guardian|mobile|email|chief_complaint|reception_memo/i);
});
