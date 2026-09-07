import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChartOrderConfirmationBadge, ChartOrderWorkStatus } from "./chart-order-status";
import type { ChartOrderPresentationRow } from "../chart-order-table-presentation";

const meta = {
  title: "Features/Chart/Order status",
  component: ChartOrderConfirmationBadge,
  tags: ["autodocs"],
  args: { state: "ready", onOpenDetail: fn() },
} satisfies Meta<typeof ChartOrderConfirmationBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmationStates: Story = {
  render: args => <div className="flex gap-4 p-6">
    <ChartOrderConfirmationBadge {...args} state="ready" />
    <ChartOrderConfirmationBadge {...args} state="invalid" />
    <ChartOrderConfirmationBadge {...args} state="confirmed" />
  </div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "입력 필요" }));
    await expect(args.onOpenDetail).toHaveBeenCalledOnce();
    await expect(canvas.getByText("확정 대기")).toBeVisible();
    await expect(canvas.getByText("확정", { exact: true })).toBeVisible();
  },
};
const rows: ChartOrderPresentationRow[] = [
  { order: { id: "draft", status: "requested" }, runtimeRow: { orderConfirmationStatus: "draft" } },
  { order: { id: "no-task", status: "confirmed" } },
  { order: { id: "done", status: "confirmed" }, executionTask: { status: "complete", clinicalOrderType: "clinical_lab", attemptNo: 1 } },
  { order: { id: "cancelled-complete", status: "cancelled" }, executionTask: { status: "complete", clinicalOrderType: "clinical_lab", attemptNo: 1 } },
  { order: { id: "cancelled-no-task", status: "cancelled" } },
];
export const WorkStates: Story = {
  render: () => <div className="flex gap-8 p-8">{rows.map(row => <ChartOrderWorkStatus key={row.order.id} row={row} />)}</div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("취소")).toHaveLength(2);
    await expect(canvas.getByText("완료")).toBeVisible();
    await userEvent.hover(canvas.getByLabelText("확정 후 업무 상태가 표시됩니다"));
    await userEvent.tab();
    await expect(canvas.getByLabelText("확정 후 업무 상태가 표시됩니다")).toHaveFocus();
    await expect(await within(canvasElement.ownerDocument.body).findByRole("tooltip")).toHaveTextContent("확정 후 업무 상태가 표시됩니다");
  },
};
