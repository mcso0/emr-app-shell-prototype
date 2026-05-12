import { expect, test, type Locator, type Page } from "@playwright/test";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

async function expectTopEdgeInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewportHeight = page.viewportSize()?.height ?? (await page.evaluate(() => window.innerHeight));

  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(viewportHeight);
}

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history&right=open");

  await expect(page.getByText("진료 대기열")).toBeVisible();
  const selectedQueueCard = page.getByTestId("order-queue-item-encounter-coco-260501");
  await expect(selectedQueueCard).toHaveAttribute("data-selected", "true");
  const selectedQueueCardColors = await selectedQueueCard.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--clair-color-primary-normal)";
    document.body.appendChild(probe);

    const primaryColor = getComputedStyle(probe).color;
    probe.remove();

    return {
      borderColor: getComputedStyle(element).borderTopColor,
      primaryColor,
      stripeColor: getComputedStyle(element.firstElementChild ?? element).backgroundColor,
    };
  });
  expect(selectedQueueCardColors.borderColor).toBe(selectedQueueCardColors.primaryColor);
  expect(selectedQueueCardColors.stripeColor).toBe(selectedQueueCardColors.primaryColor);
  await expect(page.getByRole("button", { name: "차트 이력 패널 접기" })).toBeVisible();
  await expect(page.locator("#chart-content-aside").getByText("차트이력")).toBeVisible();
  await expect(
    page.getByRole("separator", { name: "진료 기록과 처방/오더 영역 높이 조절" })
  ).toHaveCSS("height", "16px");
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("담당 수의사")).toBeVisible();
  await expect(page.getByRole("heading", { name: "진료 기록" })).toBeVisible();
  await expect(page.getByText("기본 SOAP")).toBeVisible();
  await expect(page.getByText("소화기 SOAP")).toBeVisible();
  await expect(page.getByRole("button", { name: "초안 저장" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /진단명/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "진단 이력" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /처방\/오더/ })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("항구토제 세트")).toBeVisible();
  await expect(page.getByText("피하 수액 처치").first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "오더 전체 선택" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" })).not.toBeChecked();
  await page.getByRole("button", { name: "소화기 SOAP 첨부 추가" }).click();
  await expect(page.getByText("1개").first()).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("chart diagnosis comment and plan are editable text areas", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await page.getByLabel("진단 코멘트").fill("보호자에게 탈수 징후 설명 완료.");
  await page.getByLabel("Plan").fill("수액 후 24시간 식욕과 구토 횟수 확인.");

  await expect(page.getByLabel("진단 코멘트")).toHaveValue("보호자에게 탈수 징후 설명 완료.");
  await expect(page.getByLabel("Plan")).toHaveValue("수액 후 24시간 식욕과 구토 횟수 확인.");
});

test("chart diagnosis search recommends, adds, marks, and removes session diagnoses", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const diagnosisPanel = page.getByLabel("진단명 관리");

  await diagnosisPanel.getByLabel("진단명 검색").click();
  await expect(page.getByRole("listbox", { name: "진단명 검색 결과" })).toBeVisible();
  await expect(page.getByText("SOAP/주호소 기반 추천")).toBeVisible();
  await expect(page.getByRole("option", { name: /급성 위장관염 의심/ })).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("췌장");
  await page.getByRole("option", { name: /췌장염 감별/ }).click();

  await expect(diagnosisPanel.getByText("췌장염 감별")).toBeVisible();
  await expect(diagnosisPanel.getByText("사전 연결 · 감별")).toBeVisible();
  await expect(page.getByText("소화기 SOAP")).toBeVisible();

  await diagnosisPanel.getByLabel("진단명 검색").fill("탈수");
  await page.getByRole("option", { name: /경도 탈수/ }).click();

  await expect(diagnosisPanel.getByText("경도 탈수")).toBeVisible();
  await expect(page.getByText("전신 SOAP")).toBeVisible();

  const pancreatitisConfirmedToggle = diagnosisPanel.getByRole("button", { name: "췌장염 감별 확진 토글" });
  await pancreatitisConfirmedToggle.click();
  await expect(diagnosisPanel.getByText("사전 연결 · 확진")).toBeVisible();
  await expect(pancreatitisConfirmedToggle).toHaveAttribute("aria-pressed", "true");
  await pancreatitisConfirmedToggle.click();
  await expect(pancreatitisConfirmedToggle).toHaveAttribute("aria-pressed", "false");

  await diagnosisPanel.getByLabel("진단명 검색").fill("보호자 설명용 임시 진단");
  await page.getByRole("option", { name: /보호자 설명용 임시 진단/ }).click();

  await expect(diagnosisPanel.getByText("보호자 설명용 임시 진단")).toBeVisible();
  await expect(diagnosisPanel.getByText("직접 입력 · 의심")).toBeVisible();

  await diagnosisPanel.getByRole("button", { name: "보호자 설명용 임시 진단 삭제" }).click();
  await expect(diagnosisPanel.getByText("보호자 설명용 임시 진단")).toHaveCount(0);
});

