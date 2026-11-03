import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { EmrMeasuredLoading } from "./measured-loading";

function Example() {
  const [loading, setLoading] = useState(true);
  return <div className="w-[360px] max-w-full space-y-4 p-4">
    <Button onClick={() => setLoading(!loading)}>{loading ? "내용 보기" : "다시 조회"}</Button>
    {loading ? <EmrMeasuredLoading label="예시 정보를 불러오는 중입니다.">
      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <dt>이름</dt><dd>가상 이름</dd><dt>메모</dt><dd>가상 정보 예시</dd>
      </dl>
    </EmrMeasuredLoading> : <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4">
      <dt>이름</dt><dd>조회된 가상 정보</dd><dt>메모</dt><dd>확인된 내용</dd>
    </dl>}
  </div>;
}

const meta = {
  title: "Design System/EMR/Measured Loading",
  component: EmrMeasuredLoading,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof EmrMeasuredLoading>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { label: "정보를 불러오는 중입니다.", children: <div className="grid gap-3 p-4"><h3>기본 정보</h3><p>가상 정보 예시</p></div> },
  play: async ({ canvasElement }) => {
    const sample = canvasElement.querySelector<HTMLElement>("[skullet-loading]");
    await expect(sample?.inert).toBe(true);
    await expect(sample).toHaveAttribute("aria-hidden", "true");
    await waitFor(() => expect(canvasElement.querySelector("[skullet-layer]")?.shadowRoot?.childElementCount).toBeGreaterThan(0));
    await expect(canvasElement.querySelector('[aria-busy="true"]')).not.toBeNull();
  },
};

export const RepeatedRead: Story = {
  args: Loading.args,
  render: () => <Example />,
  play: async ({ canvas, canvasElement }) => {
    const before = { ...localStorage };
    for (let iteration = 0; iteration < 2; iteration += 1) {
      await userEvent.click(canvas.getByRole("button", { name: "내용 보기" }));
      await expect(canvas.getByText("조회된 가상 정보")).toBeVisible();
      await expect(canvasElement.querySelector("[skullet-loading]")).toBeNull();
      await userEvent.click(canvas.getByRole("button", { name: "다시 조회" }));
      await expect(canvas.queryByText("조회된 가상 정보")).toBeNull();
      await waitFor(() => expect(canvasElement.querySelector("[skullet-loading]")).not.toBeNull());
    }
    await expect({ ...localStorage }).toEqual(before);
  },
};
