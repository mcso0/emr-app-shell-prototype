import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

type QueueType = "dispensing" | "treatment" | "lab" | "imaging";
const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
const patientId = "97091000-0000-4000-8000-000000000001";
const guardianId = "97091000-0000-4000-8000-000000000002";
const encounterId = "97091000-0000-4000-8000-000000000003";
const workItemId = "97091000-0000-4000-8000-000000000004";
const operatingDate = "2026-09-07";
const access = {
  information: { allowed: true, requiredPermission: "patient:view" },
  history: { allowed: true, requiredPermission: "chart:view" },
  reservations: { allowed: true, requiredPermission: "reception:view" },
  billing: { allowed: true, requiredPermission: "billing:view" },
};

async function grantWorkspaceAccess(page: Page, ids = [workspaceId]) {
  await page.addInitScript(([storageKey, workspaceIds]) => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      currentWorkspaceId: workspaceIds[0],
      workspaces: workspaceIds.map((id, index) => ({ id, displayName: `합성 병원 ${index + 1}`,
        representativeName: "합성 관리자", contactEmail: "owner@context.test", contactPhone: null,
        subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session", createdAt: "2026-09-07T00:00:00Z" })),
      memberships: workspaceIds.map((id) => ({ id: `context-membership-${id}`, workspaceId: id,
        userSessionId: "playwright-default-session", displayName: "합성 관리자", email: "admin@context.test",
        roles: ["hospital_admin"], status: "active", createdAt: "2026-09-07T00:00:00Z", activatedAt: "2026-09-07T00:00:00Z" })),
      invitations: [], updatedAt: "2026-09-07T00:00:00Z",
    }));
    window.sessionStorage.removeItem("clair-emr:chart-live-encounter-handoffs:v1");
  }, [SESSION_WORKSPACES_STORAGE_KEY, ids] as const);
}

function createWorkItem(queueType: QueueType, overrides: Record<string, unknown> = {}) {
  return { id: workItemId, workspaceId, patientId, encounterId, orderId: workItemId, queueType,
    requestCycle: 1, rowRevision: 1, status: "requested", createdAt: "2026-09-07T01:30:00Z", updatedAt: "2026-09-07T01:30:00Z",
    sourceSnapshot: { patientName: "오래된 큐 이름", guardianName: "큐 보호자", orderDisplayName: "합성 업무",
      requestingVetName: "합성 수의사" }, ...overrides };
}

function patientOverview(overrides: Record<string, unknown> = {}, guardians: Record<string, unknown>[] = [
  { id: guardianId, name: "합성 주보호자", mobilePhone: "010-1111-2222", relationship: "주보호자", isPrimary: true },
]) {
  return { ok: true, overview: { subjectId: overrides.id ?? patientId, subjectType: "patient", access: structuredClone(access),
    profile: { id: patientId, workspaceId, name: "합성 초코", patientNo: "P-CONTEXT", species: "dog", breed: "포메라니안",
      birthDate: "2020-02-03", sex: "female", neutered: true, status: "active", allergyNote: "합성 알레르기 메모",
      handlingCautionNote: "합성 취급주의 메모", specialNote: "합성 특이사항 메모", ...overrides }, relationships: { guardians } } };
}

function guardianOverview(targetWorkspaceId = workspaceId) {
  return { ok: true, overview: { subjectId: guardianId, subjectType: "guardian", access: structuredClone(access),
    profile: { id: guardianId, workspaceId: targetWorkspaceId, name: "합성 주보호자", mobilePhone: "010-1111-2222",
      email: "guardian@context.test", memo: "합성 보호자 상세 메모", status: "active" }, relationships: { patients: [{ id: patientId, name: "합성 초코" }] } } };
}

