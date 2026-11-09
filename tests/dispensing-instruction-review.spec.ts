import { expect, test, type Page } from "@playwright/test";
import { syntheticInstruction } from "../src/features/dispensing/instruction-fixtures";
import type { InstructionCommand, InstructionDocument } from "../src/features/fulfillment/instruction-contract";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

const id = "97080000-0000-4000-8000-000000000081";
const secondId = "97080000-0000-4000-8000-000000000082";
const patientId = "97080000-0000-4000-8000-000000000083";

async function install(page: Page, options: { beforeNavigate?: () => Promise<void>; queueType?: "dispensing" | "treatment"; set?: boolean; requester?: boolean; failSave?: boolean; failReopen?: boolean; emptyOral?: boolean; profileFailure?: boolean; started?: boolean; canUnassign?: boolean; owner?: "mine" | "other"; failAssignment?: boolean; staleAssignment?: boolean; assignmentDelay?: number; layoutFixture?: boolean; differentPatient?: boolean } = {}) {
  await page.addInitScript(([key, workspaceId]) => localStorage.setItem(key, JSON.stringify({
    currentWorkspaceId: workspaceId, workspaces: [{ id: workspaceId, displayName: "합성 검증 병원", representativeName: "합성 관리자", contactEmail: "synthetic@example.test", contactPhone: null, subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: "2026-06-14T00:00:00.000Z" }],
    memberships: [{ id: "synthetic-membership", workspaceId, userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "synthetic@example.test", roles: ["hospital_admin"], status: "active", createdAt: "2026-06-14T00:00:00.000Z", activatedAt: "2026-06-14T00:00:00.000Z" }], invitations: [], updatedAt: "2026-06-14T00:00:00.000Z",
  })), [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]);
  const document: InstructionDocument = {
    ...structuredClone(syntheticInstruction), queueType: options.queueType ?? "dispensing", rootOrderId: id, rootTaskId: id, name: "합성 검증 오더", isSet: options.set ?? false,
    mainAssigneeId: options.owner || options.started ? "synthetic-owner" : null, mainAssigneeName: options.owner || options.started ? "합성 기존 담당자" : null, revision: "1", finalized: false,
    canClaim: !options.owner && !options.started, canTakeover: options.owner === "other", canStart: options.owner === "mine" && !options.started, canResume: false, canUnassign: options.canUnassign ?? false, canCompleteAll: options.requester ?? true, canEditInstruction: false,
    changes: [], instruction: "", oralInstruction: { chartId: id, revision: 2,
      instruction: options.emptyOral ? " \n " : "합성 경구제 전체 지시입니다. 긴 지시사항의 줄바꿈과 닫기 버튼을 확인합니다. ".repeat(3),
      history: [{ revision: 1, instruction: "이전 지시", createdAt: "2026-10-30T00:00:00.000Z", actorId: "synthetic-author", actorName: "합성 작성자" }], snapshots: [] },
    items: (options.set ? [id, secondId] : [id]).map((itemId, index) => ({
      ...structuredClone(syntheticInstruction.items[0]), id: itemId, taskId: itemId, orderId: itemId, name: `합성 품목 ${index + 1}`,
      status: options.started ? "in_progress" : "requested", assigneeId: options.owner || options.started ? "synthetic-owner" : null, assigneeName: options.owner || options.started ? "합성 기존 담당자" : null, canAssign: false, canComplete: options.requester ?? true, canReopen: false,
      resultRequired: false, hasResult: false, instruction: "개별 지시",
      plan: { detailSchemaVersion: 1, detailInputs: { route: "PO", dose: 0.5, doseUnit: "T", totalQuantity: 1, totalQuantityUnit: "T", doseBasis: "patient", compoundNote: "합성 조제 메모", guardianNote: "합성 보호자 전달 메모" }, calculationOutputs: { plannedPracticalTotalQuantity: 1, dispenseUnit: "T" } },
    })),
  };
  if (options.layoutFixture) {
    document.instruction = "합성 세트 지시";
    document.items[1].assigneeId = "synthetic-second-assignee";
    document.items[1].assigneeName = "합성 보조 담당자";
  }
  const actions: string[] = [];
  const writes: string[] = [];
  const completionWrites: InstructionCommand[] = [];
  const reopenWrites: InstructionCommand[] = [];
  let failReopen = options.failReopen;
  let failures = options.failSave ? 1 : 0;
  let staleAssignment = options.staleAssignment;
  let requiresAcknowledgement = false;
  let assignmentFailures = options.failAssignment ? 1 : 0;
  const assignmentWrites: Record<string, unknown>[] = [];
  const workItems = () => document.items.map(item => ({ id: item.id, workspaceId, orderId: item.id, encounterId: id, patientId: options.differentPatient && item.id === secondId ? secondId : patientId,
    taskId: item.taskId, taskAttemptNo: item.attemptNo, requestCycle: item.attemptNo, rowRevision: Number(document.revision), status: item.status,
    queueType: options.queueType ?? "dispensing", assignedToUserId: item.assigneeId, requestedByUserId: id,
    patientName: "합성 환자", guardianName: "합성 보호자", requesterName: "합성 수의사",
    startedAt: item.status === "in_progress" ? "2026-10-31T00:05:00.000Z" : null,
    createdAt: "2026-10-31T00:00:00.000Z", updatedAt: "2026-10-31T00:00:00.000Z", sourceSnapshot: { inHospitalOrderName: item.name },
  }));
  const historyItems = ["2026-10-30T06:22:08Z", "2026-10-30T05:16:32Z", "2026-10-24T02:09:14Z", "2026-10-20T07:32:51Z"].map((createdAt, index) => ({
    ...workItems()[0],
    id: id.slice(0, -1) + (index + 3),
    encounterId: secondId,
    createdAt,
    sourceSnapshot: { inHospitalOrderName: "합성 과거 오더 " + (index + 1) },
  }));
  const category = options.queueType ?? "dispensing";
  const layoutInstructions = [
    { scope: "overall", instruction: "합성 전체 지시" },
    { scope: category, instruction: "합성 분류 지시".repeat(24) },
  ].map(entry => ({ ...entry, revision: 1, deleted: false, actorName: null, createdAt: null }));
  await page.route(`**/api/workspaces/${workspaceId}/staff`, route => route.fulfill({ json: { ok: true, staff: [] } }));
  await page.route(`**/api/workspaces/${workspaceId}/vital-settings`, route => route.fulfill({ json: createDefaultWorkspaceVitalSettingsSnapshot(false) }));
  await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/history?*`, route => route.fulfill({ json: { ok: true, measurements: [] } }));
  await page.route("**/fulfillment/instruction-review?*", route => {
    const taskIds = new URL(route.request().url()).searchParams.get("taskIds")?.split(",") ?? [];
    const current = options.emptyOral ? null : {
      chartId: id,
      scope: category,
      entries: options.layoutFixture ? layoutInstructions : [{ scope: category, revision: 1, instruction: document.oralInstruction!.instruction, deleted: false, legacy: true, actorName: null, createdAt: null }],
      versions: { [category]: 1 },
      versionKey: "a".repeat(64),
    };
    return route.fulfill({ json: { ok: true, reviews: taskIds.map(taskId => ({ taskId, requiresAcknowledgement, previous: null, snapshots: [], current })) } });
  });
  await page.route("**/fulfillment/work-items?*", route => {
    const params = new URL(route.request().url()).searchParams;
    const current = params.get("queueType") === category ? workItems() : [];
    const past = options.layoutFixture && current.length && params.has("patientId") ? historyItems : [];
    return route.fulfill({ json: { ok: true, workItems: [...current, ...past] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, route => options.profileFailure
    ? route.fulfill({ status: 503, json: { ok: false } })
    : route.fulfill({ json: { ok: true, overview: { subjectId: patientId, subjectType: "patient", profile: { id: patientId, name: "합성 환자", birthDate: "2020-01-01", breed: "말티즈", sex: "female", neutered: true, species: "dog" }, relationships: { guardians: [] }, access: { information: { allowed: true, requiredPermission: "patient:view" } } } } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/assignees`, route => route.fulfill({ json: { ok: true, assignees: [{ userId: "synthetic-owner", displayName: "합성 담당자" }] } }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/instruction`, async route => {
    if (route.request().method() === "PATCH") {
      const command = route.request().postDataJSON() as InstructionCommand;
      const { action } = command;
      actions.push(action);
      if (action === "claim" || action === "takeover") {
        const { startWork } = command;
        assignmentWrites.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, options.assignmentDelay ?? 80));
        if (staleAssignment) {
          staleAssignment = false; document.revision = String(Number(document.revision)+1);
          document.mainAssigneeName = "합성 새 담당자";
          return route.fulfill({ status: 409, json: { ok: false, error: "revision_conflict" } });
        }
        if (assignmentFailures-- > 0) return route.fulfill({ status: 503, json: { ok: false } });
        document.mainAssigneeId = "synthetic-owner"; document.mainAssigneeName = "합성 담당자";
        document.canClaim = false; document.canTakeover = false; document.canStart = startWork !== true; document.canUnassign = true; document.canCompleteAll = true;
        document.items.forEach(item => {
          if (item.status === "completed") return;
          item.assigneeId = "synthetic-owner"; item.assigneeName = "합성 담당자"; item.canComplete = true;
          if (startWork === true && (item.status === "requested" || item.status === "paused")) {
            item.status = "in_progress";
          }
        });
      } else if (action === "start") {
        document.canStart = false;
        document.items.forEach(item => { if (item.status === "requested") item.status = "in_progress"; });
      } else if (action === "unassign") {
        document.mainAssigneeId = null;
        document.mainAssigneeName = null;
        document.canClaim = true;
        document.canUnassign = false;
        document.items.forEach(item => {
          if (item.status !== "in_progress") return;
          item.status = "paused";
          item.assigneeId = null;
          item.assigneeName = null;
        });
      } else if (action === "reopen") {
        reopenWrites.push(command);
        if (failReopen) {
          failReopen = false;
          return route.fulfill({ status: 503, json: { ok: false } });
        }
        const item = document.items.find(item => item.id === command.itemId && item.canReopen);
        if (!item) return route.fulfill({ status: 403, json: { ok: false, error: "permission_missing" } });
        item.status = "in_progress";
        item.canComplete = true;
        item.canReopen = false;
        document.finalized = false;
        document.canCompleteAll = true;
        document.canUnassign = true;
      } else if (action === "complete" || action === "complete_all") {
        completionWrites.push(command);
        if (failures-- > 0) return route.fulfill({ status: 503, json: { ok: false } });
        const targets = action === "complete" ? document.items.filter(item => item.id === command.itemId) : document.items;
        targets.forEach(item => { item.status = "completed"; item.canComplete = false; item.canReopen = Boolean(item.assigneeId); });
        document.finalized = action === "complete_all" || !document.isSet;
        document.canCompleteAll = !document.finalized;
      } else return route.fulfill({ status: 400, json: { ok: false, error: "invalid_transition" } });
      document.revision = String(Number(document.revision) + 1);
    }
    await route.fulfill({ json: { ok: true, document } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*/execution`, route => {
    writes.push(route.request().method());
    return route.fulfill({ status: 400, json: { ok: false } });
  });
  if (options.differentPatient) await page.route(`**/customer/patient/${secondId}/profile-overview`, async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { ok: true, overview: { subjectId: secondId, subjectType: "patient", profile: { id: secondId, name: "다른 합성 환자", birthDate: "2020-01-01", breed: "말티즈", sex: "female", neutered: true, species: "dog" }, relationships: { guardians: [] }, access: { information: { allowed: true, requiredPermission: "patient:view" } } } } });
  });
  await options.beforeNavigate?.();
  await page.goto(`/w/${workspaceId}/dispensing?date=2026-10-31&workItemId=${id}&queueItemId=live-fulfillment-${id}&modulePanel=open&aside=closed&right=closed`);
  if (options.started) await expect(page.getByRole("heading", { name: category === "treatment" ? "처치 지시서" : "조제 지시서", exact: true })).toBeVisible();
  else await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  if (!options.started) {
    const entryAction = page.getByRole("button", { name: options.owner === "mine" ? "업무 시작하기" : "담당하기", exact: true });
    await expect(entryAction).toBeEnabled();
    await expect(entryAction).toHaveCSS("height", "32px");
  }
  return { document, writes, actions, assignmentWrites, completionWrites, reopenWrites, requireInstructionReview: () => { requiresAcknowledgement = true; } };
}

