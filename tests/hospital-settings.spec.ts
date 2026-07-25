import { expect, test, type Page } from "@playwright/test";

const profile = {
  workspaceId: "clair-demo",
  name: "테스트 동물병원",
  representativeName: "홍길동",
  address: "서울시 테스트구 123",
  countryCode: "KR",
  timezone: "Asia/Seoul",
  contact: {
    phone: "02-1111-2222",
    fax: "02-1111-2223",
    homepage: "",
    instagram: "",
    customerGuideMemo: "기존 안내",
  },
  logo: { hasCustomLogo: false, url: null },
  revision: 1,
  profileComplete: true,
  pendingChangeRequest: null,
};

async function mockProfile(page: Page) {
  let revision = profile.revision;
  let contact = { ...profile.contact };
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/settings/profile",
    async (route) => {
      if (route.request().method() === "PATCH") {
        const input = route.request().postDataJSON() as {
          contact: typeof contact;
        };
        contact = { ...input.contact };
        revision += 1;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          profile: { ...profile, contact, revision },
        }),
      });
    },
  );
}

test("hospital settings navigation opens three independent grouped screens", async ({
  page,
}) => {
  await mockProfile(page);
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await expect(
    sidePanel.locator('[data-emr-module-list-group-label="true"]'),
  ).toHaveText(["병원 설정", "조직 및 접근", "진료 카탈로그"]);

  const routes = [
    ["병원 기본 설정", "settings", "hospital-admin-settings-screen"],
    [
      "연락처 및 채널",
      "settings-contact",
      "hospital-admin-settings-contact-screen",
    ],
    [
      "운영시간 관리",
      "settings-hours",
      "hospital-admin-settings-hours-screen",
    ],
  ] as const;

  for (const [label, section, testId] of routes) {
    await sidePanel.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`section=${section}`));
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(
      page.getByTestId(testId).getByRole("heading", { level: 1, name: label }),
    ).toBeVisible();
    await expect(page.getByTestId(testId).locator('[aria-label="breadcrumb"]')).toHaveCount(0);
  }

  await expect(
    sidePanel.getByRole("button", { name: "공간 관리", exact: true }),
  ).toBeEnabled();
  await expect(
    sidePanel.getByRole("button", { name: "바이탈 관리", exact: true }),
  ).toBeEnabled();
});

