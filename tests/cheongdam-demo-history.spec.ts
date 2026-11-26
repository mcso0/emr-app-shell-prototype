import { expect, test } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { cheongdamWorkspaceId as workspace, type DemoHistoryItem } from "../src/features/chart/demo-history-contract";
import { filterDemoHistory, toDemoChart } from "../src/features/chart/demo-history-projection";

const item: DemoHistoryItem = {
  id: "d0000001-0000-4000-8000-000000000001",
  patientId: "d0000002-0000-4000-8000-000000000001",
  patient: "검수 환자", species: "개", visitAt: "2026-06-13T09:00:00+09:00",
  title: "외이도 재진", diagnosis: { name: "외이염", kind: "confirmed" },
  soap: { S: "귀가 가려운 듯함.", O: "우측 홍반.", A: "외이염.", P: "나중에 경과 확인." },
  orders: [],
};

test("Archived search honors date, query, order and ownership without becoming signed or eligible as a target", () => {
  const newest = {
    ...item, id: "other", title: "새 증상", visitAt: "2026-07-14T10:00:00+09:00",
    soap: { ...item.soap, O: "새로운 보행 불편." },
  };
  const rows = [item, newest];
  expect(filterDemoHistory(rows, { query: "외이도" })).toEqual([item]);
  expect(filterDemoHistory(rows, { query: "우측 홍반" })).toEqual([item]);
  expect(filterDemoHistory(rows, { from: "2026-07-14" })).toEqual([newest]);
  expect(filterDemoHistory(rows, { sort: "oldest" })).toEqual([item, newest]);
  expect(filterDemoHistory(rows, { sort: "recent" })).toEqual([newest, item]);
  expect(filterDemoHistory(rows, { mine: true })).toEqual([]);
  expect(filterDemoHistory(rows, { doctor: "named-vet" })).toEqual([]);
  expect(filterDemoHistory(rows, { targets: true })).toEqual([]);
  expect(toDemoChart(item)).toMatchObject({ status: "demo_history", editable: false, author: "", encounterId: "" });
});

test("Archived results render in the ordinary Cheongdam search without changing selectable live count", async ({ page }) => {
  await page.addInitScript(([key, id]) => {
    window.localStorage.setItem(key, JSON.stringify({
      currentWorkspaceId: id,
      workspaces: [{ id, displayName: "청담 검수", subscriptionStatus: "trialing", createdAt: "2026-06-17T00:00:00Z" }],
      memberships: [{ id: "validation-member", workspaceId: id, userSessionId: "playwright-default-session",
        displayName: "검수", email: "validator@example.invalid", roles: ["hospital_admin"], status: "active",
        createdAt: "2026-06-17T00:00:00Z", activatedAt: "2026-06-17T00:00:00Z" }],
      invitations: [], updatedAt: "2026-06-17T00:00:00Z",
    }));
  }, [SESSION_WORKSPACES_STORAGE_KEY, workspace]);
  const calls: string[] = [];
  await page.route(`**/api/workspaces/${workspace}/chart/advanced-search`, (route) => {
    calls.push(route.request().postDataJSON().action);
    return route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
  });
  await page.route(`**/api/workspaces/${workspace}/chart/demo-history`, (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ json: { items: [item] } });
  });
  await page.goto(`/w/${workspace}/chart-search?modulePanel=closed`);
  const area = page.getByRole("region", { name: "차트 상세 검색", exact: true });
  const archived = area.getByTestId("cheongdam-demo-history");
  await expect(archived.getByText(item.title, { exact: true })).toBeVisible();
  await archived.getByText(item.title, { exact: true }).click();
  await expect(archived.getByText(item.soap.S)).toBeVisible();
  await expect(archived.getByRole("button", { name: /복사|내보내기|저장/ })).toHaveCount(0);
  await area.getByRole("button", { name: "검색", exact: true }).click();
  await area.getByRole("textbox", { name: "차트 검색어" }).fill("일치하지 않음");
  await expect(archived).toHaveCount(0);
  await area.getByRole("textbox", { name: "차트 검색어" }).fill(item.title);
  await expect(archived.getByText(item.title, { exact: true })).toBeVisible();
  expect(calls.every(action => action === "search")).toBe(true);
});
