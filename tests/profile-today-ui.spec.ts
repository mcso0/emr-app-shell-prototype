import { expect, test, type Page } from "@playwright/test";
import { getWorkspaceOperatingDate } from "../src/lib/emr-domain/demo-date";

const workspaceId = "workspace-clair-cheongdam";
const subjectId = "49121000-0000-4000-8000-000000000999";
const todayPath = `**/api/workspaces/${workspaceId}/customer/*/${subjectId}/profile-overview/today`;
const longMemo = "정기 검진과 예방접종 상담을 위해 방문합니다. 지난 방문 이후 식욕과 활동량의 변화를 함께 확인하고, 보호자가 가져온 기록을 검토해 주세요. 긴 방문목적은 펼쳤을 때만 전체 내용을 표시합니다.";
const states = ["consulting", "waiting", "billing", "reservation"] as const;
const items = states.map((status, i) => ({ id: `today-${i}`, patientId: `patient-${i}`, patientName: ["초코", "코코", "구름", "보리"][i], status, title: ["진료중", "진료 대기", "수납대기", "오늘 16시 30분 · 예약"][i], description: i === 1 ? longMemo : "짧은 방문목적", scheduledAt: "2026-10-04T01:00:00Z" }));
const payload = (kind: "patient" | "guardian", rows = items) => ({ ok: true, workspaceId, subjectId, subjectType: kind, date: getWorkspaceOperatingDate(workspaceId), items: rows });

