import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";
import { getCurrentOperatingDate } from "../src/lib/emr-domain/demo-date";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
const patientId = "97092000-0000-4000-8000-000000000001";
const guardianId = "97092000-0000-4000-8000-000000000002";
const encounterId = "97092000-0000-4000-8000-000000000003";
const workItemId = "97092000-0000-4000-8000-000000000004";
const measurementId = "97092000-0000-4000-8000-000000000005";
type ContextSurface = "chart" | "dispensing";

async function prepareContext(page: Page, options: {
  canWrite?: boolean;
  onQueueRead?: () => Promise<void>;
  emptyQueue?: boolean;
  workStatus?: "in_progress" | "completed";
} = {}) {
  const canWrite = options.canWrite ?? true;
  const measuredAt = new Date().toISOString();
  const patient = {
    id: patientId, workspaceId, patientNo: "P-VITAL-CONTEXT", name: "합성 바이탈 환자",
    species: "dog", breed: "푸들", estimatedAgeText: "4세", sex: "male", neutered: true,
    status: "active", handlingCautionLocked: false, createdAt: measuredAt, updatedAt: measuredAt,
  };
  const guardian = { id: guardianId, workspaceId, name: "합성 바이탈 보호자", mobilePhone: "010-0000-0000", createdAt: measuredAt, updatedAt: measuredAt };
  const encounter = {
    id: encounterId, workspaceId, patientId, guardianId, encounterNo: "E-VITAL-CONTEXT",
    primaryVeterinarianId: "97092000-0000-4000-8000-000000000006", status: "in_consultation",
    receptionType: "walk_in", visitPurpose: "합성 바이탈 확인", checkedInAt: measuredAt,
    startedAt: measuredAt, createdAt: measuredAt, updatedAt: measuredAt,
  };
  let measurement = { id: measurementId, patientId, encounterId, measuredAt, createdAt: measuredAt,
    updatedAt: measuredAt, recordedByName: "합성 수의사", weightKg: 12, temperatureC: 38.2 };
  const latestReads: string[] = [];
  const historyReads: string[] = [];
  const writes: Array<{ method: string; body: Record<string, unknown> }> = [];

  await page.addInitScript(([storageKey, id]) => {
    window.localStorage.setItem(storageKey, JSON.stringify({ currentWorkspaceId: id,
      workspaces: [{ id, displayName: "합성 바이탈 병원", representativeName: "합성 관리자",
        contactEmail: "admin@vital-context.test", contactPhone: null, subscriptionStatus: "trialing",
        createdBySessionId: "playwright-default-session", createdAt: "2026-10-01T00:00:00Z" }],
      memberships: [{ id: "vital-context-membership", workspaceId: id, userSessionId: "playwright-default-session",
        displayName: "합성 관리자", email: "admin@vital-context.test", roles: ["hospital_admin"], status: "active",
        createdAt: "2026-10-01T00:00:00Z", activatedAt: "2026-10-01T00:00:00Z" }],
      invitations: [], updatedAt: "2026-10-01T00:00:00Z",
    }));
    window.sessionStorage.removeItem("clair-emr:chart-live-encounter-handoffs:v1");
  }, [SESSION_WORKSPACES_STORAGE_KEY, workspaceId] as const);

  await page.route(`**/api/workspaces/${workspaceId}/chart/live-queue?*`, async route => {
    await options.onQueueRead?.();
    return route.fulfill({ json: {
    ok: true, status: 200, enforcedBy: "chart-live-queue-read", queue: options.emptyQueue ? [] : [{ encounter, patient, primaryGuardian: guardian,
      veterinarianName: "합성 수의사", queueEntry: { id: "vital-context-queue", workspaceId, encounterId,
        queueType: "consultation", status: "in_progress", priority: "normal", sortOrder: 1, enteredAt: measuredAt } }],
  } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, route => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    return route.fulfill({ json: { ok: true, workItems: queueType === "dispensing" ? [{
      id: workItemId, workspaceId, patientId, encounterId, orderId: workItemId, queueType: "dispensing",
      requestCycle: 1, rowRevision: 1, status: options.workStatus ?? "in_progress", createdAt: measuredAt, updatedAt: measuredAt,
      sourceSnapshot: { patientName: patient.name, guardianName: guardian.name, orderDisplayName: "합성 조제 업무", requestingVetName: "합성 수의사" },
    }] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, route => route.fulfill({ json: {
    ok: true, overview: { subjectId: patientId, subjectType: "patient", profile: patient,
      relationships: { guardians: [{ ...guardian, isPrimary: true, relationship: "주보호자" }] },
      access: { information: { allowed: true, requiredPermission: "patient:view" } } },
  } }));
  await page.route(`**/api/workspaces/${workspaceId}/customer/guardian/${guardianId}/profile-overview`, route => route.fulfill({ json: {
    ok: true, overview: { subjectId: guardianId, subjectType: "guardian", profile: guardian,
      relationships: { patients: [patient] }, access: { information: { allowed: true, requiredPermission: "patient:view" } } },
  } }));
  await page.route(`**/api/workspaces/${workspaceId}/chart/preconsultation-context?*`, route => route.fulfill({ json: {
    ok: true, status: 200, canWriteVitals: canWrite, enforcedBy: "chart-preconsultation-context-read",
    context: { encounter, patient, guardian, queue: { id: "vital-context-queue", status: "in_consultation" }, priorEncounterCount: 0, vitals: [], history: [] },
  } }));
  await page.route(`**/api/workspaces/${workspaceId}/vital-settings`, route => route.fulfill({ json: createDefaultWorkspaceVitalSettingsSnapshot(false) }));
  await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/latest?*`, route => {
    latestReads.push(route.request().url());
    return route.fulfill({ json: { ok: true, status: 200, canWriteVitals: canWrite,
      enforcedBy: "patient-latest-vital-read", vital: measurement,
      summary: { values: { weightKg: measurement.weightKg, temperatureC: measurement.temperatureC },
        measuredAtByField: { weightKg: measurement.measuredAt, temperatureC: measurement.measuredAt } },
    } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/history**`, route => {
    const request = route.request();
    if (request.method() === "GET") {
      historyReads.push(request.url());
      return route.fulfill({ json: { ok: true, measurements: [measurement], nextCursor: null,
        canWriteVitals: canWrite, patient: { species: patient.species, weightKg: measurement.weightKg } } });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    writes.push({ method: request.method(), body });
    measurement = { ...measurement, weightKg: (body.vitals as { weightKg: number }).weightKg,
      updatedAt: new Date().toISOString() };
    return route.fulfill({ json: { ok: true, vital: measurement } });
  });
  return { latestReads, historyReads, writes, initialUpdatedAt: measuredAt };
}

async function openContext(page: Page, surface: ContextSurface) {
  const date = getCurrentOperatingDate();
  const pathname = surface === "chart" ? "treatment" : "dispensing";
  const selected = surface === "dispensing" ? `&workItemId=${workItemId}` : "";
  await page.goto(`/w/${workspaceId}/${pathname}?date=${date}&encounterId=${encounterId}${selected}&modulePanel=closed&aside=closed&right=closed`);
  const bar = page.locator('[data-slot="patient-context-bar"]');
  await expect(bar.locator('[data-slot="patient-context-patient"]')).toContainText("합성 바이탈 환자");
  await expect(bar.locator('[data-slot="patient-context-vitals"]')).toContainText("12.00 kg");
  await bar.locator('[data-slot="patient-context-vitals"]').hover();
  return { bar, action: bar.getByRole("button", { name: "오늘 바이탈 수정" }) };
}

for (const surface of ["chart", "dispensing"] as const) {
  test(`${surface} context opens the current vital history and updates the exact selected measurement`, async ({ page }) => {
    const reads = await prepareContext(page);
    const { bar, action } = await openContext(page, surface);
    await expect(action).not.toHaveAttribute("aria-disabled", "true");
    await action.click();
    const dialog = page.getByRole("dialog", { name: "바이탈 이력", exact: true });
    await expect(dialog.getByLabel("체중", { exact: true })).toHaveValue("12");
    expect(reads.historyReads.length).toBeGreaterThan(0);
    for (const url of [...reads.latestReads, ...reads.historyReads]) {
      const request = new URL(url);
      expect(request.pathname).toContain(`/workspaces/${workspaceId}/patient-vitals/`);
      expect(request.searchParams.get("encounterId")).toBe(encounterId);
      expect(request.searchParams.has("patientId")).toBe(false);
    }
    await dialog.getByLabel("체중", { exact: true }).fill("12.34");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect.poll(() => reads.writes.length).toBe(1);
    expect(reads.writes[0]).toMatchObject({ method: "PATCH", body: {
      encounterId, measurementId, expectedUpdatedAt: reads.initialUpdatedAt, vitals: { weightKg: 12.34 },
    } });
    await expect(bar.locator('[data-slot="patient-context-vitals"]')).toContainText("12.34 kg");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "바이탈 이력 닫기" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test(`${surface} context denies vital launch without write permission`, async ({ page }) => {
    const reads = await prepareContext(page, { canWrite: false });
    const { action } = await openContext(page, surface);
    await expect(action).toHaveAttribute("aria-disabled", "true");
    await expect(action).toHaveAccessibleDescription("바이탈을 입력할 권한이 없어요.");
    action.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await action.click({ force: true });
    await expect(page.getByRole("dialog", { name: "바이탈 이력", exact: true })).toHaveCount(0);
    expect(reads.historyReads).toHaveLength(0);
    expect(reads.writes).toHaveLength(0);
  });
}

test("completed dispensing context keeps vital launch disabled despite write permission", async ({ page }) => {
  const reads = await prepareContext(page, { workStatus: "completed" });
  const { action } = await openContext(page, "dispensing");
  await expect(action).toHaveAttribute("aria-disabled", "true");
  await expect(action).toHaveAccessibleDescription("진료가 끝난 접수의 바이탈은 여기서 수정할 수 없어요.");
  await action.click({ force: true });
  await expect(page.getByRole("dialog", { name: "바이탈 이력", exact: true })).toHaveCount(0);
  expect(reads.historyReads).toHaveLength(0);
});


test("chart shows the shared skeleton only before its first queue data arrives and retains loaded identity during refresh", async ({ page }) => {
  let releaseQueue = () => {};
  let queueReads = 0;
  await prepareContext(page, { onQueueRead: () => {
    queueReads += 1;
    return new Promise<void>(resolve => { releaseQueue = resolve; });
  } });
  await page.goto(`/w/${workspaceId}/treatment?date=${getCurrentOperatingDate()}&encounterId=${encounterId}&modulePanel=closed&aside=closed&right=closed`);
  const bar = page.locator('[data-slot="patient-context-bar"]');
  await expect.poll(() => queueReads).toBe(1);
  await expect(bar.locator('[data-slot="patient-context-patient"] [data-slot="skeleton"]')).toHaveCount(2);
  await expect(bar.locator('[aria-busy="true"]').first()).toBeVisible();
  await expect(bar.getByRole("button", { name: /환자 프로필 열기/ })).toHaveCount(0);
  const initialHeight = await bar.evaluate(element => element.getBoundingClientRect().height);
  releaseQueue();
  await expect(bar.getByRole("button", { name: "합성 바이탈 환자 환자 프로필 열기", exact: true })).toBeVisible();
  await expect(bar.locator('[data-slot="patient-context-patient"] [data-slot="skeleton"]')).toHaveCount(0);
  await expect.poll(() => bar.evaluate(element => element.getBoundingClientRect().height)).toBe(initialHeight);

  await page.getByRole("button", { name: "진료 대기열 새로고침", exact: true }).click();
  await expect.poll(() => queueReads).toBe(2);
  await expect(bar.locator('[data-slot="patient-context-patient"]')).toContainText("합성 바이탈 환자");
  await expect(bar.locator('[data-slot="patient-context-patient"] [data-slot="skeleton"]')).toHaveCount(0);
  releaseQueue();
});

test("chart clears the initial skeleton when a completed queue read has no selected record", async ({ page }) => {
  let releaseQueue: (() => void) | undefined;
  await prepareContext(page, { emptyQueue: true, onQueueRead: () => new Promise<void>(resolve => { releaseQueue = resolve; }) });
  await page.goto(`/w/${workspaceId}/treatment?date=${getCurrentOperatingDate()}&encounterId=${encounterId}&modulePanel=closed&aside=closed&right=closed`);
  const bar = page.locator('[data-slot="patient-context-bar"]');
  await expect(bar.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await expect.poll(() => Boolean(releaseQueue)).toBe(true);
  releaseQueue?.();
  await expect(bar).toHaveCount(0);
});
