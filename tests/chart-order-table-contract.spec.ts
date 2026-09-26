import { expect, test } from "@playwright/test";

const chartOrderUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

const visibleColumns = [
  ["select", "선택", 20],
  ["orderType", "분류", 88],
  ["confirmation", "확정 여부", 88],
  ["displayName", "Order 명", 180],
  ["status", "업무 상태", 88],
  ["billingName", "청구서명", 144],
  ["billingReflection", "청구반영", 64],
  ["durationDays", "일수", 64],
  ["frequency", "횟수", 64],
  ["totalOccurrences", "총횟수", 88],
  ["doseBasis", "head/kg당", 88],
  ["dosePerAdministration", "1회당", 64],
  ["ingredientStrength", "성분량", 88],
  ["calculatedDispenseQuantity", "조제량", 88],
  ["storageMethod", "보관", 88],
  ["administration", "투여/복약", 114],
  ["unitPrice", "단가", 114],
  ["quantity", "수량", 65],
  ["lineTotal", "합계", 126],
  ["adjustmentAmount", "할인/할증", 114],
  ["adjustmentPercent", "%", 72],
  ["chargeAmount", "총 청구금액", 126],
  ["adjustmentReason", "할인/할증 사유", 126],
  ["taxClass", "과세", 64],
  ["assignee", "업무 담당", 66],
  ["requestedBy", "요청 수의사", 77],
] as const;

test("Plan/Order renders the approved 26-column geometry and presentation contract", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);

  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(table).toBeVisible();

  const headers = table.locator("thead th[data-column-id]");
  await expect(headers).toHaveCount(26);
  await expect(headers.evaluateAll((elements) =>
    elements.map((element) => [
      element.getAttribute("data-column-id"),
      element.getAttribute("data-emr-column-size"),
      element.getAttribute("data-emr-column-resize"),
    ]),
  )).resolves.toEqual(
    visibleColumns.map(([id, , size]) => [
      id,
      String(size),
      id === "displayName"
        ? "pinned-order-boundary"
        : id === "select" || id === "orderType" || id === "confirmation"
          ? "none"
          : "data-column",
    ]),
  );

  await expect(headers.evaluateAll((elements) =>
    elements.map((element) =>
      element.getAttribute("aria-label") ?? element.textContent?.trim(),
    ),
  )).resolves.toEqual(visibleColumns.map(([, label]) => label));

  await expect(table.locator('[data-column-id="actualDispenseQuantity"]')).toHaveCount(0);
  await expect(table.locator('[data-column-id="unit"]')).toHaveCount(0);
  await expect(table.locator('[data-column-id="select"] button[aria-label*="너비 조절"]')).toHaveCount(0);
  await expect(table.locator('[data-column-id="orderType"] button[aria-label*="너비 조절"]')).toHaveCount(0);
  await expect(table.locator('[data-column-id="confirmation"] button[aria-label*="너비 조절"]')).toHaveCount(0);
  await expect(table.locator('[data-column-id="displayName"] button[aria-label="Order 명 컬럼 너비 조절"]')).toHaveCount(1);
  await expect(table.locator('tbody button[aria-label*="너비 조절"]')).toHaveCount(0);

  const firstRow = table.locator('tbody tr[data-emr-data-table-row="true"]').first();
  await expect(firstRow.locator('td[data-column-id="status"]')).toContainText("-");
  await expect(firstRow.locator('td[data-column-id="status"]')).not.toContainText("—");
});