test("operating days have one state source and exceptions guard navigation", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/orders?modulePanel=open&section=settings-hours",
  );

  const screen = page.getByTestId("hospital-admin-settings-hours-screen");
  const operatingDays = screen.getByRole("group", { name: "운영 요일" });
  await expect(operatingDays.getByRole("button")).toHaveCount(7);
  await expect(screen.getByRole("switch")).toHaveCount(0);

  const sunday = screen.getByTestId("hospital-settings-day-sunday");
  await expect(
    sunday.getByRole("button", { name: "일요일 운영시간 설정" }),
  ).toBeDisabled();
  await expect(sunday).toContainText("휴무");

  await screen
    .getByTestId("hospital-settings-day-monday")
    .getByRole("button", { name: "월요일 운영시간 설정" })
    .click();
  const timeDialog = page.getByRole("dialog", {
    name: "월요일 운영시간 설정",
  });
  await expect(timeDialog.getByRole("combobox")).toHaveCount(4);
  await expect(timeDialog.getByRole("switch")).toHaveCount(0);
  await timeDialog.getByRole("button", { name: "취소" }).click();

  await screen.getByRole("button", { name: "예외 일정 추가" }).click();
  const exceptionDialog = page.getByRole("dialog", { name: "예외 일정 추가" });
  await exceptionDialog.getByLabel("날짜").fill("2026-07-14");
  await exceptionDialog.getByRole("button", { name: "추가" }).click();
  await expect(
    page.getByTestId("hospital-settings-exception-2026-07-14"),
  ).toContainText("휴무");

  await page.getByTestId("hospital-admin-menu-roles").click();
  await expect(
    page.getByRole("dialog", { name: "저장하지 않은 변경사항이 있습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(screen).toBeVisible();
});

test("contact memo saves through the profile API and stays multiline", async ({
  page,
}) => {
  await mockProfile(page);
  await page.goto(
    "/w/clair-demo/orders?modulePanel=open&section=settings-contact",
  );

  const screen = page.getByTestId("hospital-admin-settings-contact-screen");
  const memo = screen.getByLabel("고객 안내 메모");
  await expect(memo).toHaveAttribute("rows", "5");
  await memo.fill("변경된 방문 안내");
  await screen
    .getByTestId("hospital-settings-change-bar")
    .getByRole("button", { name: "변경사항 저장" })
    .click();

  await expect(
    page.getByText("연락처 및 채널 정보가 저장되었습니다."),
  ).toBeVisible();
  await expect(memo).toHaveValue("변경된 방문 안내");
  await expect(screen.getByTestId("hospital-settings-change-bar")).toBeHidden();
});

test("hospital basic settings matches CDS V2 geometry and stays usable at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockProfile(page);
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");

  const screen = page.getByTestId("hospital-admin-settings-screen");
  await expect(
    screen.getByRole("heading", { level: 1, name: "병원 기본 설정" }),
  ).toBeVisible();
  await expect(screen.getByRole("textbox")).toHaveCount(0);
  await expect(screen.getByLabel("병원명")).toHaveText("테스트 동물병원");
  await expect(screen.getByLabel("대표자/원장명")).toHaveText("홍길동");
  await expect(screen.getByLabel("주소", { exact: true })).toHaveText(
    "서울시 테스트구 123",
  );
  await expect(screen.getByLabel("시간대", { exact: true })).toHaveText(
    "Asia/Seoul (UTC+09:00)",
  );
  await expect(screen.getByLabel("지역", { exact: true })).toHaveText(
    "대한민국",
  );

  const figmaMetrics = await screen.evaluate((root) => {
    const required = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const box = (selector: string) => required(selector).getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const mainBox = box("main");
    const headerBox = box("main > header");
    const firstSectionBox = box("main > section");

    return {
      mainWidth: Math.round(mainBox.width),
      contentTop: Math.round(headerBox.top - rootBox.top),
      headerHeight: Math.round(headerBox.height),
      headerGap: Math.round(firstSectionBox.top - headerBox.bottom),
      sectionTitleHeight: Math.round(box("#hospital-profile-title").height),
      profileCardWidth: Math.round(
        box('[data-testid="hospital-profile-card"]').width,
      ),
      profileCardHeight: Math.round(
        box('[data-testid="hospital-profile-card"]').height,
      ),
      regionCardHeight: Math.round(
        box('[data-testid="hospital-region-card"]').height,
      ),
      rowHeight: Math.round(
        box('[data-testid="hospital-settings-row-name"]').height,
      ),
      logoSize: Math.round(
        box('[data-testid="hospital-logo-trigger"]').width,
      ),
      copyButtonSize: Math.round(
        required(
          '[data-testid="hospital-settings-row-address"] button',
        ).getBoundingClientRect().width,
      ),
      requestButtonHeight: Math.round(
        required(
          '[data-testid="hospital-settings-row-change-request"] button',
        ).getBoundingClientRect().height,
      ),
    };
  });

  expect(figmaMetrics).toEqual({
    mainWidth: 920,
    contentTop: 57,
    headerHeight: 92,
    headerGap: 16,
    sectionTitleHeight: 52,
    profileCardWidth: 920,
    profileCardHeight: 425,
    regionCardHeight: 170,
    rowHeight: 85,
    logoSize: 44,
    copyButtonSize: 28,
    requestButtonHeight: 32,
  });

  await screen.getByRole("button", { name: "주소 복사" }).click();
  await expect(
    screen.getByRole("button", { name: "주소 복사" }),
  ).toHaveAttribute("data-copy-state", "succeeded");
  await expect(page.getByText("주소가 복사되었습니다.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      screen.evaluate(
        (element) =>
          element.scrollWidth <= document.documentElement.clientWidth &&
          element.querySelector("main")!.scrollWidth <=
            element.querySelector("main")!.clientWidth,
      ),
    )
    .toBe(true);
  await expect(screen.getByRole("button", { name: "주소 복사" })).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "병원 정보 변경 요청" }),
  ).toBeVisible();
});

