import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

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
  ["20260714110720", "20260711112810"],
  ["20260714110730", "20260714194500"],
  ["20260714110738", "20260714202000"],
  ["20260714154910", "20260714213000"],
  ["20260714162034", "20260715100000"],
  ["20260715062205", "20260715014500"],
  ["20260715164007", "20260716010000"],
  ["20260715164307", "20260716011000"],
  ["20260715172425", "20260716020000"],
  ["20260715180209", "20260716030000"],
  ["20260719052222", "20260705133000"],
  ["20260719052236", "20260719051725"],
  ["20260719052453", "20260719052433"],
  ["20260719120330", "20260719000000"],
  ["20260722112553", "20260722143000"],
  ["20260722130209", "20260722190000"],
  ["20260723140134", "20260723220927"],
  ["20260723202954", "20260723110000"],
  ["20260723203002", "20260723120000"],
  ["20260723203008", "20260723223000"],
  ["20260808114420", "20260808055307"],
  ["20260815102642", "20260815100223"],
  ["20260815103052", "20260815102956"],
  ["20260816062243", "20260815120000"],
  ["20260821071846", "20260821063113"],
  ["20260823063449", "20260823035126"],
] as const;

const newAliasProofs = [
  [
    "20260705133000_notification_event_persistence.sql",
    "a07f383291b78abb5ccfa4035defec2541092fb3ba02a595fa4a5a0e70bacfc5",
  ],
  [
    "20260719051725_performance_batch_rpc_followup.sql",
    "77fcf1e38c22241e59f10fbabe199dc8b72fddfa79926e3f88cc17cf93b1c869",
  ],
  [
    "20260719052433_notification_private_function_search_path.sql",
    "99743ad3e4bf7f26db1cd6ee39f6cdbbb445456b9bd6d012bb31a4cfa7828ffb",
  ],
  [
    "20260719000000_chart_preconsultation_vital_comparison.sql",
    "1057b3a181bee5b6c14aa74ffc546033673702585e94f7cb02a58965093f6c6c",
  ],
  [
    "20260723220927_workspace_space_management.sql",
    "8d73eb3bbf79ecb10bfbfeacf43aaa022fd3b1345204975a916f468c5b2f30aa",
  ],
  [
    "20260723110000_workspace_hospital_profiles.sql",
    "00692771145ff130546fc637c2de05f2f6a2f3b7cb4bf4b1ecc04894779e79f0",
  ],
  [
    "20260723120000_private_hospital_logos.sql",
    "0127a16271d09adcd4c87a5e7528780f2640c31d475f0c67ed51cd6d47dcedbf",
  ],
  [
    "20260723223000_hospital_settings_audit_event_types.sql",
    "e6fd19d052100875bd1d72ae7316ead714c1061ec72173b580662d3198895d0f",
  ],
  [
    "20260808055307_customer_profile_live_read_projection.sql",
    "f9b0e061bc69d660aff20af739b6da7e206511458564e76fb6c148e326b2c39e",
  ],
  [
    "20260815120000_chart_diagnosis_closure.sql",
    "a0a563d84506aea992f145d8088c4714d3045f6771826c0c4557231697f067a4",
  ],
  [
    "20260821063113_clinical_master_phase1_permission_source_assignment_precedence.sql",
    "188328cde08de3b576214bb49e8847c4bf9ca1f68ab43ccb15a335c74e878484",
  ],
  [
    "20260823035126_clinical_master_diagnosis_foundation.sql",
    "14aad7316e76bcfec084ffae701bb48652105ff66f7c9315578ee077deac1612",
  ],
] as const;

const preservedRemoteSql = [
  [
    "20260601111822_billing_guardian_checkout_hardening.sql",
    26442,
    "9e7d2348e736ccf3f0827aeaf83c7a9fe65c0ae8c44384e196f7eceeca43b937",
  ],
  [
    "20260615025340_den_505_rpc_role_audit_hardening.sql",
    16588,
    "049e5f75e35ba5049fdbdc36db165bedf96874d86266ef8e7b9b2c99d17bea10",
  ],
  [
    "20260616090822_den_512_reception_walkin_event_time_writer.sql",
    5387,
    "fbe3f89c9bf802cce701d92b1e5ec5721f41a076e195a7b541013a9b5688ed97",
  ],
  [
    "20260702152054_20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
    21120,
    "e748ee7d420e263490da2e48962bb6f4940cefdd0c8b3fef1da57d0549a9f463",
  ],
] as const;

const genuinelyPending = [
  "20260601093000",
  "20260616090000",
  "20260616100000",
  "20260616101000",
  "20260616102000",
  "20260617113000",
  "20260618120000",
  "20260618121000",
  "20260625090000",
  "20260627183000",
  "20260701080619",
  "20260702142317",
  "20260708104700",
  "20260711150000",
] as const;

const historyOnlyApplied = [
  "20260705133000",
  "20260711112810",
  "20260714194500",
  "20260714202000",
  "20260714213000",
  "20260715014500",
  "20260715100000",
  "20260716010000",
  "20260716011000",
  "20260716020000",
  "20260716030000",
  "20260719000000",
  "20260719051725",
  "20260719052433",
  "20260722143000",
  "20260722190000",
  "20260723110000",
  "20260723120000",
  "20260723220927",
  "20260723223000",
  "20260808055307",
  "20260815100223",
  "20260815102956",
  "20260815120000",
  "20260821063113",
  "20260823035126",
] as const;

