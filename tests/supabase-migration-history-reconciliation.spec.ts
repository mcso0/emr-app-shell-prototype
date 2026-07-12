import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const aliases = [
  ["20260524121849", "20260524121000"],
  ["20260529090705", "20260529090000"],
  ["20260529090827", "20260529090800"],
  ["20260601112430", "20260601112352"],
  ["20260616062920", "20260616054000"],
  ["20260625082856", "20260625103000"],
  ["20260625082918", "20260625113000"],
  ["20260702084035", "20260702090000"],
  ["20260702084325", "20260702110000"],
  ["20260702084357", "20260702130000"],
  ["20260702084417", "20260702133000"],
  ["20260705141026", "20260705120000"],
] as const;

const remoteOnlyMigrations = [
  "20260601111822_billing_guardian_checkout_hardening.sql",
  "20260615025340_den_505_rpc_role_audit_hardening.sql",
  "20260616090822_den_512_reception_walkin_event_time_writer.sql",
  "20260702152054_20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
] as const;

test("remote timestamp aliases remain no-op compatibility records", () => {
  for (const [remoteVersion, canonicalVersion] of aliases) {
    const fileName = findMigrationFile(remoteVersion);
    const source = readFileSync(`supabase/migrations/${fileName}`, "utf8");

    expect(source).toContain("Remote-history compatibility alias");
    expect(source).toContain(canonicalVersion);
    expect(source).not.toMatch(/\b(create|alter|insert|update|delete|drop|grant|revoke)\b/i);
  }
});

test("remote-only migration SQL is preserved for deterministic fresh replay", () => {
  for (const fileName of remoteOnlyMigrations) {
    const source = readFileSync(`supabase/migrations/${fileName}`, "utf8");
    expect(source.trim().length).toBeGreaterThan(200);
    expect(source).not.toContain("Remote-history compatibility alias");
  }
});

function findMigrationFile(version: string) {
  const manifest = readFileSync("docs/engineering/operations/supabase-migration-history-reconciliation.md", "utf8");
  const match = manifest.match(new RegExp(`\\b(${version}_[^\\s|]+\\.sql)\\b`));
  expect(match, `missing alias manifest entry for ${version}`).not.toBeNull();
  return match?.[1] ?? "";
}
