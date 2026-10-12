import { expect, test } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";

test("billing ownership survives reads, transfers authority, rejects stale and foreign actors", async ({ request }) => {
 const invoiceId = "synthetic-owner-invoice";
 const url = "/api/workspaces/clair-demo/billing/assignment";
 const headers = (actor: string) => ({ "x-clair-demo-session-user-id": actor });
 const change = (actor: string, action: string, expectedRevision: number, assignedToUserId?: string) => request.patch(url, { headers: headers(actor), data: { invoiceId, action, expectedRevision, assignedToUserId } });
 expect((await request.get(`${url}?invoiceId=${invoiceId}`)).status()).toBe(401);
 const before = await (await request.get(`${url}?invoiceId=${invoiceId}`, { headers: headers("user-tech") })).json();
 const initial = before.assignment.revision;
 expect((await change("user-tech", "claim", initial)).status()).toBe(200);
 const other = await (await request.get(`${url}?invoiceId=${invoiceId}`, { headers: headers("user-admin") })).json();
 expect(other.assignment).toMatchObject({ assignedToUserId: "user-tech", canManage: false, revision: initial + 1 });
 expect((await change("user-admin", "unassign", initial + 1)).status()).toBe(403);
 expect((await change("user-tech", "assign", initial + 1, "unknown-person")).status()).toBe(403);
 expect((await change("user-tech", "assign", initial + 1, "user-admin")).status()).toBe(200);
 expect((await change("user-tech", "unassign", initial + 2)).status()).toBe(403);
 expect((await change("user-admin", "unassign", initial + 1)).status()).toBe(409);
 expect((await change("user-admin", "unassign", initial + 2)).status()).toBe(200);
 expect((await request.patch("/api/workspaces/foreign/billing/assignment", { headers: headers("user-admin"), data: { invoiceId, action: "claim", expectedRevision: 0 } })).status()).toBe(403);
});

 test("billing UI claims durably and enables only the current assignee financial controls", async ({ page, request }) => {
  const assignmentUrl = "/api/workspaces/clair-demo/billing/assignment";
  const existing = await (await request.get(`${assignmentUrl}?invoiceId=invoice-coco-260501`, { headers: { "x-clair-demo-session-user-id": "user-admin" } })).json();
  if (existing.assignment.assignedToUserId) {
    const cleared = await request.patch(assignmentUrl, { headers: { "x-clair-demo-session-user-id": existing.assignment.assignedToUserId }, data: { invoiceId: "invoice-coco-260501", action: "unassign", expectedRevision: existing.assignment.revision } });
    expect(cleared.status()).toBe(200);
  }
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: "clair-demo", workspaces: [{ id: "clair-demo", displayName: "합성 수납 공간", representativeName: "합성 관리자", contactEmail: "owner@synthetic.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: "2026-10-12T00:00:00Z" }], memberships: [{ id: "synthetic-billing-member", workspaceId: "clair-demo", userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "owner@synthetic.test", roles: ["hospital_admin"], status: "active", createdAt: "2026-10-12T00:00:00Z", activatedAt: "2026-10-12T00:00:00Z" }], invitations: [] }));
  }, SESSION_WORKSPACES_STORAGE_KEY);
  await page.goto("/w/clair-demo/billing?invoiceId=invoice-coco-260501&modulePanel=closed&right=open&aside=closed");
  const claims = await page.request.get(`${assignmentUrl}?invoiceId=invoice-coco-260501`, { headers: { "x-clair-demo-session-user-id": "user-admin" } });
  expect(claims.status()).toBe(200);
  const claim = page.getByRole("button", { name: "담당하기", exact: true });
  await expect(claim).toBeEnabled({ timeout: 15000 });
  const pay = page.getByRole("button", { name: "수납 완료", exact: true });
  await expect(pay).toBeDisabled();
  await claim.click();
  await expect(page.getByText("담당자로 지정됐어요.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /담당자.*변경/ })).toBeEnabled();
  await expect(pay).toBeEnabled();
  await page.getByRole("button", { name: /담당자.*변경/ }).click();
  await page.getByRole("menuitem", { name: "송하윤", exact: true }).click();
  await expect(pay).toBeDisabled();
  await expect(page.getByRole("button", { name: /담당자.*변경/ })).toBeDisabled();
 });