for (const [queueType, label] of [["dispensing", "조제"], ["treatment", "처치"]] as const) {
  test(`${queueType} header separates the progress indicator from the completion group`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { actions } = await install(page, { queueType, started: true, canUnassign: true });
    const header = page.locator('[data-slot="emr-page-header"]').filter({
      has: page.getByRole("heading", { name: `${label} 지시서`, exact: true }),
    });
    const complete = header.getByRole("button", { name: `${label} 완료`, exact: true });
    const group = header.getByRole("group", { name: `${label} 완료 보조 작업` });
    const arrow = group.getByRole("button", { name: "업무 상태 변경" });
    const info = page.locator('[data-slot="instruction-info-card"]');
    await expect(header).toContainText(new RegExp(`${label} 시작 일시 .*합성 기존 담당자좁게 보기${label} 완료`));
    await expect(header.getByRole("button", { name: "좁게 보기", exact: true })).toBeVisible();
    await expect(header.getByText("진행중", { exact: true })).toHaveCount(0);
    await expect(complete).toHaveCount(1);
    await expect(group.getByRole("button", { name: `${label} 완료`, exact: true })).toBeEnabled();
    await expect(info.getByTestId("instruction-status-label")).toHaveText("진행중");
    await expect(info.getByText(`${label} 시작`, { exact: true })).toHaveCount(0);
    await expect(info.getByText(`${label} 담당`, { exact: true })).toHaveCount(0);

    const headerBox = (await header.boundingBox())!;
    const infoBox = (await info.boundingBox())!;
    await page.screenshot({
      path: testInfo.outputPath("instruction-header.png"),
      clip: { x: headerBox.x, y: headerBox.y, width: headerBox.width, height: infoBox.y + infoBox.height - headerBox.y },
    });

    await arrow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "담당 취소" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(arrow).toBeFocused();
    await complete.click();
    const confirm = page.getByRole("dialog", { name: "오더를 완료할까요?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "취소" }).click();
    expect(actions).toEqual([]);
  });
}

test("unassigned requester completes dispensing without result input and retries the same command on failure", async ({ page }) => {
  const { actions, writes, document, completionWrites } = await install(page, { failSave: true });
  await expect(page.getByRole("button", { name: "조제 완료", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "완료 메뉴 열기" }).click();
  await page.getByRole("menuitem", { name: "조제 완료", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "오더를 완료할까요?" });
  await expect(dialog.getByRole("button", { name: /수행값 입력/ })).toHaveCount(0);
  expect(actions).toEqual([]); expect(writes).toEqual([]);
  await dialog.getByRole("button", { name: "완료", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(document.items[0].status).toBe("requested");
  await dialog.getByRole("button", { name: "완료", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(completionWrites[0].commandId).toBe(completionWrites[1].commandId);
  expect(writes).toEqual([]);
  expect(actions).toEqual(["complete_all", "complete_all"]);
  expect(document.items[0].assigneeId).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  await expect(page.getByRole("button", { name: "업무 상태 변경" })).toHaveCount(0);
});

test("treatment set completes one item and then the rest without result input", async ({ page }) => {
  const { actions, writes, document } = await install(page, { queueType: "treatment", set: true, started: true });
  await page.getByRole("button", { name: "합성 품목 1 완료", exact: true }).click();
  const item = page.getByRole("dialog", { name: "이 항목을 완료할까요?" });
  await expect(item.getByRole("button", { name: /수행값 입력/ })).toHaveCount(0);
  await item.getByRole("button", { name: "완료", exact: true }).click();
  await expect(item).not.toBeVisible();
  expect(document.items.map(row => row.status)).toEqual(["completed", "in_progress"]);
  expect(document.finalized).toBe(false);
  await page.getByRole("button", { name: "처치 완료", exact: true }).click();
  const set = page.getByRole("dialog", { name: "오더를 완료할까요?" });
  await expect(set.getByText("미완료 항목 1개도 함께 완료됩니다.")).toBeVisible();
  await set.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  expect(document.items.map(row => row.status)).toEqual(["completed", "completed"]);
  expect(actions).toEqual(["complete", "complete_all"]);
  expect(writes).toEqual([]);
});

test("completed dispensing is read-only and reopening a single order can be retried", async ({ page }) => {
  const { actions, document, reopenWrites } = await install(page, { started: true, failReopen: true });
  await page.getByRole("button", { name: "조제 완료", exact: true }).click();
  await page.getByRole("dialog", { name: "오더를 완료할까요?" }).getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");

  const row = page.getByRole("row").filter({ hasText: "합성 품목 1" });
  await expect(row.getByRole("button", { name: "합성 품목 1 완료", exact: true })).toBeDisabled();
  await expect(row.getByRole("button", { name: "합성 품목 1 담당 선택" })).toBeDisabled();
  await page.getByRole("button", { name: "필터", exact: true }).last().click();
  await expect(page.getByText("미완료 오더가 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "미완료", exact: true }).click();
  await page.getByRole("button", { name: "정렬", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "이름순" })).toBeVisible();
  await page.getByRole("button", { name: "기본 간격" }).click();
  await page.getByRole("menuitemcheckbox", { name: "넓은 간격" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "수정이력" }).click();
  await expect(page.getByRole("dialog", { name: "수정 이력" })).toContainText("수정 이력이 없어요.");
  await page.keyboard.press("Escape");
  expect(actions).toEqual(["complete_all"]);

  const stateMenu = page.getByRole("button", { name: "업무 상태 변경" });
  await stateMenu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: /담당 취소|업무 취소/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "진행 중으로 변경" }).click();
  const reopen = page.getByRole("dialog", { name: "진행 중으로 변경할까요?" });
  await expect(reopen).toContainText("합성 검증 오더");
  await reopen.getByRole("button", { name: "취소" }).click();
  expect(actions).toEqual(["complete_all"]);
  await stateMenu.click();
  await page.getByRole("menuitem", { name: "진행 중으로 변경" }).click();
  const submit = reopen.getByRole("button", { name: "진행 중으로 변경" });
  await submit.click();
  await expect(reopen.getByRole("alert")).toContainText("변경을 저장하지 못했어요.");
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  expect(document.items[0].status).toBe("completed");
  await submit.click();
  await expect(reopen).not.toBeVisible();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  expect(reopenWrites).toHaveLength(2);
  expect(reopenWrites[0]).toMatchObject({ action: "reopen", itemId: id });
  expect(reopenWrites[0]).toEqual(reopenWrites[1]);
});

test("completed execution history is read-only and the document menu preserves correction", async ({ page }) => {
  const { document, actions } = await install(page, { started: true });
  document.items[0].hasResult = true;
  await page.route("**/fulfillment/work-items/*/execution", route => {
    expect(route.request().method()).toBe("GET");
    const planSha256 = "a".repeat(64);
    return route.fulfill({ json: { ok: true, context: {
      workspaceId, workItemId: id, taskId: id, orderId: id, encounterId: id,
      attemptNo: 1, workItemRevision: Number(document.revision), status: "completed",
      clinicalOrderType: "dispensing", isCurrentAttempt: true, resultRequired: false, canRecord: true,
      planSnapshot: { calculationOutputs: { plannedPracticalTotalQuantity: 1, dispenseUnit: "T" } },
      planSha256, results: [{
        id: secondId, version: 1, previousResultId: null, schemaVersion: 1,
        payload: { preparedQuantity: 1, preparedUnit: "T" },
        performedByUserId: id, recordedByUserId: id, performedAt: "2026-10-31T01:00:00.000Z", recordedAt: "2026-10-31T01:00:00.000Z",
        varianceReason: null, amendmentReason: null, planSha256,
      }],
    } } });
  });
  await page.getByRole("button", { name: "조제 완료", exact: true }).click();
  await page.getByRole("dialog", { name: "오더를 완료할까요?" }).getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  await page.getByRole("button", { name: "합성 검증 오더 더 보기" }).click();
  await page.getByRole("menuitem", { name: "수행기록", exact: true }).click();
  const history = page.getByRole("dialog", { name: "수행기록", exact: true });
  const record = page.getByRole("dialog", { name: "실제 수행기록", exact: true });
  await history.getByRole("button", { name: "합성 품목 1", exact: true }).click();
  await expect(record.getByText("조회 전용입니다. 수행기록을 변경할 수 없습니다.")).toBeVisible();
  await expect(record.getByRole("button", { name: "기록 정정", exact: true })).toHaveCount(0);
  await record.getByRole("button", { name: "닫기", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();

  await page.getByRole("button", { name: "문서 추가 작업" }).click();
  await page.getByRole("menuitem", { name: "수행기록 정정", exact: true }).click();
  await page.getByRole("dialog", { name: "수행기록 정정", exact: true }).getByRole("button", { name: "합성 품목 1", exact: true }).click();
  await expect(record.getByRole("button", { name: "기록 정정", exact: true })).toBeEnabled();
  expect(actions).toEqual(["complete_all"]);
});

test("completed treatment set reopens one selected item and releases only its remaining work", async ({ page }) => {
  const { actions, document, reopenWrites } = await install(page, { queueType: "treatment", set: true, started: true });
  await page.getByRole("button", { name: "오더별 보기", exact: true }).click();
  const card = page.getByTestId(`order-queue-item-live-fulfillment-${secondId}`);
  const sibling = page.getByTestId(`order-queue-item-live-fulfillment-${id}`);
  const completed = page.getByTestId("order-queue-status-completed");
  const inProgress = page.getByTestId("order-queue-status-inProgress");
  const waiting = page.getByTestId("order-queue-status-waiting");
  await page.getByRole("button", { name: "처치 완료", exact: true }).click();
  await page.getByRole("dialog", { name: "오더를 완료할까요?" }).getByRole("button", { name: "완료", exact: true }).click();
  await expect(completed.locator(card)).toBeVisible();

  await page.getByRole("button", { name: "업무 상태 변경" }).click();
  await page.getByRole("menuitem", { name: "진행 중으로 변경" }).click();
  const dialog = page.getByRole("dialog", { name: "진행 중으로 변경할까요?" });
  const submit = dialog.getByRole("button", { name: "진행 중으로 변경" });
  await expect(submit).toBeDisabled();
  await expect(dialog.getByRole("radio")).toHaveCount(2);
  await dialog.getByRole("radio", { name: "합성 품목 2" }).click();
  await submit.click();
  await expect(dialog).not.toBeVisible();
  await expect(inProgress.locator(card)).toBeVisible();
  await expect(completed.locator(sibling)).toHaveAttribute("data-selected", "true");
  await expect(page.getByRole("button", { name: "합성 품목 1 완료", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "합성 품목 2 완료", exact: true })).toBeEnabled();
  expect(reopenWrites).toEqual([expect.objectContaining({ action: "reopen", itemId: secondId })]);
  expect(document.items.map(item => item.status)).toEqual(["completed", "in_progress"]);

  await inProgress.locator(card).click();
  await expect(inProgress.locator(card)).toHaveAttribute("data-selected", "true");
  await page.getByRole("button", { name: "업무 상태 변경" }).click();
  await page.getByRole("menuitem", { name: "담당 취소" }).click();
  const prework = page.getByTestId("fulfillment-prework");
  await expect(prework).toBeVisible();
  await expect(waiting.locator(card)).toHaveAttribute("data-selected", "true");
  await expect(completed.locator(sibling)).toBeVisible();
  expect(document.items.map(item => [item.status, item.assigneeId])).toEqual([
    ["completed", "synthetic-owner"], ["paused", null],
  ]);
  await page.reload();
  await expect(prework).toBeVisible();
  await expect(waiting.locator(card)).toHaveAttribute("data-selected", "true");
  await prework.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("dialog", { name: "이 업무를 담당할까요?" }).getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(inProgress.locator(card)).toHaveAttribute("data-selected", "true");
  await expect(completed.locator(sibling)).toBeVisible();
  expect(actions).toEqual(["complete_all", "reopen", "unassign", "claim"]);
});

test("claim assigns and starts before opening the instruction", async ({ page }) => {
  await page.setViewportSize({ width: 1624, height: 1000 });
  const { actions, assignmentWrites } = await install(page, { requester: false, emptyOral: true });
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  await expect(page.getByRole("button", { name: "합성 품목 1 완료", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "조제 완료", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오더 정보" })).toBeVisible();
  expect(actions).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("dispensing-desktop.png") });
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("dispensing-narrow.png") });
  await page.setViewportSize({ width: 1624, height: 1000 });
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 업무를 담당할까요?" });
  await expect(dialog.getByText("미지정 → 나", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("list", { name: "대상 오더" }).getByRole("listitem")).toHaveText(["합성 품목 1"]);
  await expect(dialog.getByText("현재 담당:", { exact: false })).toHaveCount(0);
  await dialog.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByTestId("fulfillment-prework")).toHaveCount(0);
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toHaveCount(0);
  expect(actions).toEqual(["claim"]);
  expect(assignmentWrites[0]).toMatchObject({ startWork: true });
  await page.reload();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toHaveCount(0);
});

test("designated owner starts directly from prework", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const { actions } = await install(page, { owner: "mine", emptyOral: true });
  await page.getByRole("button", { name: "업무 시작하기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("fulfillment-prework")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  await expect(page.getByText("조제 시작 일시 09:05", { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("dispensing-after-start.png") });
  expect(actions).toEqual(["start"]);
  expect(errors).toEqual([]);
});

test("direct start still requires acknowledgement of changed instructions", async ({ page }) => {
  const { actions } = await install(page, { owner: "mine", requester: false });
  let requiresAcknowledgement = true;
  await page.route("**/fulfillment/instruction-review*", route => {
    if (route.request().method() === "POST") {
      requiresAcknowledgement = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (!requiresAcknowledgement) return route.fallback();
    return route.fulfill({ json: { ok: true, reviews: [{
      taskId: id, requiresAcknowledgement: true, previous: null, snapshots: [],
      current: { chartId: id, scope: "dispensing", versions: { dispensing: 2 }, versionKey: "b".repeat(64),
        entries: [{ scope: "dispensing", revision: 2, instruction: "합성 최신 지시", deleted: false, legacy: false, actorName: null, createdAt: null }] },
    }] } });
  });
  const start = page.getByRole("button", { name: "업무 시작하기", exact: true });
  await start.click();
  const review = page.getByRole("dialog", { name: "지시사항 확인" });
  await expect(review).toBeVisible();
  await expect(page.getByRole("dialog", { name: "업무를 시작할까요?" })).toHaveCount(0);
  expect(actions).toEqual([]);
  await review.getByRole("button", { name: "최신 지시 확인" }).click();
  await expect(review).not.toBeVisible();
  await start.click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  expect(actions).toEqual(["start"]);
});

for (const queueType of ["dispensing", "treatment"] as const) {
  test(`${queueType} re-request keeps the started instruction and requires review before continuing`, async ({ page }) => {
    const { document, actions, assignmentWrites } = await install(page, { queueType, started: true });
    const item = document.items[0];
    const before = queueType === "dispensing"
      ? { detailSchemaVersion: 1, detailInputs: { ...item.plan.detailInputs as object, frequency: "bid" } }
      : { detailSchemaVersion: 3, detailInputs: { method: "변경 전 합성 처치" } };
    const after = queueType === "dispensing"
      ? { ...before, detailInputs: { ...before.detailInputs, frequency: "qid" } }
      : { ...before, detailInputs: { method: "수정된 합성 처치" } };
    item.status = "requested";
    item.attemptNo = 2;
    item.taskId = secondId;
    item.plan = after;
    document.rootTaskId = secondId;
    document.revision = "2";
    document.firstStartedAt = "2026-10-31T00:05:00+00:00";
    document.canStart = true;
    document.canUnassign = true;
    document.changes = [{ id: "synthetic-edit", orderId: id, createdAt: "2026-10-31T00:20:00Z",
      actorName: "합성 수의사", changeType: "re_request",
      before: { ...before, instruction: item.instruction }, after: { ...after, instruction: item.instruction } }];
    let requiresAcknowledgement = true;
    await page.route("**/fulfillment/instruction-review*", route => {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ taskId: secondId, versionKey: "b".repeat(64) });
        requiresAcknowledgement = false;
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { ok: true, reviews: [{
        taskId: secondId, requiresAcknowledgement, previous: null, snapshots: [],
        current: { chartId: id, scope: queueType, versions: { [queueType]: 2 }, versionKey: "b".repeat(64),
          entries: [{ scope: queueType, orderId: id, kind: "clinical_edit", revision: 2,
            instruction: "합성 변경 사항을 확인해 주세요.", deleted: false, legacy: false, actorName: null, createdAt: null }] },
      }] } });
    });

    await page.reload();
    const toggle = page.getByTestId("patient-queue-view-toggle");
    await expect(toggle).toBeEnabled();
    if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
    const card = page.getByTestId(`order-queue-item-live-fulfillment-${id}`);
    await expect(card.getByText("재요청", { exact: true })).toBeVisible();
    await expect(card.getByText("09:00 합성 수의사 요청", { exact: true })).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId("order-queue-status-reRequested").locator(card)).toBeVisible();
    await expect(page.getByTestId("order-queue-status-waiting")).toHaveCount(0);
    await expect(page.getByTestId("fulfillment-prework")).toHaveCount(0);
    await expect(page.getByTestId("instruction-status-label")).toHaveText("재요청");
    const startedAt = page.getByText(`${queueType === "dispensing" ? "조제" : "처치"} 시작 일시 09:05`, { exact: true });
    await expect(startedAt).toBeVisible();
    const modified = page.locator(".fd-modified");
    await expect(modified).toContainText("수정된 오더");
    await expect(modified).toContainText("합성 품목 1");
    if (queueType === "dispensing") {
      await expect(modified.getByRole("button", { name: /복용 주기 .*변경 내용 보기/ })).toBeVisible();
      await expect(modified).toContainText(/qid|하루 4회/i);
    } else {
      await expect(modified).toContainText("수정된 합성 처치");
    }
    expect(actions).toEqual([]);

    const continueWork = page.getByRole("button", { name: "업무 계속하기" });
    await continueWork.click();
    const review = page.getByRole("dialog", { name: "지시사항 확인" });
    await expect(review).toBeVisible();
    expect(actions).toEqual([]);
    await review.getByRole("button", { name: "변경·남은 작업 범위 확인" }).click();
    await expect(review).not.toBeVisible();
    await continueWork.click();
    await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
    await expect(page.getByTestId("order-queue-status-inProgress").locator(card)).toBeVisible();
    await expect(startedAt).toBeVisible();
    await expect(modified).toContainText("합성 품목 1");
    expect(actions).toEqual(["start"]);

    await page.getByRole("button", { name: "업무 상태 변경" }).click();
    await page.getByRole("menuitem", { name: "담당 취소", exact: true }).click();
    await expect(page.getByTestId("order-queue-status-reRequested").locator(card)).toBeVisible();
    requiresAcknowledgement = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: queueType === "dispensing" ? "조제 지시서" : "처치 지시서", exact: true })).toBeVisible();
    await expect(page.getByTestId("instruction-status-label")).toHaveText("재요청");
    await expect(modified).toContainText("합성 품목 1");
    await expect(startedAt).toBeVisible();
    if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
    await expect(card.getByText("재요청", { exact: true })).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId("order-queue-status-reRequested").locator(card)).toBeVisible();

    await continueWork.click();
    await expect(review).toBeVisible();
    expect(actions).toEqual(["start", "unassign"]);
    await review.getByRole("button", { name: "변경·남은 작업 범위 확인" }).click();
    await expect(review).not.toBeVisible();
    await continueWork.click();
    await expect(page.getByTestId("order-queue-status-inProgress").locator(card)).toBeVisible();
    await expect(modified).toContainText("합성 품목 1");
    expect(actions).toEqual(["start", "unassign", "claim"]);
    expect(assignmentWrites).toEqual([expect.objectContaining({ action: "claim", startWork: true })]);
  });
}

