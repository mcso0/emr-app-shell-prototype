import { expect, test } from "@playwright/test";

test("day calendar compresses non-business rows and keeps business quarters at 36px", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  const offHour = page.getByTestId("day-hour-row-0");
  const businessHour = page.getByTestId("day-hour-row-9");
  await expect(offHour).toBeVisible();
  await expect(businessHour).toBeVisible();
  expect(
    await offHour.evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(72);
  expect(
    await businessHour.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBe(144);
  expect(
    await page
      .getByTestId("day-empty-slot-9-user-vet-suji-slot-0900")
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(36);
});
test("calendar compact task contract is 36px high with 8px inset", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      height: styles
        .getPropertyValue("--emr-calendar-task-compact-height")
        .trim(),
      paddingX: styles.getPropertyValue("--emr-calendar-task-padding-x").trim(),
      paddingY: styles.getPropertyValue("--emr-calendar-task-padding-y").trim(),
    };
  });
  expect(tokens).toEqual({ height: "36px", paddingX: "8px", paddingY: "8px" });
});
test("calendar header displays the effective operating hours", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/*/reception/calendar/day?**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date: "2026-05-01",
          records: [],
          operatingSchedule: {
            date: "2026-05-01",
            timezone: "Asia/Seoul",
            isOpen: true,
            source: "exception",
            treatmentStart: "08:00",
            treatmentEnd: "20:00",
            breakStart: "12:00",
            breakEnd: "13:00",
          },
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  await expect(
    page.getByTestId("reception-business-hours-badge"),
  ).toContainText("08:00-20:00");
});

test("day calendar renders the effective break as a selectable hatched band", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?date=2026-05-01");

  const breakBand = page.getByTestId("reception-break-time-band");
  await expect(breakBand).toBeVisible();
  await expect(breakBand).toHaveAttribute(
    "aria-label",
    "휴게시간 13:00-14:00",
  );
  expect(
    await breakBand.evaluate((element) =>
      getComputedStyle(element).backgroundImage,
    ),
  ).toContain("27px");
  const labelCenterDelta = await breakBand
    .getByText("휴게시간 13:00-14:00", { exact: true })
    .evaluate((label) => {
      const labelRect = label.getBoundingClientRect();
      const bandRect = label.parentElement?.getBoundingClientRect();
      if (!bandRect) {
        return { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
      }
      return {
        x: Math.abs(
          labelRect.left + labelRect.width / 2 -
            (bandRect.left + bandRect.width / 2),
        ),
        y: Math.abs(
          labelRect.top + labelRect.height / 2 -
            (bandRect.top + bandRect.height / 2),
        ),
      };
    });
  expect(labelCenterDelta.x).toBeLessThanOrEqual(1);
  expect(labelCenterDelta.y).toBeLessThanOrEqual(1);
  await expect(
    page.getByTestId("day-empty-slot-13-user-vet-suji-slot-1300"),
  ).toHaveAttribute("aria-disabled", "false");
});

test("creation stays blocked until the authoritative operating schedule resolves", async ({
  page,
}) => {
  let resolveSchedule: (() => void) | undefined;
  const scheduleGate = new Promise<void>((resolve) => {
    resolveSchedule = resolve;
  });
  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day?**",
    async (route) => {
      await scheduleGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date: "2026-05-01",
          records: [],
          operatingSchedule: {
            date: "2026-05-01",
            timezone: "Asia/Seoul",
            isOpen: true,
            source: "exception",
            treatmentStart: "09:00",
            treatmentEnd: "19:00",
            breakStart: "13:00",
            breakEnd: "14:00",
          },
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/reception?date=2026-05-01&modulePanel=open&drawer=reception-reservation-form%3Anew",
  );
  const panel = page.getByTestId("reception-right-panel");
  await expect(panel).toContainText("운영시간을 확인하는 중입니다.");
  await expect(
    panel.getByRole("button", { name: "생성", exact: true }),
  ).toBeDisabled();

  resolveSchedule?.();
  await expect(panel).not.toContainText("운영시간을 확인하는 중입니다.");
  await panel.getByLabel("예약시간").click();
  await expect(
    page.getByRole("option", { name: "13:00 · 휴게시간" }),
  ).toBeVisible();
});

test("break-time walk-in requires confirmation before one create request", async ({
  page,
}) => {
  let createCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createCount += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          walkIn: {
            encounter: {
              id: "encounter-break-warning",
              workspaceId: "clair-demo",
              patientId: body.patientId,
              guardianId: body.guardianId,
              primaryVeterinarianId: body.primaryVeterinarianId,
              encounterNo: "E-BREAK-WARNING",
              receptionType: "walk_in",
              department: body.department,
              durationMinutes: body.durationMinutes,
              chiefComplaint: body.visitPurpose,
              visitPurpose: body.visitPurpose,
              status: "waiting",
              checkedInAt: body.plannedStartAt,
              createdAt: body.plannedStartAt,
              updatedAt: body.plannedStartAt,
            },
            queueEntry: {
              id: "queue-break-warning",
              workspaceId: "clair-demo",
              encounterId: "encounter-break-warning",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: body.plannedStartAt,
            },
          },
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception?date=2026-05-01");
  await page
    .getByTestId("day-empty-slot-13-user-vet-suji-slot-1300")
    .click();
  const drawer = page.getByTestId("walk-in-reception-dialog");
  await drawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await drawer.getByLabel("방문목적").fill("휴게시간 현장 접수");
  const walkInCreateButton = page
    .getByTestId("reception-right-panel")
    .getByRole("button", { name: "생성", exact: true });
  await walkInCreateButton.click();

  const dialog = page.getByRole("dialog", {
    name: "휴게시간이 포함되어 있습니다",
  });
  await expect(dialog).toContainText(
    "선택한 시간에 휴게시간이 포함되어 있습니다. 접수를 진행하시겠습니까?",
  );
  expect(createCount).toBe(0);
  await dialog.getByRole("button", { name: "취소" }).click();
  expect(createCount).toBe(0);

  await walkInCreateButton.click();
  await page
    .getByRole("dialog", { name: "휴게시간이 포함되어 있습니다" })
    .getByRole("button", { name: "접수 진행" })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect.poll(() => createCount).toBe(1);
});

test("break-time reservation requires confirmation before one create request", async ({
  page,
}) => {
  let createCount = 0;
  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments",
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createCount += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          appointment: {
            id: "appointment-break-warning",
            workspaceId: "clair-demo",
            patientId: body.patientId,
            guardianId: body.guardianId,
            assignedVeterinarianId: body.assignedVeterinarianId,
            scheduledStartAt: body.scheduledStartAt,
            scheduledEndAt: "2026-05-01T13:30:00+09:00",
            visitPurpose: body.reservationMemo,
            status: "confirmed",
            createdByUserId: "user-front-desk",
            createdAt: "2026-05-01T11:00:00+09:00",
            updatedAt: "2026-05-01T11:00:00+09:00",
          },
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/reception?date=2026-05-01&modulePanel=open&drawer=reception-reservation-form%3Anew",
  );
  const drawer = page.getByTestId("reservation-create-drawer");
  await drawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await drawer.getByLabel("예약시간").click();
  await page.getByRole("option", { name: "13:00 · 휴게시간" }).click();
  const reservationCreateButton = page
    .getByTestId("reception-right-panel")
    .getByRole("button", { name: "생성", exact: true });
  await reservationCreateButton.click();

  const dialog = page.getByRole("dialog", {
    name: "휴게시간이 포함되어 있습니다",
  });
  await expect(dialog).toContainText(
    "선택한 시간에 휴게시간이 포함되어 있습니다. 예약을 진행하시겠습니까?",
  );
  expect(createCount).toBe(0);
  await dialog.getByRole("button", { name: "취소" }).click();
  expect(createCount).toBe(0);

  await reservationCreateButton.click();
  await page
    .getByRole("dialog", { name: "휴게시간이 포함되어 있습니다" })
    .getByRole("button", { name: "예약 진행" })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect.poll(() => createCount).toBe(1);
});
