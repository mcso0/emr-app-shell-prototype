import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";

import { ChartProfilePreviewCard } from "./chart-profile-preview-card";

const meta = {
  title: "Features/Chart/Profile preview card",
  component: ChartProfilePreviewCard,
  tags: ["autodocs"],
  decorators: [(Story) => (
    <div className="w-[320px] rounded-lg bg-popover p-3 shadow-md">
      <Story />
    </div>
  )],
  args: {
    kind: "patient",
    title: "초코",
    items: [
      { label: "축종·품종", value: "강아지 · Pomeranian" },
      { label: "나이", value: "9세" },
      { label: "성별", value: "중성화·수컷" },
    ],
    notes: ["슬개골 병력 문진 필요"],
    onOpenProfile: fn(),
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "프로필 보기" }));
    await expect(args.onOpenProfile).toHaveBeenCalledOnce();
  },
} satisfies Meta<typeof ChartProfilePreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Patient: Story = {};

export const Guardian: Story = {
  args: {
    kind: "guardian",
    title: "보호자 예시",
    items: [
      { label: "대표 연락처", value: "010-0000-0000" },
      { label: "이메일", value: "guardian@example.test" },
      { label: "환자 관계", value: "초코의 주보호자" },
    ],
    notes: [],
  },
};
