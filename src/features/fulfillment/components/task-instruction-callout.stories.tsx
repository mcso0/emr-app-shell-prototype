import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TaskInstructionCallout } from "./task-instruction-callout";
import type { EffectiveInstructions } from "../task-instruction-review-contract";

const document: EffectiveInstructions = {
  chartId: "72000000-0000-4000-8000-000000000001", scope: "dispensing", versions: { overall: 1, dispensing: 1 }, versionKey: "1".repeat(64),
  entries: ["overall", "dispensing"].map(scope => ({ scope: scope as "overall" | "dispensing", revision: 1, instruction: "전달사항의 내용이 들어가는 영역입니다. 전달사항의 내용이 들어가는 영역입니다.", deleted: false, actorName: "합성 작성자", createdAt: "2026-11-01T03:00:00Z" })),
};
const meta = {
  title: "Features/Fulfillment/Task Instruction Callout", component: TaskInstructionCallout, tags: ["autodocs"],
  args: { document, workspaceId: "synthetic-callout", onReview: fn() },
  decorators: [Story => <div className="p-4"><Story /></div>],
} satisfies Meta<typeof TaskInstructionCallout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MultipleInstructions: Story = { play: async ({ canvas }) => {
  await expect(canvas.queryByText("변경됨")).not.toBeInTheDocument();
} };
export const SingleInstruction: Story = { args: { document: { ...document, entries: [document.entries[1]] } }, play: async ({ canvas }) => {
  await expect(canvas.getByRole("heading", { name: "조제 지시사항" })).toBeVisible();
  await expect(canvas.queryByText("변경됨")).not.toBeInTheDocument();
  await expect(canvas.queryByText("조제", { exact: true })).not.toBeInTheDocument();
} };
export const FoldAndRestore: Story = { play: async ({ canvas, args }) => {
  const card = within(canvas.getByRole("complementary"));
  await userEvent.click(card.getByRole("button", { name: "지시사항 접기" }));
  await expect(card.getAllByText(document.entries[0].instruction)[0]).not.toBeVisible();
  await expect(card.getByRole("button", { name: "변경이력 보기" })).toBeVisible();
  await userEvent.click(card.getByRole("button", { name: "지시사항 펼치기" }));
  await expect(card.getAllByText(document.entries[0].instruction)[0]).toBeVisible();
  await userEvent.click(card.getByRole("button", { name: "지시사항 숨기기" }));
  await expect(canvas.getByRole("button", { name: "지시사항 다시 보기" })).toHaveFocus();
  await userEvent.click(canvas.getByRole("button", { name: "지시사항 다시 보기" }));
  await expect(canvas.getByRole("button", { name: "변경이력 보기" })).toHaveFocus();
  await expect(args.onReview).not.toHaveBeenCalled();
} };
export const ChangedInstruction: Story = { args: { document: { ...document, versions: { dispensing: 2 }, entries: [{ ...document.entries[1], revision: 2 }] } }, play: async ({ canvas, args }) => {
  const heading = canvas.getByRole("heading", { name: "조제 지시사항" });
  await expect(within(heading.parentElement!).getByText("변경됨")).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "변경 내용 확인" })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: "지시사항 접기" }));
  await expect(canvas.getByText("변경됨")).toBeVisible();
  await expect(canvas.getByRole("button", { name: "변경이력 보기" })).toBeVisible();
  await expect(args.onReview).not.toHaveBeenCalled();
} };
export const LongInstruction: Story = { args: { document: { ...document, entries: document.entries.map(item => ({ ...item, instruction: "긴 합성 지시사항 ".repeat(60) + "\n두 번째 문단도 줄바꿈합니다." })) } } };