test("hospital profile recovers from read errors and exposes empty and denied states", async ({
  page,
}) => {
  let phase: "error" | "empty" | "denied" = "error";
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/settings/profile",
    async (route) => {
      if (phase === "error") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "profile_read_failed" }),
        });
        return;
      }
      if (phase === "denied") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "forbidden" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          profile: {
            ...profile,
            representativeName: null,
            address: null,
            profileComplete: false,
          },
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");
  const screen = page.getByTestId("hospital-admin-settings-screen");
  await expect(
    screen.getByText("병원 정보를 불러오지 못했습니다."),
  ).toBeVisible();

  phase = "empty";
  await screen.getByRole("button", { name: "다시 시도" }).click();
  await expect(screen.getByLabel("대표자/원장명")).toHaveText(
    "등록된 대표자/원장 정보가 없습니다.",
  );
  await expect(screen.getByLabel("주소", { exact: true })).toHaveText(
    "등록된 주소가 없습니다.",
  );
  await expect(
    screen.getByRole("button", { name: "주소 복사" }),
  ).toBeDisabled();

  phase = "denied";
  await page.reload();
  await expect(
    screen.getByText("병원 정보를 볼 권한이 없습니다."),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "다시 시도" }),
  ).toHaveCount(0);
});

test("registered information request posts and renders pending state", async ({
  page,
}) => {
  await mockProfile(page);
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/settings/profile-change-requests",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        fields: ["hospital_name"],
        detail: "사업자 등록증과 동일하게 변경해 주세요.",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          request: {
            id: "request-1",
            fields: ["hospital_name"],
            status: "pending",
            createdAt: "2026-07-23T00:00:00.000Z",
          },
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");
  const screen = page.getByTestId("hospital-admin-settings-screen");
  await screen.getByRole("button", { name: "병원 정보 변경 요청" }).click();
  const dialog = page.getByRole("dialog", {
    name: "병원 등록 정보 변경 요청",
  });
  await dialog.getByRole("checkbox", { name: "병원명" }).click();
  await dialog
    .getByLabel("변경 내용 및 사유")
    .fill("사업자 등록증과 동일하게 변경해 주세요.");
  await dialog.getByRole("button", { name: "변경 요청 제출" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("변경 요청이 접수되었습니다.")).toBeVisible();
  await expect(screen.getByText("운영팀 확인 대기 중")).toBeVisible();
});

test("hospital logo hover editor validates files and restores focus", async ({
  page,
}) => {
  await mockProfile(page);
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");

  const screen = page.getByTestId("hospital-admin-settings-screen");
  const editButton = screen.getByRole("button", { name: "병원 로고 편집" });
  await expect(
    screen
      .getByTestId("hospital-logo-trigger")
      .locator('[data-slot="avatar-fallback"] svg')
  ).toBeVisible();
  await expect(screen.getByTestId("hospital-logo-trigger")).not.toContainText(
    "VIP"
  );
  await expect(editButton).toHaveCSS("opacity", "0");
  await editButton.hover();
  await expect(editButton).toHaveCSS("opacity", "1");
  await editButton.click();

  const dialog = page.getByRole("dialog", { name: "병원 로고 설정" });
  await expect(
    dialog.locator('[data-slot="avatar-fallback"] svg')
  ).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(editButton).toBeFocused();

  await editButton.click();
  await dialog.getByLabel("로고 파일").setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("지원하지 않는 로고 파일 형식입니다."),
  ).toBeVisible();

  await dialog
    .getByLabel("로고 파일")
    .setInputFiles("public/pwa-icon-512.png");
  await dialog.getByRole("button", { name: "로고 적용" }).click();
  await expect(
    page.getByText("로고 변경사항이 저장 대기 중입니다."),
  ).toBeVisible();
  await expect(screen.getByTestId("hospital-settings-change-bar")).toBeVisible();
});
