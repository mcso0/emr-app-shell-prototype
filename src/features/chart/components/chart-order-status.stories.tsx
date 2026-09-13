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
    const beforeBadge = canvas.getByText("확정 전");
    const confirmedBadge = canvas.getByText("확정 후", { exact: true });
    const invalidBadge = canvas.getByRole("button", { name: "미입력" });
    const beforeStyle = getComputedStyle(beforeBadge);
    await expect({
      backgroundColor: beforeStyle.backgroundColor,
      borderRadius: beforeStyle.borderRadius,
      color: beforeStyle.color,
      fontSize: beforeStyle.fontSize,
      fontWeight: beforeStyle.fontWeight,
      height: beforeStyle.height,
      letterSpacing: beforeStyle.letterSpacing,
      paddingLeft: beforeStyle.paddingLeft,
      paddingBottom: beforeStyle.paddingBottom,
      paddingRight: beforeStyle.paddingRight,
      paddingTop: beforeStyle.paddingTop,
    }).toEqual({
      backgroundColor: "rgb(247, 250, 252)",
      borderRadius: "6px",
      color: "rgb(45, 55, 72)",
      fontSize: "12px",
      fontWeight: "500",
      height: "22px",
      letterSpacing: "0.3px",
      paddingLeft: "8px",
      paddingBottom: "3px",
      paddingRight: "8px",
      paddingTop: "3px",
    });
    await expect(Number.parseFloat(beforeStyle.lineHeight)).toBeCloseTo(16, 2);
    await expect(beforeStyle.boxShadow).toContain(
      "rgb(226, 232, 240) 0px 0px 0px 1px inset",
    );
    await expect([
      beforeBadge.offsetWidth,
      confirmedBadge.offsetWidth,
      invalidBadge.offsetWidth,
    ]).toEqual([51, 51, 48]);
    await expect(confirmedBadge).toHaveStyle({
      backgroundColor: "rgb(240, 255, 244)",
      color: "rgb(34, 84, 61)",
    });
    await expect(getComputedStyle(confirmedBadge).boxShadow).toContain(
      "rgb(154, 230, 180) 0px 0px 0px 1px inset",
    );
    await expect(invalidBadge).toHaveStyle({
      backgroundColor: "rgb(255, 245, 245)",
      color: "rgb(155, 44, 44)",
    });
    await expect(getComputedStyle(invalidBadge).boxShadow).toContain(
      "rgb(254, 178, 178) 0px 0px 0px 1px inset",
    );
    await userEvent.click(invalidBadge);
    await expect(args.onOpenDetail).toHaveBeenCalledOnce();
    await expect(beforeBadge).toBeVisible();
    await expect(confirmedBadge).toBeVisible();
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
