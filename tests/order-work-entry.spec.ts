import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";

const id = "97080000-0000-4000-8000-000000000091";
const patientId = "97080000-0000-4000-8000-000000000092";
const guardianId = "97080000-0000-4000-8000-000000000093";
test.use({ viewport: { width: 1624, height: 1000 } });
const timestamp = "2026-11-03T00:00:00Z";
type Owner = "none" | "mine" | "other";
async function install(page: Page, category: "lab" | "imaging" | "billing", initial: Owner, fail = false, delay = 100) {
  await page.addInitScript(({ key, workspaceId, id, timestamp }) => {
    // Fixed synthetic identities only; never accept live patient data for storage.
    const syntheticSubjectKey = "97080000-0000-4000-8000-000000000092";
    const guardianId = "97080000-0000-4000-8000-000000000093";
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: workspaceId,
      workspaces: [{ id: workspaceId, displayName: "합성 검증 병원", representativeName: "합성 관리자", contactEmail: "synthetic@example.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: timestamp }],
      memberships: [{ id: "synthetic-membership", workspaceId, userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "synthetic@example.test", roles: ["hospital_admin"], status: "active", createdAt: timestamp, activatedAt: timestamp }], invitations: [], updatedAt: timestamp }));
    sessionStorage.setItem("clair-emr:chart-live-encounter-handoffs:v1", JSON.stringify({ [id]: {
      encounter: { id, workspaceId, patientId: syntheticSubjectKey, guardianId, encounterNo: "SYN-ENTRY-001", receptionType: "walk_in", visitPurpose: "합성 화면 검증", status: "ordered", checkedInAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
      patient: { id: syntheticSubjectKey, workspaceId, name: "합성 환자", patientNo: "SYN-P001", species: "dog", breed: "Maltese", sex: "female", neutered: true, birthDate: "2020-01-01", status: "active", createdAt: timestamp, updatedAt: timestamp },
      primaryGuardian: { id: guardianId, workspaceId, name: "합성 보호자", createdAt: timestamp, updatedAt: timestamp }, updatedAt: timestamp,
    } }));
    const handoffs = JSON.parse(sessionStorage.getItem("clair-emr:chart-live-encounter-handoffs:v1")!);
    const second = "97080000-0000-4000-8000-000000000094";
    handoffs[second] = { ...handoffs[id], encounter: { ...handoffs[id].encounter, id: second, encounterNo: "SYN-ENTRY-002" } };
    sessionStorage.setItem("clair-emr:chart-live-encounter-handoffs:v1", JSON.stringify(handoffs));
  }, { key: SESSION_WORKSPACES_STORAGE_KEY, workspaceId, id, timestamp });
  let owner = initial;
  let revision = 1;
  let status = "requested";
  const commands: string[] = [];
  let prepares = 0;
  let pendingChange = false;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const invoice = { id, workspaceId, encounterId: id, guardianId, invoiceNo: "SYN-I001", status: "issued", subtotalAmount: 35000, discountAmount: 0, taxAmount: 0, totalAmount: 35000, createdAt: timestamp, updatedAt: timestamp };
  const line = { id, invoiceId: id, description: "합성 검사", quantity: 1, unitPrice: 35000, lineTotal: 35000 };
  const workItem = () => ({ id, workspaceId, orderId: id, taskId: id, encounterId: id, patientId, queueType: category,
    status, requestCycle: 1, rowRevision: revision, assignedToUserId: owner === "none" ? null : owner === "mine" ? "user-admin" : "other", assignedToDisplayName: owner === "none" ? null : "합성 담당자",
    canManage: owner !== "other", requestedByUserId: "user-vet", patientName: "합성 환자", guardianName: "합성 보호자", requesterName: "합성 수의사", createdAt: timestamp, updatedAt: timestamp,
    sourceSnapshot: { orderDisplayName: "합성 검사", instruction: "합성 지시", encounterNo: "SYN-ENTRY-001" } });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
    if (!url.pathname.startsWith(`/api/workspaces/${workspaceId}/`)) return route.fallback();
    const path = url.pathname;
    if (path.endsWith("/assignment")) {
      if (route.request().method() === "PATCH") {
        commands.push(route.request().postDataJSON().action);
        await new Promise(resolve => setTimeout(resolve, delay));
        if (fail) { fail = false; return route.fulfill({ status: 503, json: { ok: false } }); }
        owner = "mine"; revision++;
      }
      return route.fulfill({ json: { ok: true, assignment: { revision, assignedToUserId: owner === "none" ? null : owner === "mine" ? "user-admin" : "other", assignedToDisplayName: owner === "none" ? null : "합성 담당자", canManage: owner !== "other", assignees: [] } } });
    }
    if (path.endsWith(`/work-items/${id}`) && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON(); commands.push(body.action);
      await new Promise(resolve => setTimeout(resolve, delay));
      if (fail) { fail = false; return route.fulfill({ status: 503, json: { ok: false } }); }
      if (body.action === "claim") owner = "mine";
      if (body.action === "start") status = "in_progress";
      revision++;
      return route.fulfill({ json: { ok: true, workItem: workItem() } });
    }
    if (path.endsWith("/work-items")) return route.fulfill({ json: { ok: true, workItems: url.searchParams.get("queueType") === category && !url.searchParams.has("patientId") ? [workItem()] : [] } });
    if (path.endsWith("/instruction-review")) return route.fulfill({ json: { ok: true, reviews: [{ taskId: id, current: null, previous: null, requiresAcknowledgement: false, snapshots: [] }] } });
    if (path.endsWith("/vital-settings")) return route.fulfill({ json: createDefaultWorkspaceVitalSettingsSnapshot(false) });
    if (path.endsWith("/patient-vitals/history")) return route.fulfill({ json: { ok: true, measurements: [] } });
    if (path.endsWith("/profile-overview")) {
      const patient = path.includes("/patient/");
      return route.fulfill({ json: { ok: true, overview: { subjectId: patient ? patientId : guardianId, subjectType: patient ? "patient" : "guardian", profile: patient ? { id: patientId, name: "합성 환자", species: "dog", breed: "Maltese", sex: "female", neutered: true, birthDate: "2020-01-01" } : { id: guardianId, name: "합성 보호자", memo: "합성 보호자 메모" }, relationships: { guardians: patient ? [{ id: guardianId, name: "합성 보호자", isPrimary: true, workspaceId }] : [] }, access: { information: { allowed: true } } } } });
    }
    if (path.endsWith("/staff")) return route.fulfill({ json: { ok: true, staff: [] } });
    if (path.endsWith("/invoice-candidates")) return route.fulfill({ json: { ok: true, candidates: [{ ...line, invoiceId: url.searchParams.get("encounterId") ?? id, billingCandidateId: id, orderId: id }] } });
    if (path.endsWith("/invoice-lines")) {
      const target = url.searchParams.get("invoiceId") ?? id;
      return route.fulfill({ json: { ok: true, invoice: { ...invoice, id: target, invoiceNo: target === id ? "SYN-I001" : "SYN-I002" }, lines: [{ ...line, invoiceId: target }] } });
    }
    if (path.endsWith("/payment-status")) {
      const target = url.searchParams.get("invoiceId") ?? id;
      return route.fulfill({ json: { ok: true, invoice: { ...invoice, id: target, invoiceNo: target === id ? "SYN-I001" : "SYN-I002" }, payments: [] } });
    }
    if (path.endsWith("/order-changes")) {
      if (route.request().method() === "POST") { pendingChange = false; invoice.updatedAt = "2026-11-03T00:01:00Z"; }
      const financial = { billingName: "합성 검사", billingQuantity: 1, unitPriceKrw: 35000, taxClass: "non_taxable", billingReflectionEnabled: true, adjustmentSource: null, adjustmentAmountKrw: 0, adjustmentPercent: 0, adjustmentReason: "" };
      return route.fulfill({ json: { ok: true, changes: pendingChange ? [{ orderId: id, proposalId: id, version: 1, before: financial, proposed: { ...financial, billingName: "합성 검사 변경" }, canApprove: true, createdAt: timestamp }] : [] } });
    }
    if (path.endsWith("/guardian-checkout")) {
      if (route.request().method() === "POST") prepares++;
      return route.fulfill({ json: { ok: true, rows: [], checkoutSession: { id, selectedInvoiceIds: [id], status: "prepared", payableAmount: 35000, excludedAmount: 0, excludedCount: 0, invoices: [] } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: "synthetic_unavailable" } });
  });
  const query = category === "billing" ? `encounterId=${id}&invoiceId=${id}` : category === "lab" ? `labResultId=live-lab-${id}` : `imagingStudyId=live-imaging-${id}`;
  await page.goto(`/w/${workspaceId}/${category}?${query}&date=2026-11-03&modulePanel=closed&aside=open&right=open`);
  const entry = page.getByTestId(`${category}-prework`);
  await expect(entry).toBeVisible();
  await expect(entry.getByRole("button", { name: initial === "mine" ? "업무 시작하기" : "담당하기", exact: true })).toBeVisible();
  return { entry, commands, errors, setPendingChange: (next: boolean) => { pendingChange = next; }, prepares: () => prepares, setOwner: (next: Owner) => { owner = next; revision++; } };
}

