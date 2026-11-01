import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { OverallInstructionsHistoryDialog } from "./overall-instructions-history-dialog";
import type { OverallInstructions } from "./overall-instructions-contract";

const actor = { actorId: "51000000-0000-4000-8000-000000000002", applyId: null, actorName: "합성 작성자", createdAt: "2026-11-01T03:00:00Z" };
const history: OverallInstructions["history"] = [
  { ...actor, scope: "dispensing", revision: 4, instruction: "다시 작성한 조제 지시", deleted: false },
  { ...actor, scope: "dispensing", revision: 3, instruction: "", deleted: true },
  { ...actor, scope: "dispensing", revision: 2, instruction: "수정한 조제 지시", deleted: false },
  { ...actor, scope: "dispensing", revision: 1, instruction: "첫 조제 지시", deleted: false },
  { ...actor, scope: "dispensing", revision: 1, instruction: "경구제 전용 이전 지시", deleted: false, legacy: true },
  { ...actor, scope: "overall", revision: 1, instruction: "전체 지시", deleted: false },
];
function Example({ empty = false }: { empty?: boolean }) {
  const [open, setOpen] = useState(true);
  return <OverallInstructionsHistoryDialog open={open} onOpenChange={setOpen} history={empty ? [] : history} />;
}
const meta = { title: "Features/Chart/Overall Instructions History", component: Example, tags: ["autodocs"] } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RevisionHistory: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await body.findByText("다시 작성된 지시", { exact: false });
  await userEvent.selectOptions(body.getByLabelText("지시 범위"), "dispensing");
  await expect(body.queryByText("전체 지시")).not.toBeInTheDocument();
  await expect(body.getByText("경구제 지시 (이전 기록) · 최초 지시")).toBeVisible();
  await expect(body.getByText("조제 지시 · 지시 삭제")).toBeVisible();
  await expect(body.getByText("조제 지시 · 변경된 지시")).toBeVisible();
} };
export const EmptyHistory: Story = { args: { empty: true }, play: async ({ canvasElement }) => {
  await within(canvasElement.ownerDocument.body).findByText("변경 이력이 없습니다.");
} };
