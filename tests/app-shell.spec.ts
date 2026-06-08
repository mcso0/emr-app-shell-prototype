import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const fullDemoQuery =
  "scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&imagingStudyId=imaging-kong-abdomen&invoiceId=invoice-kong-260501&modulePanel=open&aside=closed";

async function expectUrlSearchParams(page: Page, expected: Record<string, string>) {
  const url = new URL(page.url());

  for (const [key, value] of Object.entries(expected)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

async function resolveCssColor(page: Page, value: string) {
  return page.evaluate((colorValue) => {
    const probe = document.createElement("span");
    probe.style.color = colorValue;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, value);
}

function expectRect(value: Awaited<ReturnType<ReturnType<Page["locator"]>["boundingBox"]>>): asserts value is NonNullable<typeof value> {
  expect(value).not.toBeNull();
}

async function expectHorizontalGap(page: Page, leftTestId: string, rightTestId: string, expectedGap: number) {
  const leftBox = await page.getByTestId(leftTestId).boundingBox();
  const rightBox = await page.getByTestId(rightTestId).boundingBox();

  expectRect(leftBox);
  expectRect(rightBox);
  expect(Math.round(rightBox.x - (leftBox.x + leftBox.width))).toBe(expectedGap);
}

async function waitForTestIdWidth(page: Page, testId: string, expectedWidth: number) {
  await expect
    .poll(async () => {
      const box = await page.getByTestId(testId).boundingBox();
      return box ? Math.round(box.width) : null;
    })
    .toBe(expectedWidth);
}

async function clearWorkspaceTabs(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.sessionStorage.removeItem("clair-workspace-tabs:v1:clair-demo");
  });
}

function getWorkspaceTablist(page: Page) {
  return page.getByRole("tablist", { name: "열린 업무 탭" });
}

function getNavRail(page: Page) {
  return page.getByRole("navigation");
}

async function expectActiveWorkspaceTab(page: Page, name: string) {
  await expect(getWorkspaceTablist(page).getByRole("tab", { name: new RegExp(name) })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

test("dispensing shell supports panels and drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();

  await page.getByRole("button", { name: "조제 이력 패널 열기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "조제 이력" })).toBeVisible();
  await page.getByRole("button", { name: "조제 이력 패널 열기" }).click();
  await expect(page.getByText("26.04.11")).toBeVisible();
  const contentAside = page.locator("[data-slot='content-aside-panel']");
  await expect(contentAside).toHaveCSS("min-width", "280px");
  await expect(contentAside).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-content-aside-bg)"));
  await expect(contentAside).toHaveCSS("padding-left", "16px");
  const historyGroupTitle = page.getByTestId("history-group-toggle-26.04.11");
  await expect(historyGroupTitle).toHaveCSS("height", "32px");
  await expect(historyGroupTitle).toHaveCSS("padding-left", "4px");
  await expect(historyGroupTitle.locator("svg").first()).toHaveCSS("width", "14px");
  const firstHistoryItem = page.locator("[data-slot='content-history-item']").first();
  await expect(firstHistoryItem).toHaveCSS("border-radius", "6px");
  await expect(firstHistoryItem).toHaveCSS("padding-top", "4px");
  await expect(firstHistoryItem.locator("svg").first()).toHaveCSS("width", "12px");

  await page.getByRole("button", { name: "조제 이력 패널 접기" }).click();
  await page.getByTestId("order-row-section-0-o-10023").click({ position: { x: 100, y: 20 } });
  await expect(page.getByText("상세 정보")).toBeVisible();
  await expect(page.locator('input[value="Atorvastatin 20mg"]')).toBeVisible();

  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeVisible();

  await page.getByTestId("order-queue-item-dispensing-queue-1").click();
  await expect(page.getByRole("heading", { name: "처치 지시서" })).toBeVisible();
  const treatmentHistoryCloseButton = page.getByRole("button", { name: "처치 이력 패널 접기" });
  if (await treatmentHistoryCloseButton.count()) {
    await treatmentHistoryCloseButton.click();
  }
  await page.getByRole("button", { name: "처치 이력 패널 열기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "처치 이력" })).toBeVisible();
});

test("legacy chart route opens treatment shell without tab sync loop", async ({ page }) => {
  await page.goto("/w/clair-demo/chart");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("진료/차트");
  await expect(page.getByText("기본 SOAP")).toBeVisible();
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page).toHaveURL(/right=closed/);
});

test("global command palette searches and opens patient context", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: "전역 통합 검색 열기" }).click();
  await expect(page.getByRole("dialog", { name: "통합 검색과 빠른 실행" })).toBeVisible();
  await expect(page.getByText("빠른 실행", { exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "통합 검색" }).fill("콩이");
  const patientResult = page.getByRole("button", { name: /콩이.*환자/ });
  await expect(patientResult).toBeVisible();
  await patientResult.click();

  await expect(page).toHaveURL(/drawer=reception-patient%3Apatient-kong/);
  await expect(page.getByText("환자 정보")).toBeVisible();
});

test("global notification bell opens right drawer with badge policy count", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const notificationButton = page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ });
  await expect(notificationButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("global-notification-badge")).toHaveText("7");

  await notificationButton.click();

  const drawer = page.getByRole("dialog", { name: "알림" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("중요 알림 7개 · 안 읽음 9개");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("안 읽음 9");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("중요 7");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("두부 처방 조제가 완료되었습니다");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("보리 CBC 검체 재확인을 진행해 주세요");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("루루 수액 처치가 완료되었습니다");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("토리 FUJI DRI-CHEM 결과가 도착했습니다");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("감자 수납 준비가 완료되었습니다");
  await expect(drawer.locator('[data-testid^="global-notification-row-"]')).toHaveCount(9);
  await expect(page).toHaveURL(/\/w\/clair-demo\/reception\?modulePanel=open/);

  await drawer.getByRole("button", { name: "중요 7" }).click();
  await expect(drawer.getByTestId("global-notification-drawer-list")).not.toContainText(
    "두부 처방 조제가 완료되었습니다"
  );

  await drawer.getByRole("button", { name: "알림 닫기" }).click();
  await expect(drawer).toBeHidden();
  await expect(notificationButton).toHaveAttribute("aria-expanded", "false");
});

test("global notification drawer supports read, archive, and restore triage states", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });
  const urgentRow = drawer.getByTestId("global-notification-row-notif-order-urgent-handoff-kong-cbc");

  await expect(urgentRow).toHaveAttribute("data-notification-state", "unread");
  await urgentRow.getByRole("button", { name: "콩이 CBC 재확인이 필요합니다 읽음 처리" }).click();

  await expect(urgentRow).toHaveAttribute("data-notification-state", "read");
  await expect(urgentRow).toContainText("읽음");
  await expect(drawer).toContainText("중요 알림 6개 · 안 읽음 8개");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("안 읽음 8");

  await urgentRow.getByRole("button", { name: "콩이 CBC 재확인이 필요합니다 보관" }).click();
  await expect(drawer.getByTestId("global-notification-drawer-list")).not.toContainText(
    "콩이 CBC 재확인이 필요합니다"
  );
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("보관 2");

  await drawer.getByRole("button", { name: "보관 2" }).click();
  await expect(urgentRow).toHaveAttribute("data-notification-archived", "true");
  await urgentRow.getByRole("button", { name: "콩이 CBC 재확인이 필요합니다 보관 해제" }).click();

  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("보관 1");
  await drawer.getByRole("button", { name: "전체 9" }).click();
  await expect(urgentRow).toHaveAttribute("data-notification-archived", "false");
  await expect(urgentRow).toHaveAttribute("data-notification-state", "read");

  await drawer.getByRole("button", { name: "알림 닫기" }).click();
  await expect(page.getByRole("button", { name: /알림 센터 열기, 중요 알림 6개/ })).toBeVisible();
  await expect(page.getByTestId("global-notification-badge")).toHaveText("6");
});