test("Plan/Order table cells render approved unit labels", async ({ page }) => {
  await page.goto(chartOrderUrl);
  const row = page.getByTestId("chart-order-row-order-kong-maropitant");
  const doseCell = row.locator('td[data-column-id="dosePerAdministration"]');

  const editDoseUnit = async (option: string, doseValue = "0.25") => {
    await row.hover();
    await row.getByRole("button", { name: "Maropitant 16mg T 더보기" }).click();
    await page.getByRole("menuitem", { name: "마스터·세부값 보기" }).click();
    const detail = page.getByRole("dialog", { name: "Maropitant 16mg T 상세" });
    const dose = detail.getByLabel("Maropitant 16mg T 용량", { exact: true });
    if ((await dose.inputValue()) !== doseValue) await dose.fill(doseValue);
    await detail.getByLabel("Maropitant 16mg T 단위", { exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await detail.getByRole("button", { name: "저장하고 닫기" }).click();
  };

  await editDoseUnit("정");
  await expect(doseCell).toHaveText("0.25 TAB");
  await editDoseUnit("피펫");
  await expect(doseCell).toHaveText("0.25 PIP");
  await editDoseUnit("회분");
  await expect(doseCell).toHaveText("0.25 APPL");
  await editDoseUnit("ml");
  await expect(doseCell).toHaveText("0.25 mL");
  await editDoseUnit("mg", "16");
  await expect(doseCell).toHaveText("16 mg");
});

test("Plan/Order fills the left edge and keeps transparent 8px gutters aligned", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(table).toBeVisible();
  const firstRow = table.locator('tbody tr[data-emr-data-table-row="true"]').first();
  const tableRoot = table.locator(
    'xpath=ancestor::*[@data-emr-data-table="true"]',
  );
  const [tableBox, rootBox] = await Promise.all([
    table.boundingBox(),
    tableRoot.boundingBox(),
  ]);
  expect(tableBox).not.toBeNull();
  expect(rootBox).not.toBeNull();
  expect(tableBox!.x - rootBox!.x).toBeCloseTo(0, 0);

  const headerBoxes = await table.locator("thead th[data-column-id]").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.getAttribute("data-column-id"), left: box.left, width: box.width };
    }),
  );
  const bodyBoxes = await firstRow.locator("td[data-column-id]").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.getAttribute("data-column-id"), left: box.left, width: box.width };
    }),
  );

  expect(headerBoxes).toHaveLength(26);
  expect(bodyBoxes).toHaveLength(26);
  const fixedStart = headerBoxes[0]!.left;
  expect(
    headerBoxes.slice(0, 4).map((column) => Math.round(column.left - fixedStart)),
  ).toEqual([0, 28, 124, 220]);
  expect(
    await table.locator("thead th[data-column-id]").evaluateAll((elements) =>
      elements.slice(0, 4).map((element) =>
        Math.round(Number.parseFloat(getComputedStyle(element).left)),
      ),
    ),
  ).toEqual([0, 28, 124, 220]);
  expect(
    Math.round(
      Number.parseFloat(
        await table
          .locator('thead th[data-column-id="displayName"]')
          .evaluate((element) => getComputedStyle(element).left),
      ) + 180,
    ),
  ).toBe(400);
  for (let index = 0; index < visibleColumns.length; index += 1) {
    expect(headerBoxes[index]?.id).toBe(visibleColumns[index]?.[0]);
    expect(bodyBoxes[index]?.id).toBe(visibleColumns[index]?.[0]);
    expect(headerBoxes[index]?.width).toBeCloseTo(bodyBoxes[index]?.width ?? 0, 0);
    expect(headerBoxes[index]?.width).toBeCloseTo(
      visibleColumns[index]![2] + (index === visibleColumns.length - 1 ? 0 : 8),
      0,
    );
    expect(headerBoxes[index]?.left).toBeCloseTo(bodyBoxes[index]?.left ?? 0, 0);
  }
  for (let index = 0; index < headerBoxes.length - 1; index += 1) {
    expect(headerBoxes[index + 1]!.left - headerBoxes[index]!.left).toBeCloseTo(
      headerBoxes[index]!.width,
      0,
    );
  }
});

