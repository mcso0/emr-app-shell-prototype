import { useEffect, useId, useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Toaster } from "./sonner";

type ToasterExampleArgs = ComponentProps<typeof Toaster>;
function ToasterExample(args: ToasterExampleArgs) {
  const id = useId();
  const [loading, setLoading] = useState(false);
  useEffect(() => () => {
    for (const kind of ["normal", "success", "info", "warning", "error", "loading"]) toast.dismiss(`${id}-${kind}`);
  }, [id]);
  const options = (kind: string) => ({ id: `${id}-${kind}`, toasterId: id, duration: Infinity });
  return (
    <div className="flex max-w-lg flex-wrap gap-2">
      <Toaster {...args} id={id} />
      <Button variant="outline" onClick={() => toast("합성 일반 안내", options("normal"))}>일반 안내</Button>
      <Button variant="outline" onClick={() => toast.success("합성 저장 완료", options("success"))}>완료 안내</Button>
      <Button variant="outline" onClick={() => toast.info("합성 보조 정보", options("info"))}>정보 안내</Button>
      <Button variant="outline" onClick={() => toast.warning("합성 주의 안내", options("warning"))}>주의 안내</Button>
      <Button variant="outline" onClick={() => toast.error("합성 오류 안내", options("error"))}>오류 안내</Button>
      <Button variant="outline" onClick={() => { setLoading(true); toast.loading("합성 로딩 안내", options("loading")); }}>로딩 안내</Button>
      <Button variant="outline" disabled={!loading} onClick={() => { toast.success("합성 로딩 완료", options("loading")); setLoading(false); }}>합성 로딩 완료</Button>
    </div>
  );
}

const meta = {
  title: "Design System/UI/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "360px" },
      description: {
        component: "짧은 비차단 안내를 화면 모서리에 표시합니다. 계속 확인해야 하는 오류·업무 안내는 EmrInlineAlert를 사용하세요. Toaster는 기존 밝은 테마·상태 아이콘·닫기 이름을 소유합니다. toast 호출과 실제 작업은 호출자가 소유합니다. 버튼은 이 예제의 합성 토스트만 만들며 종료 시 자기 토스트만 정리합니다.",
      },
    },
  },
  args: { position: "top-right", visibleToasts: 3, offset: 16, mobileOffset: 16 },
  argTypes: { position: { control: "radio", options: ["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center"], description: "Viewport corner used by this local Toaster instance." } },
  render: (args) => <ToasterExample {...args} />,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function activeToast(canvasElement: HTMLElement, content: string) {
  const toastElement = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-sonner-toast]:not([data-removed="true"])')).find((item) => item.textContent?.includes(content));
  if (!toastElement) throw new Error(`The local toast must show ${content}.`);
  return toastElement;
}
async function dismissToast(toastElement: HTMLElement) {
  await userEvent.click(within(toastElement).getByRole("button", { name: "토스트 닫기" }));
  await waitFor(() => expect(!toastElement.isConnected || toastElement.dataset.removed === "true").toBe(true));
}
export const Statuses: Story = {
  parameters: { docs: { description: { story: "앱 layout과 같은 top-right·visibleToasts=3·offset=16 설정입니다. 합성 일반·완료·정보·주의·오류·로딩 상태와 원본 닫기 이름을 확인합니다. 로딩 토스트는 라이브러리 기준 닫기 버튼이 없으며 로컬 완료 버튼으로 같은 ID를 갱신합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const cases = [["일반 안내", "합성 일반 안내", null], ["완료 안내", "합성 저장 완료", "success"], ["정보 안내", "합성 보조 정보", "info"], ["주의 안내", "합성 주의 안내", "warning"], ["오류 안내", "합성 오류 안내", "error"]] as const;
    for (const [buttonName, content, type] of cases) {
      await userEvent.click(canvas.getByRole("button", { name: buttonName }));
      await waitFor(() => { const current = activeToast(canvasElement, content); expect(current).toBeVisible(); expect(current).toHaveAttribute("data-mounted", "true"); if (type) expect(current).toHaveAttribute("data-type", type); });
      await dismissToast(activeToast(canvasElement, content));
    }
    await userEvent.click(canvas.getByRole("button", { name: "로딩 안내" }));
    await waitFor(() => expect(activeToast(canvasElement, "합성 로딩 안내")).toHaveAttribute("data-type", "loading"));
    await expect(within(activeToast(canvasElement, "합성 로딩 안내")).queryByRole("button", { name: "토스트 닫기" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "합성 로딩 완료" }));
    await waitFor(() => expect(activeToast(canvasElement, "합성 로딩 완료")).toHaveAttribute("data-type", "success"));
    await expect(canvas.getByRole("button", { name: "합성 로딩 완료" })).toBeDisabled();
    await dismissToast(activeToast(canvasElement, "합성 로딩 완료"));
  },
};
export const TopLeft: Story = {
  parameters: { docs: { description: { story: "Toaster position API를 top-left로 바꾸는 예시입니다. 앱의 기본 위치와 독립적으로 로컬 토스트 위치와 닫기를 확인합니다." } } },
  args: { position: "top-left" },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "정보 안내" }));
    await waitFor(() => { const current = activeToast(canvasElement, "합성 보조 정보"); expect(current).toBeVisible(); const list = current.closest('[data-sonner-toaster]'); expect(list).toHaveAttribute("data-x-position", "left"); expect(list).toHaveAttribute("data-y-position", "top"); });
    await dismissToast(activeToast(canvasElement, "합성 보조 정보"));
  },
};