test("global notification drawer all-read action clears badge-count notifications without archiving rows", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });

  await drawer.getByRole("button", { name: "전체 읽음" }).click();

  await expect(drawer).toContainText("중요 알림 0개 · 안 읽음 0개");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("전체 9");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("안 읽음 0");
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("중요 7");
  await expect(drawer.getByTestId("global-notification-drawer-list")).toContainText("두부 처방 조제가 완료되었습니다");
  await expect(drawer.getByRole("button", { name: "전체 읽음" })).toBeDisabled();

  await drawer.getByRole("button", { name: "알림 닫기" }).click();
  await expect(page.getByTestId("global-notification-badge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "알림 센터 열기" })).toBeVisible();
});

test("global notification drawer persists local read and archive state with contract keys", async ({ page }) => {
  const readStateKey = "clair.notifications.v0.read";
  const archiveStateKey = "clair.notifications.v0.archive";
  const urgentNotificationId = "notif-order-urgent-handoff-kong-cbc";
  const initiallyArchivedNotificationId = "notif-imaging-completed-choco";

  await page.goto("/w/clair-demo/reception?modulePanel=open");
  await page.evaluate(
    ({ readKey, archiveKey }) => {
      window.localStorage.setItem(readKey, JSON.stringify(["missing-notification"]));
      window.localStorage.setItem(archiveKey, "not-json");
    },
    { readKey: readStateKey, archiveKey: archiveStateKey }
  );
  await page.reload();

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });
  const urgentRow = drawer.getByTestId(`global-notification-row-${urgentNotificationId}`);

  await expect(drawer.getByTestId("global-notification-local-state-disclaimer")).toHaveText(
    "v0 역할 큐 알림의 읽음/보관 상태는 현재 브라우저에만 저장됩니다. 다른 사용자나 다른 브라우저와 동기화되지 않습니다."
  );

  await urgentRow.getByRole("button", { name: "콩이 CBC 재확인이 필요합니다 읽음 처리" }).click();
  await urgentRow.getByRole("button", { name: "콩이 CBC 재확인이 필요합니다 보관" }).click();

  await expect
    .poll(async () =>
      page.evaluate(
        ({ readKey, archiveKey }) => ({
          readIds: JSON.parse(window.localStorage.getItem(readKey) ?? "[]"),
          archivedIds: JSON.parse(window.localStorage.getItem(archiveKey) ?? "[]"),
        }),
        { readKey: readStateKey, archiveKey: archiveStateKey }
      )
    )
    .toEqual({
      readIds: [urgentNotificationId],
      archivedIds: [initiallyArchivedNotificationId, urgentNotificationId],
    });

  await page.reload();
  await expect(page.getByRole("button", { name: /알림 센터 열기, 중요 알림 6개/ })).toBeVisible();
  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 6개/ }).click();

  await drawer.getByRole("button", { name: "보관 2" }).click();
  await expect(urgentRow).toHaveAttribute("data-notification-state", "read");
  await expect(urgentRow).toHaveAttribute("data-notification-archived", "true");
});

test("global notification source action navigates the current tab to the source workflow", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });
  const labResultRow = drawer.getByTestId("global-notification-row-notif-lab-result-kong");

  await labResultRow.getByRole("button", { name: "검사 결과 열기" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/lab\?modulePanel=open&labResultId=lab-result-kong-cbc/);
  await expect(drawer).toBeHidden();
});

test("global notification source action confirms before leaving dirty work", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as Window & { __clairSetNotificationNavigationDirty?: (dirty: boolean) => void })
            .__clairSetNotificationNavigationDirty,
      ),
    )
    .toBe("function");
  await page.evaluate(() =>
    (window as Window & { __clairSetNotificationNavigationDirty?: (dirty: boolean) => void })
      .__clairSetNotificationNavigationDirty?.(true),
  );

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });
  const labResultRow = drawer.getByTestId("global-notification-row-notif-lab-result-kong");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?");
    await dialog.dismiss();
  });
  await labResultRow.getByRole("button", { name: "검사 결과 열기" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception\?modulePanel=open/);
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("중요 알림 7개 · 안 읽음 9개");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?");
    await dialog.accept();
  });
  await labResultRow.getByRole("button", { name: "검사 결과 열기" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/lab\?modulePanel=open&labResultId=lab-result-kong-cbc/);
  await expect(drawer).toBeHidden();
});

test("global notification source action shows fallback detail when source is missing", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();
  const drawer = page.getByRole("dialog", { name: "알림" });
  const deviceResultRow = drawer.getByTestId("global-notification-row-notif-device-result-tori-fuji");

  await deviceResultRow.getByRole("button", { name: "장비 결과 열기" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception\?modulePanel=open/);
  await expect(drawer.getByTestId("global-notification-fallback-detail")).toBeVisible();
  await expect(drawer.getByTestId("global-notification-fallback-detail")).toContainText(
    "원본 업무 화면을 열 수 없습니다"
  );
  await expect(drawer.getByTestId("global-notification-fallback-detail")).toContainText(
    "연결된 source entity가 현재 mock fixture에 없습니다"
  );
  await expect(drawer.getByTestId("global-notification-fallback-detail")).toContainText(
    "토리 FUJI DRI-CHEM 결과가 도착했습니다"
  );
  await expect(drawer).toContainText("중요 알림 6개 · 안 읽음 8개");
});

test("global notification drawer fits narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  await page.getByRole("button", { name: /알림 센터 열기, 중요 알림 7개/ }).click();

  const drawer = page.getByRole("dialog", { name: "알림" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "알림 닫기" })).toBeVisible();
  await expect(drawer.getByRole("group", { name: "알림 필터" })).toBeVisible();
  await expect(drawer.getByText("콩이 CBC 재확인이 필요합니다")).toBeVisible();

  const drawerBox = await drawer.boundingBox();
  expectRect(drawerBox);
  expect(Math.round(drawerBox.x)).toBeGreaterThanOrEqual(0);
  expect(Math.round(drawerBox.width)).toBeLessThanOrEqual(390);
});

