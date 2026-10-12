import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  return <div className="flex h-[960px] max-w-full flex-col" style={{ width }}>
    {mounted ? <ChartSlotAvailabilityProvider {...props}>{availability => <WorkspaceDocumentLayout moduleDefinition={getModule("treatment")} slotProps={{ ...props, ...availability }} />}</ChartSlotAvailabilityProvider> : null}
    {route ? <output aria-label="합성 차트 이동 경로">{route}</output> : null}
  </div>;
}
const meta = {
  title: "Features/Chart/Actual Workspace", component: Example, tags: ["autodocs"], args: { scenario: "historical" as ChartWorkspaceScenario, width: 1580 }, argTypes: { scenario: { control: false }, width: { control: { type: "number", min: 1040, max: 1900 } } },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/w/storybook-chart/treatment", query: { date: "2026-10-11", encounterId: "98000000-0000-4000-8001-000000000001", historyEncounterId: "98000000-0000-4000-8001-000000000002", chartId: "98000000-0000-4000-8002-000000000001" } } }, layout: "fullscreen", docs: { story: { inline: false, height: "1000px" }, description: { component: "실제 ChartSlotAvailabilityProvider와 WorkspaceDocumentLayout에서 ChartContent와 private 처방/오더 표를 렌더합니다. 현재 접수와 완료한 과거 접수는 같은 합성 환자에 속합니다. 실제 main의 과거 차트 읽기 전용 상태를 사용합니다. 실제 과거 차트 경로의 encounterId, historyEncounterId, chartId를 사용하므로 대기열 조회 뒤에도 같은 차트를 엽니다. 표의 행·컬럼·밀도·필터·접기·비활성 이유를 새로 만들지 않습니다. 조회 API는 workspace와 진료 범위의 합성 응답이며 저장 요청은 로컬 권한 거부로 끝납니다. 미지원 읽기는 검증에서 드러납니다. 환자 컨텍스트 헤더와 전체 AppShell, 진행 중 차트 편집·확정·수납 성공은 별도 범위입니다. 기존 밀도 비교 예제와 SummaryAndDetails는 유지합니다." } } },
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
  const headers = ["선택", "분류", "확정 여부", "Order 명", "업무 상태", "청구서명", "청구반영", "일수", "횟수", "총횟수", "head/kg당", "1회당", "성분량", "조제량", "보관", "투여/복약", "단가", "수량", "합계", "할인/할증", "%", "총 청구금액", "할인/할증 사유", "과세", "업무 담당", "요청 수의사"];
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
