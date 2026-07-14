import { expect, test } from "@playwright/test";
import {
  bindWorkspaceStaffPresenceEvents,
  formatStaffLastSeenLabel,
  getWorkspaceStaffPresenceTopic,
  isStaffOnline,
} from "../src/features/staff/workspace-staff-presence";

test("Presence callbacks are bound before the channel starts subscribing", () => {
  const events: string[] = [];
  let subscribing = false;
  const channel = {
    on(
      type: "presence",
      filter: { event: string },
      callback: () => void,
    ) {
      void callback;
      if (subscribing) {
        throw new Error("callbacks cannot be added after subscribe");
      }
      events.push(`${type}:${filter.event}`);
      return this;
    },
    subscribe() {
      subscribing = true;
    },
  };

  bindWorkspaceStaffPresenceEvents(channel, () => undefined);
  channel.subscribe();

  expect(events).toEqual([
    "presence:sync",
    "presence:join",
    "presence:leave",
  ]);
});

test("Presence treats any remaining tab or device for the member as online", () => {
  const state = {
    "user-suji": [
      { presence_ref: "tab-a" },
      { presence_ref: "device-b" },
    ],
  };

  expect(isStaffOnline(state, "user-suji")).toBe(true);
  expect(
    isStaffOnline(
      { "user-suji": [{ presence_ref: "device-b" }] },
      "user-suji",
    ),
  ).toBe(true);
  expect(isStaffOnline({}, "user-suji")).toBe(false);
});

test("Presence topic is isolated by workspace and last-seen labels avoid fake history", () => {
  expect(getWorkspaceStaffPresenceTopic("workspace-clair-cheongdam")).toBe(
    "workspace:workspace-clair-cheongdam:staff-presence",
  );
  expect(formatStaffLastSeenLabel(undefined)).toBe("접속 기록 없음");
  expect(
    formatStaffLastSeenLabel(
      "2026-07-14T12:55:00.000Z",
      new Date("2026-07-14T13:00:00.000Z"),
    ),
  ).toBe("5분 전 접속");
});
