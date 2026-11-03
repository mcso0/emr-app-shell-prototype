import { expect, test, type Page } from "@playwright/test";
import { syntheticInstruction } from "../src/features/dispensing/instruction-fixtures";
import type { InstructionDocument } from "../src/features/fulfillment/instruction-contract";
import type { ExecutionContext, ExecutionResultCommand } from "../src/features/fulfillment/execution-result-contract";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

const id = "97080000-0000-4000-8000-000000000081";
const secondId = "97080000-0000-4000-8000-000000000082";
const patientId = "97080000-0000-4000-8000-000000000083";

async function install(page: Page, options: { queueType?: "dispensing" | "treatment"; set?: boolean; requester?: boolean; failSave?: boolean; emptyOral?: boolean; profileFailure?: boolean; started?: boolean; owner?: "mine" | "other"; failAssignment?: boolean; staleAssignment?: boolean; assignmentDelay?: number } = {}) {
  await page.addInitScript(([key, workspaceId]) => localStorage.setItem(key, JSON.stringify({
    currentWorkspaceId: workspaceId, workspaces: [{ id: workspaceId, displayName: "합성 검증 병원", representativeName: "합성 관리자", contactEmail: "synthetic@example.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: "2026-06-14T00:00:00.000Z" }],
    memberships: [{ id: "synthetic-membership", workspaceId, userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "synthetic@example.test", roles: ["hospital_admin"], status: "active", createdAt: "2026-06-14T00:00:00.000Z", activatedAt: "2026-06-14T00:00:00.000Z" }], invitations: [], updatedAt: "2026-06-14T00:00:00.000Z",
  })), [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]);
  const document: InstructionDocument = {
    ...structuredClone(syntheticInstruction), queueType: options.queueType ?? "dispensing", rootOrderId: id, rootTaskId: id, name: "합성 검증 오더", isSet: options.set ?? false,
    mainAssigneeId: options.owner || options.started ? "synthetic-owner" : null, mainAssigneeName: options.owner || options.started ? "합성 기존 담당자" : null, revision: "1", finalized: false,
    canClaim: !options.owner && !options.started, canTakeover: options.owner === "other", canStart: options.owner === "mine" && !options.started, canResume: false, canUnassign: false, canCompleteAll: options.requester ?? true, canEditInstruction: false,
    changes: [], instruction: "", oralInstruction: { chartId: id, revision: 2,
      instruction: options.emptyOral ? " \n " : "합성 경구제 전체 지시입니다. 긴 지시사항의 줄바꿈과 닫기 버튼을 확인합니다. ".repeat(3),
      history: [{ revision: 1, instruction: "이전 지시", createdAt: "2026-10-30T00:00:00.000Z", actorId: "synthetic-author", actorName: "합성 작성자" }], snapshots: [] },
    items: (options.set ? [id, secondId] : [id]).map((itemId, index) => ({
      ...structuredClone(syntheticInstruction.items[0]), id: itemId, taskId: itemId, orderId: itemId, name: `합성 품목 ${index + 1}`,
      status: options.started ? "in_progress" : "requested", assigneeId: options.owner || options.started ? "synthetic-owner" : null, assigneeName: options.owner || options.started ? "합성 기존 담당자" : null, canAssign: false, canComplete: options.requester ?? true, canReopen: false,
      resultRequired: true, hasResult: false, instruction: "개별 지시",
      plan: { detailSchemaVersion: 1, detailInputs: { route: "PO", dose: 0.5, doseUnit: "T", totalQuantity: 1, totalQuantityUnit: "T", doseBasis: "patient", compoundNote: "합성 조제 메모", guardianNote: "합성 보호자 전달 메모" }, calculationOutputs: { plannedPracticalTotalQuantity: 1, dispenseUnit: "T" } },
    })),
  };
  const contexts = Object.fromEntries(document.items.map(item => [item.id, {
    workspaceId, workItemId: item.id, taskId: item.id, orderId: item.id, encounterId: id, attemptNo: 1,
    workItemRevision: 1, clinicalOrderType: "dispensing", status: "requested", isCurrentAttempt: true,
    planSnapshot: item.plan, planSha256: "a".repeat(64), resultRequired: true, canRecord: true, results: [],
  } satisfies ExecutionContext])) as Record<string, ExecutionContext>;
  const actions: string[] = [];
  const writes: ExecutionResultCommand[] = [];
  let failures = options.failSave ? 1 : 0;
  let staleAssignment = options.staleAssignment;
  let assignmentFailures = options.failAssignment ? 1 : 0;
  const assignmentWrites: Record<string, unknown>[] = [];
  const workItems = () => document.items.map(item => ({ id: item.id, workspaceId, orderId: item.id, encounterId: id, patientId,
    taskId: item.id, taskAttemptNo: 1, requestCycle: 1, rowRevision: Number(document.revision), status: item.status,
    queueType: options.queueType ?? "dispensing", assignedToUserId: item.assigneeId, requestedByUserId: id,
    patientName: "합성 환자", guardianName: "합성 보호자", requesterName: "합성 수의사",
    createdAt: "2026-10-31T00:00:00.000Z", updatedAt: "2026-10-31T00:00:00.000Z", sourceSnapshot: { inHospitalOrderName: item.name },
  }));
  await page.route(`**/api/workspaces/${workspaceId}/vital-settings`, route => route.fulfill({ json: createDefaultWorkspaceVitalSettingsSnapshot(false) }));
  await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/history?*`, route => route.fulfill({ json: { ok: true, measurements: [] } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/instruction-review?*`, route => route.fulfill({ json: { ok: true, reviews: (new URL(route.request().url()).searchParams.get("taskIds") ?? "").split(",").filter(Boolean).map(taskId => ({ taskId, requiresAcknowledgement: false, previous: null, snapshots: [], current: options.emptyOral ? null : { chartId: id, scope: "dispensing", entries: [{ scope: "dispensing", revision: 1, instruction: document.oralInstruction!.instruction, deleted: false, legacy: true, actorName: null, createdAt: null }], versions: { dispensing: 1 }, versionKey: "a".repeat(64) } })) } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, route => route.fulfill({ json: { ok: true, workItems: new URL(route.request().url()).searchParams.get("queueType") === (options.queueType ?? "dispensing") ? workItems() : [] } }));
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, route => options.profileFailure
    ? route.fulfill({ status: 503, json: { ok: false } })
    : route.fulfill({ json: { ok: true, overview: { subjectId: patientId, subjectType: "patient", profile: { id: patientId, name: "합성 환자", birthDate: "2020-01-01", breed: "말티즈", sex: "female", neutered: true, species: "dog" }, relationships: { guardians: [] }, access: { information: { allowed: true, requiredPermission: "patient:view" } } } } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/assignees`, route => route.fulfill({ json: { ok: true, assignees: [{ userId: "synthetic-owner", displayName: "합성 담당자" }] } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/instruction`, async route => {
    if (route.request().method() === "PATCH") {
      const { action } = route.request().postDataJSON(); actions.push(action);
      if (action === "claim" || action === "takeover") {
        assignmentWrites.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, options.assignmentDelay ?? 80));
        if (staleAssignment) {
          staleAssignment = false; document.revision = String(Number(document.revision)+1);
          document.mainAssigneeName = "합성 새 담당자";
          return route.fulfill({ status: 409, json: { ok: false, error: "revision_conflict" } });
        }
        if (assignmentFailures-- > 0) return route.fulfill({ status: 503, json: { ok: false } });
        document.mainAssigneeId = "synthetic-owner"; document.mainAssigneeName = "합성 담당자";
        document.canClaim = false; document.canTakeover = false; document.canStart = true; document.canUnassign = true; document.canCompleteAll = true;
        document.items.forEach(item => { if (item.status !== "completed") { item.assigneeId = "synthetic-owner"; item.assigneeName = "합성 담당자"; item.canComplete = true; } });
      } else if (action === "start") {
        document.canStart = false;
        document.items.forEach(item => { if (item.status === "requested") { item.status = "in_progress"; contexts[item.id].status = "in_progress"; } });
      } else if (action === "complete_all") {
        if (document.items.some(item => item.resultRequired)) return route.fulfill({ status: 409, json: { ok: false, error: "actual_execution_result_required" } });
        document.finalized = true; document.canCompleteAll = false;
      } else return route.fulfill({ status: 400, json: { ok: false, error: "invalid_transition" } });
      document.revision = String(Number(document.revision) + 1);
    }
    await route.fulfill({ json: { ok: true, document } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/execution`, async route => {
    const itemId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    const context = contexts[itemId];
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as ExecutionResultCommand; writes.push(body);
      if (failures-- > 0) return route.fulfill({ status: 503, json: { ok: false, error: "request_failed" } });
      context.status = "completed"; context.workItemRevision++;
      context.results.push({ id: itemId, version: 1, previousResultId: null, schemaVersion: 1, payload: body.payload,
        performedAt: body.performedAt, performedByUserId: id, recordedByUserId: id, recordedAt: new Date().toISOString(),
        varianceReason: null, amendmentReason: null, planSha256: context.planSha256 });
      const item = document.items.find(item => item.id === itemId)!;
      item.status = "completed"; item.resultRequired = false; item.hasResult = true; item.canComplete = false;
      document.finalized = !document.isSet; document.canCompleteAll = document.isSet;
      document.revision = String(Number(document.revision) + 1);
    }
    await route.fulfill({ json: { ok: true, context } });
  });
  await page.goto(`/w/${workspaceId}/dispensing?date=2026-10-31&workItemId=${id}&queueItemId=live-fulfillment-${id}&modulePanel=open&aside=closed&right=closed`);
  if (options.started) await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible();
  else await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  if (!options.started) await expect(page.getByRole("button", { name: options.owner === "mine" ? "업무 시작하기" : "담당하기", exact: true })).toBeEnabled();
  return { document, contexts, writes, actions, assignmentWrites };
}

async function fillResult(page: Page) {
  const dialog = page.getByRole("dialog", { name: "실제 수행기록", exact: true });
  await dialog.getByRole("button", { name: "현재 시각", exact: true }).click();
  await dialog.getByLabel("실제 준비수량", { exact: false }).fill("1");
  await dialog.getByLabel("실제 준비 단위", { exact: false }).fill("T");
  return dialog;
}

test("unassigned requester completes through required input without starting; failed save retains draft and retry id", async ({ page }) => {
  const { actions, writes, document } = await install(page, { failSave: true });
  await expect(page.getByRole("button", { name: "조제 완료", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "조제 완료", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "완료", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "합성 품목 1 수행값 입력" }).click();
  const dialog = await fillResult(page);
  expect(actions).toEqual([]); expect(writes).toEqual([]);
  await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("실제 준비수량", { exact: false })).toHaveValue("1");
  await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[0].commandId).toBe(writes[1].commandId);
  expect(actions).toEqual([]); expect(document.items[0].assigneeId).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
});

test("set completion records each missing result before explicit finalization", async ({ page }) => {
  const { actions, writes, document } = await install(page, { set: true });
  await page.getByRole("button", { name: "조제 완료", exact: true }).click();
  for (const n of [1, 2]) {
    await page.getByRole("button", { name: `합성 품목 ${n} 수행값 입력` }).click();
    const dialog = await fillResult(page);
    await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: "오더를 완료할까요?" })).toBeVisible();
    expect(document.finalized).toBe(false);
  }
  await page.getByRole("dialog").getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  expect(actions).toEqual(["complete_all"]); expect(writes).toHaveLength(2);
});

test("claim enters the instruction without starting; start remains explicit", async ({ page }) => {
  await page.setViewportSize({ width: 1624, height: 1000 });
  const { actions } = await install(page, { requester: false, emptyOral: true });
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  await expect(page.getByRole("button", { name: "합성 품목 1 완료", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "조제 완료", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "담당자", exact: true })).toBeVisible();
  expect(actions).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("dispensing-desktop.png") });
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("dispensing-narrow.png") });
  await page.setViewportSize({ width: 1624, height: 1000 });
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByTestId("fulfillment-prework")).toHaveCount(0);
  await expect(page.getByTestId("instruction-status-label")).toHaveText("대기중");
  await page.getByRole("button", { name: "조제 시작", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  expect(actions).toEqual(["claim", "start"]);
});

test("designated owner starts directly from prework", async ({ page }) => {
  const { actions } = await install(page, { owner: "mine", emptyOral: true });
  await page.getByRole("button", { name: "업무 시작하기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "업무 시작하기" }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  expect(actions).toEqual(["start"]);
});

test("takeover requires a reason, retains it on failure and retries one command", async ({ page }) => {
  const { actions, assignmentWrites } = await install(page, { owner: "other", failAssignment: true, requester: false });
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "담당자를 변경할까요?" });
  await expect(dialog.getByRole("button", { name: "담당하기", exact: true })).toBeDisabled();
  await dialog.getByLabel("담당 변경 사유").fill("교대 근무로 인계합니다.");
  await dialog.getByRole("button", { name: "담당하기", exact: true }).dblclick();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("담당 변경 사유")).toHaveValue("교대 근무로 인계합니다.");
  expect(assignmentWrites).toHaveLength(1);
  await dialog.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toBeEnabled();
  expect(actions).toEqual(["takeover", "takeover"]);
  expect(assignmentWrites[0].commandId).toBe(assignmentWrites[1].commandId);
  expect(assignmentWrites[1].reason).toBe("교대 근무로 인계합니다.");
});

test("patient demographics, explicit memo display, all density options and responsive oral infobar", async ({ page }) => {
  await page.setViewportSize({ width: 1624, height: 1000 });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const { actions } = await install(page, { started: true });
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/dispensing`));
  await expect(page.getByTestId("instruction-patient-summary")).toHaveText("합성 환자 · 말티즈 · 중성화·암컷 · 6세");
  await expect(page.locator(".instruction-document-surface")).toContainText("조제 메모: 합성 조제 메모");
  await expect(page.locator(".instruction-document-surface")).not.toContainText("patient");
  await expect(page.getByRole("button", { name: /수행기록·이력/ })).toHaveCount(0);
  const bar = page.getByRole("complementary", { name: "경구제 지시사항" });
  await expect(bar).toBeVisible();
  const row = page.locator(`tr[data-item='${id}']`).first();
  for (const [label, height] of [["좁은 간격", 36], ["기본 간격", 40], ["넓은 간격", 52]] as const) {
    await page.locator(".fd-density").click();
    await page.getByRole("menuitemcheckbox", { name: label, exact: true }).click();
    await expect.poll(async () => Math.round((await row.boundingBox())!.height)).toBe(height);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  }
  await page.screenshot({ path: "/tmp/clair-instruction-review-desktop.png", fullPage: false });
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(bar).toBeVisible();
  const close = bar.getByRole("button", { name: "지시사항 숨기기" });
  const barBox = (await bar.boundingBox())!, closeBox = (await close.boundingBox())!;
  expect(closeBox.y).toBeGreaterThanOrEqual(barBox.y);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(barBox.x + barBox.width);
  await page.screenshot({ path: "/tmp/clair-instruction-review-compact.png", fullPage: false });
  await close.click();
  await page.getByRole("button", { name: "지시사항 다시 보기" }).click();
  await expect(bar).toBeVisible();
  expect(actions).toEqual([]); expect(errors).toEqual([]);
});

test("profile read failure stays distinct from missing demographics", async ({ page }) => {
  await install(page, { profileFailure: true, started: true });
  await expect(page.getByTestId("instruction-patient-summary")).toHaveText("환자 정보 불러오기 실패");
  await expect(page.getByTestId("instruction-patient-summary")).not.toContainText("미상");
});


test("takeover conflict refreshes the owner and keeps the reason until a new command", async ({ page }) => {
  const { assignmentWrites } = await install(page, { owner: "other", staleAssignment: true, requester: false });
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "담당자를 변경할까요?" });
  await dialog.getByLabel("담당 변경 사유").fill("교대 인계");
  await dialog.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(dialog).toContainText("합성 새 담당자");
  await expect(dialog.getByRole("alert")).toContainText("업무 내용이나 담당자가 변경");
  await expect(dialog.getByLabel("담당 변경 사유")).toHaveValue("교대 인계");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await dialog.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(assignmentWrites).toHaveLength(2);
  expect(assignmentWrites[0].commandId).not.toBe(assignmentWrites[1].commandId);
  expect(assignmentWrites[1].expectedRevision).toBe("2");
});

test("late claim response cannot open the newly selected instruction", async ({ page }) => {
  const { assignmentWrites } = await install(page, { set: true, requester: false, assignmentDelay: 900 });
  const pending = page.waitForRequest(request => request.method() === "PATCH" && request.url().endsWith("/instruction"));
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "담당하기", exact: true }).click();
  await pending;
  const selected = page.waitForRequest(request => request.method() === "GET" && request.url().endsWith(`/${secondId}/instruction`));
  await page.evaluate((nextId) => { const url = new URL(location.href); url.searchParams.set("workItemId", nextId); url.searchParams.set("queueItemId", `live-fulfillment-${nextId}`); history.pushState(null, "", url); }, secondId);
  await selected;
  await expect.poll(() => assignmentWrites.length).toBe(1);
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toHaveCount(0);
});

