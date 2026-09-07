import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Button } from "@/components/ui/button";
import { LiveNotificationDelivery } from "./live-notification-delivery";
import { defaultNotificationPreferences } from "./notification-preferences";
import {
  mockGlobalNotifications,
  type GlobalNotification,
} from "./mock-notifications";

const opened = fn();
function DeliveryExample({ muted = false }: { muted?: boolean }) {
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  function publish(priority: "normal" | "urgent") {
    const fixture = mockGlobalNotifications.find(
      (item) => item.event_key === "order_recheck_requested",
    )!;
    setNotifications((current) => [
      ...current,
      {
        ...fixture,
        id: `${priority}-${current.length}`,
        dedupe_key: `${priority}-${current.length}`,
        title: priority === "urgent" ? "예시 긴급 알림" : "예시 일반 알림",
        preview: "합성 데이터로 검증하는 알림입니다.",
        priority,
        toast_policy: "immediate",
        recipient: { kind: "user", id: "synthetic-user", label: "검증 계정" },
        unread: true,
        archived: false,
        updated_at: new Date().toISOString(),
      },
    ]);
  }
  return (
    <div className="min-h-[500px] p-6">
      <p>{muted ? "화면 알림 꺼짐" : "화면 알림 켜짐"}</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => publish("normal")}>일반 알림 생성</Button>
        <Button onClick={() => publish("urgent")}>긴급 알림 생성</Button>
      </div>
      <p className="mt-4">알림함 기록: {notifications.length}</p>
      <LiveNotificationDelivery
        workspaceId="settings-alpha"
        userId="synthetic-user"
        notifications={notifications}
        ready
        currentRoute="/w/settings-alpha/reception"
        onOpenSource={opened}
      />
    </div>
  );
}
const meta = {
  title: "Features/Notifications/Personal Delivery",
  component: DeliveryExample,
  parameters: { layout: "fullscreen" },
  args: { muted: false },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;
    const preferences = {
      ...defaultNotificationPreferences(),
      popup: !args.muted,
    };
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith("/notification-preferences"))
        return Response.json({ ok: true, preferences });
      return original(input, init);
    };
    opened.mockClear();
    return () => {
      globalThis.fetch = original;
    };
  },
} satisfies Meta<typeof DeliveryExample>;
export default meta;
type Story = StoryObj<typeof meta>;
async function frames() {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
}
export const NewNotification: Story = {
  play: async ({ canvas }) => {
    await frames();
    await userEvent.click(
      canvas.getByRole("button", { name: "일반 알림 생성" }),
    );
    await expect(await canvas.findByText("예시 일반 알림")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "나중에 보기" }));
    await expect(canvas.queryByText("예시 일반 알림")).not.toBeInTheDocument();
    await expect(canvas.getByText("알림함 기록: 1")).toBeVisible();
  },
};
export const MutedUrgentStillVisible: Story = {
  args: { muted: true },
  play: async ({ canvas }) => {
    await frames();
    await userEvent.click(
      canvas.getByRole("button", { name: "일반 알림 생성" }),
    );
    await frames();
    await expect(canvas.queryByText("예시 일반 알림")).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "긴급 알림 생성" }),
    );
    await expect(await canvas.findByText("예시 긴급 알림")).toBeVisible();
    await expect(canvas.getByText("알림함 기록: 2")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "나중에 보기" }));
    await expect(canvas.queryByText("예시 긴급 알림")).not.toBeInTheDocument();
  },
};
