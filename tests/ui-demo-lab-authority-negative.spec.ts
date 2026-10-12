import { expect, test } from "@playwright/test";
import { claimLabFixture, labFixtureRowId, labFixtureWorkId, prepareLabApiFixture } from "./fixtures/modern-lab-api";

// Characterizes the pinned product behavior; this does not set a legacy support policy.
for (const initialOwner of [null, "user-tech"]) {
  test(`legacy mock lab stays locked ${initialOwner ? "for its current owner" : "while unassigned"} without Phase2 authority`, async ({ page }) => {
    const fixture = await prepareLabApiFixture(page, [], { workspaceId: "clair-demo", initialOwner });
    await page.goto(fixture.href);
    await page.getByTestId(`lab-queue-item-live-lab-${labFixtureWorkId}`).click();
    const input = page.getByTestId(`lab-result-input-${labFixtureRowId}`);
    await expect(input).toBeVisible();
    await expect(input).toBeDisabled();
    expect(fixture.stats().phase2Reads).toBe(0);
    expect(fixture.writes).toHaveLength(0);
  });
}

test("modern lab claim allows only the current assignee and handoff locks the previous actor", async ({ page }) => {
  const fixture = await prepareLabApiFixture(page, []);
  await page.goto(fixture.href);
  await page.getByTestId(`lab-queue-item-live-lab-${labFixtureWorkId}`).click();
  const input = page.getByTestId(`lab-result-input-${labFixtureRowId}`);
  await expect(input).toBeDisabled();
  await claimLabFixture(page);
  expect(fixture.commands[0]).toMatchObject({ action: "claim", expectedRevision: 1 });
  await page.getByRole("button", { name: "담당자 송하윤 변경", exact: true }).click();
  await page.getByRole("menuitem", { name: "합성 다른 담당자", exact: true }).click();
  await expect(input).toBeDisabled();
  expect(fixture.commands[1]).toMatchObject({ action: "assign", assignedToUserId: "user-admin", expectedRevision: 2 });
  expect(fixture.stats().owner).toBe("user-admin");
  expect(fixture.writes).toHaveLength(0);
});
