import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { getModule } from "@/modules/registry";
import { WorkspaceDocumentLayout } from "@/shell/workspace-document-layout";
import { ChartSlotAvailabilityProvider } from "./module";
import { createChartWorkspaceFixture, type ChartWorkspaceScenario } from "./chart-workspace.stories.fixture";

let fixture: ReturnType<typeof createChartWorkspaceFixture>;
function Example({ width }: { scenario: ChartWorkspaceScenario; width: number }) {
  const instance = fixture;
  const [mounted, setMounted] = useState(true);
  const [route, setRoute] = useState("");
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  const props = { workspaceId: instance.workspaceId, moduleId: "treatment", moduleLabel: "진료/차트", onNavigateWorkspaceSurface: (href: string) => { instance.routes.push(href); setRoute(href); } };
  // Keep route context local to this synthetic mount. The framework's current
  // App Router decorator lacks the Next.js 16.4 parentRenderTree fixture.
  const navigation = instance.editable ? {
    pathname: `/w/${instance.workspaceId}/treatment`,
    query: { date: "2026-10-11", encounterId: instance.current.encounter.id, chartId: instance.chart.id },
  } : meta.parameters.nextjs.navigation;
  const [router] = useState(() => ({ bfcacheId: "synthetic-chart", back: fn(), forward: fn(), refresh: fn(), prefetch: fn(), push: fn((href: string) => { instance.routes.push(href); }), replace: fn((href: string) => { instance.routes.push(href); }) }));
  const [searchParams] = useState(() => new URLSearchParams(navigation.query));
  return <AppRouterContext.Provider value={router}><PathnameContext.Provider value={navigation.pathname}><SearchParamsContext.Provider value={searchParams}><div className="flex h-[960px] max-w-full flex-col" style={{ width }}>
    {mounted ? <ChartSlotAvailabilityProvider {...props}>{availability => <WorkspaceDocumentLayout moduleDefinition={getModule("treatment")} slotProps={{ ...props, ...availability }} />}</ChartSlotAvailabilityProvider> : null}
    {instance.editable ? <Toaster /> : null}
    {route ? <output aria-label="합성 차트 이동 경로">{route}</output> : null}
  </div></SearchParamsContext.Provider></PathnameContext.Provider></AppRouterContext.Provider>;
}
const meta = {
  title: "Features/Chart/Actual Workspace", component: Example, tags: ["autodocs"], args: { scenario: "historical" as ChartWorkspaceScenario, width: 1580 }, argTypes: { scenario: { control: false }, width: { control: { type: "number", min: 1040, max: 1900 } } },
  parameters: { nextjs: { appDirectory: false, navigation: { pathname: "/w/storybook-chart/treatment", query: { date: "2026-10-11", encounterId: "98000000-0000-4000-8001-000000000001", historyEncounterId: "98000000-0000-4000-8001-000000000002", chartId: "98000000-0000-4000-8002-000000000001" } } }, layout: "fullscreen", docs: { story: { inline: false, height: "1000px" }, description: { component: "실제 ChartSlotAvailabilityProvider와 WorkspaceDocumentLayout에서 ChartContent와 private 처방/오더 표를 렌더합니다. 현재 접수와 완료한 과거 접수는 같은 합성 환자에 속합니다. 실제 main의 과거 차트 읽기 전용 상태를 사용합니다. 실제 과거 차트 경로의 encounterId, historyEncounterId, chartId를 사용하므로 대기열 조회 뒤에도 같은 차트를 엽니다. 표의 행·컬럼·밀도·필터·접기·비활성 이유를 새로 만들지 않습니다. 조회 API는 workspace와 진료 범위의 합성 응답이며 저장 요청은 로컬 권한 거부로 끝납니다. 미지원 읽기는 검증에서 드러납니다. 환자 컨텍스트 헤더와 전체 AppShell, 진행 중 차트 편집·확정·수납 성공은 별도 범위입니다. 기존 밀도 비교 예제와 SummaryAndDetails는 유지합니다." } } },
  beforeEach: ({ args }) => { fixture = createChartWorkspaceFixture(args.scenario); return fixture.install(); },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
type Canvas = ReturnType<typeof within>;
async function ready(canvas: Canvas) {
  await waitFor(() => expect(canvas.getByTestId("chart-historical-readonly-badge")).toHaveTextContent("과거 차트 · 읽기 전용"), { timeout: 5000 });
  await waitFor(() => expect(canvas.getByTestId(`chart-order-row-${fixture.rows[0].orderId}`)).toBeVisible(), { timeout: 5000 });
  await expect(fixture.unhandled).toEqual([]);
}
export const HistoricalTableAndDensity: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas); const table = canvas.getByRole("table", { name: "처방/오더 테이블" });
  await expect(within(table).getAllByLabelText("합성 요청 수의사 요청 수의사")).toHaveLength(2);
  const headers = ["선택", "분류", "확정 여부", "Order 명", "업무 상태", "청구서명", "청구반영", "일수", "횟수", "총횟수", "head/kg당", "처방 용량", "용량 단위", "1회 조제량", "성분량", "총 조제량", "실 조제량", "보관", "투여/복약", "단가", "수량", "합계", "할인/할증", "%", "총 청구금액", "할인/할증 사유", "과세", "업무 담당", "요청 수의사"];
  await expect(within(table).getAllByRole("columnheader")).toHaveLength(headers.length);
  for (const name of headers) await expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
  const first = () => canvas.getByTestId(`chart-order-row-${fixture.rows[0].orderId}`);
  const standard = first().getBoundingClientRect().height;
  const selection = canvas.getByRole("checkbox", { name: "합성 임상 검사 선택" });
  await expect(selection).toHaveAttribute("aria-disabled", "true"); await userEvent.click(selection); await expect(selection).toHaveAttribute("aria-checked", "false");
  await userEvent.click(canvas.getByRole("button", { name: "테이블 보기 밀도: 기본 간격" }));
  const body = within(canvasElement.ownerDocument.body); await userEvent.click(await body.findByRole("menuitemradio", { name: "좁은 간격" }));
  await waitFor(() => expect(first().getBoundingClientRect().height).toBeLessThan(standard));
  await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
} };
export const OrderFilters: Story = { play: async ({ canvas }) => {
  await ready(canvas); const filters = within(canvas.getByRole("tablist", { name: "처방/오더 분류" }));
  await userEvent.click(filters.getByRole("tab", { name: "임상 1" }));
  await waitFor(() => expect(canvas.queryByTestId(`chart-order-row-${fixture.rows[1].orderId}`)).not.toBeInTheDocument());
  await expect(canvas.getByTestId(`chart-order-row-${fixture.rows[0].orderId}`)).toBeVisible();
  const treatment = filters.getByRole("tab", { name: "처치 1" }); treatment.focus(); await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(canvas.queryByTestId(`chart-order-row-${fixture.rows[0].orderId}`)).not.toBeInTheDocument());
  await expect(canvas.getByTestId(`chart-order-row-${fixture.rows[1].orderId}`)).toBeVisible();
  await userEvent.click(filters.getByRole("tab", { name: "전체오더 2" })); await ready(canvas);
} };
export const OrderDetailProfileReadOnly: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas);
  const trigger = canvas.getByRole("button", { name: "합성 임상 검사 상세" });
  trigger.focus(); await waitFor(() => expect(trigger).toBeVisible()); await userEvent.keyboard("{Enter}");
  const body = within(canvasElement.ownerDocument.body);
  const detail = within(await body.findByRole("dialog", { name: "합성 임상 검사 상세" }));
  await waitFor(() => expect(detail.getByTestId("lab-result-profile-selection")).toHaveTextContent("조회 전용입니다. 확정된 프로필과 기존 결과는 유지됩니다."));
  await expect(detail.getByText("오더 선택: 미선택 · 기존 V1 계약")).toBeVisible();
  const priority = detail.getByRole("switch", { name: "긴급 합성 임상 검사 긴급" });
  await expect(priority).toHaveAttribute("aria-disabled", "true");
  await expect(priority).toHaveAttribute("aria-checked", "false");
  await expect(priority).toHaveAttribute("tabindex", "-1");
  await expect(detail.queryByRole("combobox", { name: "검사 결과 프로필 선택" })).not.toBeInTheDocument();
  await expect(fixture.requests.some(request => request.url.endsWith(`/lab-imaging/result-profiles?orderId=${fixture.rows[0].orderId}`))).toBe(true);
  await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog", { name: "합성 임상 검사 상세" })).not.toBeInTheDocument());
  await userEvent.hover(canvas.getByTestId(`chart-order-row-${fixture.rows[0].orderId}`));
  trigger.focus();
  await waitFor(() => expect(trigger).toBeVisible());
  await expect(trigger).toHaveFocus();
} };
export const ClinicalPanelCollapseKeyboard: Story = { play: async ({ canvas }) => {
  await ready(canvas);
  const collapse = canvas.getByRole("button", { name: "S/O 패널 접기" });
  collapse.focus(); await waitFor(() => expect(collapse).toBeVisible()); await userEvent.keyboard("{Enter}");
  const expand = await canvas.findByRole("button", { name: "S/O 패널 펼치기" });
  await waitFor(() => expect(expand).toHaveFocus()); await expect(canvas.getByTestId("chart-soap-diagnosis-grid")).toHaveAttribute("data-collapsed-count", "1");
  await userEvent.keyboard("{Enter}"); await waitFor(() => expect(canvas.getByRole("button", { name: "S/O 패널 접기" })).toHaveFocus());
  await expect(canvas.getByTestId("chart-soap-diagnosis-grid")).toHaveAttribute("data-collapsed-count", "0");
} };
export const InlineHistorySearch: Story = { play: async ({ canvas }) => {
  await ready(canvas);
  const itemId = `chart-diagnosis-history-item-${fixture.history[0].encounter.id}`;
  const item = await canvas.findByTestId(itemId);
  await expect(item).toHaveTextContent("합성 이전 평가");
  const search = canvas.getByRole("textbox", { name: "진단 이력 검색" });
  await userEvent.type(search, "합성 이전");
  await waitFor(() => expect(canvas.getByTestId(itemId).querySelector("[data-history-diagnosis] strong")).toHaveTextContent("합성 이전"));
  await userEvent.clear(search); await userEvent.type(search, "synthetic-no-history-match");
  await waitFor(() => expect(canvas.getByTestId("chart-history-empty-state")).toHaveTextContent("검색 결과가 없습니다"));
  await expect(canvas.queryByTestId(itemId)).not.toBeInTheDocument();
  await userEvent.clear(search);
  await waitFor(() => expect(canvas.getByTestId(itemId)).toBeVisible());
  within(canvas.getByTestId(itemId)).getByRole("button", { name: "차트 보기" }).focus();
  await waitFor(() => expect(canvas.getByTestId(itemId)).toHaveAttribute("data-actions-visible", "true"));
  await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
} };
export const OrderReadErrorAndRetry: Story = { args: { scenario: "order-read-error" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getByTestId("chart-order-state-error")).toHaveTextContent("오더 정보를 불러오지 못했어요"), { timeout: 5000 });
  const reads = fixture.orderReads; fixture.recoverOrders();
  await userEvent.click(within(canvas.getByTestId("chart-order-state-error")).getByRole("button", { name: "다시 불러오기" })); await ready(canvas);
  await expect(fixture.orderReads).toBeGreaterThan(reads); await expect(canvas.queryByTestId("chart-order-state-error")).not.toBeInTheDocument();
} };

