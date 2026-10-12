import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { resolveNotificationBadgeCount, type GlobalNotification } from "./mock-notifications";
import { GlobalNotificationDrawer } from "./global-notification-drawer";

const item: GlobalNotification = {
  id: "synthetic-important", event_key: "order_recheck_requested", dedupe_key: "synthetic-important", domain: "lab", priority: "high", toast_policy: "drawer_only", sourceActionLabel: "합성 원본 확인", workTypeLabel: "검사", title: "합성 중요 알림", preview: "예제 안내", detail: "합성 상태를 확인해 주세요.", sourceLabel: "합성 검사", recipientLabel: "합성 사용자", recipient: { kind: "user", id: "synthetic-user", label: "합성 사용자" }, source: { kind: "fallback_detail", fallback_reason: "missing_source" }, issuedAtLabel: "방금", created_at: "2026-10-11T00:00:00Z", updated_at: "2026-10-11T00:00:00Z", read_state_key: "clair.notifications.v0.read", archive_state_key: "clair.notifications.v0.archive", unread: true, archived: false, requires_action: true, badge_count: true,
};
const notifications: GlobalNotification[] = [item, { ...item, id: "synthetic-read", dedupe_key: "synthetic-read", title: "합성 읽은 알림", unread: false, requires_action: false, badge_count: false }, { ...item, id: "synthetic-archived", dedupe_key: "synthetic-archived", title: "합성 보관 알림", archived: true, unread: false, requires_action: false, badge_count: false }];
function Example(args: ComponentProps<typeof GlobalNotificationDrawer>) {
  const [rows, setRows] = useState(args.notifications);
  const [open, setOpen] = useState(args.open);
  const [fallback, setFallback] = useState(args.fallbackDetailNotificationId);
  const [action, setAction] = useState("없음");
  const [errorMessage, setErrorMessage] = useState(args.errorMessage);
  const update = (id: string, patch: Partial<GlobalNotification>, name: string) => { setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); setAction(`${name}:${id}`); };
  return <><Button onClick={() => setOpen(true)}>합성 알림함 열기</Button><output aria-label="합성 알림 작업">{action}</output><GlobalNotificationDrawer {...args} open={open} notifications={rows} badgeCount={resolveNotificationBadgeCount(rows, { userId: "synthetic-user", activeRoleIds: [] })} errorMessage={errorMessage} fallbackDetailNotificationId={fallback}
    stateNotice="합성 Storybook 예제입니다. 읽음·보관·원본 요청은 로컬 상태만 바꿉니다."
    onOpenChange={setOpen} onCloseFallbackDetail={() => setFallback(null)} onOpenNotificationSource={(row) => { setFallback(row.id); setAction(`source:${row.id}`); }}
    onMarkNotificationRead={(id) => update(id, { unread: false }, "read")} onArchiveNotification={(id) => update(id, { archived: true }, "archive")} onRestoreNotification={(id) => update(id, { archived: false }, "restore")}
    onMarkAllRead={() => { setRows((current) => current.map((row) => ({ ...row, unread: false }))); setAction("read-all"); }} onRetry={() => { setAction("retry"); setErrorMessage(null); setRows(notifications); }} /></>;
}
const meta = {
  title: "Features/Notifications/Global Drawer", component: GlobalNotificationDrawer, tags: ["autodocs"],
  args: { open: true, notifications, badgeCount: 1, fallbackDetailNotificationId: null, stateNotice: "합성 예제의 로컬 상태입니다.", onArchiveNotification: () => undefined, onCloseFallbackDetail: () => undefined, onMarkAllRead: () => undefined, onMarkNotificationRead: () => undefined, onOpenChange: () => undefined, onOpenNotificationSource: () => undefined, onRestoreNotification: () => undefined },
  argTypes: { ...Object.fromEntries(["onArchiveNotification", "onCloseFallbackDetail", "onMarkAllRead", "onMarkNotificationRead", "onOpenChange", "onOpenNotificationSource", "onRestoreNotification", "onRetry"].map((key) => [key, { control: false }])), badgeCount: { control: false, description: "Example의 합성 목록에서 계산합니다." }, stateNotice: { control: false, description: "Example에서 합성 로컬 상태 안내로 고정합니다." } },
  render: (args) => <Example key={JSON.stringify([args.open, args.notifications, args.fallbackDetailNotificationId, args.errorMessage, args.loading])} {...args} />,
  parameters: { docs: { story: { inline: false, height: "820px" }, description: { component: "알림 목록의 전체·안 읽음·중요·보관 필터와 읽음·보관·복원 진입점을 확인합니다. GlobalNotificationDrawer는 서버 조회를 하지 않고 목록과 콜백을 받습니다. Example은 합성 상태만 바꾸고 서버 저장 안내를 명시적으로 대체합니다. 실제 권한, 동기화, 수신과 경로 이동은 검증하지 않습니다." } } },
} satisfies Meta<typeof GlobalNotificationDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
function button(root: ParentNode, text: string) { const result = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((node) => node.textContent?.trim() === text || node.getAttribute("aria-label") === text); if (!result) throw new Error(`알림 버튼이 없습니다: ${text}`); return result; }
async function filter(root: ParentNode, label: string) { const group = root.querySelector('[aria-label="알림 필터"]'); const result = Array.from(group?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((node) => node.textContent?.trim().startsWith(label)); if (!result) throw new Error(`알림 필터가 없습니다: ${label}`); await userEvent.click(result); }
export const FiltersAndStateActions: Story = {
  parameters: { docs: { description: { story: "네 필터와 읽음·보관·복원 콜백의 ID 및 로컬 행 상태를 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const body = canvasElement.ownerDocument.body;
    const rows = () => body.querySelectorAll('[data-testid^="global-notification-row-"]');
    await until(() => rows().length === 2, "전체 알림 목록이 준비되지 않았습니다.");
    await filter(body, "중요"); await until(() => rows().length === 1, "중요 알림 필터가 반영되지 않았습니다.");
    await filter(body, "안 읽음"); await until(() => rows().length === 1, "안 읽음 필터가 반영되지 않았습니다.");
    await userEvent.click(button(body, "합성 중요 알림 읽음 처리"));
    await until(() => rows().length === 0 && canvasElement.querySelector("output")?.textContent === "read:synthetic-important", "읽음 콜백이 반영되지 않았습니다.");
    await filter(body, "전체"); await until(() => rows().length === 2, "전체 필터가 복원되지 않았습니다.");
    await userEvent.click(button(body, "합성 중요 알림 보관"));
    await until(() => rows().length === 1 && canvasElement.querySelector("output")?.textContent === "archive:synthetic-important", "보관 콜백이 반영되지 않았습니다.");
    await filter(body, "보관"); await until(() => rows().length === 2, "보관 필터가 반영되지 않았습니다.");
    await userEvent.click(button(body, "합성 중요 알림 보관 해제"));
    await until(() => rows().length === 1 && canvasElement.querySelector("output")?.textContent === "restore:synthetic-important", "복원 콜백이 반영되지 않았습니다.");
  },
};
export const SourceFallbackAndClose: Story = { parameters: { docs: { description: { story: "원본 요청의 ID, 대체 상세 안내와 닫기 콜백을 확인합니다. 실제 경로는 열지 않습니다." } } }, play: async ({ canvasElement }) => { const body = canvasElement.ownerDocument.body; await until(() => Boolean(body.querySelector('[data-testid="global-notification-row-synthetic-important"]')), "알림 행이 없습니다."); await userEvent.click(button(body.querySelector('[data-testid="global-notification-row-synthetic-important"]')!, "합성 원본 확인")); await until(() => Boolean(body.querySelector('[data-testid="global-notification-fallback-detail"]')) && canvasElement.querySelector("output")?.textContent === "source:synthetic-important", "대체 상세 콜백이 없습니다."); await userEvent.click(button(body.querySelector('[data-testid="global-notification-fallback-detail"]')!, "닫기")); await until(() => !body.querySelector('[data-testid="global-notification-fallback-detail"]'), "대체 상세가 닫히지 않았습니다."); await userEvent.click(button(body, "알림 닫기")); await until(() => !body.querySelector('[role="dialog"]'), "알림함이 닫히지 않았습니다."); await userEvent.click(button(canvasElement, "합성 알림함 열기")); await until(() => Boolean(body.querySelector('[role="dialog"]')), "알림함이 다시 열리지 않았습니다."); await userEvent.keyboard("{Escape}"); await until(() => !body.querySelector('[role="dialog"]'), "Escape로 알림함이 닫히지 않았습니다."); await expect(button(canvasElement, "합성 알림함 열기")).toBeVisible(); } };
export const MarkAllRead: Story = { parameters: { docs: { description: { story: "전체 읽음 콜백과 읽음 완료 후 비활성 버튼을 확인합니다." } } }, play: async ({ canvasElement }) => { const body = canvasElement.ownerDocument.body; await until(() => Boolean(body.querySelector('[role="dialog"]')), "알림함이 없습니다."); await userEvent.click(button(body, "전체 읽음")); await until(() => button(body, "전체 읽음").disabled && canvasElement.querySelector("output")?.textContent === "read-all", "전체 읽음 결과가 없습니다."); } };
export const Loading: Story = { args: { notifications: [], loading: true }, parameters: { docs: { description: { story: "알림 조회 중 안내를 표시합니다." } } } };
export const Empty: Story = { args: { notifications: [], badgeCount: 0 }, parameters: { docs: { description: { story: "빈 목록과 비활성 전체 읽음 버튼을 표시합니다." } } } };
export const ErrorRetry: Story = { args: { notifications: [], errorMessage: "합성 조회 오류입니다." }, parameters: { docs: { description: { story: "조회 오류에서 다시 시도하면 합성 목록으로 복구되는지 확인합니다." } } }, play: async ({ canvasElement }) => { const body = canvasElement.ownerDocument.body; await until(() => Boolean(body.querySelector('[data-testid="global-notification-error-state"]')), "오류 안내가 없습니다."); await userEvent.click(button(body, "다시 시도")); await until(() => canvasElement.querySelector("output")?.textContent === "retry" && !body.querySelector('[data-testid="global-notification-error-state"]') && body.querySelectorAll('[data-testid^="global-notification-row-"]').length === 2, "재시도 콜백이 없습니다."); } };
export const GlobalUnreadCount: Story = { args: { globalUnreadCount: 12 }, parameters: { docs: { description: { story: "현재 로드된 목록의 안 읽음 수와 서버에서 전달받은 전체 안 읽음 수가 다를 수 있음을 표시합니다. 예제의 12는 합성 값입니다." } } }, play: async ({ canvasElement }) => { await until(() => canvasElement.ownerDocument.body.textContent?.includes("안 읽음 12개") === true, "전역 안 읽음 개수가 표시되지 않았습니다."); } };
