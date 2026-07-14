"use client";

import { useEffect, useState } from "react";
import type { RealtimePresenceState } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60_000;

type WorkspaceStaffPresenceChannel = {
  on(
    type: "presence",
    filter: { event: string },
    callback: () => void,
  ): WorkspaceStaffPresenceChannel;
};

export function getWorkspaceStaffPresenceTopic(workspaceId: string) {
  return `workspace:${workspaceId}:staff-presence`;
}

export function isStaffOnline(
  presenceState: RealtimePresenceState<Record<string, unknown>>,
  userId: string,
) {
  return (presenceState[userId]?.length ?? 0) > 0;
}

export function bindWorkspaceStaffPresenceEvents(
  channel: WorkspaceStaffPresenceChannel,
  syncOnlineStatus: () => void,
) {
  return channel
    .on("presence", { event: "sync" }, syncOnlineStatus)
    .on("presence", { event: "join" }, syncOnlineStatus)
    .on("presence", { event: "leave" }, syncOnlineStatus);
}

export function formatStaffLastSeenLabel(
  lastSeenAt: string | undefined,
  now = new Date(),
) {
  if (!lastSeenAt) return "접속 기록 없음";

  const timestamp = Date.parse(lastSeenAt);
  if (Number.isNaN(timestamp)) return "접속 기록 없음";

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - timestamp) / 60_000),
  );
  if (elapsedMinutes < 1) return "방금 접속";
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전 접속`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}시간 전 접속`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `${elapsedDays}일 전 접속`;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(timestamp)) + " 접속";
}

export function useWorkspaceStaffOnlineStatus({
  userId,
  workspaceId,
}: {
  userId: string | null;
  workspaceId: string;
}) {
  const statusKey = `${workspaceId}:${userId ?? ""}`;
  const [snapshot, setSnapshot] = useState({ key: "", online: false });

  useEffect(() => {
    if (!userId || !workspaceId) return;
    const targetUserId = userId;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    const client = supabase;
    let disposed = false;
    const channel = client.channel(getWorkspaceStaffPresenceTopic(workspaceId), {
      config: { private: true },
    });

    const syncOnlineStatus = () => {
      if (disposed) return;
      setSnapshot({
        key: statusKey,
        online: isStaffOnline(
          channel.presenceState<Record<string, unknown>>(),
          targetUserId,
        ),
      });
    };

    bindWorkspaceStaffPresenceEvents(channel, syncOnlineStatus);

    async function subscribe() {
      const { data } = await client.auth.getSession();
      if (!data.session || disposed) return;

      await client.realtime.setAuth(data.session.access_token);
      if (disposed) return;

      channel.subscribe();
    }

    void subscribe();

    return () => {
      disposed = true;
      void client.removeChannel(channel);
    };
  }, [statusKey, userId, workspaceId]);

  return snapshot.key === statusKey ? snapshot.online : false;
}

export function WorkspaceStaffPresenceReporter({
  workspaceId,
}: {
  workspaceId: string;
}) {
  useEffect(() => {
    if (!workspaceId) return;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    const client = supabase;
    let disposed = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function start() {
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session || disposed) return;

      await client.realtime.setAuth(session.access_token);
      if (disposed) return;

      channel = client.channel(getWorkspaceStaffPresenceTopic(workspaceId), {
        config: {
          private: true,
          presence: { key: session.user.id },
        },
      });

      const touchActivity = () =>
        client.rpc("clair_touch_workspace_member_activity", {
          p_workspace_id: workspaceId,
        });

      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED" || disposed || !channel) return;

        void channel.track({
          userId: session.user.id,
          onlineAt: new Date().toISOString(),
        });
        void touchActivity();

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          void touchActivity();
        }, HEARTBEAT_INTERVAL_MS);
      });
    }

    void start();

    return () => {
      disposed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (channel) {
        void channel.untrack();
        void client.removeChannel(channel);
      }
    };
  }, [workspaceId]);

  return null;
}