/** Hands-on local preview; refresh restores the synthetic automatic quantity. */
export const EditDispenseQuantity: Story = {
  args: { scenario: "dispense-edit" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const input = await body.findByRole("textbox", { name: "합성 조제 약품 실 조제량" });
    await expect(input).toHaveValue("1.0");
    await expect(input).toHaveAttribute("type", "text");
    await expect(body.queryByRole("button", { name: "합성 조제 약품 실 조제량 저장" })).not.toBeInTheDocument();
    await userEvent.clear(input); await userEvent.type(input, "abc");
    await expect(await body.findByRole("alert")).toHaveTextContent("숫자만 입력해 주세요.");
    await userEvent.keyboard("{Enter}"); await userEvent.tab();
    await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
    await userEvent.clear(input); await userEvent.type(input, "1.2");
    await userEvent.tab();
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.actualDispenseQuantity).toBe(1.2));
    await expect(input).toHaveValue("1.2");
    await expect(body.queryByRole("button", { name: /합성 조제 약품.*(재확인|되돌리기)/ })).not.toBeInTheDocument();
    const writes = fixture.requests.filter(request => request.method !== "GET");
    await expect(writes.map(request => request.body?.mode)).toEqual(["manual"]);
    for (const request of writes) await expect(request.body).not.toHaveProperty("reason");
  },
  parameters: { docs: { description: { story: "실 조제량은 텍스트로 입력하고 Enter 또는 포커스 이동으로 저장합니다. 잘못된 입력은 유지하며 오류 테두리와 포커스·호버 툴팁을 표시합니다. 셀 옆 저장·재확인·되돌리기 버튼은 없습니다. 저장은 합성 미리보기 메모리에만 반영되며 새로고침하면 초기화됩니다." } } },
};