test("Plan/Order title, tabs, and selection checkbox share the same left edge", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);

  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(table).toBeVisible();
  const panel = page
    .getByRole("heading", { name: "Plan/Order" })
    .locator('xpath=ancestor::section[@data-slot="chart-workspace-panel"]');
  const heading = panel.getByRole("heading", { name: "Plan/Order" });
  const tabs = panel.locator('[role="tablist"][aria-label="처방/오더 분류"]');
  const selectionHeader = table.locator('thead th[data-column-id="select"]');
  const selectionCheckbox = selectionHeader.getByRole("checkbox", {
    name: "오더 전체 선택",
  });
  const [headingBox, tabsBox, checkboxBox] = await Promise.all([
    heading.boundingBox(),
    tabs.boundingBox(),
    selectionCheckbox.boundingBox(),
  ]);

  expect(headingBox).not.toBeNull();
  expect(tabsBox).not.toBeNull();
  expect(checkboxBox).not.toBeNull();
  expect(headingBox!.x).toBeCloseTo(checkboxBox!.x, 0);
  expect(tabsBox!.x).toBeCloseTo(checkboxBox!.x, 0);
});

test("Plan/Order keeps scrolled columns behind the fixed start edge", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const viewport = table.locator(
    'xpath=ancestor::*[@data-emr-pinned-table-viewport="true"]',
  );
  const scrollOwner = viewport.locator(
    '> [data-emr-pinned-table-scroll-owner="true"]',
  );
  const firstRow = table.locator('tbody tr[data-emr-data-table-row="true"]').first();

  await expect(firstRow).toBeVisible();
  await scrollOwner.evaluate((element) => element.scrollTo({ left: 600, top: 0 }));
  await expect.poll(() => scrollOwner.evaluate((element) => element.scrollLeft)).toBe(600);

  await expect(
    firstRow.evaluate((row) => {
      const viewportElement = row.closest('[data-emr-pinned-table-viewport="true"]');
      const viewportBox = viewportElement?.getBoundingClientRect();
      const pinnedCell = row.querySelector('td[data-column-id="select"]');
      const pinnedBox = pinnedCell?.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const hit = viewportBox
        ? document.elementFromPoint(
            viewportBox.left + 1,
            rowBox.top + rowBox.height / 2,
          )?.closest("td")
        : null;

      return {
        hitColumn: hit?.getAttribute("data-column-id"),
        pinnedLeft: pinnedBox?.left,
        viewportLeft: viewportBox?.left,
      };
    }),
  ).resolves.toMatchObject({ hitColumn: "select" });
});

test("Plan/Order keeps scrolled resize handles below the fixed header", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const viewport = table.locator(
    'xpath=ancestor::*[@data-emr-pinned-table-viewport="true"]',
  );
  const scrollOwner = viewport.locator(
    '> [data-emr-pinned-table-scroll-owner="true"]',
  );

  await expect(table).toBeVisible();
  await scrollOwner.evaluate((element) => element.scrollTo({ left: 600, top: 0 }));
  await expect.poll(() => scrollOwner.evaluate((element) => element.scrollLeft)).toBe(600);

  const overlapResult = await table.evaluate((element) => {
    const pinnedHeaders = Array.from(
      element.querySelectorAll<HTMLElement>(
        'thead [data-emr-column-pinned="left"]',
      ),
    );
    const pinnedStart = Math.min(
      ...pinnedHeaders.map((header) => header.getBoundingClientRect().left),
    );
    const pinnedEnd = Math.max(
      ...pinnedHeaders.map((header) => header.getBoundingClientRect().right),
    );
    const overlappingHandles = Array.from(
      element.querySelectorAll<HTMLElement>(
        'thead [data-slot="table-head"]:not([data-emr-column-pinned]) [data-emr-column-resize-handle="true"]',
      ),
    ).filter((handle) => {
      const box = handle.getBoundingClientRect();
      const center = box.left + box.width / 2;
      return center > pinnedStart && center < pinnedEnd;
    });

    return {
      overlapCount: overlappingHandles.length,
      leakedHandles: overlappingHandles
        .filter((handle) => {
          const box = handle.getBoundingClientRect();
          return (
            document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            ) === handle
          );
        })
        .map((handle) => handle.getAttribute("aria-label")),
    };
  });

  expect(overlapResult.overlapCount).toBeGreaterThan(0);
  expect(overlapResult.leakedHandles).toEqual([]);
});

