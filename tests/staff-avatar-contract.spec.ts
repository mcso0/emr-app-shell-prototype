import { expect, test } from "@playwright/test";

import {
  CHEONGDAM_AVATAR_USER_IDS,
  CHEONGDAM_FALLBACK_USER_IDS,
  getLocalStaffAvatarUrl,
  getStaffAvatarStoragePath,
} from "../src/features/staff/staff-avatar";
import { createMockWorkspaceStaffReadGateway } from "../src/features/staff/server-workspace-staff-core";

test("selected Cheongdam users resolve to user-id based avatar assets", () => {
  expect(CHEONGDAM_AVATAR_USER_IDS).toHaveLength(11);
  expect(CHEONGDAM_FALLBACK_USER_IDS).toEqual([
    "49110000-0000-4000-8000-000000000002",
    "49110000-0000-4000-8000-000000000004",
    "49110000-0000-4000-8000-000000000014",
  ]);

  for (const userId of CHEONGDAM_AVATAR_USER_IDS) {
    expect(getStaffAvatarStoragePath(userId)).toBe(`${userId}.png`);
    expect(getLocalStaffAvatarUrl(userId)).toBe(`/avatars/${userId}.png`);
  }
});

test("fallback users do not resolve to an avatar asset", () => {
  for (const userId of CHEONGDAM_FALLBACK_USER_IDS) {
    expect(getLocalStaffAvatarUrl(userId)).toBeNull();
  }
});

test("mock staff gateway keeps selected avatars and fallback users distinct", async () => {
  const result = await createMockWorkspaceStaffReadGateway().listWorkspaceStaff({
    role: "vet",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.staff.find((member) => member.id === "user-vet-suji")?.avatarUrl).toBe(
    "/avatars/49110000-0000-4000-8000-000000000003.png",
  );
  expect(result.staff.find((member) => member.id === "user-vet-jaewon")?.avatarUrl).toBeUndefined();
});

test("reception veterinarian lanes render image avatars and preserve fallback", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");

  const laneNameLabels = page
    .getByTestId("veterinarian-lane-header")
    .locator("span.min-w-0.truncate");
  await expect(laneNameLabels).not.toHaveCount(0);
  for (const laneNameLabel of await laneNameLabels.all()) {
    await expect(laneNameLabel).toHaveClass(/emr-text-body/);
  }

  const sujiHeader = page.getByTestId("veterinarian-lane-header").filter({ hasText: "이수지" });
  await expect(sujiHeader.locator("img")).toHaveAttribute(
    "src",
    "/avatars/49110000-0000-4000-8000-000000000003.png",
  );

  const jaewonHeader = page.getByTestId("veterinarian-lane-header").filter({ hasText: "서재원" });
  await expect(jaewonHeader.locator("img")).toHaveCount(0);
  await expect(jaewonHeader).toContainText("JW");
});