export const RecalculateDispensePrescription: Story = {
  args: { scenario: "dispense-edit" },
  parameters: { docs: { description: { story: "16 mg/mL 합성 약품의 일수·용량·횟수를 편집합니다. 모든 수량은 텍스트 입력이며 잘못된 값은 저장되지 않습니다. 수동 실 조제량은 처방 변경 후에도 유지됩니다. 값을 확인한 뒤 실 조제량 입력에서 Enter를 누르면 재확인합니다. 별도 재확인·되돌리기 버튼은 없습니다. 실제 DB 계산·확정은 포함하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const quantity = () => body.getByRole("textbox", { name: "합성 조제 약품 실 조제량" });
    const days = () => body.getByRole("textbox", { name: "합성 조제 약품 일수" });
    const dose = () => body.getByRole("textbox", { name: "합성 조제 약품 용량" });
    await body.findByRole("textbox", { name: "합성 조제 약품 실 조제량" });
    const writes = () => fixture.requests.filter(request => request.method !== "GET");
    for (const field of [days, dose]) {
      await expect(field()).toHaveAttribute("type", "text");
      const before = writes().length;
      const rowHeight = field().closest("tr")!.getBoundingClientRect().height;
      await userEvent.clear(field()); await userEvent.type(field(), "abc");
      await expect(field()).toHaveAttribute("aria-invalid", "true");
      await expect(body.getByRole("button", { name: "합성 조제 약품 확정", hidden: true })).toBeDisabled();
      await waitFor(() => expect(canvasElement.ownerDocument.querySelector('[data-slot="tooltip-content"]')).toHaveTextContent("숫자만 입력해 주세요."));
      await expect(field().closest("tr")!.getBoundingClientRect().height).toBe(rowHeight);
      await userEvent.keyboard("{Enter}"); await userEvent.tab();
      await expect(writes()).toHaveLength(before);
      await expect(field()).toHaveValue("abc");
      await userEvent.click(field()); await userEvent.keyboard("{Escape}");
    }
    await userEvent.clear(days()); await userEvent.type(days(), "1.5");
    await expect(days()).toHaveAttribute("aria-invalid", "true");
    await userEvent.keyboard("{Enter}");
    await expect(fixture.rows[0].detailInputs.durationDays).toBe(1);
    await userEvent.clear(days()); await userEvent.type(days(), "2"); await userEvent.tab();
    await waitFor(() => expect(quantity()).toHaveValue("2.0"), { timeout: 5000 });
    await userEvent.clear(dose()); await userEvent.type(dose(), "32"); await userEvent.tab();
    await waitFor(() => expect(quantity()).toHaveValue("4.0"), { timeout: 5000 });
    await expect(fixture.rows[0].detailInputs.dose).toBe(32);
    await userEvent.clear(quantity()); await userEvent.type(quantity(), "1.2");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.actualDispenseQuantity).toBe(1.2));
    await userEvent.clear(days()); await userEvent.type(days(), "3"); await userEvent.tab();
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.theoreticalTotalQuantity).toBe(6), { timeout: 5000 });
    await expect(quantity()).toHaveValue("1.2");
    await expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(true);
    await userEvent.click(quantity()); await userEvent.tab();
    await expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(true);
    await userEvent.click(quantity()); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(false));
    await expect(quantity()).toHaveValue("1.2");
    await userEvent.click(body.getByRole("combobox", { name: "합성 조제 약품 빈도" }));
    await userEvent.click(await body.findByRole("option", { name: "BID" }));
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.theoreticalTotalQuantity).toBe(12), { timeout: 5000 });
    await expect(quantity()).toHaveValue("1.2");
    await userEvent.click(quantity()); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(false));
    await expect(body.queryByRole("button", { name: /합성 조제 약품.*(재확인|되돌리기)/ })).not.toBeInTheDocument();
    await expect(fixture.requests.some(request => request.body?.mode === "reconfirm")).toBe(true);
    await expect(fixture.unhandled).toEqual([]);
  },
};