test("takeover requires a reason, retains it on failure and retries one command", async ({ page }) => {
  const { actions, assignmentWrites } = await install(page, { owner: "other", set: true, failAssignment: true, requester: false });
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "담당자를 변경할까요?" });
  await expect(dialog.getByText("합성 기존 담당자 → 나", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("list", { name: "대상 오더" }).getByRole("listitem")).toHaveText(["합성 품목 1", "합성 품목 2"]);
  const confirm = dialog.getByRole("button", { name: "담당 변경", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("담당 변경 사유").fill("교대 근무로 인계합니다.");
  await confirm.dblclick();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("담당 변경 사유")).toHaveValue("교대 근무로 인계합니다.");
  expect(assignmentWrites).toHaveLength(1);
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toHaveCount(0);
  expect(actions).toEqual(["takeover", "takeover"]);
  expect(assignmentWrites[0].commandId).toBe(assignmentWrites[1].commandId);
  expect(assignmentWrites[1]).toMatchObject({ startWork: true, reason: "교대 근무로 인계합니다." });
});

test("takeover keeps the reason when a new instruction must be acknowledged", async ({ page }) => {
  const { actions, assignmentWrites } = await install(page, { owner: "other", requester: false });
  let newInstruction = false;
  await page.route("**/fulfillment/work-items/*/instruction", route => {
    if (route.request().method() !== "PATCH" || newInstruction || actions.length) return route.fallback();
    newInstruction = true;
    actions.push("takeover");
    return route.fulfill({ status: 409, json: { ok: false, error: "instruction_ack_required" } });
  });
  await page.route("**/fulfillment/instruction-review*", route => {
    if (route.request().method() === "POST") {
      newInstruction = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (!newInstruction) return route.fallback();
    return route.fulfill({ json: { ok: true, reviews: [{
      taskId: id, requiresAcknowledgement: true, previous: null, snapshots: [],
      current: { chartId: id, scope: "dispensing", versions: { dispensing: 2 }, versionKey: "b".repeat(64),
        entries: [{ scope: "dispensing", revision: 2, instruction: "합성 최신 지시", deleted: false, legacy: false, actorName: null, createdAt: null }] },
    }] } });
  });

  const entry = page.getByTestId("fulfillment-prework");
  const takeover = page.getByRole("dialog", { name: "담당자를 변경할까요?" });
  await entry.getByRole("button", { name: "담당하기", exact: true }).click();
  await takeover.getByLabel("담당 변경 사유").fill("합성 교대 사유");
  await takeover.getByRole("button", { name: "담당 변경", exact: true }).click();
  await expect(takeover).not.toBeVisible();
  await expect(entry).toBeVisible();
  const review = page.getByRole("dialog", { name: "지시사항 확인" });
  await review.getByRole("button", { name: "최신 지시 확인" }).click();
  await expect(review).not.toBeVisible();

  await entry.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(takeover.getByLabel("담당 변경 사유")).toHaveValue("합성 교대 사유");
  await takeover.getByRole("button", { name: "담당 변경", exact: true }).click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
  await expect(page.getByRole("button", { name: "조제 시작", exact: true })).toHaveCount(0);
  expect(actions).toEqual(["takeover", "takeover"]);
  expect(assignmentWrites[0]).toMatchObject({ startWork: true, reason: "합성 교대 사유" });
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
  const confirm = dialog.getByRole("button", { name: "담당 변경", exact: true });
  await confirm.click();
  await expect(dialog.getByText("합성 새 담당자 → 나", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("업무 내용이나 담당자가 변경");
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByLabel("담당 변경 사유")).toHaveValue("교대 인계");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await confirm.click();
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
    const { actions, assignmentWrites } = await install(page, { queueType: "treatment", owner, requester: false, emptyOral: true });
    const entry = page.getByTestId("fulfillment-prework");
    await expect(entry.getByRole("columnheader", { name: "처치 계획" })).toBeVisible();
    await expect(entry.getByRole("button", { name: "완료 메뉴 열기" })).toHaveCount(0);
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
    if (owner === "mine") {
      await expect(dialog).toHaveCount(0);
    } else {
      await expect(dialog.getByText(owner === "other" ? "합성 기존 담당자 → 나" : "미지정 → 나", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("list", { name: "대상 오더" }).getByRole("listitem")).toHaveText(["합성 품목 1"]);
      if (owner === "other") await dialog.getByLabel("담당 변경 사유").fill("합성 교대 사유");
      await dialog.getByRole("button", { name: owner === "other" ? "담당 변경" : "담당하기", exact: true }).click();
    }
    await expect(entry).toHaveCount(0);
    await expect(page.getByTestId("instruction-status-label")).toHaveText("진행중");
    await expect(page.getByRole("button", { name: "처치 시작", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "처치 지시서", exact: true })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: test.info().outputPath(`treatment-after-${owner ?? "claim"}.png`) });
    expect(actions).toEqual([owner === "mine" ? "start" : owner === "other" ? "takeover" : "claim"]);
    if (owner !== "mine") expect(assignmentWrites[0]).toMatchObject({
      startWork: true,
      ...(owner === "other" ? { reason: "합성 교대 사유" } : {}),
    });
  });
}


for (const [queueType, label] of [["dispensing", "조제"], ["treatment", "처치"]] as const) {
  test(label + " prework uses the approved header, order disclosure, scoped instructions and dated history", async ({ page }, testInfo) => {
    const { actions, writes, requireInstructionReview } = await install(page, { queueType, set: true, owner: "mine", layoutFixture: true });
    const entry = page.getByTestId("fulfillment-prework");
    const menu = entry.getByRole("button", { name: "완료 메뉴 열기" });
    await expect(menu).toHaveCSS("height", "32px");
    await expect(menu).toHaveCSS("width", "32px");
    await expect(entry.getByRole("button", { name: "업무 시작하기" }).locator("svg")).toHaveCount(0);
    await menu.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: label + " 완료" })).toBeVisible();
    await expect(page.getByRole("menuitem")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();

    const summary = entry.locator("dl").filter({ hasText: "요청 시각" });
    await expect(summary.locator("dt")).toHaveText(["오더명", "요청 시각", "요청자", "담당자"]);
    await expect(summary).toContainText("합성 품목 1 외 1건");
    await expect(summary.locator("dd > span > svg")).toHaveCount(2);
    await expect(summary.locator('[data-slot="avatar"]')).toHaveCount(2);
    const table = entry.getByRole("region", { name: "요청된 " + label + " 오더" });
    await expect(table.getByRole("columnheader", { name: "항목 담당" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: /복약지도|보관/ })).toHaveCount(0);
    const toggle = table.getByRole("button", { name: /합성 품목 1 지시/ });
    await expect(toggle).toHaveCSS("height", "24px");
    await expect(toggle).toHaveCSS("width", "24px");
    const details = table.locator(".fd-info-row");
    await expect(details).toHaveCount(2);
    await expect(details.first()).toContainText("개별 지시");
    await expect(details.first()).not.toContainText("오더별 지시:");
    await toggle.click();
    await expect(details.first()).toBeHidden();
    await expect(details.last()).toBeVisible();
    await toggle.press("Enter");
    await expect(details.first()).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const instructions = entry.locator("section").filter({ has: page.getByRole("heading", { name: label + " 요청 사항" }) });
    for (const scope of ["전체 지시", label + " 지시", "세트 지시"]) {
      await expect(instructions.getByText(scope, { exact: true })).toHaveCount(1);
    }
    await expect(instructions.getByRole("button")).toHaveCount(0);
    expect(await instructions.locator("p").evaluateAll(paragraphs => new Set(paragraphs.map(node => node.previousElementSibling?.getBoundingClientRect().width)).size)).toBe(1);
    const history = entry.getByTestId("fulfillment-prework-history-timeline");
    await expect(history).toContainText("2026년 10월 30일");
    await expect(history).toContainText("15:22:08");
    await expect(history.locator("ol").locator("li")).toHaveCount(3);
    await expect(history).not.toContainText("합성 품목 1");
    await entry.getByRole("button", { name: "전체 이력 보기" }).click();
    await expect(history.locator("ol").locator("li")).toHaveCount(4);
    await entry.getByRole("button", { name: "이력 접기" }).press("Enter");
    await expect(history.locator("ol").locator("li")).toHaveCount(3);
    await expect(history).not.toContainText("합성 기존 담당자");

    await history.screenshot({ path: testInfo.outputPath("prework-history.png") });
    await entry.locator("header").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("prework-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "사이드 패널 접기" }).click();
    await expect(page).toHaveURL(/modulePanel=closed/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(toggle).toBeVisible();
    await expect.poll(() => instructions.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("prework-narrow.png") });
    await menu.click();
    await page.getByRole("menuitem", { name: label + " 완료" }).click();
    const completion = page.getByRole("dialog", { name: "오더를 완료할까요?" });
    await expect(completion.getByRole("button", { name: "완료", exact: true })).toBeEnabled();
    await completion.getByRole("button", { name: "취소", exact: true }).click();
    requireInstructionReview();
    await entry.getByRole("button", { name: "업무 시작하기" }).click();
    await expect(page.getByRole("dialog", { name: "지시사항 확인" }).getByRole("button", { name: "최신 지시 확인" })).toBeVisible();
    expect(actions).toEqual([]);
    expect(writes).toEqual([]);
  });
}


