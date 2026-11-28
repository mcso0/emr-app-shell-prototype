import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { OrderBillingChangeReview } from "./order-billing-change-review";
import { useBillingStore } from "./store";

type Scenario = "held" | "new-proposal" | "pending-approval";
const invoiceId = "99500000-0000-4000-8000-000000000001";
const before = { billingName: "합성 청구", billingQuantity: 1, unitPriceKrw: 1000, taxClass: "non_taxable" as const,
  billingReflectionEnabled: true, adjustmentSource: null, adjustmentAmountKrw: 0, adjustmentPercent: 0, adjustmentReason: "" };
let fixture: { held: boolean; hasProposal: boolean; reads: number; writes: number; release?: () => void };
function Example({ scenario }: { scenario: Scenario }) {
  const [blocked, setBlocked] = useState(scenario !== "pending-approval");
  return <div className="space-y-4 p-6">
    <Button onClick={() => { fixture.held = true; setBlocked(true); }}>합성 수정 시작</Button>
    <Button onClick={() => { fixture.held = false; fixture.hasProposal = true; setBlocked(false); }}>합성 수정 종료</Button>
    <OrderBillingChangeReview workspaceId="synthetic-review-workspace" invoiceId={invoiceId} reviewKey="synthetic-review" blocked={blocked} onApplied={() => {}} />
  </div>;
}
const meta = {
  title: "Features/Billing/Order Change Review", component: Example,
  args: { scenario: "held" as Scenario }, parameters: { nextjs: { appDirectory: true } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch, billing = useBillingStore.getState();
    fixture = { held: args.scenario !== "pending-approval", hasProposal: args.scenario !== "new-proposal", reads: 0, writes: 0 };
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname !== "/api/workspaces/synthetic-review-workspace/billing/order-changes") return original(input, init);
      if (init?.method === "POST") {
        fixture.writes++;
        await new Promise<void>(resolve => { fixture.release = resolve; });
        return Response.json({ ok: false, error: "order_work_on_hold" }, { status: 409 });
      }
      fixture.reads++;
      return Response.json({ ok: true, changes: fixture.hasProposal ? [{ orderId: "99500000-0000-4000-8000-000000000002",
        proposalId: "99500000-0000-4000-8000-000000000003", version: 1, before, proposed: { ...before, unitPriceKrw: 2000 }, canApprove: !fixture.held, createdAt: "2026-11-17T00:00:00Z" }] : [] });
    };
    return () => { fixture.release?.(); globalThis.fetch = original; useBillingStore.setState(billing, true); };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HoldReleaseRefreshesApproval: Story = { play: async ({ canvas }) => {
  await expect(await canvas.findByRole("button", { name: "확인 후 금액 반영" })).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "합성 수정 종료" }));
  await waitFor(() => expect(canvas.getByRole("button", { name: "확인 후 금액 반영" })).toBeEnabled());
  await expect(fixture.writes).toBe(0);
} };
export const HoldReleaseLoadsNewProposal: Story = { args: { scenario: "new-proposal" }, play: async ({ canvas }) => {
  await waitFor(() => expect(fixture.reads).toBeGreaterThan(0));
  await expect(canvas.queryByRole("button", { name: "확인 후 금액 반영" })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: "합성 수정 종료" }));
  await expect(await canvas.findByRole("button", { name: "확인 후 금액 반영" })).toBeEnabled();
  await expect(fixture.writes).toBe(0);
} };
export const HoldDuringApprovalRefreshesAfterResponse: Story = { args: { scenario: "pending-approval" }, play: async ({ canvas }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "확인 후 금액 반영" }));
  await waitFor(() => expect(fixture.writes).toBe(1));
  await userEvent.click(canvas.getByRole("button", { name: "합성 수정 시작" }));
  await userEvent.click(canvas.getByRole("button", { name: "합성 수정 종료" }));
  const reads = fixture.reads;
  fixture.release?.();
  await waitFor(() => expect(fixture.reads).toBeGreaterThan(reads));
  await waitFor(() => expect(canvas.getByRole("button", { name: "확인 후 금액 반영" })).toBeEnabled());
} };
export const FailedApprovalKeepsError: Story = { args: { scenario: "pending-approval" }, play: async ({ canvas }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "확인 후 금액 반영" }));
  await waitFor(() => expect(fixture.writes).toBe(1));
  const reads = fixture.reads;
  fixture.release?.();
  await canvas.findByRole("alert");
  // Let any accidental follow-up GET settle before checking the failure feedback.
  await new Promise(resolve => setTimeout(resolve, 100));
  await expect(canvas.getByRole("alert")).toHaveTextContent("다른 창에서 이 오더를 수정 중입니다.");
  await expect(fixture.reads).toBe(reads);
  await expect(canvas.getByRole("button", { name: "확인 후 금액 반영" })).toBeEnabled();
} };
