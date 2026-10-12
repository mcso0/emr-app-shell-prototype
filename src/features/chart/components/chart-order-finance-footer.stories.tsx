import { useEffect, useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import type { ChartOrderBillingSummary } from "../chart-order-billing-summary-contract";
import { ChartOrderBillingDetailAside, ChartOrderFinanceFooter } from "./chart-order-finance-footer";

const summary: ChartOrderBillingSummary = {
  workspaceId: "synthetic-workspace", encounterId: "synthetic-encounter", currency: "KRW", context: null, etag: "synthetic", generatedAt: "2026-10-11T00:00:00Z", invoiceId: null,
  amounts: { confirmed: 20000, draft: 10000, estimatedTotal: 30000, gross: 30000, discount: 0, surcharge: 0, tax: 0, outstanding: 0, paid: 0, requestableTotal: 20000 },
  orderCounts: { total: 2, confirmed: 1, draft: 1, cancelled: 0, recheck: 0, requested: 0, requestable: 1 },
  requestableOrderIds: ["synthetic-order"], unfinishedOrders: [],
};
function Example(args: ComponentProps<typeof ChartOrderFinanceFooter>) {
  const [open, setOpen] = useState(args.drawerOpen);
  const [action, setAction] = useState("없음");
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return <div className="relative h-[620px] min-w-[860px] overflow-hidden border">
    <div className="absolute inset-x-0 bottom-0"><ChartOrderFinanceFooter {...args} drawerOpen={open} onOpenDetails={() => setOpen((current) => !current)} onRequestBilling={() => setAction("billing-request")} /></div>
    <ChartOrderBillingDetailAside canRequestBilling={args.canRequestBilling} displayState={args.displayState} error={args.error} freshness={args.freshness} hasAuthoritativeSummary={args.hasAuthoritativeSummary} open={open} onClose={() => setOpen(false)} onRetry={() => setAction("retry")} onRequestBilling={() => setAction("billing-request")} requesting={args.requesting} summary={args.summary} />
    <output className="block p-4" aria-label="합성 금액 액션">{action}</output>
  </div>;
}
const meta = {
  title: "Features/Chart/Order Finance",
  component: ChartOrderFinanceFooter,
  tags: ["autodocs"],
  args: { canRequestBilling: true, confirmationCounts: { ready: 1, invalid: 0, confirmed: 1 }, drawerOpen: false, displayState: "authoritative", freshness: "fresh", hasAuthoritativeSummary: true, onOpenDetails: () => undefined, onRequestBilling: () => undefined, requesting: false, saveStatusText: "저장됨", summary },
  argTypes: { displayState: { control: "select", options: ["authoritative", "preview", "invalid", "save_error"] }, freshness: { control: "select", options: ["loading", "fresh", "refreshing", "stale", "error"] }, onOpenDetails: { control: false }, onRequestBilling: { control: false } },
  render: (args) => <Example key={`${args.drawerOpen}:${args.freshness}:${args.displayState}`} {...args} />,
  parameters: { docs: { description: { component: "Summary And Details는 origin/main의 상세 토글·Escape 닫기·접근성 요약을 포함한 대표 조합입니다. Stale/Refreshing/Requesting 등은 현재 차트 caller가 전달하지 않는 컴포넌트 API 상태 예시입니다. 차트 오더의 금액 요약과 ChartOrderBillingDetailAside를 조립합니다. 금액, 확정 개수, 최신성, 청구 가능 여부는 호출 기능이 제공합니다. Example은 상세 열림과 콜백 기록만 관리합니다. 합성 금액은 청구 계산 정확성, 저장, 실제 결제나 경로 이동의 증거가 아닙니다." } } },
} satisfies Meta<typeof ChartOrderFinanceFooter>;
export default meta;
type Story = StoryObj<typeof meta>;
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
export const SummaryAndDetails: Story = {
  args: { accessibilitySummary: "선택 오더 0건 · 선택 오더 합계 0원 · 저장됨" },
  parameters: { docs: { description: { story: "총 금액과 상세 열기·닫기, 합성 청구 요청 콜백을 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const footer = canvasElement.querySelector('[data-testid="chart-order-footer"]');
    if (!footer?.textContent?.includes("30,000")) throw new Error("합성 총 금액이 없습니다.");
    await expect(footer.textContent).toContain("선택 오더 0건 · 선택 오더 합계 0원 · 저장됨");
    const details = Array.from(footer.querySelectorAll<HTMLButtonElement>("button")).find((node) => node.textContent === "금액 상세")!;
    await userEvent.click(details);
    await until(() => Boolean(canvasElement.querySelector("aside")) && canvasElement.querySelector("aside")?.getAttribute("aria-hidden") !== "true", "금액 상세가 열리지 않았습니다.");
    await userEvent.click(details);
    await until(() => canvasElement.querySelector("aside")?.getAttribute("aria-hidden") === "true", "같은 금액 상세 버튼으로 닫혀야 합니다.");
    await userEvent.click(details);
    await until(() => canvasElement.querySelector("aside")?.getAttribute("aria-hidden") !== "true", "상세가 다시 열려야 합니다.");
    await userEvent.keyboard("{Escape}");
    await until(() => canvasElement.querySelector("aside")?.getAttribute("aria-hidden") === "true", "Escape로 상세가 닫혀야 합니다.");
    await userEvent.click(details);
    await until(() => canvasElement.querySelector("aside")?.getAttribute("aria-hidden") !== "true", "닫기 버튼 검증 전 상세가 열려야 합니다.");
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>('button[aria-label="금액 상세 닫기"]')!);
    await until(() => canvasElement.querySelector("aside")?.getAttribute("aria-hidden") === "true", "금액 상세가 닫히지 않았습니다.");
    await userEvent.click(footer.querySelector<HTMLButtonElement>('button[aria-label="전체 수납 청구"]')!);
    await until(() => canvasElement.querySelector("output")?.textContent === "billing-request", "청구 요청 콜백이 없습니다.");
  },
};
export const InitialLoading: Story = { args: { drawerOpen: true, freshness: "loading", hasAuthoritativeSummary: false, canRequestBilling: false }, parameters: { docs: { description: { story: "최초 금액 조회 중인 상세 안내를 표시합니다." } } } };
export const InitialErrorRetry: Story = { args: { drawerOpen: true, freshness: "error", hasAuthoritativeSummary: false, canRequestBilling: false }, parameters: { docs: { description: { story: "최초 조회 실패와 다시 시도 콜백을 확인합니다." } } }, play: async ({ canvasElement }) => { const button = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("aside button")).find((node) => node.textContent === "다시 시도"); if (!button) throw new Error("조회 오류의 다시 시도 버튼이 없습니다."); await userEvent.click(button); await until(() => canvasElement.querySelector("output")?.textContent === "retry", "다시 시도 콜백이 없습니다."); } };
export const EmptyOrders: Story = { args: { drawerOpen: true, canRequestBilling: false, confirmationCounts: { ready: 0, invalid: 0, confirmed: 0 }, summary: { ...summary, amounts: { confirmed: 0, draft: 0, estimatedTotal: 0, gross: 0, discount: 0, surcharge: 0, tax: 0, outstanding: 0, paid: 0, requestableTotal: 0 }, orderCounts: { total: 0, confirmed: 0, draft: 0, cancelled: 0, recheck: 0, requested: 0, requestable: 0 }, requestableOrderIds: [] } }, parameters: { docs: { description: { story: "오더가 없는 상세 상태와 비활성 청구를 표시합니다." } } } };
export const Preview: Story = { args: { displayState: "preview", canRequestBilling: false, drawerOpen: true }, parameters: { docs: { description: { story: "호출 기능이 제공한 미리보기 금액의 상태 안내를 표시합니다." } } } };
export const Invalid: Story = { args: { displayState: "invalid", canRequestBilling: false, drawerOpen: true, confirmationCounts: { ready: 0, invalid: 1, confirmed: 1 } }, parameters: { docs: { description: { story: "미입력 오더와 유효하지 않은 금액 상태를 표시합니다." } } } };
export const SaveError: Story = { args: { displayState: "save_error", canRequestBilling: false, drawerOpen: true, saveStatusText: "저장 실패", error: "합성 저장 오류" }, parameters: { docs: { description: { story: "저장 오류 안내와 마지막 요약 금액을 표시합니다." } } } };
export const Stale: Story = { args: { freshness: "stale", canRequestBilling: false, drawerOpen: true }, parameters: { docs: { description: { story: "마지막 요약을 유지하며 다시 확인 진입점을 표시합니다." } } } };
export const Refreshing: Story = { args: { freshness: "refreshing", drawerOpen: true }, parameters: { docs: { description: { story: "이전 조회 금액을 유지하면서 갱신 중 상태를 표시합니다." } } } };
export const RefreshError: Story = { args: { freshness: "error", drawerOpen: true, canRequestBilling: false }, parameters: { docs: { description: { story: "이전 금액이 있는 갱신 실패는 최초 조회 오류와 다르게 요약과 다시 확인 버튼을 유지합니다." } } } };
export const Requesting: Story = { args: { requesting: true }, parameters: { docs: { description: { story: "청구 화면 이동 요청 중 버튼이 비활성화되는지 확인합니다." } } }, play: async ({ canvasElement }) => { if (!canvasElement.querySelector<HTMLButtonElement>('button[aria-label="전체 수납 청구 이동 중"]')?.disabled) throw new Error("이동 중 청구 버튼이 활성화되어 있습니다."); } };
