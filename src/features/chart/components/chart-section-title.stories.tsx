import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ChartSectionTitle } from "./chart-section-title";

const meta = {
  title: "Features/Chart/Section Title", component: ChartSectionTitle, tags: ["autodocs"],
  args: { title: "합성 차트 영역", subtitle: "합성 보조 설명" },
  argTypes: { title: { control: "text" }, subtitle: { control: "text" } },
  parameters: { docs: { description: { component: "현재 origin/main에서 사용 호출자를 찾지 못한 실제 export의 API 비교입니다. title은 h2이고 subtitle이 있을 때만 보조 span을 표시합니다. 차트 화면의 현재 제목을 재구성하거나 새 호출자를 제안하는 예시는 아닙니다." } } },
  render: args => <div className="w-[360px] max-w-full p-4"><ChartSectionTitle {...args} /></div>,
} satisfies Meta<typeof ChartSectionTitle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithSubtitle: Story = {
  play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole("heading", { level: 2, name: args.title })).toBeVisible(); await expect(canvas.getByText(args.subtitle ?? "")).toBeVisible(); },
};
export const TitleOnly: Story = {
  args: { subtitle: undefined },
  play: async ({ canvasElement, args }) => { await expect(within(canvasElement).getByRole("heading", { level: 2, name: args.title })).toBeVisible(); await expect(canvasElement.querySelector("span")).not.toBeInTheDocument(); },
};