for (const owner of [undefined, "mine", "other"] as const) {
  test(`treatment ${owner ?? "unassigned"} uses common entry`, async ({ page }) => {
    await page.setViewportSize({ width: 1624, height: 1000 });
    const { actions } = await install(page, { queueType: "treatment", owner, requester: false, emptyOral: true });
    const entry = page.getByTestId("fulfillment-prework");
    await expect(entry.getByRole("columnheader", { name: "처치 지시" })).toBeVisible();
    await expect(entry.locator("header")).toContainText("합성 보호자");
    await expect(page.getByTestId("workspace-document-toolbar")).toBeHidden();
    await page.screenshot({ path: test.info().outputPath(`treatment-${owner ?? "none"}.png`) });
    if (!owner) {
      await page.setViewportSize({ width: 768, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath("treatment-narrow.png") });
    }
    const label = owner === "mine" ? "업무 시작하기" : "담당하기";
    await entry.getByRole("button", { name: label, exact: true }).click();
    const dialog = page.getByRole("dialog");
    if (owner === "other") await dialog.getByLabel("담당 변경 사유").fill("합성 교대 사유");
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(entry).toHaveCount(0);
    expect(actions).toEqual([owner === "mine" ? "start" : owner === "other" ? "takeover" : "claim"]);
  });
}