async function setup(page: Page, kind: "patient" | "guardian" = "patient", allowed = true) {
  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`, (route) => route.fulfill({ json: { ok: true, patients: [] } }));
  await page.route(`**/api/workspaces/${workspaceId}/customer/${kind}/${subjectId}/profile-overview`, (route) => route.fulfill({ json: { ok: true, overview: {
    subjectId, subjectType: kind,
    profile: { id: subjectId, workspaceId, name: kind === "patient" ? "예시 환자" : "예시 보호자", species: "dog", breed: "Poodle", sex: "male", status: "active" },
    relationships: kind === "patient" ? { guardians: [] } : { patients: [{ id: "patient-0", name: "초코", isPrimary: true }, { id: "patient-1", name: "코코", isPrimary: false }] },
    access: {
      information: { allowed: true, requiredPermission: "patient:view" },
      history: { allowed: true, requiredPermission: "chart:view" },
      reservations: { allowed, requiredPermission: "reception:view" },
      billing: { allowed: true, requiredPermission: "billing:view" },
    },
  } } }));
}
async function open(page: Page, kind: "patient" | "guardian" = "patient") {
  await page.goto(`/w/${workspaceId}/customer?modulePanel=open&right=closed&drawer=${kind}:${subjectId}`);
  return page.getByTestId("profile-today-section");
}

for (const kind of ["patient", "guardian"] as const) {
  test(`${kind} today is first and memo expands without moving icon`, async ({ page }) => {
    await setup(page, kind);
    let lazyReads = 0;
    await page.route(`**/profile-overview/history?**`, (route) => { lazyReads += 1; return route.fulfill({ json: { ok: true, section: "history", items: [], nextCursor: null } }); });
    await page.route(todayPath, (route) => route.fulfill({ json: payload(kind) }));
    const section = await open(page, kind);
    await expect(section.locator("[data-today-status]")).toHaveCount(4);
    expect(lazyReads).toBe(0);
    await expect(section.getByText("수납대기", { exact: kind === "patient" })).toBeVisible();
    await expect(section.getByText(/진료과|진료실|오더 진행/)).toHaveCount(0);
    if (kind === "guardian") await expect(section.getByText("코코 · 진료 대기")).toBeVisible();
    const card = section.locator('[data-today-status="waiting"]');
    const memo = card.locator("p").last();
    const icon = card.getByTestId("profile-today-icon");
    const collapsed = (await memo.boundingBox())!.height;
    const before = (await icon.boundingBox())!.y - (await card.boundingBox())!.y;
    expect(collapsed).toBe(18);
    const more = card.getByRole("button", { name: "더보기" });
    await expect(section.getByRole("button", { name: "더보기" })).toHaveCount(1);
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(card.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
    expect((await memo.boundingBox())!.height).toBeGreaterThan(collapsed);
    expect((await icon.boundingBox())!.y - (await card.boundingBox())!.y).toBe(before);
    await card.getByRole("button", { name: "접기" }).click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    const info = page.getByTestId("profile-side-panel").getByRole("heading", { name: kind === "patient" ? "환자 정보" : "보호자 정보", exact: true });
    expect((await section.boundingBox())!.y).toBeLessThan((await info.boundingBox())!.y);
  });
}

test("loading, error and empty align centrally; XS refresh retry recovers", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let attempts = 0;
  await page.route(todayPath, async (route) => {
    attempts += 1;
    if (attempts === 1) { await pending; await route.fulfill({ status: 500, json: { ok: false } }); }
    else await route.fulfill({ json: payload("patient", []) });
  });
  const section = await open(page);
  const feedback = section.getByRole("status");
  await expect(feedback).toHaveText("오늘 접수/예약을 불러오는 중입니다");
  await expect(feedback).toHaveCSS("text-align", "center");
  await expect(feedback).toHaveCSS("color", "rgb(163, 163, 163)");
  release();
  await expect(feedback).toContainText("오늘 접수/예약을 불러오지 못했습니다");
  const retry = section.getByRole("button", { name: "다시 시도" });
  await expect(retry).toHaveCSS("height", "24px");
  await expect(retry.locator('svg[data-icon="inline-start"]')).toHaveCSS("width", "12px");
  await expect(feedback).toHaveCSS("padding-top", "13px");
  await expect(feedback).toHaveCSS("padding-bottom", "13px");
  const box = (await feedback.boundingBox())!;
  const button = (await retry.boundingBox())!;
  expect(Math.abs(button.x + button.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
  await retry.click();
  await expect(feedback).toHaveText("접수/예약 일정이 없습니다");
  expect(attempts).toBe(2);
});

test("denied overview prevents today's request and preserves basic info", async ({ page }) => {
  await setup(page, "patient", false);
  let attempts = 0;
  await page.route(todayPath, (route) => { attempts += 1; return route.fulfill({ status: 403, json: { ok: false } }); });
  const section = await open(page);
  await expect(section.getByRole("status")).toHaveText("오늘 접수/예약을 볼 권한이 없습니다");
  await expect(page.getByTestId("profile-side-panel").getByRole("heading", { name: "환자 정보", exact: true })).toBeVisible();
  expect(attempts).toBe(0);
});

test("refresh clears old cards after permission loss and rejects foreign scope response", async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route(todayPath, (route) => {
    attempts += 1;
    return route.fulfill(attempts === 1 ? { json: payload("patient") } : { status: 403, json: { ok: false } });
  });
  const section = await open(page);
  await expect(section.locator("[data-today-status]")).toHaveCount(4);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(section.getByRole("status")).toHaveText("오늘 접수/예약을 볼 권한이 없습니다");
  await expect(section.locator("[data-today-status]")).toHaveCount(0);
  await page.unroute(todayPath);
  await page.route(todayPath, (route) => route.fulfill({ json: { ...payload("patient"), subjectId: "another-patient" } }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(section.getByRole("status")).toContainText("오늘 접수/예약을 불러오지 못했습니다");
  await expect(section.locator("[data-today-status]")).toHaveCount(0);
});

test("closing a pending profile prevents its delayed result from replacing guardian cards", async ({ page }) => {
  await setup(page);
  await setup(page, "guardian");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(todayPath, async (route) => {
    if (route.request().url().includes("/patient/")) { await pending; await route.fulfill({ json: payload("patient") }).catch(() => {}); }
    else await route.fulfill({ json: payload("guardian", [items[2]]) });
  });
  const first = await open(page);
  await expect(first.getByRole("status")).toHaveText("오늘 접수/예약을 불러오는 중입니다");
  await page.getByTestId("profile-side-panel").getByRole("button", { name: "상세 닫기" }).click();
  const second = await open(page, "guardian");
  await expect(second.locator("[data-today-status]")).toHaveCount(1);
  release();
  await expect(second.getByText("구름 · 수납대기")).toBeVisible();
  await expect(second.locator("[data-today-status]")).toHaveCount(1);
});

test("KST midnight refresh clears yesterday's cards before the new day response", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-04T14:59:30Z") });
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let attempts = 0;
  await page.route(todayPath, async (route) => {
    attempts += 1;
    if (attempts > 1) await pending;
    await route.fulfill({ json: { ...payload("patient", attempts === 1 ? items : []), date: attempts === 1 ? "2026-10-04" : "2026-10-05" } });
  });
  const section = await open(page);
  await expect(section.locator("[data-today-status]")).toHaveCount(4);
  await page.clock.fastForward(61_000);
  await expect(section.getByRole("status")).toHaveText("오늘 접수/예약을 불러오는 중입니다");
  await expect(section.locator("[data-today-status]")).toHaveCount(0);
  release();
  await expect(section.getByRole("status")).toHaveText("접수/예약 일정이 없습니다");
});
