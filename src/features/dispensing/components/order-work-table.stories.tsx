import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { orderRows, technicianUsers } from "../data";
import { OrderWorkTable } from "./order-work-table";

const meta = {
  title: "Features/Dispensing/OrderWorkTable",
  component: OrderWorkTable,
  parameters: { layout: "padded" },
  args: {
    rows: orderRows,
    sectionId: "storybook",
    technicians: technicianUsers,
    onCompleteRows: fn(),
    onAssignOrder: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 900 }}><Story /></div>],
} satisfies Meta<typeof OrderWorkTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dispensing: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.queryByRole("columnheader", { name: "상태" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("columnheader", { name: /오더명/ })).toBeInTheDocument();
    for (const row of args.rows) {
      const badge = canvas.queryByTestId(`order-status-badge-${row.id}`);
      if (row.status === "취소" || row.status === "재요청") {
        await expect(badge).toHaveTextContent(row.status);
        await expect(badge?.closest('[data-column-id="name"]')).not.toBeNull();
      } else {
        await expect(badge).not.toBeInTheDocument();
      }
    }
    const owner = canvasElement.querySelector<HTMLElement>('[data-emr-pinned-table-scroll-owner="true"]')!;
    const name = canvasElement.querySelector<HTMLElement>('tbody [data-column-id="name"]')!;
    const select = canvasElement.querySelector<HTMLElement>('tbody [data-column-id="select"]')!;
    const dose = canvasElement.querySelector<HTMLElement>('tbody [data-column-id="dose"]')!;
    const warning = canvasElement.querySelector<HTMLElement>(".emr-table-warning-cell > div")!;
    const warningBefore = warning.getBoundingClientRect().x;
    const before = [name, select, dose].map((cell) => cell.getBoundingClientRect().x);
    owner.scrollLeft = 160;
    await expect(owner.scrollLeft).toBe(160);
    const after = [name, select, dose].map((cell) => cell.getBoundingClientRect().x);
    await expect(warning.getBoundingClientRect().x).toBe(warningBefore);
    await expect(after[0]).toBe(before[0]);
    await expect(after[1]).toBe(before[1]);
    await expect(after[2]).toBe(before[2] - 160);
    await userEvent.click(canvas.getAllByRole("checkbox", { name: `${args.rows[0].name} 선택` })[0].parentElement!);
    await userEvent.click(canvas.getByRole("button", { name: "선택 오더 완료" }));
    await expect(args.onCompleteRows).toHaveBeenCalledWith([args.rows[0].id]);
  },
};

export const Treatment: Story = {
  args: { rows: orderRows.map((row) => ({ ...row, category: "처치" })) },
  play: Dispensing.play,
};

export const ServerManaged: Story = {
  args: { completionDisabled: true },
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole("button", { name: "완료" })) {
      await expect(button).toBeDisabled();
    }
  },
};

export const Empty: Story = { args: { rows: [] } };