test("chart safety context and confirmation dialogs identify the active patient", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext.getByText("콩이 · 보호자 김하늘")).toBeVisible();
  await expect(patientContext.getByText("차트번호")).toBeVisible();
  await expect(patientContext.getByText("E-260501-0003")).toBeVisible();
  await expect(page.getByText("콩이(4세) · 보호자 김하늘 · 푸들")).toBeVisible();
  await expect(page.getByTestId("chart-soap-status")).toHaveText("자동저장됨 · 10:16");
  await expect(page.getByText("자동저장됨 · 10:16").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Order 청구" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Order 확정" })).toBeDisabled();

  await page.getByRole("button", { name: "차트 작성완료" }).click();
  const chartCompleteDialog = page.getByRole("dialog");
  await expect(chartCompleteDialog.getByText("차트 작성완료 확인")).toBeVisible();
  await expect(chartCompleteDialog.getByText("환자: 콩이 · 보호자 김하늘")).toBeVisible();
  await expect(chartCompleteDialog.getByText("차트번호: E-260501-0003")).toBeVisible();
  await expect(chartCompleteDialog.getByText("진단명: 1건 · 오더: 4건")).toBeVisible();
  await chartCompleteDialog.getByRole("button", { name: "계속 작성" }).click();

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();
  await expect(page.getByRole("button", { name: "Order 청구" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Order 확정" })).toBeEnabled();

  await page.getByRole("button", { name: "Order 확정" }).click();
  const orderConfirmDialog = page.getByRole("dialog");
  await expect(orderConfirmDialog.getByText("Order 확정 확인")).toBeVisible();
  await expect(orderConfirmDialog.getByText("환자: 콩이 · 보호자 김하늘")).toBeVisible();
  await expect(orderConfirmDialog.getByText("차트번호: E-260501-0003")).toBeVisible();
  await expect(orderConfirmDialog.getByText("선택 오더: 1건 · 선택 금액 4,500")).toBeVisible();
  await expect(orderConfirmDialog.getByText("재요청 포함: 없음")).toBeVisible();
});

test("chart keeps orders visible when SOAP sections grow", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const addSoapButton = page.getByRole("button", { name: "SOAP 추가", exact: true });

  for (let count = 0; count < 4; count += 1) {
    await addSoapButton.click();
  }

  await expect(page.getByText("추가 계통 SOAP 4")).toBeVisible();
  await expectTopEdgeInViewport(page, page.getByRole("heading", { name: /처방\/오더/ }));
  await expectTopEdgeInViewport(page, page.getByRole("button", { name: "Order 확정" }));
});

test("chart grab divider resizes the SOAP and order areas", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const divider = page.getByRole("separator", { name: "진료 기록과 처방/오더 영역 높이 조절" });
  const orderHeading = page.getByRole("heading", { name: /처방\/오더/ });

  await expect(divider).toBeVisible();
  await expect(orderHeading).toBeVisible();

  const beforeBox = await orderHeading.boundingBox();

  await divider.press("ArrowDown");
  await divider.press("ArrowDown");

  const afterBox = await orderHeading.boundingBox();

  expect(beforeBox).not.toBeNull();
  expect(afterBox).not.toBeNull();
  expect(afterBox!.y).toBeGreaterThan(beforeBox!.y);
});

test("chart grab divider stops resizing when pointer focus is lost", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const divider = page.getByRole("separator", { name: "진료 기록과 처방/오더 영역 높이 조절" });

  await expect(divider).toBeVisible();

  const dividerBox = await divider.boundingBox();

  expect(dividerBox).not.toBeNull();

  const pointerX = dividerBox!.x + dividerBox!.width / 2;
  const pointerY = dividerBox!.y + dividerBox!.height / 2;

  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY + 80);

  const valueAfterDrag = await divider.getAttribute("aria-valuenow");

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.move(pointerX, pointerY - 120);
  await page.mouse.up();

  await expect(divider).toHaveAttribute("aria-valuenow", valueAfterDrag ?? "");
});

test("chart order checkboxes update the selected order total", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByText("선택 오더 0건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 0")).toBeVisible();

  await page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }).check();

  await expect(page.getByText("선택 오더 1건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 4,500")).toBeVisible();

  const selectAllOrders = page.getByRole("checkbox", { name: "오더 전체 선택" });

  await selectAllOrders.check();
  await expect(page.getByText("선택 오더 4건")).toBeVisible();

  await selectAllOrders.uncheck();

  await expect(page.getByText("선택 오더 0건")).toBeVisible();
  await expect(page.getByText("선택 오더 합계: 0")).toBeVisible();
});

