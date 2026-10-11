import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { ScheduleEditorCallerExample } from "./caller-parity.stories.fixture";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

type SheetStoryArgs = { description: string; showCloseButton: boolean; side: "top" | "right" | "bottom" | "left"; title: string; triggerLabel: string };
function SheetExample({ description, showCloseButton, side, title, triggerLabel }: SheetStoryArgs) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(0);
  return <div className="grid justify-items-start gap-3 p-8">
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>{triggerLabel}</SheetTrigger>
      <SheetContent side={side} showCloseButton={showCloseButton}>
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
        <p className="px-4">위치와 닫기 동작을 확인하는 Sheet API 조합입니다.</p>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>닫기</SheetClose>
          <Button onClick={() => { setApplied((count) => count + 1); setOpen(false); }}>샘플 적용</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <output aria-label="합성 시트 적용 결과">적용 {applied}회</output>
  </div>;
}
const meta = {
  title: "Design System/UI/Sheet", component: SheetExample, tags: ["autodocs"],
  parameters: { docs: { description: { component: "Default는 근무표의 실제 ScheduleShiftEditorSheet를 사용합니다. 유형·직원·날짜·업무·시간 입력과 유효성 검사, 취소·저장을 유지하며 저장 callback만 로컬 결과로 연결합니다. 나머지는 Sheet 위치 API 예제입니다. Sheet는 Dialog 기반 모달 초점을 유지합니다." } } },
  args: { description: "Sheet 위치 API 예제입니다.", showCloseButton: true, side: "right", title: "합성 패널", triggerLabel: "시트 열기" },
  argTypes: { description: { control: "text" }, title: { control: "text" }, triggerLabel: { control: "text" }, showCloseButton: { control: "boolean" }, side: { control: "radio", options: ["top", "right", "bottom", "left"] } },
  render: (args) => <SheetExample {...args} />,
} satisfies Meta<SheetStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ScheduleEditorCallerExample />,
  parameters: { controls: { disable: true }, docs: { description: { story: "ScheduleShiftEditorSheet와 실제 상위 화면의 미저장 확인입니다. 현행 제품에는 저장 후에도 확인창이 남는 문제가 있어 이 동작을 그대로 재현합니다. 합성 저장 결과를 확인한 뒤 실제 확인 버튼으로 닫습니다. 제품 문제를 예제 안에서 우회하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "근무 추가" }));
    const popup = await doc.findByRole("dialog", { name: "근무 추가" });
    const form = within(popup);
    await userEvent.clear(form.getByLabelText("업무"));
    await expect(form.getByRole("button", { name: "저장" })).toBeDisabled();
    await userEvent.type(form.getByLabelText("업무"), "합성 접수 업무");
    await userEvent.click(form.getByRole("combobox", { name: "직원" }));
    await userEvent.click(await doc.findByRole("option", { name: "합성 접수 직원 · 접수" }));
    await expect(form.getByRole("combobox", { name: "직원" })).toHaveTextContent("합성 접수 직원");
    await expect(canvas.getByLabelText("합성 근무 편집 상태")).toHaveTextContent("변경 있음");
    await userEvent.click(form.getByRole("button", { name: "취소" }));
    const guard = within(await doc.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" }));
    await userEvent.click(guard.getByRole("button", { name: "계속 편집" }));
    await expect(form.getByLabelText("업무")).toHaveValue("합성 접수 업무");
    await userEvent.keyboard("{Escape}");
    const escapeGuard = await doc.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(escapeGuard).not.toBeVisible());
    await expect(popup).toBeVisible();
    await expect(canvas.getByLabelText("합성 근무 저장 결과")).toHaveTextContent("저장 없음");
    await userEvent.click(form.getByRole("button", { name: "저장" }));
    const savedGuard = await doc.findByRole("dialog", { name: "저장하지 않은 변경이 있습니다" });
    await expect(popup).toBeVisible();
    await expect(canvas.getByLabelText("합성 근무 저장 결과")).toHaveTextContent("work · synthetic-desk · 2026-10-11 · 합성 접수 업무");
    await expect(canvas.getByLabelText("합성 근무 편집 상태")).toHaveTextContent("변경 없음");
    await userEvent.click(within(savedGuard).getByRole("button", { name: "저장하지 않고 이동" }));
    await waitFor(() => expect(popup).not.toBeVisible());
    await expect(canvas.getByLabelText("합성 근무 저장 결과")).toHaveTextContent("합성 접수 업무");
  },
};
async function checkSide(canvasElement: HTMLElement, args: SheetStoryArgs, apply: boolean) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: args.triggerLabel }));
  const popup = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: args.title });
  await expect(popup).toHaveAttribute("data-side", args.side);
  if (apply) await userEvent.click(within(popup).getByRole("button", { name: "샘플 적용" }));
  else await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(popup).not.toBeVisible());
  await expect(canvas.getByLabelText("합성 시트 적용 결과")).toHaveTextContent(apply ? "적용 1회" : "적용 0회");
}
export const LeftSide: Story = {
  args: { side: "left", title: "왼쪽 API 패널", triggerLabel: "왼쪽 시트 열기" },
  parameters: { docs: { description: { story: "side=left의 실제 위치와 Escape 닫기 API를 확인합니다. 제품의 특정 왼쪽 패널은 아닙니다." } } },
  play: async ({ canvasElement, args }) => checkSide(canvasElement, args, false),
};
export const BottomSheet: Story = {
  args: { side: "bottom", title: "하단 API 패널", triggerLabel: "하단 시트 열기" },
  parameters: { docs: { description: { story: "side=bottom의 실제 위치와 로컬 적용 callback을 확인합니다." } } },
  play: async ({ canvasElement, args }) => checkSide(canvasElement, args, true),
};
