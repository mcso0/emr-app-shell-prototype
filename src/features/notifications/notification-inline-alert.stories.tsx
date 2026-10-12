import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import type { GlobalNotification } from "./mock-notifications";
import { NotificationInlineAlert } from "./notification-inline-alert";

const notification: GlobalNotification = {
  id: "synthetic-inline", event_key: "order_recheck_requested", dedupe_key: "synthetic-inline", domain: "lab", priority: "normal", toast_policy: "drawer_only",
  sourceActionLabel: "합성 원본 확인", workTypeLabel: "검사", title: "합성 알림", preview: "예제 안내", detail: "합성 상태를 확인해 주세요.", sourceLabel: "합성 검사", recipientLabel: "합성 사용자",
  recipient: { kind: "user", id: "synthetic-user", label: "합성 사용자" }, source: { kind: "order", route: "/synthetic-story-source", entity_id: "synthetic-order" },
  issuedAtLabel: "방금", created_at: "2026-10-11T00:00:00Z", updated_at: "2026-10-11T00:00:00Z", read_state_key: "clair.notifications.v0.read", archive_state_key: "clair.notifications.v0.archive", unread: true, archived: false, requires_action: true, badge_count: true,
};
function Example(args: ComponentProps<typeof NotificationInlineAlert>) {
  const [opened, setOpened] = useState("없음");
  return <div className="grid max-w-xl gap-3"><NotificationInlineAlert {...args} onOpenSource={(item) => setOpened(item.id)} /><output aria-label="합성 원본 요청">{opened}</output></div>;
}
const meta = {
  title: "Features/Notifications/Inline Alert", component: NotificationInlineAlert, tags: ["autodocs"], args: { notification }, argTypes: { onOpenSource: { control: false, description: "예제에서 요청 알림 ID를 기록합니다." } }, render: (args) => <Example {...args} />,
  parameters: { docs: { description: { component: "알림의 우선순위, 표시 정책과 완료 여부로 인라인 안내 심각도를 정합니다. 호출 기능이 notification과 원본 열기 콜백을 제공합니다. Example은 알림 ID만 기록합니다. 원본 경로 이동, 수신 권한, 읽음 저장이나 실제 전달은 검증하지 않습니다." } } },
} satisfies Meta<typeof NotificationInlineAlert>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InformationAndSource: Story = {
  parameters: { docs: { description: { story: "일반 알림은 info로 표시하고 원본 열기 콜백에 알림을 전달합니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[data-severity="info"]')) throw new Error("일반 알림 심각도가 올바르지 않습니다.");
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>("button")!);
    await waitFor(() => expect(canvasElement.querySelector("output")).toHaveTextContent(notification.id));
  },
};
export const Urgent: Story = { args: { notification: { ...notification, priority: "urgent" } }, parameters: { docs: { description: { story: "긴급 알림은 error 심각도로 표시합니다." } } }, play: async ({ canvasElement }) => { if (!canvasElement.querySelector('[data-severity="error"]')) throw new Error("긴급 알림 심각도가 올바르지 않습니다."); } };
export const HighPriority: Story = { args: { notification: { ...notification, priority: "high" } }, parameters: { docs: { description: { story: "높은 우선순위 알림은 warning으로 표시합니다." } } } };
export const InlineFirst: Story = { args: { notification: { ...notification, toast_policy: "inline_first" } }, parameters: { docs: { description: { story: "inline_first 정책도 warning 안내를 사용합니다." } } } };
export const Completed: Story = { args: { notification: { ...notification, event_key: "clinical_result_completed", requires_action: false } }, parameters: { docs: { description: { story: "조치가 필요하지 않은 완료 이벤트는 success로 표시합니다." } } }, play: async ({ canvasElement }) => { if (!canvasElement.querySelector('[data-severity="success"]')) throw new Error("완료 알림 심각도가 올바르지 않습니다."); } };
export const MissingSource: Story = { args: { notification: { ...notification, source: { kind: "fallback_detail", fallback_reason: "missing_source" } } }, parameters: { docs: { description: { story: "원본 경로가 없으면 알림 상세 보기 버튼을 표시합니다." } } }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector("button")).toHaveTextContent("알림 상세 보기"); await userEvent.click(canvasElement.querySelector("button")!); await waitFor(() => expect(canvasElement.querySelector("output")).toHaveTextContent(notification.id)); } };