test("app shell renders workspace switcher in the navigation column when module panel is open", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const tabsBar = page.getByTestId("workspace-tabs-bar");
  const navigationColumn = page.getByTestId("shell-navigation-column");
  const modulePanelArea = page.getByTestId("module-panel-area");
  const workspaceArea = page.getByTestId("shell-workspace-area");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");

  await expect(tabsBar.getByRole("button", { name: "clair-demo 워크스페이스 선택" })).toHaveCount(0);
  await expect(navigationColumn.getByRole("button", { name: "clair-demo 워크스페이스 선택" })).toBeVisible();
  await expect(workspaceSwitcher.getByText("VIP 동물의료센터 청담점")).toBeVisible();
  await expect(page.getByRole("button", { name: "사이드 패널 접기", exact: true })).toBeVisible();

  await expectHorizontalGap(page, "shell-navigation-column", "shell-workspace-area", 10);

  const tabsBox = await tabsBar.boundingBox();
  const navigationBox = await navigationColumn.boundingBox();
  const modulePanelBox = await modulePanelArea.boundingBox();
  const workspaceBox = await workspaceArea.boundingBox();
  const switcherBox = await workspaceSwitcher.boundingBox();
  const switcherMark = workspaceSwitcher.locator('[data-slot="workspace-switcher-mark"]');
  const switcherLabel = workspaceSwitcher.locator('[data-slot="workspace-switcher-label"]');
  const switcherChevron = workspaceSwitcher.locator(":scope > svg");

  expectRect(tabsBox);
  expectRect(navigationBox);
  expectRect(modulePanelBox);
  expectRect(workspaceBox);
  expectRect(switcherBox);
  expect(tabsBox.y).toBe(switcherBox.y);
  expect(Math.round(tabsBox.height)).toBe(32);
  expect(Math.round(switcherBox.height)).toBe(32);
  expect(Math.round(switcherBox.width)).toBeGreaterThanOrEqual(192);
  await expect(switcherLabel).not.toHaveCSS("text-overflow", "ellipsis");
  await expect(switcherLabel).toHaveText("VIP 동물의료센터 청담점");
  await expect(workspaceSwitcher).toHaveCSS("font-size", "14px");
  await expect(workspaceSwitcher).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-workspace-button-bg)"));
  await expect(workspaceSwitcher).toHaveCSS("border-color", await resolveCssColor(page, "var(--emr-workspace-button-border)"));
  await expect(switcherMark).toHaveCSS("width", "18px");
  await expect(switcherMark).toHaveCSS("height", "18px");
  await expect(switcherChevron).toHaveCSS("width", "16px");
  await expect(switcherChevron).toHaveCSS("height", "16px");
  await expect
    .poll(async () => {
      const buttonBox = await workspaceSwitcher.boundingBox();
      const markBox = await switcherMark.boundingBox();
      const chevronBox = await switcherChevron.boundingBox();
      if (!buttonBox || !markBox || !chevronBox) return null;
      return {
        left: Math.round(markBox.x - buttonBox.x),
        right: Math.round(buttonBox.x + buttonBox.width - (chevronBox.x + chevronBox.width)),
      };
    })
    .toEqual({ left: 9, right: 9 });
  expect(switcherBox.width).toBeLessThan(navigationBox.width);
  expect(workspaceBox.y - (tabsBox.y + tabsBox.height)).toBe(10);
  expect(modulePanelBox.y - (switcherBox.y + switcherBox.height)).toBe(10);
  expect(modulePanelBox.height).toBe(workspaceBox.height);
});

test("workspace switcher reads persisted workspace display name from server list", async ({ page }) => {
  await page.route("**/api/workspaces", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        workspaces: [
          {
            id: "persisted-hanbit",
            displayName: "Persisted Hanbit Animal Hospital",
            membershipId: "membership-persisted-hanbit",
            roles: ["hospital_admin"],
            status: "active",
          },
        ],
        enforcedBy: "workspace-membership-reader",
      }),
    });
  });

  await page.goto("/w/persisted-hanbit/reception?modulePanel=open");

  await expect(page.getByTestId("workspace-switcher")).toContainText(
    "Persisted Hanbit Animal Hospital"
  );
});

test("app shell keeps compact workspace switcher and nav rail visible on narrow viewports", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const navigationColumn = page.getByTestId("shell-navigation-column");
  const workspaceArea = page.getByTestId("shell-workspace-area");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");
  const modulePanelArea = page.getByTestId("module-panel-area");

  await expect(navigationColumn).toBeVisible();
  await expect(workspaceSwitcher).toBeVisible();
  await expect(workspaceSwitcher.getByText("VIP 동물의료센터 청담점")).toBeHidden();
  await expect(getNavRail(page).getByRole("link", { name: "홈" })).toBeVisible();
  await expect(page.getByTestId("module-side-panel-title")).toBeHidden();
  await expectHorizontalGap(page, "shell-navigation-column", "shell-workspace-area", 10);

  const navigationBox = await navigationColumn.boundingBox();
  const switcherBox = await workspaceSwitcher.boundingBox();
  const modulePanelBox = await modulePanelArea.boundingBox();
  const workspaceBox = await workspaceArea.boundingBox();

  expectRect(navigationBox);
  expectRect(switcherBox);
  expectRect(modulePanelBox);
  expectRect(workspaceBox);
  expect(Math.round(navigationBox.width)).toBe(56);
  expect(Math.round(switcherBox.width)).toBe(56);
  expect(Math.round(switcherBox.height)).toBe(32);
  expect(Math.round(modulePanelBox.width)).toBe(56);
  expect(workspaceBox.width).toBeGreaterThan(300);
});

test("app shell collapses workspace switcher with the navigation column", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=closed");
  await waitForTestIdWidth(page, "shell-navigation-column", 56);

  const navigationColumn = page.getByTestId("shell-navigation-column");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");
  const workspaceMark = workspaceSwitcher.locator('[data-slot="workspace-switcher-mark"]');
  const workspaceChevron = workspaceSwitcher.locator(":scope > svg");

  await expect(workspaceSwitcher).toBeVisible();
  await expect(workspaceSwitcher.getByText("VIP 동물의료센터 청담점")).toBeHidden();
  await expect(workspaceChevron).toBeVisible();
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();
  await expectHorizontalGap(page, "shell-navigation-column", "shell-workspace-area", 10);

  const navigationBox = await navigationColumn.boundingBox();
  const switcherBox = await workspaceSwitcher.boundingBox();
  const markBox = await workspaceMark.boundingBox();

  expectRect(navigationBox);
  expectRect(switcherBox);
  expectRect(markBox);
  expect(Math.round(navigationBox.width)).toBe(56);
  expect(Math.round(switcherBox.width)).toBe(56);
  expect(Math.round(switcherBox.height)).toBe(32);
  expect(Math.round(markBox.width)).toBe(18);
  await expect(workspaceChevron).toHaveCSS("width", "16px");
  await expect(workspaceChevron).toHaveCSS("height", "16px");
  const chevronBox = await workspaceChevron.boundingBox();
  expectRect(chevronBox);
  expect(Math.round(markBox.x - switcherBox.x)).toBe(9);
  expect(Math.round(switcherBox.x + switcherBox.width - (chevronBox.x + chevronBox.width))).toBe(9);
});