for (const category of ["lab", "imaging", "billing"] as const) {
  for (const owner of ["none", "mine", "other"] as const) {
    test(`${category} ${owner} uses common entry and preserves command semantics`, async ({ page }) => {
      const state = await install(page, category, owner);
      await expect(page.getByTestId("workspace-document-toolbar")).toBeHidden();
      await expect(page.locator('[data-slot="patient-context-bar"]')).toHaveCount(0);
      expect(state.prepares()).toBe(0);
      await page.screenshot({ path: test.info().outputPath(`${category}-${owner}-desktop.png`) });
      if (owner === "none") {
        await page.setViewportSize({ width: 768, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`${category}-narrow.png`) });
        await page.setViewportSize({ width: 1624, height: 1000 });
      }
      const label = owner === "mine" ? "업무 시작하기" : "담당하기";
      await state.entry.getByRole("button", { name: label, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (owner === "other") {
        await expect(dialog.getByRole("button", { name: label, exact: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: "닫기", exact: true }).click();
        expect(state.commands).toEqual([]); expect(state.prepares()).toBe(0);
      } else {
        await dialog.getByRole("button", { name: label, exact: true }).dblclick();
        await expect(state.entry).toHaveCount(0);
        expect(state.commands).toEqual(owner === "none" ? ["claim"] : category === "imaging" ? ["start"] : []);
        if (category === "billing") await expect.poll(state.prepares).toBeGreaterThan(0);
        if (category === "lab") await expect(page.getByRole("button", { name: "검사 시작", exact: true })).toBeVisible();
      }
      expect(state.errors).toEqual([]);
    });
  }
  test(`${category} failed claim keeps entry and retries without duplicate writes`, async ({ page }) => {
    const state = await install(page, category, "none", true);
    await state.entry.getByRole("button", { name: "담당하기", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "담당하기", exact: true }).dblclick();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(state.commands).toEqual(["claim"]); expect(state.prepares()).toBe(0);
    await dialog.getByRole("button", { name: "담당하기", exact: true }).click();
    await expect(state.entry).toHaveCount(0);
    expect(state.commands).toEqual(["claim", "claim"]);
  });
}

async function selectOtherInvoice(page: Page) {
  await page.evaluate(() => {
    const url = new URL(location.href);
    url.searchParams.set("invoiceId", "97080000-0000-4000-8000-000000000094");
    url.searchParams.set("encounterId", "97080000-0000-4000-8000-000000000094");
    history.pushState(null, "", url);
  });
  await expect(page.getByTestId("billing-prework")).toContainText("SYN-ENTRY-002");
}

test("billing entry is invalidated when selecting another owned invoice", async ({ page }) => {
  const state = await install(page, "billing", "mine");
  await state.entry.getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await expect.poll(state.prepares).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  const count = state.prepares();
  await selectOtherInvoice(page);
  await expect(state.entry.getByRole("button", { name: "업무 시작하기", exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  expect(state.prepares()).toBe(count);
  expect(state.commands).toEqual([]);
});

test("billing late claim cannot enter a newly selected invoice", async ({ page }) => {
  const state = await install(page, "billing", "none", false, 800);
  await state.entry.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "담당하기", exact: true }).click();
  await expect.poll(() => state.commands.length).toBe(1);
  await selectOtherInvoice(page);
  await page.waitForTimeout(1000);
  await expect(state.entry).toBeVisible();
  expect(state.prepares()).toBe(0);
  expect(state.commands).toEqual(["claim"]);
});


test("billing entry waits for checkout preparation without repeating ownership commands", async ({ page }) => {
  const state = await install(page, "billing", "mine");
  let releaseReview!: () => void; let reviewRequested = false;
  const reviewGate = new Promise<void>(resolve => { releaseReview = resolve; });
  await page.route("**/billing/order-changes?*", async route => {
    reviewRequested = true; await reviewGate; await route.fallback();
  });
  let release!: () => void; let requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/billing/guardian-checkout", async route => {
    if (route.request().method() === "POST") { requested = true; await gate; }
    await route.fallback();
  });
  await state.entry.getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await expect.poll(() => reviewRequested).toBe(true);
  await expect(page.getByTestId("page-loading-state")).toBeVisible();
  await expect(page.getByTestId("workspace-main-content")).not.toBeVisible();
  expect(state.prepares()).toBe(0);
  releaseReview();
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByTestId("page-loading-state")).toBeVisible();
  await expect(page.getByTestId("workspace-main-content")).not.toBeVisible();
  expect(state.commands).toEqual([]);
  release();
  await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
  await expect(page.getByRole("table", { name: "청구 항목 테이블" })).toBeVisible();
  expect(state.commands).toEqual([]);
});