function encounterContext(targetPatientId = patientId, targetEncounterId = encounterId) {
  return { ok: true, status: 200, canWriteVitals: false, enforcedBy: "chart-preconsultation-context-read", context: {
    encounter: { id: targetEncounterId, encounterNo: "E-CONTEXT", receptionType: "walk_in", checkedInAt: "2026-09-07T01:30:00Z",
      status: "in_consultation", visitPurpose: "합성 실제 방문 목적", chiefComplaint: "합성 실제 주호소" },
    queue: { id: "context-queue", status: "in_consultation" }, patient: { ...patientOverview().overview.profile, id: targetPatientId },
    guardian: { id: guardianId, name: "합성 주보호자", memo: "합성 보호자 상세 메모" }, priorEncounterCount: 0, vitals: [], history: [],
  } };
}

function routePath(queueType: QueueType, targetWorkspaceId = workspaceId) {
  const surface = queueType === "treatment" ? "dispensing" : queueType;
  const selectedId = queueType === "lab" ? `labResultId=live-lab-${workItemId}` : queueType === "imaging" ? `imagingStudyId=live-imaging-${workItemId}` : `workItemId=${workItemId}`;
  return `/w/${targetWorkspaceId}/${surface}?date=${operatingDate}&encounterId=${encounterId}&${selectedId}&modulePanel=open&aside=closed&right=closed`;
}

function createGate() {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  return { pending, release };
}

async function installReads(page: Page, queueType: QueueType, options: {
  overview?: ReturnType<typeof patientOverview>;
  profileStatus?: number;
  guardianStatus?: number;
  encounterStatus?: number;
  profileGate?: ReturnType<typeof createGate>;
} = {}) {
  let profileReads = 0;
  await page.route("**/api/workspaces/*/fulfillment/work-items?*", async route => {
    const requestedType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: requestedType === queueType ? [createWorkItem(queueType)] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, async route => {
    profileReads += 1;
    if (options.profileGate) await options.profileGate.pending;
    await route.fulfill({ status: options.profileStatus ?? 200, json: options.profileStatus ? { ok: false } : options.overview ?? patientOverview() });
  });
  await page.route("**/api/workspaces/*/customer/guardian/*/profile-overview", async route => {
    await route.fulfill({ status: options.guardianStatus ?? 200, json: options.guardianStatus ? { ok: false } : guardianOverview() });
  });
  await page.route("**/api/workspaces/*/chart/preconsultation-context?*", async route => {
    await route.fulfill({ status: options.encounterStatus ?? 200, json: options.encounterStatus ? { ok: false } : encounterContext() });
  });
  await page.route("**/api/workspaces/*/patient-vitals/latest?*", async route => {
    await route.fulfill({ json: { ok: true, status: 200, canWriteVitals: false, vital: null } });
  });
  return { profileReads: () => profileReads };
}

for (const queueType of ["dispensing", "treatment", "lab", "imaging"] as const) {
  test(`${queueType} direct context and reload use persisted profile fields and exact encounter memos`, async ({ page }) => {
    await grantWorkspaceAccess(page);
    const reads = await installReads(page, queueType);
    await page.goto(routePath(queueType));
    const bar = page.locator("[data-slot='patient-context-bar']");
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(bar.locator("[data-slot='patient-context-patient']")).toContainText(/합성 초코.*포메라니안.*중성화·암컷.*6세/);
      await expect(bar.locator("[data-slot='patient-context-guardian']")).toContainText(/합성 주보호자\(주보호자\).*010-1111-2222/);
      await expect(bar.getByRole("button", { name: "방문목적 메모 보기" })).toHaveAttribute("title", "합성 실제 방문 목적");
      await expect(bar.getByRole("button", { name: "보호자메모 메모 보기" })).toHaveAttribute("title", "합성 보호자 상세 메모");
      await expect(bar.getByRole("button", { name: "환자메모 메모 보기" })).toHaveAttribute("title", "합성 알레르기 메모 · 합성 취급주의 메모 · 합성 특이사항 메모");
      await expect(bar.getByRole("button", { name: "수납메모 메모 보기" })).toBeDisabled();
      await expect(bar).not.toContainText("미상");
      await expect(bar).not.toContainText("오래된 큐 이름");
      expect(reads.profileReads()).toBe(reload ? 2 : 1);
    }
    await bar.getByRole("button", { name: "합성 초코 환자 프로필 열기" }).hover();
    await expect(page.locator("[data-slot='chart-patient-profile-preview']")).toContainText("포메라니안");
    expect(reads.profileReads()).toBe(2);
  });
}

