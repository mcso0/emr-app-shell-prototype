import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("role and job management UI uses server lifecycle endpoints and impact dialogs", () => {
  const source=readFileSync("src/features/auth/workspace-role-permission-management.tsx","utf8");
  const roleDialog=readFileSync("src/features/auth/workspace-permission-role-lifecycle-dialog.tsx","utf8");
  const jobDialog=readFileSync("src/features/auth/workspace-job-position-lifecycle-dialog.tsx","utf8");
  expect(source).toContain("/permission-roles");
  expect(source).toContain("/job-positions");
  expect(source).toContain("다시 활성화");
  expect(roleDialog).toContain("대체 역할");
  expect(roleDialog).toContain("보관된 구성원의 이력은 유지");
  expect(jobDialog).toContain("기존 구성원");
  expect(jobDialog).toContain("대체 직무");
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
