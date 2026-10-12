import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { Button } from "@/components/ui/button";
import { LiveNotificationDelivery } from "./live-notification-delivery";
import { defaultNotificationPreferences } from "./notification-preferences";
import {
  mockGlobalNotifications,
  type GlobalNotification,
} from "./mock-notifications";

const opened = fn();
const archived = fn(async () => true);
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
  function publishWaitingAlert() {
    const fixture = mockGlobalNotifications.find(
      (item) => item.event_key === "waiting_over_30m",
    )!;
    setNotifications((current) => [
      ...current,
      {
        ...fixture,
        id: `waiting-${current.length}`,
        dedupe_key: `waiting-${current.length}`,
        priority: "urgent",
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
        <Button onClick={publishWaitingAlert}>장기 대기 알림 생성</Button>
      </div>
      <p className="mt-4">알림함 기록: {notifications.length}</p>
      <LiveNotificationDelivery
        workspaceId="settings-alpha"
        userId="synthetic-user"
        notifications={notifications}
        ready
        currentRoute="/w/settings-alpha/reception"
        onArchive={archived}
        onOpenSource={opened}
      />
    </div>
  );
}
const meta = {
  title: "Features/Notifications/Personal Delivery",
  component: DeliveryExample,
  parameters: { docs: { story: { inline: false, height: "480px" }, description: { component: "개인 알림의 표시, 닫기, 보관 동작을 확인합니다. DeliveryExample과 muted는 예제 설정입니다. 실제 LiveNotificationDelivery는 workspaceId, userId, notifications, ready, currentRoute와 콜백을 받습니다. 예제는 합성 알림과 알림 설정 응답을 사용하며 실제 전달과 보관 권한은 기능이 담당합니다." } }, layout: "fullscreen" },
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
    archived.mockClear();
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
  parameters: { docs: { description: { story: "일반 알림을 추가하고 닫은 뒤 알림함 기록이 남는지 확인합니다." } } },
  play: async ({ canvas }) => {
    await frames();
    await userEvent.click(
      canvas.getByRole("button", { name: "일반 알림 생성" }),
    );
    await expect(await canvas.findByText("예시 일반 알림")).toBeVisible();
    await waitFor(() =>
      expect(
        Number.parseInt(
          document.documentElement.style.getPropertyValue(
            "--live-notification-toast-stack-height",
          ),
          10,
        ),
      ).toBeGreaterThan(0),
    );
    await userEvent.click(canvas.getByRole("button", { name: "닫기" }));
    await expect(canvas.queryByText("예시 일반 알림")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue(
          "--live-notification-toast-stack-height",
        ),
      ).toBe("0px"),
    );
    await expect(canvas.getByText("알림함 기록: 1")).toBeVisible();
  },
};
export const MutedUrgentStillVisible: Story = {
  parameters: { docs: { description: { story: "화면 알림을 끈 상태에서 일반 알림은 숨기고 긴급 알림은 표시하는지 확인합니다." } } },
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
    await userEvent.click(canvas.getByRole("button", { name: "닫기" }));
    await expect(canvas.queryByText("예시 긴급 알림")).not.toBeInTheDocument();
  },
};

export const ArchiveWaitingAlert: Story = {
  parameters: { docs: { description: { story: "장기 대기 알림의 보관 요청을 합성 콜백으로 처리하고 화면에서 제거하는지 확인합니다." } } },
  play: async ({ canvas }) => {
    await frames();
    await userEvent.click(
      canvas.getByRole("button", { name: "장기 대기 알림 생성" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "이 알림 다시 보지 않기" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "이 알림 다시 보지 않기" }),
    );
    await expect(archived).toHaveBeenCalledWith("waiting-0");
    await expect(
      canvas.queryByRole("button", { name: "이 알림 다시 보지 않기" }),
    ).not.toBeInTheDocument();
  },
};

export const ArchiveWaitingAlertFailure: Story = {
  parameters: { docs: { description: { story: "합성 보관 요청이 실패했을 때 알림과 다시 시도할 수 있는 동작이 남는지 확인합니다." } } },
  play: async ({ canvas }) => {
    archived.mockResolvedValueOnce(false);
    await frames();
    await userEvent.click(
      canvas.getByRole("button", { name: "장기 대기 알림 생성" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "이 알림 다시 보지 않기" }),
    );
    await expect(archived).toHaveBeenCalledWith("waiting-0");
    await expect(
      canvas.getByRole("button", { name: "이 알림 다시 보지 않기" }),
    ).toBeVisible();
  },
};