for (const [status, message] of [[403, "환자 정보 조회 권한 없음"], [404, "환자 정보 조회 대상 없음"], [500, "환자 정보 불러오기 실패"]] as const) {
  test(`profile ${status} remains explicit and cannot use a queue or demo profile`, async ({ page }) => {
    await grantWorkspaceAccess(page);
    await installReads(page, "lab", { profileStatus: status });
    await page.goto(routePath("lab"));
    const bar = page.locator("[data-slot='patient-context-bar']");
    await expect(bar.locator("[data-slot='patient-context-patient']")).toContainText(message);
    await expect(bar).not.toContainText("미상");
    await expect(bar).not.toContainText("오래된 큐 이름");
    await expect(bar.getByRole("button", { name: /환자 프로필 열기/ })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: /보호자 프로필 열기/ })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "환자메모 메모 보기" })).toBeDisabled();
  });
}

test("pending profile and missing clinical fields differ from lookup failure", async ({ page }) => {
  await grantWorkspaceAccess(page);
  const profileGate = createGate();
  await installReads(page, "dispensing", { profileGate, overview: patientOverview({ breed: null, species: null, birthDate: null,
    sex: null, neutered: null, allergyNote: null, handlingCautionNote: null, specialNote: null }, []) });
  await page.goto(routePath("dispensing"));
  const bar = page.locator("[data-slot='patient-context-bar']");
  const pendingPatient = bar.locator("[data-slot='patient-context-patient']");
  await expect(pendingPatient.locator("[data-slot='skeleton']")).toHaveCount(4);
  await expect(pendingPatient.locator('[aria-busy="true"]')).toBeVisible();
  await expect(pendingPatient).not.toContainText("환자 정보 불러오는 중");
  await expect(bar.getByRole("button", { name: /환자 프로필 열기/ })).toHaveCount(0);
  profileGate.release();
  await expect(pendingPatient.locator("[data-slot='skeleton']")).toHaveCount(0);
  await expect(bar.locator("[data-slot='patient-context-patient']")).toContainText(/합성 초코.*품종 미입력.*성별 미입력.*나이 미입력/);
  await expect(bar.locator("[data-slot='patient-context-guardian']")).toContainText("보호자 미지정");
  await expect(bar.getByRole("button", { name: /보호자 프로필 열기/ })).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "환자메모 메모 보기" })).toHaveAttribute("title", "환자 특이 메모 없음");
});

test("guardian and encounter denial remain unavailable while permitted patient data stays visible", async ({ page }) => {
  await grantWorkspaceAccess(page);
  await installReads(page, "imaging", { guardianStatus: 403, encounterStatus: 403 });
  await page.goto(routePath("imaging"));
  const bar = page.locator("[data-slot='patient-context-bar']");
  await expect(bar).toContainText("합성 초코");
  await expect(bar.getByRole("button", { name: "방문목적 메모 보기" })).toHaveAttribute("title", "방문 목적 조회 권한 없음");
  await expect(bar.getByRole("button", { name: "방문목적 메모 보기" })).toBeDisabled();
  await expect(bar.getByRole("button", { name: "보호자메모 메모 보기" })).toHaveAttribute("title", "보호자 메모 조회 권한 없음");
  await expect(bar.getByRole("button", { name: "보호자메모 메모 보기" })).toBeDisabled();
  await expect(bar).not.toContainText("오더 수행");
  await expect(bar).not.toContainText("외래");
});