export const DispenseUnitOptions: Story = {
  args: { scenario: "dispense-edit" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const unit = await body.findByRole("combobox", { name: "합성 조제 약품 단위" });
    unit.focus(); await userEvent.keyboard("{Enter}");
    const list = await body.findByRole("listbox");
    await expect(within(list).getAllByRole("option").map(option => option.textContent)).toEqual(["mcg", "mg", "g", "mL", "L"]);
    await userEvent.keyboard("{Escape}");
    const trigger = body.getByRole("button", { name: "합성 조제 약품 더보기" });
    trigger.focus(); await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("menuitem", { name: "오더 상세·수정" }));
    const detail = within(await body.findByRole("dialog", { name: "합성 조제 약품 상세" }));
    await userEvent.click(detail.getByRole("combobox", { name: "합성 조제 약품 단위" }));
    const detailList = await body.findByRole("listbox");
    await expect(within(detailList).getAllByRole("option").map(option => option.textContent)).toEqual(["mcg", "mg", "g", "mL", "L"]);
    await userEvent.keyboard("{Escape}");
    await expect(fixture.rows[0].detailInputs.doseUnit).toBe("mg");
    await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
  },
};


export const UnsupportedDispenseUnit: Story = {
  args: { scenario: "dispense-edit" },
  beforeEach: () => { fixture.rows[0].detailInputs.doseUnit = "capsule"; },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const unit = await body.findByRole("combobox", { name: "합성 조제 약품 단위" });
    await expect(unit).toHaveTextContent("capsule");
    await expect(unit).toHaveAttribute("aria-invalid", "true");
    unit.focus(); await userEvent.keyboard("{Enter}");
    await expect(await body.findByRole("option", { name: "capsule (사용 불가)" })).toHaveAttribute("aria-disabled", "true");
    await expect(body.getByRole("option", { name: "mg" })).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await expect(fixture.rows[0].detailInputs.doseUnit).toBe("capsule");
    await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
  },
};


