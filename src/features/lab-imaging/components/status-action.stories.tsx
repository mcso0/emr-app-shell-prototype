import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, waitFor } from "storybook/test";
import { LabImagingStatusAction } from "./status-action";

function Example(args: ComponentProps<typeof LabImagingStatusAction>) {
  const [status, setStatus] = useState(args.status);
  const [action, setAction] = useState("없음");
  return <div className="flex items-center gap-4 p-6">
    <LabImagingStatusAction {...args} status={status}
      onStart={() => { setAction("start"); setStatus(args.activeStatus); }}
      onComplete={() => { setAction("complete"); setStatus(args.completedStatus); }}
      onCancelAssignment={() => { setAction("cancel"); setStatus(args.requestedStatus); }} />
    <output aria-label="합성 상태 액션">{action}</output>
  </div>;
}
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
const meta = {
  title: "Features/Lab/Status Action",
  component: LabImagingStatusAction,
  tags: ["autodocs"],
  args: { activeLabel: "검사중", activeStatus: "in_progress", completeLabel: "검사완료", completedStatus: "completed", menuAriaLabel: "검사 상태 액션", requestedStatus: "requested", status: "requested", onStart: () => undefined, onComplete: () => undefined, onCancelAssignment: () => undefined },
  argTypes: { status: { control: "select", options: ["requested", "in_progress", "completed", "unknown"] }, onStart: { control: false }, onComplete: { control: false }, onCancelAssignment: { control: false } },
  render: (args) => <Example key={args.status} {...args} />,
  parameters: { docs: { description: { component: "검사·영상 기능의 상태 문자열을 받아 담당하기, 진행 메뉴, 완료 표시를 선택합니다. 상태값과 각 콜백은 호출 기능이 제공합니다. Example은 로컬 상태만 바꾸며 업무 저장, 권한과 실제 담당 배정은 검증하지 않습니다. FulfillmentWorkLifecycleAction과는 별도 API입니다." } } },
} satisfies Meta<typeof LabImagingStatusAction>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Requested: Story = {
  parameters: { docs: { description: { story: "담당하기 버튼의 콜백이 로컬 진행 상태를 만드는지 확인합니다." } } },
  play: async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>("button")!);
    await until(() => canvasElement.querySelector("output")?.textContent === "start" && canvasElement.textContent?.includes("검사중") === true, "시작 콜백이 반영되지 않았습니다.");
  },
};
export const ActiveKeyboardComplete: Story = {
  args: { status: "in_progress" },
  parameters: { docs: { description: { story: "키보드 ArrowDown으로 진행 메뉴를 열고 완료 콜백의 로컬 결과를 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="검사 상태 액션 열기"]');
    if (!trigger) throw new Error("진행 메뉴 버튼이 없습니다.");
    trigger.focus(); await userEvent.keyboard("{ArrowDown}");
    const body = canvasElement.ownerDocument.body;
    const item = () => Array.from(body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((node) => node.textContent?.includes("검사완료"));
    await until(() => Boolean(item()), "완료 메뉴가 열리지 않았습니다.");
    await userEvent.click(item()!);
    await until(() => canvasElement.querySelector("output")?.textContent === "complete" && canvasElement.querySelector<HTMLButtonElement>("button")?.disabled === true, "완료 콜백과 비활성 완료 표시가 없습니다.");
  },
};
export const Completed: Story = { args: { status: "completed" }, parameters: { docs: { description: { story: "완료 상태는 비활성 버튼으로 표시합니다." } } }, play: async ({ canvasElement }) => { if (!canvasElement.querySelector<HTMLButtonElement>("button")?.disabled) throw new Error("완료 상태가 비활성화되지 않았습니다."); } };
export const ActiveCancelAssignment: Story = {
  args: { status: "in_progress" },
  parameters: { docs: { description: { story: "진행 메뉴에서 담당취소를 선택하면 콜백과 요청 상태가 반영됩니다." } } },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="검사 상태 액션 열기"]');
    if (!trigger) throw new Error("진행 메뉴 버튼이 없습니다.");
    trigger.focus(); await userEvent.keyboard("{ArrowDown}");
    const body = canvasElement.ownerDocument.body;
    const item = () => Array.from(body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((node) => node.textContent === "담당취소");
    await until(() => Boolean(item()), "담당취소 메뉴가 열리지 않았습니다.");
    await userEvent.click(item()!);
    await until(() => canvasElement.querySelector("output")?.textContent === "cancel" && canvasElement.querySelector("button")?.textContent?.includes("담당하기") === true, "담당취소 콜백과 요청 상태가 없습니다.");
  },
};
export const UnsupportedStatus: Story = { args: { status: "unknown" }, parameters: { docs: { description: { story: "세 상태값과 일치하지 않으면 작업 UI를 표시하지 않습니다." } } }, play: async ({ canvasElement }) => { if (canvasElement.querySelector("button")) throw new Error("지원하지 않는 상태에 작업 버튼이 있습니다."); } };