test("Plan/Order keeps the boundary line and fixed area above the scroll layer", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(table).toBeVisible();
  const root = table.locator('xpath=ancestor::*[@data-emr-data-table="true"]');
  await expect(root).toHaveAttribute("data-emr-data-table-column-gap", "8");
  const handle = table
    .locator('th[data-column-id="displayName"] [data-emr-column-resize-handle="true"]')
    .first();
  await expect(handle).toBeVisible();
  await expect(handle.evaluate((element) => ({
    right: getComputedStyle(element).right,
    height: getComputedStyle(element).height,
    width: getComputedStyle(element).width,
    before: {
      top: getComputedStyle(element, "::before").top,
      left: getComputedStyle(element, "::before").left,
      height: getComputedStyle(element, "::before").height,
      width: getComputedStyle(element, "::before").width,
    },
  }))).resolves.toEqual({
    right: "-3.5px",
    height: "22px",
    width: "8px",
    before: { top: "4px", left: "3.5px", height: "14px", width: "1px" },
  });
  await expect(root.locator('[data-emr-pinned-table-divider="true"]')).toHaveCount(1);
  const divider = root.locator('[data-emr-pinned-table-divider="true"]').first();
  await expect(divider).toBeVisible();
  await expect(divider).toHaveCSS("display", "block");
  await expect(divider.evaluate((element) => {
    const dividerRect = element.getBoundingClientRect();
    const viewport = element.closest('[data-emr-pinned-table-viewport="true"]');
    const viewportRect = viewport?.getBoundingClientRect();
    return viewportRect
      ? {
          top: Math.round(dividerRect.top - viewportRect.top),
          height: Math.round(dividerRect.height),
          viewportHeight: Math.round(viewportRect.height),
        }
      : null;
  })).resolves.toMatchObject({ top: 0 });
  await expect(divider.evaluate((element) => {
    const dividerRect = element.getBoundingClientRect();
    const viewport = element.closest('[data-emr-pinned-table-viewport="true"]');
    const viewportRect = viewport?.getBoundingClientRect();
    return viewportRect ? Math.round(dividerRect.height - viewportRect.height) : null;
  })).resolves.toBe(0);
  await expect(root.locator('[data-emr-pinned-table-scrollbar="horizontal"]')).toHaveCount(1);
  await expect(root.locator('[data-emr-pinned-table-scrollbar="horizontal"]').evaluate((element) =>
    getComputedStyle(element).insetInlineStart,
  )).resolves.toBe("408px");
  await expect(root.locator('[data-emr-pinned-table-scrollbar="horizontal"]')).toHaveCSS("z-index", "1");
  await expect(table.locator('[data-emr-pinned-table-header-divider="true"]')).toHaveCount(1);
  const headerDivider = table.locator('[data-emr-pinned-table-header-divider="true"]');
  await expect(headerDivider).toBeVisible();
  await expect(handle).toHaveCSS("pointer-events", "auto");
  await expect(handle).toHaveCSS("z-index", "16");
  await expect(handle.evaluate((element) => {
    const handleBounds = element.getBoundingClientRect();
    const dividerBounds = element
      .closest("th")
      ?.querySelector('[data-emr-pinned-table-header-divider="true"]')
      ?.getBoundingClientRect();
    return dividerBounds
      ? Math.abs(
          handleBounds.left + handleBounds.width / 2 -
            (dividerBounds.left + dividerBounds.width / 2),
        )
      : Number.POSITIVE_INFINITY;
  })).resolves.toBeLessThan(0.1);
  await handle.hover();
  await expect(handle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.keyboard.press("Tab");
  await handle.focus();
  await expect(handle.evaluate((element) =>
    element.matches(":focus-visible"),
  )).resolves.toBe(true);
  await expect(handle).toHaveCSS("outline-style", "none");
  await expect(
    table.locator(
      'th[data-column-id="displayName"] [data-emr-table-content="true"]',
    ),
  ).toHaveCSS("outline-style", "solid");
});

