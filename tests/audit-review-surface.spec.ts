import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  createMockLiveAuditReviewGateway,
  readLiveAuditReviewEvents,
} from "../src/features/audit/server-audit-event-review-core";

const migrationPath = "supabase/migrations/20260520130000_live_mvp_audit_event_review_rpc.sql";
const migration = readFileSync(migrationPath, "utf8");

test("audit review route allows hospital admins and denies non-admin demo actors", async ({ request }) => {
  const admin = await request.get("/api/workspaces/clair-demo/audit/events", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(admin.status()).toBe(200);
  const adminBody = await admin.json() as {
    ok: true;
    events: Array<{ actorUserId: string; eventType: string; workspaceId: string }>;
    enforcedBy: string;
  };
  expect(adminBody.enforcedBy).toBe("live-audit-review-reader");
  expect(adminBody.events.length).toBeGreaterThan(0);
  expect(adminBody.events.every((event) => event.workspaceId === "clair-demo")).toBe(true);
  expect(adminBody.events.map((event) => event.eventType)).toContain("chart.soap_saved");

  const nonAdmin = await request.get("/api/workspaces/clair-demo/audit/events", {
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(nonAdmin.status()).toBe(403);
  await expectJson(nonAdmin, { ok: false, denialReason: "permission_missing" });
});

test("audit review core filters by event type and search while preserving workspace scope", async () => {
  const result = await readLiveAuditReviewEvents({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    filter: {
      eventType: "billing.payment_state_changed",
      query: "invoice-kong",
    },
    gateway: createMockLiveAuditReviewGateway(),
  });

  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(result.ok ? result.events : []).toHaveLength(1);
  expect(result.ok ? result.events[0] : null).toMatchObject({
    eventType: "billing.payment_state_changed",
    targetId: "invoice-kong-260501",
    targetType: "invoice",
  });
});

test("hospital admin audit review surface renders events and blocks non-admin users", async ({ page }) => {
  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await page.getByPlaceholder("이메일을 입력해주세요").fill("admin@clair.local");
  await page.getByPlaceholder("비밀번호를 입력해주세요").fill("local-pass-1");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByRole("button", { name: "감사 로그" }).click();
  await expect(page.getByRole("heading", { name: "감사 로그" })).toBeVisible();
  await expect(page.getByTestId("hospital-admin-audit-review")).toContainText("SOAP 저장");
  await expect(page.getByTestId("hospital-admin-audit-review")).toContainText("결제 상태 변경");

  await page.getByLabel("감사 로그 검색").fill("invoice-kong");
  await expect(page.getByTestId("hospital-admin-audit-review")).toContainText("invoice-kong-260501");
  await expect(page.getByTestId("hospital-admin-audit-review")).not.toContainText("do not store full note");

  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /수의사/ }).click();
  await page.getByPlaceholder("이메일을 입력해주세요").fill("vet@clair.local");
  await page.getByPlaceholder("비밀번호를 입력해주세요").fill("local-pass-1");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "감사 로그" }).click();
  await expect(page.getByText("감사 로그 접근 제한")).toBeVisible();
});

test("hospital admin audit review uses the mg table empty state when no events match", async ({ page }) => {
  await page.route("**/api/workspaces/clair-demo/audit/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, events: [] }),
    });
  });

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-audit").click();

  const emptyState = page.getByTestId("hospital-audit-empty-state");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toContainText("표시할 감사 로그가 없습니다");

  await page.getByLabel("감사 로그 검색").fill("없는 actor");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 감사 로그가 없습니다");
});

test("audit review migration adds an admin-only reader without direct table grants", () => {
  expect(migration).toContain("create or replace function public.clair_list_audit_events");
  expect(migration).toContain("private.clair_is_workspace_admin");
  expect(migration).toContain("role_permission:view required");
  expect(migration).toContain("from public.audit_events audit_event");
  expect(migration).toContain("grant execute on function public.clair_list_audit_events");
  expect(migration).not.toMatch(/grant select on table public\.audit_events/i);
});

async function expectJson(response: { json(): Promise<unknown> }, partial: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(partial);
}