function setLegacyDispenseUnits(perKg: boolean, confirmed = false) {
  const row = fixture.rows[0];
  row.detailInputs = { ...row.detailInputs, dose: 1, doseBasis: perKg ? "kg" : "patient", doseUnit: perKg ? "ml/kg" : "ml", totalQuantityUnit: "ml" };
  if (confirmed) { row.orderConfirmationStatus = "confirmed"; row.status = "completed"; }
}

async function checkLegacyUnitPicker(body: Canvas, control: HTMLElement, label: string) {
  await expect(control).toHaveTextContent(label);
  await expect(control).not.toHaveAttribute("aria-invalid", "true");
  control.focus(); await userEvent.keyboard("{Enter}");
  const list = within(await body.findByRole("listbox"));
  await expect(list.queryByRole("option", { name: /사용 불가/ })).not.toBeInTheDocument();
  await expect(list.getByRole("option", { name: label, selected: true })).not.toHaveAttribute("aria-disabled", "true");
  await userEvent.keyboard("{Escape}");
}

async function checkLegacyDispenseUnits(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  const original = JSON.stringify(fixture.rows[0].detailInputs);
  const label = fixture.rows[0].detailInputs.doseUnit === "ml/kg" ? "mL/kg" : "mL";
  await checkLegacyUnitPicker(body, await body.findByRole("combobox", { name: "합성 조제 약품 단위" }), label);
  body.getByRole("button", { name: "합성 조제 약품 더보기" }).focus(); await userEvent.keyboard("{Enter}");
  await userEvent.click(await body.findByRole("menuitem", { name: "오더 상세·수정" }));
  const detail = within(await body.findByRole("dialog", { name: "합성 조제 약품 상세" }));
  await checkLegacyUnitPicker(body, detail.getByRole("combobox", { name: "합성 조제 약품 단위" }), label);
  await checkLegacyUnitPicker(body, detail.getByRole("combobox", { name: "합성 조제 약품 조제 단위" }), "mL");
  await expect(JSON.stringify(fixture.rows[0].detailInputs)).toBe(original);
  await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
}

export const LegacyMlUnits: Story = {
  args: { scenario: "dispense-edit" },
  beforeEach: () => setLegacyDispenseUnits(false),
  play: async ({ canvasElement }) => checkLegacyDispenseUnits(canvasElement),
};

export const LegacyMlPerKgUnits: Story = {
  args: { scenario: "dispense-edit" },
  beforeEach: () => setLegacyDispenseUnits(true),
  play: async ({ canvasElement }) => checkLegacyDispenseUnits(canvasElement),
};

export const LegacyUnitsInReRequest: Story = {
  args: { scenario: "dispense-edit" },
  beforeEach: () => setLegacyDispenseUnits(true, true),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const original = JSON.stringify(fixture.rows[0].detailInputs);
    (await body.findByRole("button", { name: "합성 조제 약품 더보기" })).focus(); await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("menuitem", { name: "재요청" }));
    const dialog = within(await body.findByRole("dialog"));
    await checkLegacyUnitPicker(body, dialog.getByRole("combobox", { name: "합성 조제 약품 단위" }), "mL/kg");
    await checkLegacyUnitPicker(body, dialog.getByRole("combobox", { name: "합성 조제 약품 조제 단위" }), "mL");
    await expect(JSON.stringify(fixture.rows[0].detailInputs)).toBe(original);
    await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(0);
  },
};