test("Plan/Order scroll columns keep a working header resize handle", async ({ page }) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const statusHeader = table.locator('th[data-column-id="status"]');
  const statusHandle = statusHeader.getByRole("button", {
    name: "업무 상태 컬럼 너비 조절",
  });
  await expect(statusHandle).toBeVisible();
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "88");
  const box = await statusHandle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(() =>
    statusHandle.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 16, box!.y + box!.height / 2);
  await page.mouse.up();
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "104");
  await statusHandle.focus();
  await statusHandle.press("ArrowRight");
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "112");
  await expect(table.locator('thead th[data-column-id="status"]')).not.toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("Plan/Order boundary drag resizes only Order name", async ({ page }) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const displayNameHeader = table.locator('th[data-column-id="displayName"]');
  const statusHeader = table.locator('th[data-column-id="status"]');
  const handle = displayNameHeader.locator('[data-emr-column-resize-handle="true"]');
  await expect(displayNameHeader).toHaveAttribute("data-emr-column-size", "180");
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "88");
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(handle).toHaveAttribute("data-resizing", "true");
  await expect(handle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.mouse.move(box!.x + box!.width / 2 + 24, box!.y + box!.height / 2);
  await page.mouse.up();
  await expect(displayNameHeader).toHaveAttribute("data-emr-column-size", "204");
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "88");
  await page.keyboard.press("Tab");
  await handle.focus();
  await handle.press("ArrowRight");
  await expect(displayNameHeader).toHaveAttribute("data-emr-column-size", "212");
  await expect(statusHeader).toHaveAttribute("data-emr-column-size", "88");
});

test("Plan/Order empty display values use the shared hyphen placeholder", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(table).toBeVisible();
  await expect(table).not.toContainText("—");
  await expect(table).not.toContainText("미설정");
});

test("Plan/Order billing and tax headers and switches are centered", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  for (const id of ["billingReflection", "taxClass"]) {
    await expect(table.locator(`th[data-column-id="${id}"] [data-emr-table-content="true"]`)).toHaveCSS(
      "justify-content",
      "center",
    );
    await expect(table.locator(`tbody td[data-column-id="${id}"] [data-emr-table-content="true"]`).first()).toHaveCSS(
      "justify-content",
      "center",
    );
  }
});

test("Plan/Order resize is live, keyboard-accessible, and does not sort", async ({ page }) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const orderHeader = table.locator('th[data-column-id="displayName"]');
  const grab = orderHeader.getByRole("button", { name: "Order 명 컬럼 너비 조절" });
  await expect(table.locator('tbody tr[data-emr-data-table-row="true"]').first()).toBeVisible();
  const rowLocator = table.locator('tbody tr[data-emr-data-table-row="true"]');
  await expect
    .poll(() =>
      rowLocator.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid"))),
    )
    .toEqual([
      "chart-order-row-order-kong-cbc",
      "chart-order-row-order-kong-fluid",
      "chart-order-row-order-kong-abdomen",
      "chart-order-row-order-kong-maropitant",
    ]);
  const rowIds = await table
    .locator('tbody tr[data-emr-data-table-row="true"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")));

  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "180");
  await grab.focus();
  await grab.press("ArrowRight");
  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "188");
  await expect(table.locator('thead th[data-column-id="displayName"]')).not.toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(table.locator('thead th[data-column-id="displayName"]')).not.toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await expect
    .poll(() =>
      table
        .locator('tbody tr[data-emr-data-table-row="true"]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid"))),
    )
    .toEqual(rowIds);

  await grab.press("Shift+ArrowLeft");
  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "164");

  await grab.press("Home");
  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "180");

  await grab.press("Shift+ArrowRight");
  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "204");
  await grab.dblclick();
  await expect(orderHeader).toHaveAttribute("data-emr-column-size", "180");
});

