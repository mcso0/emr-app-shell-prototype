import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { BillingExample, billingFixture, billingWorkspaceId, billingInvoiceId, billingEncounterId, prepareBillingFixture, type BillingScenario } from "./billing-workspace.stories.fixture";

const meta = {
  title: "Features/Billing/Actual Workspace", component: BillingExample, tags: ["autodocs"], args: { scenario: "queue" as BillingScenario }, argTypes: { scenario: { control: false } },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true, navigation: { pathname: `/w/${billingWorkspaceId}/billing`, segments: [["workspaceId", billingWorkspaceId]], query: { date: "2026-10-11" } } }, docs: { story: { inline: false, height: "940px" }, description: { component: "실제 BillingSidePanel·BillingSlotAvailabilityProvider·WorkspaceDocumentLayout과 registry의 본문·헤더·이력·수납 요약을 사용합니다. 합성 청구서·항목·보호자·환자를 정확한 로컬 API 응답으로 제공합니다. 선택은 원본의 이동 콜백을 기록하며 페이지를 바꾸지 않습니다. Checkout 준비만 합성 응답이고 금융 변경은 로컬 403으로 끝납니다. 실제 결제·청구·외부 통신·DB 권한은 검증하지 않습니다. 원본을 해제한 뒤 fetch와 인증·수납·레이아웃 상태를 복원합니다." } } },
  beforeEach: ({ args }) => prepareBillingFixture(args.scenario),
} satisfies Meta<typeof BillingExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const QueueSearchAndSelection: Story = { play: async ({ canvas }) => {
  const side = within(canvas.getByRole("complementary", { name: "수납 대기열" }));
  const card = await side.findByTestId(`billing-queue-item-${billingInvoiceId}`);
  await expect(card).toHaveTextContent("합성 수납 환자");
  await userEvent.click(side.getByTestId("billing-queue-search-control"));
  const search = side.getByRole("searchbox", { name: "수납 대기열 검색" });
  await userEvent.type(search, "synthetic-no-match");
  await expect(side.queryByTestId(`billing-queue-item-${billingInvoiceId}`)).not.toBeInTheDocument();
  await userEvent.clear(search); await userEvent.type(search, "합성 수납");
  await userEvent.click(await side.findByTestId(`billing-queue-item-${billingInvoiceId}`));
  await expect(canvas.getByRole("status", { name: "합성 수납 이동 경로" })).toHaveTextContent(`invoiceId=${billingInvoiceId}`);
  await expect(canvas.getByRole("status", { name: "합성 수납 이동 경로" })).toHaveTextContent(`encounterId=${billingEncounterId}`);
  await expect(billingFixture.requests.every(request => request.method === "GET")).toBe(true); await expect(billingFixture.unhandled).toEqual([]);
} };
export const InvoiceTableAndSummary: Story = {
  args: { scenario: "detail" }, parameters: { nextjs: { navigation: { query: { date: "2026-10-11", invoiceId: billingInvoiceId, encounterId: billingEncounterId } } } },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole("table", { name: "청구 항목 테이블" });
    await expect(within(table).getByText("합성 청구 항목 1")).toBeVisible();
    for (const name of ["항목", "출처 / 진행", "단가", "수량", "청구금액"]) await expect(within(table).getByRole("columnheader", { name })).toBeVisible();
    await expect(within(table).getByRole("spinbutton", { name: "합성 청구 항목 1 수량" })).toHaveValue(1);
    await waitFor(() => expect(billingFixture.requests.some(request => request.method === "POST" && request.path.endsWith("/guardian-checkout"))).toBe(true));
    await waitFor(() => expect(canvas.queryByText("Checkout session을 준비하는 중입니다.")).not.toBeInTheDocument());
    await expect(canvas.getByTestId("billing-checkout-total")).toHaveTextContent("3,000");
    await expect(billingFixture.requests.some(request => request.method === "PATCH")).toBe(false); await expect(billingFixture.unhandled).toEqual([]);
  },
};
export const EmptyWorkspace: Story = { args: { scenario: "empty" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getAllByText("수납 업무가 없습니다")).toHaveLength(2));
  await expect(canvas.queryByRole("table", { name: "청구 항목 테이블" })).not.toBeInTheDocument(); await expect(billingFixture.unhandled).toEqual([]);
} };
export const ReadErrorAndRetry: Story = { args: { scenario: "error" }, play: async ({ canvas }) => {
  const side = within(canvas.getByRole("complementary", { name: "수납 대기열" }));
  await waitFor(() => expect(side.getByText("수납 업무를 불러오지 못했습니다")).toBeVisible());
  billingFixture.recover(); await userEvent.click(side.getByRole("button", { name: "재시도" }));
  await expect(await side.findByTestId(`billing-queue-item-${billingInvoiceId}`)).toBeVisible();
  await waitFor(() => expect(canvas.queryByText("수납 업무를 불러오지 못했습니다")).not.toBeInTheDocument()); await expect(billingFixture.unhandled).toEqual([]);
} };
export const PermissionDenied: Story = { args: { scenario: "denied" }, play: async ({ canvas }) => {
  await waitFor(() => expect(canvas.getAllByText("수납 업무를 볼 권한이 없습니다")).toHaveLength(2));
  await expect(canvas.queryByRole("button", { name: "재시도" })).not.toBeInTheDocument(); await expect(billingFixture.requests.every(request => request.method === "GET")).toBe(true);
} };
export const FinancialDenialCleanup: Story = {
  args: { scenario: "detail" },
  parameters: {
    nextjs: { navigation: { query: { date: "2026-10-11", invoiceId: billingInvoiceId, encounterId: billingEncounterId } } },
    docs: { description: { story: "실제 담당하기·수납 완료 확인을 사용하되 두 금융 요청 모두 로컬 403으로 거절합니다. 첫 응답을 보류한 상태에서 원본 화면을 해제하고, 원본이 이어서 보내는 fallback 요청까지 처리한 후 상태를 복원하는 종료 검사입니다. 검사 종료 후 작업대는 해제됩니다." } },
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole("table", { name: "청구 항목 테이블" });
    await userEvent.click(canvas.getByRole("button", { name: "담당하기" }));
    const body = within(canvasElement.ownerDocument.body);
    const paid = await body.findByRole("button", { name: /^수납 완료$/ });
    await waitFor(() => expect(paid).toBeEnabled());
    await userEvent.click(paid);
    const dialog = within(await body.findByRole("dialog", { name: "수납 완료 전 확인" }));
    billingFixture.holdNextTransition();
    await userEvent.click(dialog.getByRole("button", { name: "수납 완료 저장" }));
    await waitFor(() => expect(billingFixture.requests.filter(request => request.method === "PATCH")).toHaveLength(1));
    await billingFixture.finish();
    await expect(billingFixture.requests.filter(request => request.method === "PATCH").map(request => request.path)).toEqual([
      `/api/workspaces/${billingWorkspaceId}/billing/guardian-checkout`,
      `/api/workspaces/${billingWorkspaceId}/billing/payment-status`,
    ]);
    await expect(billingFixture.isRestored()).toBe(true);
    await expect(billingFixture.unhandled).toEqual([]);
    await expect(canvas.queryByRole("table", { name: "청구 항목 테이블" })).not.toBeInTheDocument();
  },
};