const finalFingerprintProofs = [
  "5b6046943b4317bf828110285007a24f82e8aaf74ae1e2bfa0b20695952170b4",
  "8d51fb069dc582fc2bbaf7a96565c10f5a6d3e177711fab90e842c0bf5859901",
  "ac9e4ad6fb7f5d7ce05a03e3dc01888937e47f083644a5da96b7684cb7fb31a3",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
] as const;

const migrationFiles = readdirSync("supabase/migrations");

test("all reviewed remote timestamp aliases remain comment-only", () => {
  const manifest = readFileSync(
    "docs/engineering/operations/supabase-migration-history-reconciliation.md",
    "utf8",
  );

  expect(aliases).toHaveLength(38);
  expect(new Set(aliases.map(([remoteVersion]) => remoteVersion)).size).toBe(38);

  for (const [remoteVersion, canonicalVersion] of aliases) {
    const aliasFile = findMigrationFile(remoteVersion);
    const canonicalFile = findMigrationFile(canonicalVersion);
    const source = readFileSync(`supabase/migrations/${aliasFile}`, "utf8");

    expect(aliasFile.startsWith(`${remoteVersion}_remote_history_alias_`)).toBe(
      true,
    );
    expect(source).toContain(canonicalVersion);
    expect(executableLines(source)).toEqual([]);
    expect(source).not.toContain(";");
    expect(manifest).toContain(`\`${aliasFile}\``);
    expect(manifest).toContain(`\`${canonicalFile}\``);
  }
});

test("new alias canonical hashes and the behavior-equivalent status chain are documented", () => {
  const manifest = readFileSync(
    "docs/engineering/operations/supabase-migration-history-reconciliation.md",
    "utf8",
  );

  for (const [fileName, expectedHash] of newAliasProofs) {
    const source = readFileSync(`supabase/migrations/${fileName}`, "utf8");
    expect(sha256(source)).toBe(expectedHash);
    expect(manifest).toContain(expectedHash);
  }

  expect(manifest).toContain("behavior-equivalent remote chain");
  expect(manifest).toContain("20260715164007");
  expect(manifest).toContain("20260715164307");
  expect(manifest).toContain("20260715180209");
  expect(manifest).toContain("20260716030000");
});

test("the chart preconsultation proof distinguishes raw and normalized hashes", () => {
  const manifest = readFileSync(
    "docs/engineering/operations/supabase-migration-history-reconciliation.md",
    "utf8",
  );

  expect(manifest).toContain(
    "1057b3a181bee5b6c14aa74ffc546033673702585e94f7cb02a58965093f6c6c",
  );
  expect(manifest).toContain(
    "6da8f83abfea862cf0707907e610b2d84bdef59a3a799033575e641c09b0a816",
  );
  expect(manifest).toContain("terminal-LF normalization");
  expect(manifest).toContain("not be read as a raw byte-identity claim");
});

test("the four preserved remote SQL files have stable proof hashes", () => {
  const manifest = readFileSync(
    "docs/engineering/operations/supabase-migration-history-reconciliation.md",
    "utf8",
  );

  for (const [fileName, expectedBytes, expectedHash] of preservedRemoteSql) {
    const source = readFileSync(`supabase/migrations/${fileName}`, "utf8");

    expect(source.length).toBeGreaterThan(200);
    expect(Buffer.byteLength(source, "utf8")).toBe(expectedBytes);
    expect(sha256(source)).toBe(expectedHash);
    expect(source).not.toContain("Remote-history compatibility alias");
    expect(manifest).toContain(fileName);
    expect(manifest).toContain(expectedHash);
  }
});

test("the reconciliation snapshot and pending boundary are current", () => {
  const manifest = readFileSync(
    "docs/engineering/operations/supabase-migration-history-reconciliation.md",
    "utf8",
  );

  expect(manifest).toContain("| 158 | 130 | 118 | 12 | 40 |");
  expect(manifest).toContain("170/130/130/0/40");
  expect(manifest).toContain("| 170 | 156 | 156 | 0 | 14 |");
  expect(manifest).toMatch(/26\s+behavior-applied canonical/);
  expect(manifest).toMatch(/14\s+genuinely pending/);

  for (const version of historyOnlyApplied) {
    expect(manifest).toContain(`\`${version}\``);
  }

  for (const proof of finalFingerprintProofs) {
    expect(manifest).toContain(proof);
  }

  expect(manifest).toContain("LegacyDbPushMissingRemoteError");
  expect(manifest).toContain("history-only repair");
  expect(manifest).toContain("Do not use `--include-all`");
  expect(manifest).not.toMatch(/remote repair\s+pending/i);

  for (const version of genuinelyPending) {
    expect(manifest).toContain(`\`${version}\``);
  }
});

function findMigrationFile(version: string) {
  const matches = migrationFiles.filter((fileName) =>
    fileName.startsWith(`${version}_`),
  );
  expect(matches, `missing migration file for ${version}`).toHaveLength(1);
  return matches[0] ?? "";
}

function executableLines(source: string) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"));
}

function sha256(source: string) {
  return createHash("sha256").update(source, "utf8").digest("hex");
}