test("Plan/Order reset stays within the available pinned width cap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1060, height: 844 });
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const orderHeader = table.locator('th[data-column-id="displayName"]');
  const grab = orderHeader.getByRole("button", { name: "Order 명 컬럼 너비 조절" });
  const surface = page.locator('[data-slot="chart-order-table-surface"]');
  await expect(orderHeader).toBeVisible();

  const maxSize = await surface.evaluate(
    (element) =>
      Math.min(
        400,
        Math.max(160, element.getBoundingClientRect().width - 232 - 8 - 240),
    ),
  );
  expect(maxSize).toBeGreaterThanOrEqual(160);
  expect(maxSize).toBeLessThan(400);
  await expect(
    table.locator('xpath=ancestor::*[@data-emr-data-table="true"]'),
  ).toHaveAttribute("data-emr-data-table-pinning", "columns");

  await grab.focus();
  for (let index = 0; index < 20; index += 1) {
    await grab.press("Shift+ArrowRight");
  }
  await expect
    .poll(async () => Number(await orderHeader.getAttribute("data-emr-column-size")))
    .toBeCloseTo(maxSize, 0);

  await grab.press("Home");
  await expect(orderHeader).toHaveAttribute(
    "data-emr-column-size",
    String(Math.min(180, maxSize)),
  );
});

test("Plan/Order unpins below the approved 240px remaining viewport and restores pinning", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });

  const tableRoot = table.locator(
    'xpath=ancestor::*[@data-emr-data-table="true"]',
  );
  await expect(tableRoot).toHaveAttribute("data-emr-data-table-pinning", "none");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(tableRoot).toHaveAttribute("data-emr-data-table-pinning", "columns");
});

test("Plan/Order switch cells keep readonly and unknown presentation semantics", async ({
  page,
}) => {
  await page.goto(chartOrderUrl);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  await expect(
    table.locator('tbody tr[data-emr-data-table-row="true"]').first(),
  ).toBeVisible();
  const billingCells = table.locator('tbody td[data-column-id="billingReflection"]');
  const taxCells = table.locator('tbody td[data-column-id="taxClass"]');
  await expect(billingCells.getByRole("switch")).toHaveCount(0);
  await expect(taxCells.getByRole("switch")).toHaveCount(0);
  await expect(taxCells.getByLabel(/과세 미설정/)).toHaveCount(4);
  await expect(taxCells).toHaveText(["-", "-", "-", "-"]);
});

