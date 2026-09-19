import { expect, test, type Page } from "@playwright/test";

const patientProfileRoute =
  "/w/clair-demo/treatment?modulePanel=open&aside=closed&drawer=patient%3Apatient-coco";

async function openPatientReceptionMenu(page: Page) {
  await page.getByRole("button", { name: "접수/예약" }).click();
}

async function mockWalkInCreateSuccess(page: Page) {
  let count = 0;
  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      count += 1;
      const input = route.request().postDataJSON() as Record<string, unknown>;
      const checkedInAt = "2026-05-01T11:20:00+09:00";
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          walkIn: {
            encounter: {
              id: "encounter-patient-profile-walk-in",
              workspaceId: "clair-demo",
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              encounterNo: "E-PROFILE-001",
              receptionType: "walk_in",
              department: input.department,
              durationMinutes: input.durationMinutes,
              visitPurpose: input.visitPurpose,
              chiefComplaint: input.visitPurpose,
              status: "waiting",
              checkedInAt,
              createdAt: checkedInAt,
              updatedAt: checkedInAt,
            },
            queueEntry: {
              id: "queue-patient-profile-walk-in",
              workspaceId: "clair-demo",
              encounterId: "encounter-patient-profile-walk-in",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: checkedInAt,
            },
          },
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );
  return () => count;
}

test("patient profile starts a preselected walk-in in the same right-panel slot", async ({
  page,
}) => {
  await page.goto(patientProfileRoute);

  const originalPathname = new URL(page.url()).pathname;
  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();

  await expect.poll(() => new URL(page.url()).pathname).toBe(originalPathname);
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page.getByTestId("walk-in-reception-dialog")).toBeVisible();
  await expect(page.getByTestId("workspace-right-panel")).toContainText("접수 생성");
  await expect(page.getByRole("textbox", { name: "환자 검색" })).toHaveValue(
    /코코.*이지은/,
  );
  await expect(page.getByRole("textbox", { name: "보호자명" })).toHaveValue(
    /이지은.*010-3245-1188/,
  );
});

test("clean cancel restores the same patient profile tab", async ({ page }) => {
  await page.goto(patientProfileRoute);
  await page.getByRole("tab", { name: "예약" }).click();

  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();
  await page.getByRole("button", { name: "취소" }).click();

  await expect(page.getByTestId("profile-side-panel")).toBeVisible();
  await expect(page.getByRole("tab", { name: "예약" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("dirty walk-in asks before discarding and keeps the draft when continued", async ({
  page,
}) => {
  await page.goto(patientProfileRoute);
  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();

  const purpose = page.getByRole("textbox", { name: "방문목적" });
  await purpose.fill("기침 재진");
  await page.getByRole("button", { name: "취소" }).click();

  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(purpose).toHaveValue("기침 재진");

  await page.getByRole("button", { name: "취소" }).click();
  await confirm.getByRole("button", { name: "나가기" }).click();
  await expect(page.getByTestId("profile-side-panel")).toBeVisible();
});

test("dirty header close uses the same discard guard", async ({ page }) => {
  await page.goto(patientProfileRoute);
  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();

  const purpose = page.getByRole("textbox", { name: "방문목적" });
  await purpose.fill("헤더 닫기 초안");
  await page.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();

  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성" }).click();
  await expect(purpose).toHaveValue("헤더 닫기 초안");
});

test("patient profile starts a preselected reservation in the same right-panel slot", async ({
  page,
}) => {
  await page.goto(patientProfileRoute);

  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "예약하기" }).click();

  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page.getByTestId("reservation-create-drawer")).toBeVisible();
  await expect(page.getByTestId("workspace-right-panel")).toContainText("예약 생성");
  await expect(page.getByRole("textbox", { name: "환자 검색" })).toHaveValue(
    /코코.*이지은/,
  );
  await expect(page.getByRole("textbox", { name: "보호자명" })).toHaveValue(
    /이지은.*010-3245-1188/,
  );
});

test("successful walk-in keeps the current module and shows detail in the same slot", async ({
  page,
}) => {
  const getCreateCount = await mockWalkInCreateSuccess(page);
  await page.goto(patientProfileRoute);
  const originalPathname = new URL(page.url()).pathname;

  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();
  const form = page.getByTestId("walk-in-reception-dialog");
  await form.getByRole("textbox", { name: "방문목적" }).fill("심잡음 재진");
  await page
    .getByTestId("workspace-right-panel")
    .getByRole("button", { name: "생성", exact: true })
    .click();

  await expect.poll(getCreateCount).toBe(1);
  await expect(page.getByText("접수가 완료되었습니다")).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe(originalPathname);
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page.getByTestId("workspace-right-panel")).toContainText("접수 상세");
  await expect(page.getByTestId("workspace-right-panel")).toContainText("심잡음 재진");

  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByTestId("profile-side-panel")).toBeVisible();
});

test("walk-in failure preserves the draft for retry", async ({ page }) => {
  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 500, error: "db_write_failed" }),
      });
    },
  );
  await page.goto(patientProfileRoute);

  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "접수하기" }).click();
  const form = page.getByTestId("walk-in-reception-dialog");
  const purpose = form.getByRole("textbox", { name: "방문목적" });
  await purpose.fill("실패 후 재시도");
  await page
    .getByTestId("workspace-right-panel")
    .getByRole("button", { name: "생성", exact: true })
    .click();

  await expect(
    page.getByText(
      "접수를 만들지 못했어요. 입력값은 그대로 두었어요. 다시 시도해 주세요.",
    ),
  ).toBeVisible();
  await expect(form).toBeVisible();
  await expect(purpose).toHaveValue("실패 후 재시도");
});

test("successful reservation keeps patient context and opens reservation detail", async ({
  page,
}) => {
  let createCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day**",
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments",
    async (route) => {
      createCount += 1;
      const input = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          appointment: {
            id: "appointment-patient-profile",
            workspaceId: "clair-demo",
            patientId: input.patientId,
            guardianId: input.guardianId,
            assignedVeterinarianId: input.assignedVeterinarianId,
            scheduledStartAt: input.scheduledStartAt,
            scheduledEndAt: "2026-05-01T11:30:00+09:00",
            visitPurpose: input.reservationMemo,
            symptomNote: input.reservationMemo,
            status: "confirmed",
            createdByUserId: "user-front-desk",
            createdAt: "2026-05-01T08:55:00+09:00",
            updatedAt: "2026-05-01T08:55:00+09:00",
          },
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );
  await page.goto(patientProfileRoute);

  await openPatientReceptionMenu(page);
  await page.getByRole("menuitem", { name: "예약하기" }).click();
  const form = page.getByTestId("reservation-create-drawer");
  await form.getByRole("textbox", { name: "예약 메모" }).fill("정기 심장 검진");
  await page
    .getByTestId("workspace-right-panel")
    .getByRole("button", { name: "생성", exact: true })
    .click();

  await expect.poll(() => createCount).toBe(1);
  await expect(page.getByText("예약이 완료되었습니다")).toBeVisible();
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(page.getByTestId("workspace-right-panel")).toContainText("예약 상세");
  await expect(page.getByTestId("workspace-right-panel")).toContainText("정기 심장 검진");
});