export const UnitChangesPreservePrescription: Story = {
  args: { scenario: "dispense-edit" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dose = () => body.getByRole("textbox", { name: "합성 조제 약품 용량" });
    const unit = () => body.getByRole("combobox", { name: "합성 조제 약품 단위" });
    const actual = await body.findByRole("textbox", { name: "합성 조제 약품 실 조제량" });
    await userEvent.clear(actual); await userEvent.type(actual, "1.2"); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(fixture.rows[0].calculationOutputs.actualDispenseQuantity).toBe(1.2));
    for (const [nextUnit, nextDose] of [["mL", 1], ["L", 0.001], ["g", 0.016], ["mcg", 16000], ["mg", 16]] as const) {
      unit().focus(); await userEvent.keyboard("{Enter}");
      await userEvent.click(await body.findByRole("option", { name: nextUnit }));
      await waitFor(() => expect(fixture.rows[0].detailInputs).toMatchObject({ dose: nextDose, doseUnit: nextUnit }));
      await expect(dose()).toHaveValue(String(nextDose));
      await expect(fixture.rows[0].calculationOutputs.theoreticalTotalQuantity).toBe(1);
      await expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(false);
      await expect(actual).toHaveValue("1.2");
    }
    const trigger = body.getByRole("button", { name: "합성 조제 약품 더보기" });
    trigger.focus(); await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("menuitem", { name: "오더 상세·수정" }));
    const detail = within(await body.findByRole("dialog", { name: "합성 조제 약품 상세" }));
    await userEvent.click(detail.getByRole("combobox", { name: "합성 조제 약품 단위" }));
    await userEvent.click(await body.findByRole("option", { name: "mL" }));
    await expect(detail.getByRole("spinbutton", { name: "합성 조제 약품 용량" })).toHaveValue(1);
    await userEvent.click(detail.getByRole("button", { name: "저장하고 닫기" }));
    await waitFor(() => expect(fixture.rows[0].detailInputs).toMatchObject({ dose: 1, doseUnit: "mL" }));
    await expect(fixture.rows[0].calculationOutputs.theoreticalTotalQuantity).toBe(1);
    await expect(fixture.rows[0].calculationOutputs.actualDispenseQuantity).toBe(1.2);
    await expect(fixture.rows[0].calculationOutputs.requiresReconfirmation).toBe(false);
    await expect(fixture.unhandled).toEqual([]);
  },
};


export const SmallDoseUnitConversion: Story = {
  args: { scenario: "dispense-edit" },
  beforeEach: () => { fixture.rows[0].calculationOutputs.preparationPolicy = null; },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dose = await body.findByRole("textbox", { name: "합성 조제 약품 용량" });
    const unit = body.getByRole("combobox", { name: "합성 조제 약품 단위" });
    await userEvent.clear(dose); await userEvent.type(dose, "0.01"); await userEvent.tab();
    await waitFor(() => expect(fixture.rows[0].detailInputs.dose).toBe(0.01));
    unit.focus(); await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("option", { name: "L" }));
    await waitFor(() => expect(fixture.rows[0].detailInputs).toMatchObject({ dose: 0.000000625, doseUnit: "L" }));
    await expect(dose).toHaveValue("0.000000625");
    await expect(dose).toHaveAttribute("aria-invalid", "false");
    await expect(fixture.rows[0].calculationOutputs.theoreticalTotalQuantity).toBe(0.000625);
    await expect(body.getByRole("button", { name: "합성 조제 약품 확정", hidden: true })).not.toBeDisabled();
    // An invalid text draft must not be relabeled from the last saved number.
    await userEvent.clear(dose); await userEvent.type(dose, "abc");
    const writes = fixture.requests.filter(request => request.method !== "GET").length;
    unit.focus(); await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("option", { name: "mg" }));
    await expect(dose).toHaveValue("abc");
    await expect(unit).toHaveTextContent("L");
    await expect(fixture.requests.filter(request => request.method !== "GET")).toHaveLength(writes);
    await userEvent.click(dose); await userEvent.keyboard("{Escape}");
  },
};