test("synthetic linked adjustment fixture exposes the paired editor", async ({
  page,
}) => {
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts?*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const row = body.rows?.find((candidate: { orderId?: string }) => candidate.orderId === "order-kong-maropitant");
    if (row) {
      row.orderConfirmationStatus = "confirmed";
      row.status = "confirmed";
      row.billingCandidateStatus = "candidate_created";
      row.unitPriceSnapshot = 100000;
      row.lineTotalSnapshot = 100000;
      row.appliedSnapshot = {
        ...row.appliedSnapshot,
        billingName: "Synthetic billing",
        priceKrw: 100000,
      };
    }
    await route.fulfill({ response, json: body });
  });
  await page.route(
    "**/api/workspaces/clair-demo/billing/invoice-candidates?*",
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      await route.fulfill({
        response,
        json: {
          ...body,
          candidates: [
            ...candidates.filter(
              (candidate: { orderId?: string }) =>
                candidate.orderId !== "order-kong-maropitant",
            ),
            {
              billingCandidateId: "synthetic-billing-candidate",
              orderId: "order-kong-maropitant",
              status: "candidate_created",
            },
          ],
        },
      });
    },
  );
  let saveCount = 0;
  const saveOverrides: Array<{
    adjustmentAmountKrw?: number;
    adjustmentPercent?: number;
    adjustmentReason?: string | null;
    adjustmentSource?: "amount" | "percent" | null;
  }> = [];
  const overrideUrl =
    "http://127.0.0.1:3128/api/workspaces/clair-demo/chart/order-prebilling-overrides";
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-prebilling-overrides",
    async (route) => {
      const request = route.request().postDataJSON() as {
        expectedVersion: number;
        orderId: string;
        override: {
          adjustmentAmountKrw?: number;
          adjustmentPercent?: number;
          adjustmentReason?: string | null;
          adjustmentSource?: "amount" | "percent" | null;
        };
      };
      saveCount += 1;
      saveOverrides.push(request.override);
      if (saveCount <= 2) {
        const source = request.override.adjustmentSource ?? "amount";
        const adjustmentAmountKrw =
          request.override.adjustmentAmountKrw ??
          (source === "percent"
            ? Math.round(100000 * (request.override.adjustmentPercent ?? -10) / 100)
            : -10000);
        const adjustmentPercent =
          request.override.adjustmentPercent ?? (adjustmentAmountKrw / 100000) * 100;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            enforcedBy: "chart-order-prebilling-override",
            ok: true,
            status: 200,
            override: {
              adjustmentAmountKrw,
              adjustmentPercent,
              adjustmentReason: request.override.adjustmentReason ?? null,
              adjustmentSource: source,
              baseAmountKrw: 100000,
              billingName: "Synthetic billing",
              billingQuantity: 1,
              billingReflectionEnabled: true,
              chargeAmountKrw: 90000,
              orderId: request.orderId,
              versionNo: request.expectedVersion + 1,
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 422, error: "db_write_failed" }),
      });
    },
  );
  await page.goto(chartOrderUrl);
  await expect(
    page.getByRole("table", { name: "처방/오더 테이블" })
      .locator('tbody tr[data-emr-data-table-row="true"]')
      .first(),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const amount = table.locator('td[data-column-id="adjustmentAmount"] input');
  const percent = table.locator('td[data-column-id="adjustmentPercent"] input');
  const reason = table.locator('td[data-column-id="adjustmentReason"] input');
  await expect(amount).toHaveCount(1);
  await expect(percent).toHaveValue("0");
  await expect(reason).toHaveValue("");
  await expect(amount).toHaveCSS("padding-left", "10px");
  await expect(percent).toHaveCSS("padding-left", "10px");
  await expect(amount.locator("xpath=..").locator("span")).toHaveCSS("right", "10px");
  await expect(percent.locator("xpath=..").locator("span")).toHaveCSS("right", "10px");
  await amount.fill("-10000");
  await expect(percent).toHaveValue("-10");
  await amount.focus();
  const amountSave = page.waitForResponse(
    (response) =>
      response.url() === overrideUrl && response.request().method() === "POST",
  );
  await amount.press("Enter");
  expect((await amountSave).status()).toBe(200);
  await expect.poll(() => saveCount).toBe(1);
  expect(saveOverrides[0]).toMatchObject({
    adjustmentAmountKrw: -10000,
    adjustmentSource: "amount",
  });
  await percent.focus();
  await percent.blur();
  await expect.poll(() => saveCount).toBe(1);
  await expect(amount).toHaveValue("-10000");
  await expect(percent).toHaveValue("-10");
  await reason.fill("자유 사유");
  const reasonSave = page.waitForResponse(
    (response) =>
      response.url() === overrideUrl && response.request().method() === "POST",
  );
  await reason.press("Enter");
  expect((await reasonSave).status()).toBe(200);
  await expect.poll(() => saveCount).toBe(2);
  expect(saveOverrides[1]).toMatchObject({
    adjustmentReason: "자유 사유",
  });
  await expect(reason).toHaveValue("자유 사유");
  await percent.fill("-12");
  await expect(amount).toHaveValue("-12000");
  const failedSave = page.waitForResponse(
    (response) =>
      response.url() === overrideUrl && response.request().method() === "POST",
  );
  await percent.press("Enter");
  expect((await failedSave).status()).toBe(422);
  await expect.poll(() => saveCount).toBe(3);
  expect(saveOverrides[2]).toMatchObject({
    adjustmentPercent: -12,
    adjustmentSource: "percent",
  });
  await expect(page.getByText("청구 전 값을 저장하지 못했어요.").last()).toBeVisible();
  await expect(percent).toHaveValue("-12");
  await expect(amount).toHaveValue("-12000");
  await expect(reason).toHaveValue("자유 사유");
});
