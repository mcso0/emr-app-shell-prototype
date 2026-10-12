import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { expect, userEvent, waitFor } from "storybook/test";
import { FulfillmentWorkLifecycleAction } from "./work-lifecycle-action";

type LifecycleProps = ComponentProps<typeof FulfillmentWorkLifecycleAction>;
const loadNoAssignees: NonNullable<LifecycleProps["loadEligibleAssignees"]> = async () => [];
const succeedTransition: LifecycleProps["onTransition"] = async () => true;

function Example(args: LifecycleProps) {
  const [action, setAction] = useState("없음");
  const [result, setResult] = useState("미실행");
  const [status, setStatus] = useState(args.status);
  const [assignedToUserId, setAssignedToUserId] = useState(args.assignedToUserId);
  return <div className="flex items-center gap-4 p-6"><FulfillmentWorkLifecycleAction {...args} status={status} assignedToUserId={assignedToUserId} onTransition={async (next, options) => {
    setAction(JSON.stringify({ action: next, ...options }));
    const succeeded = await args.onTransition(next, options);
    setResult(String(succeeded));
    if (succeeded) {
      if (next === "claim") setAssignedToUserId("synthetic-assignee");
      if (next === "unassign") setAssignedToUserId(null);
      if (next === "assign" || next === "handoff") setAssignedToUserId(options?.assignedToUserId);
      if (next === "start" || next === "resume") setStatus("in_progress");
      if (next === "pause") setStatus("paused");
      if (next === "complete") setStatus("completed");
      if (next === "return") setStatus("returned");
    }
    return succeeded;
  }} /><output aria-label="합성 전환 요청">{action}</output><output aria-label="합성 전환 결과">{result}</output></div>;
}
const meta = {
  title: "Features/Fulfillment/Work Lifecycle Action",
  component: FulfillmentWorkLifecycleAction,
  tags: ["autodocs"],
  args: { activityLabel: "검사", completeLabel: "검사완료", status: "requested", canManage: true, busy: false, loadEligibleAssignees: loadNoAssignees, onTransition: succeedTransition },
  argTypes: { onTransition: { control: false }, loadEligibleAssignees: { control: false }, status: { control: "select", options: ["requested", "in_progress", "paused", "completed", "cancelled", "returned"] }, busy: { control: "boolean" } },
  render: (args) => <Example key={`${args.status}:${args.assignedToUserId}:${args.busy}`} {...args} />,
  parameters: { docs: { story: { inline: false, height: "760px" }, description: { component: "업무 상태와 담당자 유무에 따라 담당하기, 시작, 진행 메뉴 또는 종료 상태를 표시합니다. 호출 기능이 담당자 목록과 비동기 전환 콜백을 제공합니다. Example은 요청 인자와 합성 콜백 결과를 기록하고 성공하면 로컬 상태·담당자를 변경합니다. 실제 업무 변경, 적격 담당자 조회, 알림 전달과 서버 권한은 검증하지 않습니다." } } },
} satisfies Meta<typeof FulfillmentWorkLifecycleAction>;
export default meta;
type Story = StoryObj<typeof meta>;
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
async function chooseMenu(canvasElement: HTMLElement, label: string) {
  const trigger = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="검사 상태 액션 열기"]');
  if (!trigger) throw new Error("업무 상태 메뉴가 없습니다.");
  trigger.focus(); await userEvent.keyboard("{ArrowDown}");
  const item = () => Array.from(canvasElement.ownerDocument.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((node) => node.textContent?.trim() === label);
  await until(() => Boolean(item()), `${label} 메뉴가 없습니다.`); await userEvent.click(item()!);
}
function dialogButton(body: HTMLElement, label: string) { const button = Array.from(body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((node) => node.textContent?.trim() === label); if (!button) throw new Error(`${label} 대화상자 버튼이 없습니다.`); return button; }
async function setReason(body: HTMLElement, label: string, text: string) {
  const input = body.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  if (!input) throw new Error(`${label} 입력이 없습니다.`);
  await userEvent.clear(input);
  await userEvent.type(input, text);
}
async function assertRequest(canvasElement: HTMLElement, expected: string) {
  const button = canvasElement.querySelector<HTMLButtonElement>('button:not([aria-label])');
  if (!button || button.disabled) throw new Error("실행 가능한 상태 버튼이 없습니다.");
  await userEvent.click(button);
  await until(() => canvasElement.querySelector("output")?.textContent?.includes(expected) === true, `전환 콜백 ${expected}가 없습니다.`);
}

export const UnassignedClaim: Story = { parameters: { docs: { description: { story: "미배정 요청의 담당하기 버튼이 claim을 전달합니다." } } }, play: async ({ canvasElement }) => assertRequest(canvasElement, '"action":"claim"') };
export const AssignedStart: Story = { args: { assignedToUserId: "synthetic-assignee", startPhase: "inputting" }, parameters: { docs: { description: { story: "배정된 요청의 시작 버튼이 start와 시작 단계를 전달합니다." } } }, play: async ({ canvasElement }) => { await assertRequest(canvasElement, '"action":"start"'); if (!canvasElement.querySelector("output")?.textContent?.includes('"detailedPhase":"inputting"')) throw new Error("시작 단계가 전달되지 않았습니다."); } };
export const InProgress: Story = { args: { assignedToUserId: "synthetic-assignee", status: "in_progress" }, parameters: { docs: { description: { story: "키보드로 진행 메뉴를 열어 완료 콜백을 확인합니다." } } }, play: async ({ canvasElement }) => { await chooseMenu(canvasElement, "검사완료"); await until(() => canvasElement.querySelector("output")?.textContent?.includes('"action":"complete"') === true, "완료 콜백이 없습니다."); await expect(canvasElement.querySelector('button:not([aria-label])')).toBeDisabled(); await expect(canvasElement.querySelector('button:not([aria-label])')).toHaveTextContent("검사완료"); } };
export const Paused: Story = { args: { assignedToUserId: "synthetic-assignee", status: "paused" }, parameters: { docs: { description: { story: "일시중지 상태에서 재개 콜백을 확인합니다." } } }, play: async ({ canvasElement }) => { await chooseMenu(canvasElement, "재개"); await until(() => canvasElement.querySelector("output")?.textContent?.includes('"action":"resume"') === true, "재개 콜백이 없습니다."); await expect(canvasElement.querySelector('button:not([aria-label])')).toHaveTextContent("검사 중"); } };
export const Busy: Story = { args: { busy: true }, parameters: { docs: { description: { story: "요청 처리 중에는 담당하기를 실행할 수 없습니다." } } }, play: async ({ canvasElement }) => { const button = canvasElement.querySelector<HTMLButtonElement>('button:not([aria-label])'); if (!button?.disabled) throw new Error("처리 중 버튼이 활성화되어 있습니다."); await expect(button).toBeDisabled(); if (canvasElement.querySelector("output")?.textContent !== "없음") throw new Error("처리 중 전환이 실행되었습니다."); } };
export const Completed: Story = { args: { status: "completed" }, parameters: { docs: { description: { story: "완료 상태를 비활성 버튼으로 표시합니다." } } } };
export const Returned: Story = { args: { status: "returned" }, parameters: { docs: { description: { story: "반려 상태를 비활성 버튼으로 표시합니다." } } } };
export const Cancelled: Story = { args: { status: "cancelled" }, parameters: { docs: { description: { story: "취소 상태를 비활성 버튼으로 표시합니다." } } } };
export const Unassign: Story = { args: { assignedToUserId: "synthetic-assignee" }, parameters: { docs: { description: { story: "배정된 요청에서 담당 취소 콜백을 확인합니다." } } }, play: async ({ canvasElement }) => { await chooseMenu(canvasElement, "담당 취소"); await until(() => canvasElement.querySelector("output")?.textContent?.includes('"action":"unassign"') === true, "담당 취소 콜백이 없습니다."); } };
export const Pause: Story = { args: { assignedToUserId: "synthetic-assignee", status: "in_progress" }, parameters: { docs: { description: { story: "진행 업무의 일시중지 콜백을 확인합니다." } } }, play: async ({ canvasElement }) => { await chooseMenu(canvasElement, "일시중지"); await until(() => canvasElement.querySelector("output")?.textContent?.includes('"action":"pause"') === true, "일시중지 콜백이 없습니다."); await expect(canvasElement.querySelector('button:not([aria-label])')).toHaveTextContent("일시중지"); } };
export const ReturnReason: Story = {
  args: { assignedToUserId: "synthetic-assignee", status: "in_progress" },
  parameters: { docs: { description: { story: "반려 사유가 필요하며, 앞뒤 공백을 제거한 사유를 전달하고 성공 시 대화상자를 닫습니다." } } },
  play: async ({ canvasElement }) => {
    await chooseMenu(canvasElement, "반려"); const body = canvasElement.ownerDocument.body;
    await until(() => Boolean(body.querySelector('[role="dialog"] textarea')), "반려 대화상자가 없습니다.");
    if (!dialogButton(body, "반려").disabled) throw new Error("사유 없이 반려할 수 있습니다.");
    await setReason(body, "반려 사유", "  합성 확인 사유  ");
    await until(() => !dialogButton(body, "반려").disabled, "사유가 반영되지 않았습니다."); await userEvent.click(dialogButton(body, "반려"));
    await until(() => canvasElement.querySelector("output")?.textContent === '{"action":"return","reason":"합성 확인 사유"}' && !body.querySelector('[role="dialog"]'), "반려 인자 또는 성공 후 닫기가 올바르지 않습니다.");
  },
};
export const HandoffRequiredFields: Story = {
  args: { assignedToUserId: "synthetic-assignee", status: "in_progress", loadEligibleAssignees: async () => [{ userId: "synthetic-assignee", displayName: "현재 합성 담당자" }, { userId: "synthetic-next", displayName: "다음 합성 담당자" }] },
  parameters: { docs: { description: { story: "현재 담당자를 제외한 합성 목록에서 인계자를 고르고 사유를 입력한 뒤 정확한 assignedToUserId와 사유를 인계 콜백으로 전달하는지 확인합니다. 선택한 담당자 이름을 표시합니다." } } },
  play: async ({ canvasElement }) => {
    await chooseMenu(canvasElement, "담당 인계"); const body = canvasElement.ownerDocument.body;
    const select = () => body.querySelector<HTMLButtonElement>('[aria-label="인계할 담당자"]');
    await until(() => Boolean(select()) && !select()!.disabled, "합성 담당자 조회가 준비되지 않았습니다.");
    if (!dialogButton(body, "저장").disabled) throw new Error("필수 값 없이 인계할 수 있습니다.");
    select()!.focus(); await userEvent.keyboard("{ArrowDown}");
    const option = () => Array.from(body.querySelectorAll<HTMLElement>('[role="option"]')).find((node) => node.textContent?.includes("다음 합성 담당자"));
    await until(() => Boolean(option()), "합성 담당자 선택지가 없습니다.");
    if (Array.from(body.querySelectorAll('[role="option"]')).some((node) => node.textContent?.includes("현재 합성 담당자"))) throw new Error("현재 담당자가 인계 목록에 남아 있습니다.");
    await userEvent.click(option()!);
    await until(() => select()?.textContent?.trim() === "다음 합성 담당자", "선택한 담당자 이름이 표시되지 않았습니다.");
    if (!dialogButton(body, "저장").disabled) throw new Error("사유 없이 인계할 수 있습니다.");
    await setReason(body, "인계 사유", "  합성 인계 사유  "); await until(() => !dialogButton(body, "저장").disabled, "인계 사유가 반영되지 않았습니다."); await userEvent.click(dialogButton(body, "저장"));
    await until(() => canvasElement.querySelector("output")?.textContent === '{"action":"handoff","assignedToUserId":"synthetic-next","reason":"합성 인계 사유"}' && !body.querySelector('[role="dialog"]'), "인계 인자 또는 성공 후 닫기가 올바르지 않습니다.");
  },
};
export const NoEligibleAssignees: Story = { args: { assignedToUserId: "synthetic-assignee" }, play: async ({ canvasElement }) => {
  const trigger = canvasElement.querySelector<HTMLButtonElement>('button[aria-label*="담당자"]');
  if (!trigger) throw new Error("담당자 아바타가 없습니다.");
  await userEvent.click(trigger);
  await until(() => canvasElement.ownerDocument.body.textContent?.includes("변경 가능한 담당자가 없습니다.") === true, "빈 목록 안내가 없습니다.");
  await userEvent.keyboard("{Escape}");
} };
export const FailedReturn: Story = {
  beforeEach: () => {
    const existingToastIds = new Set(toast.getToasts().map((item) => item.id));
    return () => {
      for (const item of toast.getToasts()) {
        if (!existingToastIds.has(item.id) && "title" in item && item.title === "업무 상태를 변경하지 못했어요. 최신 상태를 확인해 주세요.") toast.dismiss(item.id);
      }
    };
  },
  args: { assignedToUserId: "synthetic-assignee", status: "in_progress", onTransition: async () => false }, parameters: { docs: { description: { story: "반려 전환 콜백이 실패하면 대화상자와 입력 사유를 유지하며 다시 제출할 수 있습니다. 실패 토스트의 시각적 표현은 별도 검증 범위입니다." } } }, play: async ({ canvasElement }) => { await chooseMenu(canvasElement, "반려"); const body = canvasElement.ownerDocument.body; await until(() => Boolean(body.querySelector('[role="dialog"] textarea')), "반려 입력이 없습니다."); await setReason(body, "반려 사유", "합성 실패 사유"); await until(() => !dialogButton(body, "반려").disabled, "반려 사유가 반영되지 않았습니다."); await userEvent.click(dialogButton(body, "반려")); await until(() => canvasElement.querySelector('[aria-label="합성 전환 결과"]')?.textContent === "false" && !dialogButton(body, "반려").disabled, "실패 후 재시도 상태가 없습니다."); if (body.querySelector<HTMLTextAreaElement>('textarea[aria-label="반려 사유"]')?.value !== "합성 실패 사유") throw new Error("실패 후 사유가 보존되지 않았습니다."); await userEvent.click(dialogButton(body, "취소")); await until(() => !body.querySelector('[role="dialog"]'), "실패 대화상자 취소가 반영되지 않았습니다."); } };
