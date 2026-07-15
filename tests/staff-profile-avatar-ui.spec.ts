import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("self avatar UI uses the signed direct-upload handshake and updates only after finalize", async () => {
  const drawerSource = await readFile(
    "src/features/staff/staff-operational-profile-drawer.tsx",
    "utf8",
  );

  expect(drawerSource).toContain("capabilities.canEditAvatar");
  expect(drawerSource).toContain("getBrowserSupabaseClient");
  expect(drawerSource).toContain("uploadToSignedUrl");
  expect(drawerSource).toContain('action: "prepare"');
  expect(drawerSource).toContain('action: "finalize"');
  expect(drawerSource).toContain('action: "discard"');
  expect(drawerSource).toContain('method: "DELETE"');
  expect(drawerSource).toContain('phase("uploading")');
  expect(drawerSource).toContain('phase("processing")');
  expect(drawerSource.indexOf('action: "finalize"')).toBeLessThan(
    drawerSource.indexOf("avatarUrl: body.avatarUrl"),
  );
  expect(drawerSource).not.toMatch(/formData\(|request\.arrayBuffer\(/);
});

test("avatar dialog renders a real square preview, icon-only close/reset, phases, and focus return", async () => {
  const headerSource = await readFile(
    "src/features/staff/components/profile-side-panel-v2-header.tsx",
    "utf8",
  );

  expect(headerSource).toContain("URL.createObjectURL");
  expect(headerSource).toContain("URL.revokeObjectURL");
  expect(headerSource).toContain("선택한 프로필 이미지 미리보기");
  expect(headerSource).toContain("선택한 이미지 제거");
  expect(headerSource).toContain("프로필 이미지 업로드 닫기");
  expect(headerSource).toContain("업로드 준비 중");
  expect(headerSource).toContain("파일 업로드 중");
  expect(headerSource).toContain("이미지 처리 중");
  expect(headerSource).toContain("menuTriggerRef.current?.focus()");
  expect(headerSource).not.toMatch(/<DialogClose[^>]*>취소<\/DialogClose>/);
});
