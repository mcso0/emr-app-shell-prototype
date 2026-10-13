import { expect, test } from "@playwright/test";

test("billing skips provisional ownership reads and resumes persisted authorization", async ({ page }) => {
  const realInvoiceId = "98400000-0000-4000-8000-000000000001";
  const assignmentReads: string[] = [];
  let allowed = false;
  let materialized = false;
  await page.route("**/billing/assignment?*", async route => {
    const invoiceId = new URL(route.request().url()).searchParams.get("invoiceId")!;
    assignmentReads.push(invoiceId);
    await route.fulfill({ status: allowed ? 200 : 403, json: allowed ? {
      ok: true, assignment: { invoiceId, revision: 0, assignedToUserId: null, assignedToDisplayName: null, canManage: true, assignees: [] },
    } : { ok: false, denialReason: "permission_missing" } });
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "clair-emr:chart-live-encounter-handoffs:v1",
      JSON.stringify({
        "encounter-live-billing": {
          encounter: {
            id: "encounter-live-billing",
            workspaceId: "clair-demo",
            patientId: "patient-live-bori",
            guardianId: "guardian-live-mina",
            primaryVeterinarianId: "user-vet-suji",
            encounterNo: "E-LIVE-BILL",
            receptionType: "walk_in",
            visitPurpose: "live billing candidate 검수",
            status: "ordered",
            checkedInAt: "2026-05-30T10:00:00.000Z",
            createdAt: "2026-05-30T10:00:00.000Z",
            updatedAt: "2026-05-30T10:10:00.000Z",
          },
          patient: {
            id: "patient-live-bori",
            patientNo: "P-LIVE-0001",
            workspaceId: "clair-demo",
            name: "보리",
            species: "dog",
            breed: "푸들",
            estimatedAgeText: "5세",
            sex: "female",
            neutered: true,
            handlingCautionLocked: true,
            status: "active",
            createdAt: "2026-05-30T09:00:00.000Z",
            updatedAt: "2026-05-30T09:00:00.000Z",
          },
          primaryGuardian: {
            id: "guardian-live-mina",
            workspaceId: "clair-demo",
            name: "김미나",
            mobilePhone: "010-0000-0000",
            createdAt: "2026-05-30T09:00:00.000Z",
            updatedAt: "2026-05-30T09:00:00.000Z",
          },
          updatedAt: "2026-05-30T10:10:00.000Z",
        },
      }),
    );
  });
  await page.route("**/api/workspaces/clair-demo/billing/invoice-candidates?encounterId=encounter-live-billing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        candidates: [
          {
            billingCandidateId: "billcand-live-cbc",
            description: "Live CBC 검사",
            invoiceId: materialized ? realInvoiceId : undefined,

            lineTotal: 35000,
            orderId: "order-live-cbc",
            quantity: 1,
            unitPrice: 35000,
          },
        ],
        enforcedBy: "billing-invoice-candidate-sync",
      }),
    });
  });

  await page.goto("/w/clair-demo/billing?encounterId=encounter-live-billing&modulePanel=open&right=closed&aside=closed");

  await expect(page.getByText("김미나 · 보리")).toBeVisible();
  await expect(page.getByText("LIVE-E-LIVE-BILL · 김미나")).toBeVisible();
  const billingTable = page.getByRole("table", { name: "청구 항목 테이블" });
  await expect(billingTable.locator("tbody tr", { hasText: "Live CBC 검사" })).toContainText("35,000원");

  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("clair-billing-assignment"));
  });
  expect(assignmentReads.filter(id => id.startsWith("invoice-live-"))).toEqual([]);
  materialized = true;
  await page.goto(`/w/clair-demo/billing?encounterId=encounter-live-billing&modulePanel=open&right=open&aside=closed`);
  await expect.poll(() => assignmentReads.includes(realInvoiceId)).toBe(true);
  await expect(page.getByRole("button", { name: "담당하기", exact: true })).toBeDisabled();
  allowed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("clair-billing-assignment")));
  await expect(page.getByRole("button", { name: "담당하기", exact: true })).toBeEnabled();
  expect(assignmentReads.filter(id => id.startsWith("invoice-live-"))).toEqual([]);
});
