import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmedOrderEditDialog } from "./confirmed-order-edit-dialog";
import { confirmedOrderEditSchema, type ConfirmedOrderContext } from "../confirmed-order-edit-contract";
import { OrderBillingChangeReview } from "@/features/billing/order-billing-change-review";
import { PartialOrderWorkDialog } from "@/features/fulfillment/components/partial-order-work-dialog";

type Scenario = "financial" | "clinical" | "retry" | "conflict" | "readonly" | "billing" | "partial" | "late" | "treatment";
const id = (n: number) => `93000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let state: ReturnType<typeof createFixture>;
function createFixture(scenario: Scenario) {
  const context: ConfirmedOrderContext = { orderId: id(1), chartId: id(2), version: "synthetic-v1", detailInputs: { dose: 1, durationDays: 3 }, calculationOutputs: {}, detailSchemaVersion: 1, taskStatus: "in_progress", billingStage: "before", financial: { billingName: "합성 조제 청구", billingQuantity: 3, unitPriceKrw: 5000, taxClass: "non_taxable", billingReflectionEnabled: true, adjustmentSource: null, adjustmentAmountKrw: 0, adjustmentPercent: 0, adjustmentReason: "" }, pendingFinancial: null, canEditClinical: scenario !== "readonly", canEditFinancial: scenario !== "readonly", actualDispenseMode: "automatic", actualDispenseQuantity: 3 };
  const requests: Record<string, unknown>[] = [];
  let failed = false, saved = 0, release: (() => void) | undefined;
  let changes = [{ orderId: id(1), proposalId: id(3), version: 1, before: context.financial!, proposed: { ...context.financial!, unitPriceKrw: 6000 }, canApprove: true, createdAt: "2026-11-03T00:00:00Z" }];
  const partial = { taskId: id(4), revision: 1, canRecord: true, notes: [] as { taskId: string; note: string; createdAt: string; actorName: string; attemptNo: number }[] };
  const install = () => {
    const old = globalThis.fetch;
    const handle: typeof fetch = async (input, init) => {
      const url = new URL(String(input), location.origin);
      if (!url.pathname.startsWith("/api/")) return old(input, init);
      if (!url.pathname.startsWith("/api/workspaces/synthetic-confirmed-edit/")) throw new Error("Unexpected workspace");
      const post = init?.method === "POST";
      const command = post ? JSON.parse(String(init?.body)) as Record<string, unknown> : null;
      if (command) requests.push(command);
      if (post && scenario === "late") await new Promise<void>(resolve => { release = resolve; });
      if (post && ["retry", "billing", "partial"].includes(scenario) && !failed) { failed = true; return Response.json({ ok: false, error: "unavailable" }, { status: 503 }); }
      if (url.pathname.endsWith("/confirmed-order-edit")) {
        if (command) {
          const parsed = confirmedOrderEditSchema.parse(command);
          if (scenario === "conflict") return Response.json({ ok: false, error: "revision_conflict" }, { status: 409 });
          if (parsed.expectedVersion !== context.version) throw new Error("Stale fixture version");
          if (parsed.financial) context.financial = { ...context.financial!, ...parsed.financial };
          if (parsed.clinical) context.detailInputs = parsed.clinical.detailInputs;
          context.version = `synthetic-v${requests.length + 1}`;
        }
        return Response.json({ ok: true, context });
      }
      if (url.pathname.endsWith("/order-changes")) { if (command) changes = []; return Response.json({ ok: true, changes }); }
      if (url.pathname.endsWith("/partial-work")) { if (command) { partial.notes.push({ taskId: id(4), note: String(command.note), createdAt: "2026-11-03T00:00:00Z", actorName: "합성 담당자", attemptNo: 1 }); partial.revision++; } return Response.json({ ok: true, document: partial }); }
      throw new Error("Unexpected synthetic endpoint");
    };
    globalThis.fetch = handle;
    return () => { release?.(); if (globalThis.fetch === handle) globalThis.fetch = old; };
  };
  return { context, requests, install, approveExternally: () => { changes = []; }, saved: () => saved, recordSaved: () => { saved++; }, release: () => release?.() };
}
function Example({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(true), [count, setCount] = useState(0);
  const saved = () => { state.recordSaved(); setCount(n => n + 1); };
  return <div className="p-6"><output aria-label="합성 저장 횟수">{count}</output><Button onClick={() => setOpen(value => !value)}>{open ? "합성 화면 전환" : "수정 열기"}</Button>
    {open && (scenario === "billing" ? <OrderBillingChangeReview workspaceId="synthetic-confirmed-edit" invoiceId={id(5)} reviewKey="synthetic-story-invoice" onApplied={saved} /> : scenario === "partial" ? <PartialOrderWorkDialog workspaceId="synthetic-confirmed-edit" taskId={id(4)} name="합성 조제" onClose={() => setOpen(false)} onSaved={saved} /> : <ConfirmedOrderEditDialog workspaceId="synthetic-confirmed-edit" chartId={id(2)} orderId={id(1)} name={scenario === "treatment" ? "합성 처치" : "합성 조제"} clinicalType={scenario === "treatment" ? "treatment" : "dispensing"} fieldLabels={{ dose: "용량", durationDays: "일수" }} onClose={() => setOpen(false)} onSaved={() => { saved(); setOpen(false); }}
      renderClinical={(inputs, change, disabled) => <div className="grid grid-cols-2 gap-3">{([['dose', '용량'], ['durationDays', '일수']] as const).map(([key, label]) => <label className="grid gap-2 text-sm" key={key}>{label}<Input aria-label={label} disabled={disabled} type="number" value={Number(inputs[key])} onChange={e => change({ ...inputs, [key]: Number(e.target.value) })} /></label>)}</div>} />)}
  </div>;
}
const meta = { title: "Features/Chart/Confirmed Order Edit", component: Example, args: { scenario: "financial" as Scenario }, tags: ["autodocs"], parameters: { docs: { story: { inline: false, height: "920px" }, description: { component: "실제 수정·수납 확인·부분 수행 컴포넌트의 합성 통신 검증. DB 권한·원자성은 SQL 회귀 테스트로 별도 확인합니다. 진료 용량 예시는 합성 데이터입니다." } } }, beforeEach: ({ args }) => { state = createFixture(args.scenario); return state.install(); } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = (element: HTMLElement) => within(element.ownerDocument.body);
async function editPrice(element: HTMLElement) { const screen = body(element); const price = await screen.findByLabelText("단가 (원)"); await userEvent.clear(price); await userEvent.type(price, "6000"); return screen; }
export const FinancialOnlyAndSuccessiveEdit: Story = { play: async ({ canvasElement, canvas }) => {
 const screen = body(canvasElement); await screen.findByLabelText("단가 (원)"); await expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
 await editPrice(canvasElement); await expect(screen.getByText("조제·처치 변경 안내는 보내지 않아요.")).toBeVisible(); await userEvent.dblClick(screen.getByRole("button", { name: "수정 저장" }));
 await waitFor(() => expect(canvas.getByLabelText("합성 저장 횟수")).toHaveTextContent("1")); await expect(state.requests).toHaveLength(1); await expect(state.requests[0].clinical).toBeUndefined();
 await userEvent.click(canvas.getByRole("button", { name: "수정 열기" })); await expect(await screen.findByLabelText("단가 (원)")).toHaveValue(6000);
 await userEvent.clear(screen.getByLabelText("단가 (원)")); await userEvent.type(screen.getByLabelText("단가 (원)"), "7000"); await userEvent.click(screen.getByRole("button", { name: "수정 저장" })); await waitFor(() => expect(state.requests).toHaveLength(2)); await expect(state.requests[1].expectedVersion).toBe("synthetic-v2");
} };
export const ClinicalReason: Story = { args: { scenario: "clinical" }, play: async ({ canvasElement }) => { const screen = body(canvasElement); const days = await screen.findByLabelText("일수"); await userEvent.clear(days); await userEvent.type(days, "5"); await expect(screen.getByRole("button", { name: "수정 후 요청" })).toBeDisabled(); await userEvent.type(screen.getByLabelText("수정 사유 *"), "합성 일수 수정"); await userEvent.click(screen.getByRole("button", { name: "수정 후 요청" })); await waitFor(() => expect(state.requests).toHaveLength(1)); await expect(state.requests[0].financial).toBeUndefined(); } };
export const SaveFailureRetry: Story = { args: { scenario: "retry" }, play: async ({ canvasElement }) => { const screen = await editPrice(canvasElement); await userEvent.click(screen.getByRole("button", { name: "수정 저장" })); await screen.findByRole("alert"); await expect(screen.getByLabelText("단가 (원)")).toHaveValue(6000); await userEvent.click(screen.getByRole("button", { name: "수정 저장" })); await waitFor(() => expect(state.requests).toHaveLength(2)); await expect(state.requests[0].commandId).toBe(state.requests[1].commandId); } };
export const ConflictPreservesInput: Story = { args: { scenario: "conflict" }, play: async ({ canvasElement }) => { const screen = await editPrice(canvasElement); await userEvent.click(screen.getByRole("button", { name: "수정 저장" })); await screen.findByRole("alert"); await expect(screen.getByLabelText("단가 (원)")).toHaveValue(6000); await expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled(); await userEvent.click(screen.getByRole("button", { name: "입력을 버리고 최신 내용 조회" })); await waitFor(() => expect(screen.getByLabelText("단가 (원)")).toHaveValue(5000)); } };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvasElement }) => { const screen = body(canvasElement); await expect(await screen.findByLabelText("단가 (원)")).toBeDisabled(); await expect(screen.getByLabelText("일수")).toBeDisabled(); } };
export const Treatment: Story = { args: { scenario: "treatment" }, play: async ({ canvasElement }) => { const screen = body(canvasElement); await screen.findByLabelText("일수"); await expect(screen.queryByLabelText("요청 조제량")).toBeNull(); } };
export const BillingReviewRetry: Story = { args: { scenario: "billing" }, play: async ({ canvasElement, canvas }) => { const screen = body(canvasElement); await userEvent.click(await screen.findByRole("button", { name: "확인 후 금액 반영" })); await screen.findByRole("alert"); await userEvent.click(screen.getByRole("button", { name: "확인 후 금액 반영" })); await waitFor(() => expect(canvas.getByLabelText("합성 저장 횟수")).toHaveTextContent("1")); await expect(screen.queryByText("청구 변경 확인 대기")).toBeNull(); } };
export const PartialWorkRetry: Story = { args: { scenario: "partial" }, play: async ({ canvasElement }) => { const screen = body(canvasElement); await userEvent.type(await screen.findByLabelText("이미 수행한 내용"), "합성 1회 수행 완료"); await userEvent.click(screen.getByRole("button", { name: "기록 저장" })); await screen.findByRole("alert"); await expect(screen.getByLabelText("이미 수행한 내용")).toHaveValue("합성 1회 수행 완료"); await userEvent.click(screen.getByRole("button", { name: "기록 저장" })); await screen.findByText("합성 1회 수행 완료"); await expect(state.requests[0].commandId).toBe(state.requests[1].commandId); } };
export const LateResponse: Story = { args: { scenario: "late" }, play: async ({ canvasElement, canvas }) => { const screen = await editPrice(canvasElement); await userEvent.click(screen.getByRole("button", { name: "수정 저장" })); await waitFor(() => expect(state.requests).toHaveLength(1)); canvas.getByRole("button", { name: "합성 화면 전환", hidden: true }).click(); state.release(); await new Promise(resolve => setTimeout(resolve, 50)); await expect(state.saved()).toBe(0); } };
export const Preview: Story = {};
export const BillingPendingPreview: Story = { args: { scenario: "billing" } };

export const BillingApprovalFromAnotherTab: Story = { args: { scenario: "billing" }, play: async ({ canvasElement }) => {
  const screen = body(canvasElement);
  await screen.findByRole("button", { name: "확인 후 금액 반영" });
  const events: unknown[] = [];
  const listener = (event: Event) => events.push((event as CustomEvent).detail);
  window.addEventListener("clair-billing-order-change", listener);
  try {
    state.approveExternally();
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(screen.queryByText("청구 변경 확인 대기")).toBeNull());
    await expect(events).toEqual([{ workspaceId: "synthetic-confirmed-edit", invoiceId: id(5) }]);
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(events).toHaveLength(1));
  } finally { window.removeEventListener("clair-billing-order-change", listener); }
} };
