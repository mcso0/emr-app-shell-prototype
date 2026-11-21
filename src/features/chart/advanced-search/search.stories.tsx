import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import { ChartRow } from "./presentation";
import { exampleChart } from "./search.stories.fixture";
const meta = {
  title: "Features/Chart/차트 상세 검색/검색 결과",
  component: ChartRow,
  parameters: { layout: "fullscreen" },
  args: {
    chart: exampleChart("synthetic-chart"),
    active: false,
    query: "구토 초음파",
    onOpen: fn(),
    onCopy: fn(),
  },
} satisfies Meta<typeof ChartRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TwoTerms: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "모카 차트 원본 열기" }),
    ).toBeVisible();
    await expect(canvas.getByText("없음")).toBeVisible();
    await expect(canvasElement.querySelectorAll("mark").length).toBeGreaterThan(
      1,
    );
  },
};
export const Draft: Story = {
  args: {
    chart: exampleChart("synthetic-draft", {
      status: "draft",
      editable: true,
      purpose: "재진",
    }),
    active: true,
    query: "초음파",
  },
};