test("dispensing table supports hover selection and bulk completion", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");

  const row = page.getByTestId("order-row-section-0-o-10024");
  const checkbox = row.getByRole("checkbox");

  await expect(row.getByText("요청").first()).toBeVisible();
  const statusBadge = row.getByTestId("order-status-badge-o-10024");
  const statusIcon = statusBadge.getByTestId("order-status-badge-o-10024-icon");
  await expect(statusIcon).toHaveCSS("width", "12px");
  await expect(statusIcon).toHaveCSS("height", "12px");
  await expect(statusIcon).toHaveCSS("color", await resolveCssColor(page, "var(--emr-status-neutral-text)"));
  await expect(checkbox).toHaveCSS("opacity", "1");
  await expect(checkbox).toHaveCSS("border-color", await resolveCssColor(page, "var(--emr-line-default)"));
  const completedCheckbox = page.getByTestId("order-row-section-0-o-10027").getByRole("checkbox");
  const canceledCheckbox = page.getByTestId("order-row-section-0-o-10028").getByRole("checkbox");
  await expect(completedCheckbox).toBeDisabled();
  await expect(completedCheckbox).toHaveCSS("opacity", "1");
  await expect(completedCheckbox).toHaveCSS("border-color", await resolveCssColor(page, "var(--emr-line-hairline)"));
  await expect(canceledCheckbox).toBeDisabled();
  await expect(canceledCheckbox).toHaveCSS("opacity", "1");
  await expect(canceledCheckbox).toHaveCSS("border-color", await resolveCssColor(page, "var(--emr-line-hairline)"));

  await checkbox.click();
  await expect(page.getByText("상세 정보")).toBeHidden();
  await expect(page.getByText("선택한 오더 1개")).toBeVisible();

  await page.getByRole("button", { name: "선택 오더 완료" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeHidden();
  await expect(row.getByText("완료").first()).toBeVisible();
  await expect(checkbox).toBeDisabled();
  await expect(checkbox).toHaveCSS("opacity", "1");
});

test("dispensing table column grips resize with a minimum width", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");

  const grip = page.getByRole("button", { name: "status 컬럼 너비 조절" }).first();
  const header = page.getByRole("columnheader", { name: "상태" }).first();
  const before = await header.boundingBox();
  const gripBox = await grip.boundingBox();

  expect(before).not.toBeNull();
  expect(gripBox).not.toBeNull();

  await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox!.x - 240, gripBox!.y + gripBox!.height / 2);
  await page.mouse.up();

  const after = await header.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThanOrEqual(76);
  expect(after!.width).toBeLessThanOrEqual(before!.width);
});

test("dispensing order group segmented control filters groups", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=closed&aside=closed");

  const allFilter = page.getByRole("button", { name: "전체 12" });
  const oralFilter = page.getByRole("button", { name: "경구제 6" });
  const otherFilter = page.getByRole("button", { name: "기타 6" });

  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeVisible();
  await expect(page.getByText("기타 오더 그룹")).toBeVisible();

  await otherFilter.click();
  await expect(otherFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeHidden();
  await expect(page.getByText("기타 오더 그룹")).toBeVisible();

  await oralFilter.click();
  await expect(oralFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("경구제 오더 그룹")).toBeVisible();
  await expect(page.getByText("기타 오더 그룹")).toBeHidden();
});

test("dispensing order group section can collapse and expand", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const firstRow = page.getByTestId("order-row-section-0-o-10023");
  const collapseButton = page.getByRole("button", { name: "항생제 세트 A 접기" }).first();

  await expect(firstRow).toBeVisible();
  await expect(collapseButton).toHaveAttribute("aria-expanded", "true");

  await collapseButton.click();
  await expect(firstRow).toBeHidden();
  const expandButton = page.getByRole("button", { name: "항생제 세트 A 펼치기" }).first();
  await expect(expandButton).toHaveAttribute("aria-expanded", "false");

  await expandButton.click();
  await expect(firstRow).toBeVisible();
  await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
});

test("dispensing order groups support assignment status actions without add or delete", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page).toHaveURL(/aside=closed/);

  await expect(page.getByRole("button", { name: /추가|생성|새 오더/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /삭제|제거/ })).toHaveCount(0);

  const row = page.getByTestId("order-row-section-0-o-10024");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect(page.getByRole("button", { name: "조제중" }).first()).toBeVisible();
  await expect(page.getByText("송하윤").first()).toBeVisible();
  await expect(row.getByRole("combobox", { name: /담당 변경/ })).toContainText("송하윤");

  await page.getByRole("button", { name: "항생제 세트 A 상태 액션" }).first().click();
  await page.getByText("담당취소").click();
  await expect(page.getByRole("button", { name: "담당하기" }).first()).toBeVisible();
  await expect(row.getByRole("combobox", { name: /담당 변경/ })).toContainText("미지정");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await page.getByRole("button", { name: "항생제 세트 A 상태 액션" }).first().click();
  await page.getByRole("menuitem", { name: "완료" }).click();
  await expect(page.getByRole("button", { name: "조제완료" }).first()).toBeVisible();
  await expect(row.getByText("완료").first()).toBeVisible();
});

test("dispensing top completion action completes all child orders", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const titleBar = page.locator("[data-slot='instruction-header-title-bar']");
  await titleBar.getByRole("button", { name: "담당하기" }).click();
  await titleBar.getByRole("button", { name: "항생제 세트 A 상태 액션" }).click();
  await page.getByRole("menuitem", { name: "완료" }).click();

  await expect(titleBar.getByRole("button", { name: "조제완료" })).toBeVisible();
  const resultContent = page.locator("[data-slot='instruction-result-scroll-content']");
  const statusBadges = resultContent.locator("[data-testid^='order-status-badge-']:not([data-testid$='-icon'])");
  await expect(statusBadges).toHaveCount(12);
  await expect(statusBadges).toHaveText(Array(12).fill("완료"));
  await expect(resultContent.getByText("작업 완료 6/6")).toHaveCount(2);
});

test("dispensing assignee cell changes technician without opening drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");
  await expect(page).toHaveURL(/aside=closed/);

  const row = page.getByTestId("order-row-section-0-o-10024");
  const assigneeSelect = row.getByRole("combobox", { name: /담당 변경/ });

  await assigneeSelect.scrollIntoViewIfNeeded();
  await assigneeSelect.click();
  await page.getByRole("option", { name: "박준호" }).click();

  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeHidden();
  await expect(assigneeSelect).toContainText("박준호");
  await expect(page.getByText("박준호").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeHidden();

  await row.click({ position: { x: 100, y: 20 } });
  await expect(page.getByRole("button", { name: "상세 닫기" })).toBeVisible();
});

test("dispensing history aside can open from shared URL state", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=history");

  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(page.getByRole("button", { name: "조제 이력 목록 접기" })).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();
  await expect(page.getByText("26.04.11")).toBeVisible();

  const firstHistoryGroup = page.getByTestId("history-group-26.04.11");
  const firstHistoryGroupToggle = firstHistoryGroup.getByTestId("history-group-toggle-26.04.11");

  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "true");
  await firstHistoryGroupToggle.click();
  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "false");
  await expect(firstHistoryGroup.getByText("[CBC] CBC 검사 세트")).toBeHidden();
  await expect(firstHistoryGroup.getByText("Atorvastatin 20(mg) T 9:00 AM")).toBeHidden();
  await expect(page.getByTestId("history-group-26.03.12").getByText("[CBC] CBC 검사 세트")).toBeVisible();

  await firstHistoryGroupToggle.click();
  await expect(firstHistoryGroupToggle).toHaveAttribute("aria-expanded", "true");
  await expect(firstHistoryGroup.getByText("[CBC] CBC 검사 세트")).toBeVisible();
});

test("module side panel can collapse and reopen from the rail", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "조제/처치");
  await expect(getNavRail(page).getByRole("button", { name: "고객센터" })).toBeVisible();
  await page.getByRole("button", { name: "사이드 패널 접기", exact: true }).click();
  await expect(page).toHaveURL(/modulePanel=closed/);
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();

  await page.getByRole("button", { name: "사이드 패널 펼치기" }).click();
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
});

