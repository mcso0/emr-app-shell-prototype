import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
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
  await expect(canvas.queryByRole("button", { name: "변경이력 보기" })).not.toBeInTheDocument();
} };
export const SingleInstruction: Story = { args: { document: { ...document, entries: [document.entries[1]] } }, play: async ({ canvas }) => {
  await expect(canvas.getByRole("heading", { name: "조제 지시사항" })).toBeVisible();
  await expect(canvas.queryByText("변경됨")).not.toBeInTheDocument();
  await expect(canvas.queryByRole("button", { name: "변경이력 보기" })).not.toBeInTheDocument();
  await expect(canvas.queryByText("조제", { exact: true })).not.toBeInTheDocument();
} };
export const FoldAndRestore: Story = { play: async ({ canvas, args }) => {
  const card = within(canvas.getByRole("complementary"));
  await userEvent.click(card.getByRole("button", { name: "지시사항 숨기기" }));
  await expect(canvas.getByRole("button", { name: "지시사항 다시 보기" })).toHaveFocus();
  await userEvent.click(canvas.getByRole("button", { name: "지시사항 다시 보기" }));
  await expect(canvas.getByRole("button", { name: "지시사항 숨기기" })).toHaveFocus();
  await expect(args.onReview).not.toHaveBeenCalled();
} };
export const ChangedInstruction: Story = { args: { document: { ...document, versions: { dispensing: 2 }, entries: [{ ...document.entries[1], revision: 2 }] } }, play: async ({ canvas, args }) => {
  const heading = canvas.getByRole("heading", { name: "조제 지시사항" });
  await expect(within(heading.parentElement!).getByText("변경됨")).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "변경 내용 확인" })).not.toBeInTheDocument();
  await expect(canvas.getByText("변경됨")).toBeVisible();
  await expect(canvas.getByRole("button", { name: "변경이력 보기" })).toBeVisible();
  await expect(args.onReview).not.toHaveBeenCalled();
} };
export const LongInstruction: Story = { args: { document: { ...document, entries: document.entries.map(item => ({ ...item, instruction: "긴 합성 지시사항 ".repeat(60) + "\n두 번째 문단도 줄바꿈합니다." })) } } };

export const InlineExpansion: Story = {
  args: { document: { ...document, versions: { dispensing: 2 }, entries: [{ ...document.entries[1], revision: 2, instruction: "긴 합성 지시사항 ".repeat(60) + "\n두 번째 문단" }] } },
  decorators: [Story => <div style={{ width: 760 }}><Story /></div>],
  play: async ({ canvas, args }) => {
    const toggle = await canvas.findByRole("button", { name: "조제 지시 펼치기" });
    const body = canvas.getByText(/두 번째 문단/, { selector: "p" });
    await expect(body).toBeVisible();
    await expect(body.clientHeight).toBe(20);
    await expect(canvas.getByRole("complementary").getBoundingClientRect().height).toBe(70);
    await expect(canvas.getByText("변경됨")).toBeVisible();
    await toggle.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("button", { name: "조제 지시 접기" })).toHaveAttribute("aria-expanded", "true");
    await expect(body.clientHeight).toBeGreaterThan(20);
    await expect(canvas.getByText("변경됨")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "조제 지시 접기" }));
    await expect(body.clientHeight).toBe(20);
    await expect(args.onReview).not.toHaveBeenCalled();
  },
};
export const ShortInstruction: Story = { args: { document: { ...document, entries: [{ ...document.entries[1], instruction: "짧은 지시" }] } }, play: async ({ canvas }) => {
  await expect(canvas.queryByRole("button", { name: /지시 펼치기/ })).not.toBeInTheDocument();
  await expect(canvas.getByRole("complementary").getBoundingClientRect().height).toBe(70);
} };
export const ResizeOverflow: Story = {
  args: { document: { ...document, entries: [{ ...document.entries[1], instruction: "합성 지시사항입니다. ".repeat(5) }] } },
  decorators: [Story => <div data-testid="resize-container" style={{ width: 1000 }}><Story /></div>],
  play: async ({ canvas }) => {
    const container = canvas.getByTestId("resize-container");
    await waitFor(() => expect(canvas.queryByRole("button", { name: "조제 지시 펼치기" })).not.toBeInTheDocument());
    container.style.width = "360px";
    await canvas.findByRole("button", { name: "조제 지시 펼치기" });
    await expect(canvas.getByRole("complementary").scrollWidth).toBeLessThanOrEqual(canvas.getByRole("complementary").clientWidth);
    container.style.width = "1000px";
    await waitFor(() => expect(canvas.queryByRole("button", { name: "조제 지시 펼치기" })).not.toBeInTheDocument());
  },
};
export const NarrowInstructions: Story = {
  ...LongInstruction,
  decorators: [Story => <div style={{ width: 320 }}><Story /></div>],
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "전체 오더 지시 펼치기" }));
    await expect(canvas.getByRole("button", { name: "조제 지시 펼치기" })).toHaveAttribute("aria-expanded", "false");
    const card = canvas.getByRole("complementary");
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await userEvent.click(canvas.getByRole("button", { name: "전체 오더 지시 접기" }));
  },
};