test("billing entry keeps payment preparation blocked until order change approval", async ({ page }) => {
  const state = await install(page, "billing", "mine");
  state.setPendingChange(true);
  await state.entry.getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await expect(state.entry).toHaveCount(0);
  await expect(page.getByRole("region", { name: "청구 변경 확인" })).toBeVisible();
  expect(state.prepares()).toBe(0);
  await page.getByRole("button", { name: "확인 후 금액 반영", exact: true }).click();
  await expect(page.getByRole("region", { name: "청구 변경 확인" })).toHaveCount(0);
  await expect.poll(state.prepares).toBeGreaterThan(0);
  expect(state.errors).toEqual([]);
});

for (const status of [403, 500]) {
  test(`billing order review ${status} releases page loading and retry waits for checkout`, async ({ page }) => {
    const state = await install(page, "billing", "mine");
    let fail = true;
    await page.route("**/billing/order-changes?*", async route => {
      if (fail) return route.fulfill({ status, json: { ok: false, error: "unavailable" } });
      await route.fallback();
    });
    await state.entry.getByRole("button", { name: "업무 시작하기", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "업무 시작하기", exact: true }).click();
    const review = page.getByRole("region", { name: "청구 변경 확인" });
    await expect(review.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
    expect(state.prepares()).toBe(0);
    let release!: () => void; let requested = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/billing/guardian-checkout", async route => {
      if (route.request().method() === "POST") { requested = true; await gate; }
      await route.fallback();
    });
    fail = false;
    await review.getByRole("button", { name: "최신 변경안 조회", exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByTestId("page-loading-state")).toBeVisible();
    await expect(page.getByTestId("workspace-main-content")).not.toBeVisible();
    release();
    await expect(page.getByRole("table", { name: "청구 항목 테이블" })).toBeVisible();
    await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
    expect(state.commands).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}