test("home normalizes a collapsed module panel before navigating back to modules", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=closed&aside=closed");
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toBeVisible();

  await getNavRail(page).getByRole("link", { name: "홈" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/home/);
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page.getByRole("button", { name: "사이드 패널 펼치기" })).toHaveCount(0);
  await expect(page.getByTestId("module-side-panel-title")).toHaveCount(0);
  await expect(page.getByTestId("home-dashboard")).toBeVisible();
  await expect(page.getByText("운영 병목 보드")).toBeVisible();

  await getNavRail(page).getByRole("link", { name: "조제/처치" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
});

test("shell navigation keeps demo query context across modules", async ({ page }) => {
  await page.goto(`/w/clair-demo/treatment?${fullDemoQuery}`);
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();

  await page.getByRole("button", { name: "사이드 패널 접기", exact: true }).click();
  await expect(page).toHaveURL(/modulePanel=closed/);
  await expectUrlSearchParams(page, {
    scenario: "kong-vomit",
    patientId: "patient-kong",
    encounterId: "encounter-kong-260501",
    labResultId: "lab-result-kong-cbc",
    imagingStudyId: "imaging-kong-abdomen",
    invoiceId: "invoice-kong-260501",
  });

  await getNavRail(page).getByRole("link", { name: "임상병리검사" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expectUrlSearchParams(page, {
    scenario: "kong-vomit",
    patientId: "patient-kong",
    encounterId: "encounter-kong-260501",
    labResultId: "lab-result-kong-cbc",
    imagingStudyId: "imaging-kong-abdomen",
    invoiceId: "invoice-kong-260501",
  });
});

test("module side panel order type segmented control filters side orders", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  const orderTypeFilter = sidePanel.getByRole("group", { name: "오더 유형 필터" });
  const allFilter = orderTypeFilter.getByRole("button", { name: "전체" });
  const dispensingFilter = orderTypeFilter.getByRole("button", { name: "조제" });
  const treatmentFilter = orderTypeFilter.getByRole("button", { name: "처치" });

  await expect(page.getByTestId("module-side-panel-title")).toHaveText("조제/처치");
  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("항생제 세트 A")).toBeVisible();
  await expect(sidePanel.getByText("수액 처치", { exact: true })).toBeVisible();
  await expect(sidePanel.getByText("네뷸라이징")).toBeVisible();

  const treatmentCard = page.getByTestId("order-queue-item-dispensing-queue-1");
  const treatmentCardAction = page.getByTestId("order-queue-item-action-dispensing-queue-1");
  await expect(treatmentCard).toContainText(/외래\s*나비\s*·\s*오세아/);
  await expect(treatmentCardAction).toHaveCSS("opacity", "0");
  await treatmentCard.hover();
  await treatmentCardAction.click({ force: true });
  await expect(page.getByRole("menu", { name: "나비 수액 처치 더보기" })).toContainText("지시서 열기");
  await expect(page.getByRole("menu", { name: "나비 수액 처치 더보기" })).toContainText("환자 정보");
  await expect(treatmentCard).not.toHaveAttribute("data-selected", "true");
  await page.mouse.click(8, 8);

  await sidePanel.getByRole("button", { name: /현재 정렬: 요청순/ }).click();
  await expect(page.getByRole("menu", { name: "현재 정렬: 요청순" })).toContainText("대기 긴 순");
  await page.getByRole("menuitemradio", { name: "대기 긴 순" }).click();
  await expect(sidePanel.getByRole("button", { name: /현재 정렬: 대기 긴 순/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await sidePanel.getByRole("button", { name: /필터: 전체 조건/ }).click();
  await page.getByRole("menuitemradio", { name: "담당 미정" }).click();
  await expect(sidePanel.getByText("소염제 세트")).toBeVisible();
  await expect(sidePanel.getByText("항생제 세트 A")).toBeHidden();
  await page.keyboard.press("Escape");

  await sidePanel.getByRole("button", { name: /표시 옵션: 기본/ }).click();
  await page.getByRole("menuitemradio", { name: "촘촘한 밀도" }).click();
  await expect(sidePanel.getByRole("button", { name: /표시 옵션: 촘촘/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await sidePanel.getByRole("button", { name: /필터: 담당 미정/ }).click();
  await page.getByRole("menuitemradio", { name: "전체 조건" }).click();
  await page.keyboard.press("Escape");

  await treatmentFilter.click();
  await expect(treatmentFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("수액 처치", { exact: true })).toBeVisible();
  await expect(sidePanel.getByText("네뷸라이징")).toBeVisible();
  await expect(sidePanel.getByText("항생제 세트 A")).toBeHidden();

  await dispensingFilter.click();
  await expect(dispensingFilter).toHaveAttribute("aria-pressed", "true");
  await expect(sidePanel.getByText("항생제 세트 A")).toBeVisible();
  await expect(sidePanel.getByText("위장약 세트")).toBeVisible();
  await expect(sidePanel.getByText("수액 처치")).toBeHidden();
});

test("order queue side panel renders status group titles with CDS V2 icon tokens", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("order-queue-status-reRequested")).toContainText("재요청");
  await expect(sidePanel.getByTestId("order-queue-status-inProgress")).toContainText("진행중");
  await expect(sidePanel.getByTestId("order-queue-status-waiting")).toContainText("대기중");
  await expect(sidePanel.getByTestId("order-queue-status-completed")).toContainText("완료");
  await expect(sidePanel.getByTestId("order-queue-status-canceled")).toContainText("취소");

  await expect(sidePanel.getByTestId("order-queue-status-reRequested-count")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-sidepanel-list-title-count)"));
  await expect(sidePanel.getByTestId("order-queue-status-inProgress-count")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-sidepanel-list-title-count)"));
  await expect(sidePanel.getByTestId("order-queue-status-waiting-count")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-sidepanel-list-title-count)"));
  await expect(sidePanel.getByTestId("order-queue-status-completed-count")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-sidepanel-list-title-count)"));
  await expect(sidePanel.getByTestId("order-queue-status-canceled-count")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-sidepanel-list-title-count)"));

  const reRequestedIcon = sidePanel.getByTestId("order-queue-status-reRequested-status-icon");
  await expect(reRequestedIcon).toHaveAttribute("data-state-icon-state", "rework");
  await expect(reRequestedIcon).toHaveCSS("width", "16px");
  await expect(reRequestedIcon).toHaveCSS("height", "16px");
  await expect
    .poll(() =>
      reRequestedIcon.evaluate((icon) => {
        const paths = Array.from(icon.querySelectorAll("path"));
        return {
          accentFill: getComputedStyle(paths[1]).fill,
          glyphFill: getComputedStyle(paths[3]).fill,
          pathCount: paths.length,
          stroke: getComputedStyle(paths[2]).stroke,
          strokeWidth: getComputedStyle(paths[2]).strokeWidth,
        };
      }),
    )
    .toEqual({
      accentFill: await resolveCssColor(page, "var(--emr-sidepanel-state-icon-rework-bg)"),
      glyphFill: await resolveCssColor(page, "var(--emr-sidepanel-state-icon-rework-fg)"),
      pathCount: 4,
      stroke: await resolveCssColor(page, "var(--emr-sidepanel-state-icon-rework-border)"),
      strokeWidth: "1.5px",
    });

  await expect(sidePanel.getByTestId("order-queue-status-inProgress-status-icon")).toHaveAttribute("data-state-icon-state", "in-progress");
  await expect(sidePanel.getByTestId("order-queue-status-waiting-status-icon")).toHaveAttribute("data-state-icon-state", "to-do");
  await expect(sidePanel.getByTestId("order-queue-status-completed-status-icon")).toHaveAttribute("data-state-icon-state", "done");
  await expect(sidePanel.getByTestId("order-queue-status-canceled-status-icon")).toHaveAttribute("data-state-icon-state", "cancel");
});

test("order queue status groups can collapse and expand", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=history&right=closed");

  const sidePanel = page.locator("aside").first();
  const reRequestedGroup = sidePanel.getByTestId("order-queue-status-reRequested");
  const toggle = reRequestedGroup.getByRole("button", { name: "재요청 접기" });

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeVisible();

  await toggle.click();
  const expandToggle = reRequestedGroup.getByRole("button", { name: "재요청 펼치기" });
  await expect(expandToggle).toHaveAttribute("aria-expanded", "false");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeHidden();

  await expandToggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(reRequestedGroup.getByTestId("order-queue-item-dispensing-queue-0")).toBeVisible();
});

test("orders module renders hospital admin order management instead of the placeholder queue", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=closed");

  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute("aria-label", "병원관리");
  await expect(page.getByTestId("hospital-admin-menu-order-management")).toContainText("Order 관리");
  await expect(page.getByRole("heading", { name: "임상병리 검사" })).toBeVisible();
  await expect(page.getByTestId("order-queue-status-reRequested")).toHaveCount(0);
});

test("customer table uses compact scope controls and checkbox bulk selection", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");

  const header = page.getByTestId("customer-page-header");
  const table = page.getByTestId("customer-patient-table");

  await expect(header.getByRole("textbox", { name: "고객관리 검색" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "환자/보호자 등록" })).toBeVisible();
  await expect(table).toBeVisible();
  await expect(table).toHaveCSS("border-radius", "0px");
  await expect(table.getByRole("textbox", { name: "고객관리 검색" })).toBeVisible();
  await expect(table).toContainText("전체 동물");
  await expect(table).not.toContainText("0 / 5 선택");

  await page.getByRole("checkbox", { name: "코코 선택" }).click();
  await expect(page.getByText("선택한 동물 1개")).toBeVisible();
  await expect(page.getByText("환자 정보")).toHaveCount(0);

  await page.getByTestId("customer-patient-row-patient-coco").click({ position: { x: 120, y: 20 } });
  await expect(page.getByText("환자 정보")).toBeVisible();
});

test("hospital order table keeps tabs and compact controls in one hierarchy row", async ({ page }) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=closed");

  const tabGroup = page.getByRole("group", { name: "임상병리 검사 하위 타입" });
  const activeTab = tabGroup.getByRole("button", { name: "전체" });
  const search = page.getByRole("textbox", { name: "오더 검색" });
  await expect(activeTab).toBeVisible();
  await expect(activeTab).toHaveAttribute("aria-pressed", "true");
  await expect(search).toBeVisible();
  await expect(page.getByRole("button", { name: "오더 필터 설정" })).toBeVisible();
  await expect(page.getByTestId("hospital-order-table")).toBeVisible();

  const activeTabBox = await activeTab.boundingBox();
  const searchBox = await search.boundingBox();
  expectRect(activeTabBox);
  expectRect(searchBox);
  expect(Math.abs(Math.round(activeTabBox.y - searchBox.y))).toBeLessThanOrEqual(8);
});

test("dispensing queue selection updates existing patient and instruction context", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=closed");

  const patientContextBar = page.locator("[data-slot='patient-context-bar'] > div").first();
  await expect(patientContextBar).toHaveCSS("min-height", "50px");
  await expect(patientContextBar).toHaveCSS("padding-left", "16px");
  await expect(patientContextBar).toHaveCSS("column-gap", "12px");
  await expect(page.locator("[data-slot='emr-page-header']")).toHaveCSS("min-height", "32px");
  const instructionInfoCard = page.locator("[data-slot='instruction-info-card']");
  await expect(instructionInfoCard).toHaveCSS("min-height", "72px");
  await expect(instructionInfoCard).toHaveCSS("padding-left", "16px");
  await expect(instructionInfoCard).toHaveCSS("border-radius", "10px");

  await expect(page.getByTestId("order-queue-selection-summary")).toHaveCount(0);
  await expect(page.getByTestId("instruction-status-label")).toHaveText("재요청");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", "rgb(255, 250, 240)");
  await expect(page.getByTestId("instruction-status-label").locator("span")).toHaveCount(0);
  await expect(page.locator("[data-slot='instruction-header-order-info']")).toContainText(/조제 시작\s*10:34/);
  const selectedQueueCard = page.getByTestId("order-queue-item-dispensing-queue-0");
  await expect(selectedQueueCard).toHaveCSS("padding-top", "8px");
  await expect(selectedQueueCard).toHaveCSS("border-radius", "10px");
  await expect(selectedQueueCard).toHaveCSS("border-color", await resolveCssColor(page, "var(--emr-sidepanel-task-card-selected-border)"));
  await expect(selectedQueueCard.getByText("예약")).toHaveCSS("height", "20px");
  await expect(selectedQueueCard).toContainText("10:30 이수지 재요청");
  await expect(selectedQueueCard).toContainText("김미래");
  await expect(page.getByTestId("order-queue-item-action-dispensing-queue-0")).toHaveCSS("width", "24px");
  const unassignedQueueCard = page.getByTestId("order-queue-item-dispensing-queue-2");
  await expect(unassignedQueueCard).toContainText("미지정");

  await page.getByTestId("order-queue-item-dispensing-queue-1").click();

  const titleBar = page.locator("[data-slot='instruction-header-title-bar']");
  await expect(titleBar).toContainText("RX-260414-0007");

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext).toContainText(/환자\s*나비/);
  await expect(patientContext).toContainText(/보호자\s*오세아/);
  await expect(patientContext).toContainText(/품종\s*러시안블루/);

  const orderInfo = page.locator("[data-slot='instruction-header-order-info']");
  await expect(orderInfo).toContainText("2026.04.14 10:42");
  await expect(orderInfo).toContainText("나비(5세) · 러시안블루");
  await expect(orderInfo).toContainText(/요청 일시\s*2026.04.14 10:42\s*진행중/);
  await expect(orderInfo).toContainText(/요청 수의사\s*김도윤/);
  await expect(orderInfo).toContainText(/처치 담당\s*송하윤/);
  await expect(orderInfo).toContainText(/처치 시작\s*10:45/);
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-status-info-bg)"));

  const resultContent = page.locator("[data-slot='instruction-result-scroll-content']");
  await expect(resultContent).toContainText("수액 처치");
  await expect(resultContent).toContainText("Lactated Ringer's 120ml SC");
  await expect(resultContent).not.toContainText("항생제 세트 A");

  await page.getByTestId("order-queue-item-dispensing-queue-4").click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("완료");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-status-success-bg)"));
  await expect(page.getByTestId("order-status-badge-neb-o-50010")).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-status-success-bg)"));
  await expect(page.getByTestId("order-status-badge-neb-o-50010")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-status-success-text)"));

  await page.getByTestId("order-queue-item-dispensing-queue-5").click();
  await expect(page.getByTestId("instruction-status-label")).toHaveText("취소");
  await expect(page.getByTestId("instruction-status-label")).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-status-danger-bg)"));
  await expect(page.getByTestId("order-status-badge-cardio-o-60010")).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-status-danger-bg)"));
  await expect(page.getByTestId("order-status-badge-cardio-o-60010")).toHaveCSS("color", await resolveCssColor(page, "var(--emr-status-danger-text)"));
});

