import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";

type DialogStoryArgs = { description: string; showCloseButton: boolean; title: string; triggerLabel: string };

function DiscardChangesCaller({ title, description, triggerLabel }: DialogStoryArgs) {
  const [open, setOpen] = useState(false);
  const [discarded, setDiscarded] = useState(0);
  return <div className="grid justify-items-start gap-3">
    <Button variant="outline" onClick={() => setOpen(true)}>{triggerLabel}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <EmrConfirmDialogContent
        title={title} description={description}
        cancelLabel="계속 편집" confirmLabel="변경사항 버리기" confirmButtonVariant="destructive"
        onCancel={() => setOpen(false)}
        onConfirm={() => { setDiscarded((count) => count + 1); setOpen(false); }}
      />
    </Dialog>
    <output aria-label="합성 변경사항 처리 결과">변경사항 버림 {discarded}회</output>
  </div>;
}

function DialogExample({ description, showCloseButton, title, triggerLabel }: DialogStoryArgs) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  return <div className="grid justify-items-start gap-3">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>{triggerLabel}</DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="text-sm">Dialog API 예제입니다. 확인 결과는 로컬 횟수에만 기록합니다.</div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
          <Button onClick={() => { setConfirmed((count) => count + 1); setOpen(false); }}>확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <output aria-label="합성 확인 결과">확인 {confirmed}회</output>
  </div>;
}

const meta = {
  title: "Design System/UI/Dialog", component: DialogExample, tags: ["autodocs"],
  parameters: { docs: { description: { component: "Default는 역할·권한 설정의 미저장 변경 확인에서 쓰는 실제 EmrConfirmDialogContent를 렌더링합니다. 취소·닫기·확인은 호출자처럼 로컬 Dialog 상태와 처리 결과를 바꿉니다. 나머지는 Dialog API 조합 예제입니다. showCloseButton은 우측 닫기 아이콘만 숨기며 Escape 닫기를 막지 않습니다. 서버 저장과 실제 화면 이동은 실행하지 않습니다." } } },
  argTypes: {
    title: { control: "text", description: "실제 DialogTitle에 전달하는 제목입니다." },
    description: { control: "text", description: "실제 DialogDescription에 전달하는 설명입니다." },
    triggerLabel: { control: "text" },
    showCloseButton: { control: "boolean", description: "API 예제의 우측 닫기 아이콘 표시입니다. Escape 동작에는 영향을 주지 않습니다." },
  },
  args: { description: "역할 권한 변경을 저장하지 않았습니다. 변경사항을 버리고 이동할까요?", showCloseButton: true, title: "저장하지 않은 변경사항이 있습니다", triggerLabel: "편집 화면 나가기" },
  render: (args) => <DialogExample {...args} />,
} satisfies Meta<DialogStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openDialog(canvasElement: HTMLElement, label: string, title: string) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: label }));
  const doc = within(canvasElement.ownerDocument.body);
  const popup = await doc.findByRole("dialog", { name: title });
  await waitFor(() => expect(popup).toBeVisible());
  return popup;
}
async function closed(popup: HTMLElement) { await waitFor(() => expect(popup).not.toBeVisible()); }

export const Default: Story = {
  render: (args) => <DiscardChangesCaller {...args} />,
  argTypes: { showCloseButton: { control: false, table: { disable: true } } },
  parameters: { docs: { description: { story: "origin/main의 role-permission-management/screen.tsx 미저장 확인 조합입니다. 실제 공통 확인 콘텐츠와 동일한 문구·destructive 버튼을 사용합니다. 취소와 Escape는 결과를 바꾸지 않고, 확인만 로컬 버림 횟수를 늘립니다." } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    let popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await userEvent.click(within(popup).getByRole("button", { name: "계속 편집" }));
    await closed(popup);
    await expect(canvas.getByLabelText("합성 변경사항 처리 결과")).toHaveTextContent("변경사항 버림 0회");
    popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await userEvent.keyboard("{Escape}");
    await closed(popup);
    popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await userEvent.click(within(popup).getByRole("button", { name: "변경사항 버리기" }));
    await closed(popup);
    await expect(canvas.getByLabelText("합성 변경사항 처리 결과")).toHaveTextContent("변경사항 버림 1회");
  },
};
export const ConfirmAction: Story = {
  args: { description: "확인 callback의 로컬 결과를 확인하는 Dialog API 예제입니다.", title: "합성 요청 확인", triggerLabel: "확인 다이얼로그 열기" },
  parameters: { docs: { description: { story: "Dialog API 조합입니다. 확인 버튼은 로컬 횟수를 기록하고 닫습니다. 앱의 특정 요청·저장 화면을 재현하지 않습니다." } } },
  play: async ({ canvasElement, args }) => {
    const popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await userEvent.click(within(popup).getByRole("button", { name: "확인" }));
    await closed(popup);
    await expect(within(canvasElement).getByLabelText("합성 확인 결과")).toHaveTextContent("확인 1회");
  },
};
export const WithoutCloseButton: Story = {
  args: { description: "우측 닫기 아이콘이 없는 API 예제입니다. 취소·확인·Escape로 닫을 수 있습니다.", showCloseButton: false, title: "닫기 아이콘 숨김" },
  parameters: { docs: { description: { story: "showCloseButton=false의 실제 범위입니다. 우측 아이콘만 숨기며 Escape와 footer action은 유지합니다." } } },
  play: async ({ canvasElement, args }) => {
    let popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await expect(within(popup).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await closed(popup);
    popup = await openDialog(canvasElement, args.triggerLabel, args.title);
    await userEvent.click(within(popup).getByRole("button", { name: "취소" }));
    await closed(popup);
    await expect(within(canvasElement).getByLabelText("합성 확인 결과")).toHaveTextContent("확인 0회");
  },
};