for (const [status, stateText] of [[404, "조회 대상 없음"], [500, "불러오기 실패"]] as const) {
  test(`guardian and encounter ${status} cannot imply an empty memo`, async ({ page }) => {
    await grantWorkspaceAccess(page);
    await installReads(page, "dispensing", { guardianStatus: status, encounterStatus: status });
    await page.goto(routePath("dispensing"));
    const bar = page.locator("[data-slot='patient-context-bar']");
    const guardianMemo = bar.getByRole("button", { name: "보호자메모 메모 보기" });
    const visitMemo = bar.getByRole("button", { name: "방문목적 메모 보기" });
    await expect(guardianMemo).toHaveAttribute("title", `보호자 메모 ${stateText}`);
    await expect(guardianMemo).toBeDisabled();
    await expect(guardianMemo).not.toHaveAttribute("title", "보호자 메모 없음");
    await expect(visitMemo).toHaveAttribute("title", `방문 목적 ${stateText}`);
    await expect(visitMemo).toBeDisabled();
  });
}

test("a late response for the previous patient cannot replace the selected patient", async ({ page }) => {
  await grantWorkspaceAccess(page);
  await installReads(page, "lab");
  const oldGate = createGate();
  const nextPatientId = "97091000-0000-4000-8000-000000000011";
  const nextEncounterId = "97091000-0000-4000-8000-000000000013";
  const nextWorkId = "97091000-0000-4000-8000-000000000014";
  let oldRead = false;
  let oldResponseFinished = false;
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, async route => {
    oldRead = true;
    await oldGate.pending;
    await route.fulfill({ json: patientOverview() }).catch(() => undefined);
    oldResponseFinished = true;
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${nextPatientId}/profile-overview`, async route => {
    await route.fulfill({ json: patientOverview({ id: nextPatientId, name: "합성 다음 환자", breed: "말티즈" }, []) });
  });
  await page.route("**/api/workspaces/*/fulfillment/work-items?*", async route => {
    const type = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: type === "lab" ? [createWorkItem("lab"), createWorkItem("lab", {
      id: nextWorkId, patientId: nextPatientId, encounterId: nextEncounterId,
      sourceSnapshot: { patientName: "합성 다음 환자", orderDisplayName: "합성 다음 검사" },
    })] : [] } });
  });
  await page.route("**/api/workspaces/*/chart/preconsultation-context?*", async route => {
    const id = new URL(route.request().url()).searchParams.get("encounterId");
    await route.fulfill({ json: id === nextEncounterId ? encounterContext(nextPatientId, nextEncounterId) : encounterContext() });
  });
  await page.goto(routePath("lab"));
  await expect.poll(() => oldRead).toBe(true);
  await page.getByTestId(`lab-queue-item-live-lab-${nextWorkId}`).click();
  const bar = page.locator("[data-slot='patient-context-bar']");
  await expect(bar).toContainText("합성 다음 환자");
  oldGate.release();
  await expect.poll(() => oldResponseFinished).toBe(true);
  await expect(bar).toContainText("말티즈");
  await expect(bar).not.toContainText("합성 초코");
  await expect(bar).not.toContainText("합성 보호자 상세 메모");
});

for (const mismatchedProfile of ["subject", "workspace", "permission"] as const) {
  test(`profile response ${mismatchedProfile} mismatch is rejected`, async ({ page }) => {
    await grantWorkspaceAccess(page);
    const overview = patientOverview(mismatchedProfile === "subject" ? { id: "97091000-0000-4000-8000-000000000099" }
      : mismatchedProfile === "workspace" ? { workspaceId: "outside-workspace" } : {});
    if (mismatchedProfile === "permission") overview.overview.access.information.allowed = false;
    await installReads(page, "lab", { overview });
    await page.goto(routePath("lab"));
    const bar = page.locator("[data-slot='patient-context-bar']");
    await expect(bar.locator("[data-slot='patient-context-patient']")).toContainText(
      mismatchedProfile === "permission" ? "환자 정보 조회 권한 없음" : "환자 정보 불러오기 실패");
    await expect(bar).not.toContainText("포메라니안");
    await expect(bar.getByRole("button", { name: /프로필 열기/ })).toHaveCount(0);
  });
}

test("the same patient ID in another workspace cannot expose the previous workspace profile while loading", async ({ page }) => {
  const secondaryWorkspaceId = "workspace-context-secondary";
  await grantWorkspaceAccess(page, [workspaceId, secondaryWorkspaceId]);
  await installReads(page, "lab");
  const secondaryGate = createGate();
  let secondaryRead = false;
  await page.route("**/api/workspaces/*/fulfillment/work-items?*", async route => {
    const url = new URL(route.request().url());
    const targetWorkspaceId = url.pathname.split("/")[3];
    await route.fulfill({ json: { ok: true, workItems: url.searchParams.get("queueType") === "lab"
      ? [createWorkItem("lab", { workspaceId: targetWorkspaceId })] : [] } });
  });
  await page.route(`**/api/workspaces/${secondaryWorkspaceId}/customer/patient/${patientId}/profile-overview`, async route => {
    secondaryRead = true;
    await secondaryGate.pending;
    await route.fulfill({ json: patientOverview({ workspaceId: secondaryWorkspaceId, name: "합성 다른 병원 환자", breed: "다른 품종" }, []) });
  });
  await page.goto(routePath("lab"));
  const bar = page.locator("[data-slot='patient-context-bar']");
  await expect(bar).toContainText("합성 초코");
  await page.getByTestId("workspace-switcher").click();
  await page.getByRole("option", { name: /합성 병원 2/ }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${secondaryWorkspaceId}/lab`));
  await expect.poll(() => secondaryRead).toBe(true);
  const pendingPatient = bar.locator("[data-slot='patient-context-patient']");
  await expect(pendingPatient.locator("[data-slot='skeleton']")).toHaveCount(4);
  await expect(pendingPatient.locator('[aria-busy="true"]')).toBeVisible();
  await expect(pendingPatient).not.toContainText("환자 정보 불러오는 중");
  await expect(bar).not.toContainText("합성 초코");
  await expect(bar).not.toContainText("합성 주보호자");
  await expect(bar.getByRole("button", { name: /프로필 열기/ })).toHaveCount(0);
  secondaryGate.release();
  await expect(bar).toContainText("합성 다른 병원 환자");
  await expect(bar).toContainText("다른 품종");
});