test("treatment module renders the chart queue instead of the order queue placeholder", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed");

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("진료 대기열")).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "진행중 접기" })).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "대기중 접기" })).toBeVisible();
  await expect(sidePanel.getByText("코코")).toBeVisible();
  const chartQueueAction = sidePanel.locator("[data-testid^='order-queue-item-action-']").first();
  await chartQueueAction.hover();
  await chartQueueAction.click({ force: true });
  await expect(page.getByRole("menu", { name: /더보기/ })).toContainText("차트 열기");
  await expect(page.getByRole("menu", { name: /더보기/ })).toContainText("보호자 정보");
  await expect(page.getByRole("button", { name: "차트 이력 패널 열기" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "기본 SOAP" })).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("right panel can be collapsed on a module that owns it", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed&right=open");
  await expect(page.getByTestId("module-side-panel-title")).toHaveText("진료/차트");
  await expect(page.getByRole("tab", { name: "기본 SOAP" })).toBeVisible();
  await expect(page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보")).toHaveCount(0);
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByRole("button", { name: "환자 정보 패널 접기" })).toBeVisible();
  await expect(page.getByRole("button", { name: /환자 정보 (열기|접기)/ })).toHaveCount(0);
  await page.getByRole("button", { name: "환자 정보 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByRole("button", { name: /환자 정보 (열기|접기)/ })).toHaveCount(0);
});

test("dispensing does not render the patient side panel or trigger", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed&right=open");

  await expect(page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보")).toBeHidden();
  await expect(page.getByRole("button", { name: /환자 정보 (열기|접기)/ })).toHaveCount(0);
  await expect(page).not.toHaveURL(/right=/);
});

test("workspace tabs create an initial tab and keep the final tab open", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const workspaceTabs = getWorkspaceTablist(page);

  await expect(workspaceTabs).toBeVisible();
  await expectActiveWorkspaceTab(page, "조제/처치");
  await expect(workspaceTabs.getByRole("button", { name: "새 업무 탭" })).toBeVisible();
  await expect(workspaceTabs.getByRole("button", { name: "조제/처치 탭 닫기" })).toHaveCount(0);

  await workspaceTabs.getByRole("button", { name: "새 업무 탭" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
  await expect(page.getByText("새 탭이 생성되었습니다.")).toBeVisible();
  await expect(workspaceTabs.getByRole("tab")).toHaveCount(2);
  await expect(workspaceTabs.getByRole("tab", { name: /조제\/처치/ })).toHaveCount(2);
  await expect(workspaceTabs.getByRole("button", { name: "조제/처치 탭 닫기" })).toHaveCount(2);

  await workspaceTabs.getByRole("button", { name: "조제/처치 탭 닫기" }).last().click();
  await expect(workspaceTabs.getByRole("tab")).toHaveCount(1);
  await expectActiveWorkspaceTab(page, "조제/처치");
  await expect(workspaceTabs.getByRole("button", { name: "조제/처치 탭 닫기" })).toHaveCount(0);
});

test("workspace tabs keep navigation history per active tab", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed");
  await expectActiveWorkspaceTab(page, "진료/차트");

  await getNavRail(page).getByRole("link", { name: "임상병리검사" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);
  await expectActiveWorkspaceTab(page, "검사");
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled();

  await page.getByRole("button", { name: "탭 뒤로가기" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expectActiveWorkspaceTab(page, "진료/차트");
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeEnabled();

  await page.getByRole("button", { name: "새 업무 탭" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expect(page.getByText("새 탭이 생성되었습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled();
  await getNavRail(page).getByRole("link", { name: "홈" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/home/);
  await expectActiveWorkspaceTab(page, "홈");
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled();

  await getNavRail(page).getByRole("link", { name: "수납" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expect(page).toHaveURL(/right=open/);
  await expectActiveWorkspaceTab(page, "수납");
  await expect(page.getByRole("button", { name: "탭 뒤로가기" })).toBeEnabled();

  await page.getByRole("button", { name: "탭 뒤로가기" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/home/);
  await expectActiveWorkspaceTab(page, "홈");
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeEnabled();

  await page.getByRole("button", { name: "탭 앞으로가기" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expect(page).toHaveURL(/right=open/);
  await expectActiveWorkspaceTab(page, "수납");

  await getWorkspaceTablist(page).getByRole("tab", { name: /진료\/차트/ }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expect(page.getByRole("button", { name: "탭 앞으로가기" })).toBeEnabled();
});

test("workspace tabs restore open tabs after reload", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const workspaceTabs = getWorkspaceTablist(page);

  await workspaceTabs.getByRole("button", { name: "새 업무 탭" }).click();
  await getNavRail(page).getByRole("link", { name: "임상병리검사" }).click();
  await expectActiveWorkspaceTab(page, "검사");
  await expect(workspaceTabs.getByRole("tab")).toHaveCount(2);
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);

  await page.reload();

  await expect(workspaceTabs.getByRole("tab")).toHaveCount(2);
  await expectActiveWorkspaceTab(page, "검사");
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);

  await workspaceTabs.getByRole("tab", { name: /조제\/처치/ }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
});

test("workspace tab chrome follows the 10px shell rhythm", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const workspaceTabsBar = page.locator("[data-testid='workspace-tabs-bar']");
  const navigationColumn = page.getByTestId("shell-navigation-column");
  const modulePanelArea = page.getByTestId("module-panel-area");
  const workspaceArea = page.getByTestId("shell-workspace-area");
  const workspaceSwitcher = page.getByTestId("workspace-switcher");
  const navRail = getNavRail(page);
  const shellBox = await workspaceTabsBar.boundingBox();
  const navigationBox = await navigationColumn.boundingBox();
  const modulePanelBox = await modulePanelArea.boundingBox();
  const workspaceBox = await workspaceArea.boundingBox();
  const switcherBox = await workspaceSwitcher.boundingBox();
  const navBox = await navRail.boundingBox();

  expect(shellBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(modulePanelBox).not.toBeNull();
  expect(workspaceBox).not.toBeNull();
  expect(switcherBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(shellBox!.x - (navigationBox!.x + navigationBox!.width)).toBeCloseTo(10, 0);
  expect(workspaceBox!.x - (navigationBox!.x + navigationBox!.width)).toBeCloseTo(10, 0);
  expect(modulePanelBox!.y - (switcherBox!.y + switcherBox!.height)).toBeCloseTo(10, 0);
  expect(workspaceBox!.y - (shellBox!.y + shellBox!.height)).toBeCloseTo(10, 0);
  expect(navBox!.x - modulePanelBox!.x).toBeCloseTo(0, 0);
  expect(Math.round(shellBox!.height)).toBe(32);
  expect(Math.round(switcherBox!.height)).toBe(32);
  const searchButton = getNavRail(page).getByRole("button", { name: "전역 통합 검색 열기" });
  const searchIcon = searchButton.locator("svg");
  const customerCenterButton = getNavRail(page).getByRole("button", { name: "고객센터" });
  await expect(navRail).toHaveCSS("width", "56px");
  await expect(navRail).toHaveCSS("background-color", await resolveCssColor(page, "var(--emr-navrail-bg)"));
  await expect(navRail).toHaveCSS("border-radius", "12px");
  await expect(navRail).toHaveCSS("padding-left", "12px");
  await expect(searchButton).toHaveCSS("width", "32px");
  await expect(searchButton).toHaveCSS("height", "32px");
  await expect(searchButton).toHaveCSS("color", await resolveCssColor(page, "var(--emr-navrail-icon)"));
  await expect(searchIcon).toHaveCSS("width", "24px");
  await expect(searchIcon).toHaveCSS("height", "24px");
  await expect(customerCenterButton).toHaveCSS("width", "32px");
  await expect(customerCenterButton).toHaveCSS("height", "32px");
  await expect(searchButton).not.toContainText(
    "동물명 또는 보호자명으로 검색",
  );
  const topbarHoverColor = await resolveCssColor(page, "var(--emr-topbar-tab-hover-bg)");
  const navRailHoverColor = await resolveCssColor(page, "var(--emr-navrail-item-hover)");
  await expect
    .poll(() => searchButton.evaluate((button) => getComputedStyle(button).boxShadow))
    .toMatch(/^(none|(?:rgba\(0, 0, 0, 0\).*))/);
  await searchButton.hover();
  await expect(searchButton).toHaveCSS("background-color", navRailHoverColor);
  await expect
    .poll(() =>
      navRail.evaluate((rail) => {
        const contents = rail.firstElementChild as HTMLElement | null;
        if (!contents) return null;
        const children = Array.from(contents.children) as HTMLElement[];
        const boxes = children.map((child) => child.getBoundingClientRect());
        const gaps = boxes.slice(1).map((box, index) =>
          Math.round(box.y - (boxes[index].y + boxes[index].height)),
        );
        const dividers = children
          .filter((child) => !child.querySelector("[aria-label]"))
          .map((child) => {
            const line = child.firstElementChild as HTMLElement | null;
            const wrapperBox = child.getBoundingClientRect();
            const lineBox = line?.getBoundingClientRect();
            return {
              wrapperHeight: Math.round(wrapperBox.height),
              lineHeight: lineBox ? Math.round(lineBox.height) : null,
              lineWidth: lineBox ? Math.round(lineBox.width) : null,
              padding: getComputedStyle(child).padding,
            };
          });
        return {
          contentGap: getComputedStyle(contents).rowGap,
          contentWidth: Math.round(contents.getBoundingClientRect().width),
          divider: dividers[0],
          gaps: [...new Set(gaps)],
        };
      }),
    )
    .toEqual({
      contentGap: "12px",
      contentWidth: 32,
      divider: {
        wrapperHeight: 1,
        lineHeight: 1,
        lineWidth: 24,
        padding: "0px 6px",
      },
      gaps: [12],
    });
  const newTabButton = page.getByRole("button", { name: "새 업무 탭" });
  await newTabButton.hover();
  await expect(newTabButton).toHaveCSS("background-color", topbarHoverColor);
  const activeWorkspaceTab = getWorkspaceTablist(page).getByRole("tab").first();
  await expect(activeWorkspaceTab).toHaveCSS("height", "32px");
  await expect(activeWorkspaceTab).toHaveCSS("font-size", "14px");
  await expect(activeWorkspaceTab).toHaveCSS("line-height", "20px");
  await expect(activeWorkspaceTab).toHaveCSS("letter-spacing", "0.196px");
  await expect(activeWorkspaceTab).toHaveCSS("padding-left", "8px");
  await expect(activeWorkspaceTab).toHaveCSS("padding-right", "10px");
  await expect(activeWorkspaceTab.locator("xpath=ancestor::*[@role='presentation'][1]")).toHaveCSS(
    "background-color",
    await resolveCssColor(page, "var(--emr-topbar-tab-active-bg)"),
  );
  await expect(activeWorkspaceTab.locator("xpath=ancestor::*[@role='presentation'][1]")).toHaveCSS(
    "border-color",
    await resolveCssColor(page, "var(--emr-topbar-tab-active-border)"),
  );
  const backButton = page.getByRole("button", { name: "탭 뒤로가기" });
  const forwardButton = page.getByRole("button", { name: "탭 앞으로가기" });
  await expect(backButton).toHaveCSS("width", "32px");
  await expect(forwardButton).toHaveCSS("width", "32px");
  await expect(backButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(forwardButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(workspaceTabsBar.getByRole("button", { name: "알림" })).toHaveCSS("width", "32px");
  await expect(workspaceTabsBar.getByRole("button", { name: "도움말" })).toHaveCSS("width", "32px");
  await expect(workspaceTabsBar.getByRole("button", { name: "설정" })).toHaveCSS("width", "32px");
  await expect(workspaceTabsBar.getByRole("button", { name: /프로필 메뉴/ })).toHaveCSS("width", "48px");
  await expect(workspaceTabsBar.getByRole("button", { name: /프로필 메뉴/ })).toHaveCSS(
    "background-color",
    await resolveCssColor(page, "var(--emr-topbar-profile-bg)"),
  );
  await expect
    .poll(() =>
      workspaceTabsBar.evaluate((header) => {
        const left = header.firstElementChild as HTMLElement | null;
        const right = header.lastElementChild as HTMLElement | null;
        const divider = left?.children[2] as HTMLElement | undefined;
        return {
          headerGap: getComputedStyle(header).columnGap,
          leftGap: left ? getComputedStyle(left).columnGap : null,
          rightGap: right ? getComputedStyle(right).columnGap : null,
          dividerBg: divider ? getComputedStyle(divider).backgroundColor : null,
          dividerHeight: divider ? Math.round(divider.getBoundingClientRect().height) : null,
          dividerWidth: divider ? Math.round(divider.getBoundingClientRect().width) : null,
        };
      }),
    )
    .toEqual({
      dividerBg: "rgba(0, 0, 0, 0.08)",
      dividerHeight: 16,
      dividerWidth: 1,
      headerGap: "16px",
      leftGap: "8px",
      rightGap: "10px",
    });
  await expect(backButton).toBeDisabled();
  await expect(forwardButton).toBeDisabled();
});

test("workspace tab close button keeps tab hover surface unified", async ({ page }) => {
  await clearWorkspaceTabs(page);
  await page.goto("/w/clair-demo/dispensing?modulePanel=open&aside=closed");

  const workspaceTabs = getWorkspaceTablist(page);
  await workspaceTabs.getByRole("button", { name: "새 업무 탭" }).click();

  const hoverColor = await resolveCssColor(page, "var(--emr-topbar-tab-hover-bg)");
  const closeButton = workspaceTabs.getByRole("button", { name: "조제/처치 탭 닫기" }).first();
  const tabContainer = closeButton.locator("xpath=ancestor::*[@role='presentation'][1]");
  const tabButton = tabContainer.getByRole("tab").first();

  await expect(tabButton).toHaveCSS("padding-right", "0px");
  await expect(closeButton).toHaveCSS("width", "16px");
  await expect(closeButton).toHaveCSS("height", "16px");
  await closeButton.hover();
  await expect(tabContainer).toHaveCSS("background-color", hoverColor);
  await expect(closeButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("PWA manifest exposes install shell metadata", async ({ request, page }) => {
  const response = await request.get("/manifest.webmanifest");

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/manifest+json");

  const manifest = await response.json();

  expect(manifest).toMatchObject({
    name: "CLAiR EMR",
    short_name: "CLAiR",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#E9ECF2",
    theme_color: "#18181B",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      }),
      expect.objectContaining({
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      }),
      expect.objectContaining({
        src: "/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      }),
    ]),
  );

  await page.goto(manifest.start_url);
  await expect(page.getByRole("heading", { name: "CLAiR EMR" })).toBeVisible();
});
