import { expect, test } from "@playwright/test";

const workspaceId = "workspace-clair-cheongdam";
const date = "2026-09-01";
for (const destination of ["lab", "imaging", "dispensing"] as const) {
  test(`Home deep link selects exact overdue ${destination} work among the same encounter`, async ({ page }) => {
    const dates: string[] = [];
    await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
      const url = new URL(route.request().url());
      const selectedDate = url.searchParams.get("date");
      if (selectedDate) dates.push(selectedDate);
      const workItems = url.searchParams.get("queueType") === destination && (!selectedDate || selectedDate === date)
        ? ["first", "second"].map((id) => ({
          id, workspaceId, encounterId: "same-encounter", patientId: "same-patient", orderId: `order-${id}`,
          queueType: destination, status: "requested", requestCycle: 1, rowRevision: 1,
          requestedByUserId: "requester", createdAt: `${date}T09:00:00+09:00`, updatedAt: `${date}T09:00:00+09:00`,
          sourceSnapshot: { patientName: "합성 환자", guardianName: "합성 보호자", orderDisplayName: `${id} 검사`, requestingVetName: "합성 수의사" },
        })) : [];
      await route.fulfill({ json: { ok: true, workItems, sourceStatus: "live" } });
    });
    const selection = destination === "lab" ? "&labResultId=live-lab-second" : destination === "imaging" ? "&imagingStudyId=live-imaging-second" : "";
    await page.goto(`/w/${workspaceId}/${destination}?encounterId=same-encounter&workItemId=second&date=${date}&modulePanel=open${selection}`);
    const cardId = destination === "lab" ? "lab-queue-card-live-lab-second" : destination === "imaging" ? "imaging-queue-card-live-imaging-second" : "order-queue-item-live-fulfillment-second";
    await expect(page.getByTestId(cardId)).toHaveAttribute("data-selected", "true");
    expect(dates.length).toBeGreaterThan(0);
    expect(new Set(dates)).toEqual(new Set([date]));
  });
}
