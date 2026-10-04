import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

async function grantSyntheticWorkspaceAccess(page: Page) {
  await page.addInitScript(
    ([storageKey, workspaceId]) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          currentWorkspaceId: workspaceId,
          workspaces: [{
            id: workspaceId,
            displayName: "합성 테스트 병원",
            representativeName: "합성 관리자",
            contactEmail: "owner@synthetic.test",
            contactPhone: null,
            subscriptionStatus: "trialing",
            createdBySessionId: "playwright-default-session",
            createdAt: "2026-10-04T00:00:00.000Z",
          }],
          memberships: [{
            id: "synthetic-membership",
            workspaceId,
            userSessionId: "playwright-default-session",
            displayName: "합성 관리자",
            email: "admin@synthetic.test",
            roles: ["hospital_admin"],
            status: "active",
            createdAt: "2026-10-04T00:00:00.000Z",
            activatedAt: "2026-10-04T00:00:00.000Z",
          }],
          invitations: [],
          updatedAt: "2026-10-04T00:00:00.000Z",
        }),
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID],
  );
}

const screens = [
  { queueType: "dispensing", module: "dispensing", activity: "조제" },
  { queueType: "treatment", module: "dispensing", activity: "처치" },
  { queueType: "lab", module: "lab", activity: "검사" },
  { queueType: "imaging", module: "imaging", activity: "판독" },
] as const;

for (const screen of screens) {
  for (const status of ["requested", "in_progress"] as const) {
    const action = status === "requested" ? "담당 변경" : "담당 인계";

    test(`${screen.queueType} ${action} preserves loading, candidates and failed-read feedback`, async ({ page }) => {
      await grantSyntheticWorkspaceAccess(page);
      await page.route("**/*", async (route) => {
        const hostname = new URL(route.request().url()).hostname;
        if (hostname !== "127.0.0.1" && hostname !== "localhost") {
          await route.abort();
          return;
        }
        await route.fallback();
      });

      const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
      const workItemId = `synthetic-${screen.queueType}-${status}`;
      const workItem = {
        workspaceId,
        id: workItemId,
        orderId: workItemId,
        encounterId: `synthetic-encounter-${screen.queueType}`,
        queueType: screen.queueType,
        status,
        requestCycle: 1,
        rowRevision: 1,
        assignedToUserId: "user-tech",
        requestedByUserId: "user-vet",
        patientName: "합성 환자",
        guardianName: "합성 보호자",
        requesterName: "합성 수의사",
        createdAt: "2026-10-04T09:00:00.000Z",
        updatedAt: "2026-10-04T09:00:00.000Z",
        sourceSnapshot: {
          orderDisplayName: "합성 업무",
          serviceItemId: "synthetic-service",
          instruction: "합성 테스트 지시",
        },
      };
      await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
        const queueType = new URL(route.request().url()).searchParams.get("queueType");
        await route.fulfill({ json: { ok: true, workItems: queueType === screen.queueType ? [workItem] : [] } });
      });

      const reads: Array<{ pathname: string; method: string; actor: string | undefined }> = [];
      const mutations: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "PATCH" && request.url().includes("/fulfillment/")) {
          mutations.push(request.url());
        }
      });
      let releaseCandidates: (() => void) | undefined;
      await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}/assignees`, async (route) => {
        const request = route.request();
        reads.push({
          pathname: new URL(request.url()).pathname,
          method: request.method(),
          actor: request.headers()["x-clair-demo-session-user-id"],
        });
        if (reads.length === 1) {
          await new Promise<void>((resolve) => { releaseCandidates = resolve; });
          await route.fulfill({ json: { ok: true, assignees: [
            { userId: "user-tech", displayName: "합성 현재 담당자" },
            { userId: "user-admin", displayName: "합성 다음 담당자", title: "합성 직책" },
          ] } });
        } else {
          await route.fulfill({ status: 503, json: { ok: false } });
        }
      });

      try {
        await page.goto(`/w/${workspaceId}/${screen.module}?modulePanel=open&aside=closed`);
        const queueItemTestId = screen.module === "dispensing"
          ? `order-queue-item-live-fulfillment-${workItemId}`
          : `${screen.module}-queue-item-live-${screen.module}-${workItemId}`;
        await page.getByTestId(queueItemTestId).click();

        const openDialog = async () => {
          await page.getByRole("button", { name: `${screen.activity} 상태 액션 열기`, exact: true }).click();
          await page.getByRole("menuitem", { name: action, exact: true }).click();
        };
        await openDialog();
        const dialog = page.getByRole("dialog", { name: `${screen.activity} ${action}`, exact: true });
        const assigneeSelect = dialog.getByRole("combobox", { name: "인계할 담당자" });
        await expect(dialog).toBeVisible();
        await expect(assigneeSelect).toBeDisabled();
        await expect(assigneeSelect).toContainText("담당자 불러오는 중");
        await expect.poll(() => reads.length).toBe(1);
        releaseCandidates?.();

        await expect(assigneeSelect).toBeEnabled();
        await assigneeSelect.click();
        await expect(page.getByRole("option", { name: "합성 현재 담당자" })).toHaveCount(0);
        await page.getByRole("option", { name: "합성 다음 담당자 · 합성 직책", exact: true }).click();
        if (status === "in_progress") {
          await dialog.getByRole("textbox", { name: "인계 사유", exact: true }).fill("합성 테스트 인계");
        }
        await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
        await dialog.getByRole("button", { name: "취소", exact: true }).click();

        await openDialog();
        await expect(page.getByText("담당자 목록을 불러오지 못했어요.", { exact: true })).toBeVisible();
        await expect(assigneeSelect).toBeEnabled();
        await expect(assigneeSelect).toContainText("담당자 선택");
        await expect(dialog.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
        await assigneeSelect.click();
        await expect(page.getByRole("option")).toHaveCount(0);

        expect(reads).toEqual([1, 2].map(() => ({
          pathname: `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}/assignees`,
          method: "GET",
          actor: "user-tech",
        })));
        expect(mutations).toEqual([]);
      } finally {
        releaseCandidates?.();
      }
    });
  }
}
