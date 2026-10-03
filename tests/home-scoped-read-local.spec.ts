import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { createSupabaseHomeOperationsWorkItemGateway, readHomeOperationsWorkItems } from "../src/features/home/server-home-operations-work-items-core";
import type { PermissionId } from "../src/types/emr-domain";

test.skip(process.env.HOME_SCOPED_LOCAL_DB !== "1", "Requires dedicated local item5_synthetic fixture; no hosted DB access");
test.setTimeout(180_000);
type Dataset = {
  sources: Record<string, unknown[]>;
  fulfillment: Record<string, unknown[]>;
  measurement: { rpcCalls: number; postgresJsonTextBytes: number; sqlElapsedMs: number };
};
const permissions: PermissionId[][] = [
  ["reception:view", "chart:view", "lab:view", "imaging:view", "dispensing:view", "billing:view"],
  ["reception:view"], ["reception:view", "chart:view"],
  ["reception:view", "lab:view", "imaging:view", "dispensing:view"], ["reception:view", "billing:view"],
];
function readDataset(role: number, legacy: boolean, date = "2026-10-03", completed = false, cancelled = false): Dataset {
  return JSON.parse(execFileSync(process.execPath, ["scripts/test-home-scoped-read-local.mjs", "--role", String(role), "--date", date,
    ...(legacy ? ["--legacy"] : []), ...(completed ? ["--completed"] : []), ...(cancelled ? ["--cancelled"] : [])],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
}
function gateway(dataset: Dataset, legacy: boolean) {
  // Baseline source pages/v1 queue payload pass through the unchanged original
  // Home mapping. Only the RPC transport names/shape are adapted for comparison.
  return createSupabaseHomeOperationsWorkItemGateway({ async rpc(name, args) {
    if (name === "clair_get_home_operations_source_snapshot_v2") return { data: dataset.sources, error: null };
    const rows = dataset.fulfillment[String(args.p_queue_type)] ?? [];
    return { data: legacy ? rows.map((row) => Object.fromEntries(Object.entries(row as object).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]))) : rows, error: null };
  } });
}
async function response(dataset: Dataset, legacy: boolean, role: number, date: string, completed: boolean, cancelled: boolean, scope: "all" | "mine" = "all") {
  const actorUserId = `99500000-0000-4000-8000-${String(role).padStart(12, "0")}`;
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [{ id: "local", workspaceId: "home-local-proof", userId: actorUserId, roles: [], status: "active",
      permissionRole: { key: "synthetic", label: "Synthetic", roleType: "custom", permissionIds: permissions[role - 1] } }],
  });
  const result = await readHomeOperationsWorkItems({ actorUserId, workspaceId: "home-local-proof", permissionAdapter,
    filters: { date, includeCompleted: completed, includeCancelled: cancelled, scope }, gateway: gateway(dataset, legacy) });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const { generatedAt: _generatedAt, ...stable } = result;
  void _generatedAt;
  return stable;
}

test("SQL old/new full Home result parity across Seoul days, terminal flags, carryover and roles", async () => {
  const measurements: unknown[] = [];
  for (let role = 1; role <= 5; role++) {
    const baseline = readDataset(role, true);
    const cases: [string, boolean, boolean][] = role === 1
      ? [["2026-10-03", false, false], ["2026-10-03", true, false], ["2026-10-03", false, true], ["2026-10-03", true, true],
        ["2025-03-01", true, true], ["2026-10-02", true, true], ["2026-10-04", false, false]]
      : [["2026-10-03", false, false], ["2026-10-03", true, true]];
    for (const [date, completed, cancelled] of cases) {
      const scoped = readDataset(role, false, date, completed, cancelled);
      const expected = await response(baseline, true, role, date, completed, cancelled);
      const actual = await response(scoped, false, role, date, completed, cancelled);
      expect(actual).toEqual(expected); // Every item field/order, counts, identity, navigation, patient presence.
      expect(await response(scoped, false, role, date, completed, cancelled, "mine"))
        .toEqual(await response(baseline, true, role, date, completed, cancelled, "mine"));
      expect(JSON.stringify(scoped)).not.toContain("Foreign sentinel");
      if (role === 1 && date === "2026-10-03" && completed && cancelled) {
        expect(scoped.sources.appointments.length).toBeGreaterThan(1000);
        for (const rows of Object.values(scoped.fulfillment)) expect(rows.length).toBeGreaterThan(1000);
        expect(actual.items.some((item) => item.operatingDate < date && item.attentionSignals.includes("long_stay"))).toBe(true);
        expect(scoped.fulfillment.lab.some((row) => JSON.stringify(row).includes("unusedHistoricalPayload"))).toBe(false);
      }
      measurements.push({ role, date, completed, cancelled, items: actual.items.length, baseline: baseline.measurement, scoped: scoped.measurement,
        nodeJsonBytes: { baseline: Buffer.byteLength(JSON.stringify({ sources: baseline.sources, fulfillment: baseline.fulfillment })),
          scoped: Buffer.byteLength(JSON.stringify({ sources: scoped.sources, fulfillment: scoped.fulfillment })) } });
    }
  }
  mkdirSync("output/item5", { recursive: true });
  writeFileSync("output/item5/parity-measurements.json", JSON.stringify(measurements, null, 2));
});

test("repeated scoped reads are complete and deterministic", async () => {
  const first = readDataset(1, false, "2026-10-03", true, true);
  const second = readDataset(1, false, "2026-10-03", true, true);
  expect(second.sources).toEqual(first.sources);
  expect(second.fulfillment).toEqual(first.fulfillment);
});