test("explicit mock dispensing resolves the selected work item local patient ID", async ({ page }) => {
  await grantWorkspaceAccess(page, ["clair-demo"]);
  const fixtureId = "fulfill-order-coco-maropitant";
  await page.route("**/api/workspaces/clair-demo/fulfillment/work-items?*", async route => {
    const requestedType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: requestedType === "dispensing" ? [createWorkItem("dispensing", {
      id: fixtureId, workspaceId: "clair-demo", patientId: "patient-coco", encounterId: "encounter-coco-260501",
      sourceSnapshot: { patientName: "코코", guardianName: "이지은", orderDisplayName: "합성 조제 업무" },
    })] : [] } });
  });
  await page.route("**/api/workspaces/*/patient-vitals/latest?*", route => route.fulfill({ json: { ok: true, status: 200, canWriteVitals: false, vital: null } }));
  await page.goto(`/w/clair-demo/dispensing?date=2026-05-01&workItemId=${fixtureId}&encounterId=encounter-coco-260501&modulePanel=open&aside=closed&right=closed`);
  const bar = page.locator("[data-slot='patient-context-bar']");
  await expect(bar.locator("[data-slot='patient-context-patient']")).toContainText(/코코.*코리안숏헤어.*중성화·암컷.*8세/);
  await expect(bar.locator("[data-slot='patient-context-guardian']")).toContainText(/이지은\(주보호자\).*010-/);
  await expect(bar.getByRole("button", { name: "환자메모 메모 보기" })).toHaveAttribute("title", /세팔로스포린.*낯선 사람.*심잡음/);
  await expect(bar.getByRole("button", { name: "방문목적 메모 보기" })).not.toBeDisabled();
});
