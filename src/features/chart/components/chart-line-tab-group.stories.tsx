import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { ChartLineTabGroup } from "./chart-line-tab-group";
const items = Array.from({ length: 8 }, (_, index) => ({ value: `system-${index}`, label: `합성 진단계통 ${index + 1}`, count: index + 1 }));
function Example() {
  const [value, setValue] = useState(items[0].value);
  return <div className="grid w-[340px] gap-3"><div className="flex h-12 min-w-0"><ChartLineTabGroup aria-label="합성 SOAP 진단계통" items={items} value={value} onValueChange={setValue} /></div><section id="chart-soap-editor-panel" role="tabpanel" aria-label="합성 SOAP 내용">{value}</section></div>;
}
const meta = { title: "Features/Chart/SOAP Line Tabs", component: Example, tags: ["autodocs"], parameters: { docs: { description: { component: "실제 ChartLineTabGroup입니다. UI SDK Tabs가 ARIA와 roving focus/화살표·Home·End 활성화를 소유하고 기존 측정·overflow·더보기 메뉴와 공유 SOAP 편집 패널 연결을 유지합니다. 합성 진단계통만 전환합니다." } } } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OverflowKeyboard: Story = { play: async ({ canvas }) => {
  const first = canvas.getByRole("tab", { name: "합성 진단계통 1 1" });
  await userEvent.click(first); await userEvent.keyboard("{ArrowRight}");
  await waitFor(() => expect(canvas.getByRole("tab", { name: "합성 진단계통 2 2" })).toHaveFocus());
  await expect(canvas.getByRole("tabpanel")).toHaveTextContent("system-1");
  await userEvent.keyboard("{End}");
  await waitFor(() => expect(canvas.getByRole("tab", { name: "합성 진단계통 8 8" })).toHaveAttribute("aria-selected", "true"));
  await expect(canvas.getByRole("tab", { name: "합성 진단계통 8 8" })).toHaveFocus();
  await waitFor(() => expect(canvas.getByRole("button", { name: "숨긴 진단계통 더보기" })).toBeVisible());
  await userEvent.keyboard("{Home}");
  await expect(first).toHaveFocus();
  await expect(first).toHaveAttribute("aria-controls", "chart-soap-editor-panel");
} };
