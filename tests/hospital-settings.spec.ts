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

test("hospital logo hover editor validates files and restores focus", async ({
  page,
}) => {
  await mockProfile(page);
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");

  const screen = page.getByTestId("hospital-admin-settings-screen");
  const editButton = screen.getByRole("button", { name: "병원 로고 편집" });
  await expect(editButton).toHaveCSS("opacity", "0");
  await editButton.hover();
  await expect(editButton).toHaveCSS("opacity", "1");
  await editButton.click();

  const dialog = page.getByRole("dialog", { name: "병원 로고 설정" });
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