function deferredRead() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function expectOnlyPageLoading(page: Page) {
  await expect(page.getByTestId("page-loading-state")).toBeVisible();
  const content = page.locator('[data-page-content][inert]').first();
  await expect(content).toHaveAttribute("inert", "");
  await expect(content).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("fulfillment-prework")).not.toBeVisible();
  await expect(content.getByRole("heading", { name: "조제 지시서", exact: true })).not.toBeVisible();
  await expect(content.locator('[data-slot="emr-instruction-header-stack"]')).not.toBeVisible();
}
for (const source of ["instruction", "assignees", "profile-overview"]) {
  test(`page boundary waits for initial ${source} and then shows prework together`, async ({ page }) => {
    const gate = deferredRead(); let requested = false;
    const ready = install(page, { beforeNavigate: async () => {
      await page.route(source === "profile-overview" ? "**/customer/patient/*/profile-overview" : `**/fulfillment/work-items/*/${source}`, async route => {
        if (route.request().method() === "GET") { requested = true; await gate.promise; }
        await route.fallback();
      });
    } });
    await expect.poll(() => requested).toBe(true);
    await expectOnlyPageLoading(page);
    if (source === "instruction") await page.screenshot({ path: test.info().outputPath("initial-loading.png") });
    gate.release(); await ready;
    await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
    await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  });
}
for (const owner of [undefined, "mine"] as const) {
  test(`page boundary waits for instruction after ${owner ?? "unassigned"} entry`, async ({ page }) => {
    const { actions } = await install(page, { owner });
    const gate = deferredRead(); let requested = false;
    await page.route("**/fulfillment/work-items/*/instruction", async route => {
      if (route.request().method() === "GET") { requested = true; await gate.promise; }
      await route.fallback();
    });
    const name = owner === "mine" ? "업무 시작하기" : "담당하기";
    await page.getByRole("button", { name, exact: true }).click();
    if (!owner) await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await expectOnlyPageLoading(page);
    await page.screenshot({ path: test.info().outputPath("entry-loading.png") });
    gate.release();
    await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).toBeVisible();
    await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
    expect(actions).toEqual(owner === "mine" ? ["start"] : ["claim"]);
  });
}
test("instruction refresh failure exits page loading and keeps an explicit retry", async ({ page }) => {
  await install(page, { owner: "mine" });
  await page.route("**/fulfillment/work-items/*/instruction", route => route.request().method() === "GET" ? route.fulfill({ status: 503, json: { ok: false } }) : route.fallback());
  await page.getByRole("button", { name: "업무 시작하기", exact: true }).click();
  await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "다시 조회", exact: true }).first()).toBeVisible();
});