test("chart opens the Kong scenario as one SOAP, assessment, and order flow", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext.getByText("콩이")).toBeVisible();
  await expect(patientContext.getByText("김하늘")).toBeVisible();
  await expect(patientContext.getByText("담당 수의사")).toBeVisible();
  await expect(page.getByText("보호자 진술상 전날 밤부터 구토 3회, 아침 식욕 없음. 물 섭취 후 재구토.")).toBeVisible();
  await expect(page.getByText("체온 39.1C, 복부 촉진 시 경미한 불편감. 탈수 경도 의심.")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심. 이물 가능성 배제를 위해 검사/영상 확인 필요.").first()).toBeVisible();
  await expect(page.getByText("피하 수액과 항구토제 처방 후 수납 안내").first()).toBeVisible();
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByText("복부 초음파").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "경구제 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "원내 검사 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "영상 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "치료 1" })).toBeVisible();
});

test("chart queue selection changes the selected encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("하루")).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
  await expect(page.getByText("진단 입력 전입니다.")).toBeVisible();
  await expect(page.getByText("기본 SOAP")).toBeVisible();
});

test("chart scenario query primes the encounter without locking queue selection", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("하루")).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
});

test("chart history selection returns to a previous encounter for the patient", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  await page.getByTestId("order-queue-item-encounter-coco-260501").click();
  await page.getByTestId("chart-history-item-encounter-coco-260501").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("코코")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});

test("chart patient panels collapse and reopen from the context bar", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history&right=closed");

  await expect(page.locator("#chart-content-aside").getByText("차트이력")).toBeVisible();
  const historyToggleOpen = page.getByRole("button", { name: "차트 이력 패널 접기" });
  await expect(historyToggleOpen).toHaveAttribute("aria-pressed", "true");
  await expect(historyToggleOpen).toHaveAttribute("data-state", "on");
  await page.getByRole("button", { name: "차트 이력 패널 접기" }).hover();
  await expect(page.getByText("과거 이력 보기")).toBeVisible();
  await page.getByRole("button", { name: "차트 이력 패널 접기" }).click();
  await expect(page).toHaveURL(/aside=closed/);

  const historyToggleClosed = page.getByRole("button", { name: "차트 이력 패널 열기" });
  await expect(historyToggleClosed).toHaveAttribute("aria-pressed", "false");
  await expect(historyToggleClosed).toHaveAttribute("data-state", "off");
  await page.getByRole("button", { name: "차트 이력 패널 열기" }).hover();
  await expect(page.getByText("과거 이력 보기")).toBeVisible();
  await page.getByRole("button", { name: "차트 이력 패널 열기" }).click();
  await expect(page).toHaveURL(/aside=history/);

  await expect(page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보")).toBeHidden();
  const patientInfoToggleClosed = page.getByRole("button", { name: "환자 정보 열기" });
  await expect(patientInfoToggleClosed).toHaveAttribute("aria-pressed", "false");
  await expect(patientInfoToggleClosed).toHaveAttribute("data-state", "off");
  await page.getByRole("button", { name: "환자 정보 열기" }).hover();
  await expect(page.getByText("환자 정보 보기")).toBeVisible();
  await page.getByRole("button", { name: "환자 정보 열기" }).click();
  await expect(page).toHaveURL(/right=open/);
  const patientInfoToggleOpen = page.getByRole("button", { name: "환자 정보 접기" });
  await expect(patientInfoToggleOpen).toHaveAttribute("aria-pressed", "true");
  await expect(patientInfoToggleOpen).toHaveAttribute("data-state", "on");
  await expect(page.getByText("진료 참고 · 개인/민감 정보 · 부가 정보")).toHaveCount(0);
  const patientInfoPanelTitle = page.getByRole("heading", { name: "환자 정보" });
  const patientInfoPanelCollapse = page.getByRole("button", { name: "환자 정보 패널 접기" });
  await expect(patientInfoPanelCollapse).toBeVisible();
  const titleBox = await patientInfoPanelTitle.boundingBox();
  const collapseBox = await patientInfoPanelCollapse.boundingBox();
  if (!titleBox || !collapseBox) {
    throw new Error("Patient info panel title or collapse button was not measurable.");
  }
  expect(collapseBox.x - (titleBox.x + titleBox.width)).toBeLessThanOrEqual(8);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toBeVisible();
  await expect(page.getByText("부가 정보", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "환자 정보 패널 접기" }).click();
  await expect(page).toHaveURL(/right=closed/);
  await expect(page.getByText("개인/민감 정보", { exact: true })).toBeHidden();
});
