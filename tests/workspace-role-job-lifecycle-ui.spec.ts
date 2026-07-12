import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("role and job management UI uses the server-backed catalog boundary", () => {
  const source = readFileSync(
    "src/features/hospital-admin/role-permission-management/screen.tsx",
    "utf8"
  );
  const state = readFileSync(
    "src/features/hospital-admin/role-permission-management/use-workspace-role-state.ts",
    "utf8"
  );
  const api = readFileSync(
    "src/features/hospital-admin/role-permission-management/server-catalog.ts",
    "utf8"
  );
  expect(source).toContain("workspace.mutateCatalog");
  expect(source).toContain('action: "job.archive"');
  expect(state).toContain("usesServerCatalog");
  expect(api).toContain("/role-permission-management");
});

test("member directory uses archive language and excludes inactive definitions from new selections", () => {
  const source=readFileSync("src/features/auth/workspace-membership-management.tsx","utf8");
  expect(source).toContain("includeArchived=true");
  expect(source).toContain('action: "archive"');
  expect(source).toContain("구성원 보관");
  expect(source).toContain("구성원 복구");
  expect(source).toContain("보관됨");
  expect(source).toContain("activePermissionRoles");
  expect(source).toContain("activeJobPositions");
  expect(source).not.toContain("90일 후 영구 삭제");
  expect(source).not.toContain("구성원 삭제");
});