test("prework A-B-A queue navigation masks each selected read and rejects the late B response", async ({ page }) => {
  await install(page, { set: true });
  const gate = deferredRead(); let blocked = false;
  await page.route(`**/fulfillment/work-items/${secondId}/instruction`, async route => {
    blocked = true; await gate.promise; await route.fallback();
  });
  const panel = page.locator("aside").first();
  await panel.getByText("합성 품목 2", { exact: true }).click();
  await expect.poll(() => blocked).toBe(true);
  await expectOnlyPageLoading(page);
  await page.screenshot({ path: test.info().outputPath("selection-loading.png") });
  await panel.getByText("합성 품목 1", { exact: true }).click();
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  gate.release();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(new RegExp(`workItemId=${id}`));
  await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`workItemId=${secondId}`));
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`workItemId=${id}`));
  await expect(page.getByTestId("fulfillment-prework")).toBeVisible();
});


test("same-patient instruction selection retains the header through one loading interval with 300ms queue latency", async ({ page }) => {
  await page.setViewportSize({ width: 1673, height: 867 });
  const { document } = await install(page, { set: true, started: true });
  const header = page.locator('[data-slot="patient-context-bar"]').first();
  await expect(header).toBeVisible();
  let queueReads = 0;
  await page.route("**/fulfillment/work-items?*", async route => {
    queueReads += 1;
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fallback();
  });
  await page.route(`**/fulfillment/work-items/${secondId}/instruction`, async route => {
    await new Promise(resolve => setTimeout(resolve, 220));
    await route.fulfill({ json: { ok: true, document: { ...document, rootTaskId: secondId, rootOrderId: secondId, isSet: false, items: document.items.filter(item => item.id === secondId) } } });
  });
  await page.route(`**/fulfillment/work-items/${secondId}/assignees`, async route => {
    await new Promise(resolve => setTimeout(resolve, 140));
    await route.fallback();
  });
  await page.route("**/fulfillment/instruction-review?*", async route => {
    await new Promise(resolve => setTimeout(resolve, 75));
    await route.fallback();
  });
  await header.evaluate(node => {
    const samples: Array<{ header: boolean; loading: boolean }> = [];
    const state = { samples, running: true };
    Object.assign(window, { instructionSelectionTrace: state });
    const sample = () => {
      if (!state.running) return;
      const loading = node.ownerDocument.querySelector('[data-testid="page-loading-state"]');
      const next = { header: node.isConnected && getComputedStyle(node).visibility === "visible", loading: Boolean(loading && getComputedStyle(loading).visibility === "visible") };
      const previous = samples.at(-1);
      if (!previous || previous.header !== next.header || previous.loading !== next.loading) samples.push(next);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByTestId("module-side-panel-host").getByText("합성 품목 2", { exact: true }).click();
  await expect(page.getByTestId("page-loading-state")).toBeVisible();
  await expect(header).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("same-patient-loading.png") });
  await expect(page.getByTestId("page-loading-state")).toHaveCount(0);
  await expect(header).toBeVisible();
  const samples = await page.evaluate(() => {
    const state = (window as unknown as { instructionSelectionTrace: { running: boolean; samples: Array<{ header: boolean; loading: boolean }> } }).instructionSelectionTrace;
    state.running = false;
    return state.samples;
  });
  expect(samples.every(sample => sample.header)).toBe(true);
  expect(samples.filter((sample, index) => sample.loading && !samples[index - 1]?.loading)).toHaveLength(1);
  expect(queueReads).toBe(0);
});


test("a different patient's instruction waits for the new header context", async ({ page }) => {
  await install(page, { set: true, started: true, differentPatient: true });
  await page.getByTestId("module-side-panel-host").getByText("합성 품목 2", { exact: true }).click();
  await expect(page.getByTestId("page-loading-state")).toBeVisible();
  await expect(page.locator('[data-slot="patient-context-bar"]').first()).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "조제 지시서", exact: true })).not.toBeVisible();
  await expect(page.getByTestId("page-loading-state")).toHaveCount(0);
  await expect(page.locator('[data-slot="patient-context-bar"]').first()).toContainText("다른 합성 환자");
});
