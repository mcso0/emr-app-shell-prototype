import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { readReceptionSnapshot } from "../src/features/reception/server-reception-snapshot-read-core";

test("reception snapshot reads calendar and queue concurrently", async () => {
  const started: string[] = [];
  let releaseReads = () => {};
  const readGate = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });

  const resultPromise = readReceptionSnapshot({
    actorUserId: "user-front-desk",
    calendarGateway: {
      async listReceptionDay() {
        started.push("calendar");
        await readGate;
        return {
          ok: true,
          records: [],
          operatingSchedule: {
            date: "2026-05-01",
            timezone: "Asia/Seoul",
            isOpen: true,
            source: "weekly",
            treatmentStart: "09:00",
            treatmentEnd: "19:00",
            breakStart: "13:00",
            breakEnd: "14:00",
          },
        } as const;
      },
    },
    date: "2026-05-01",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId: "clair-demo",
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
    queueGateway: {
      async listReceptionQueue() {
        started.push("queue");
        await readGate;
        return { ok: true, queue: [] } as const;
      },
    },
    workspaceId: "clair-demo",
  });

  await expect.poll(() => started.toSorted()).toEqual(["calendar", "queue"]);
  releaseReads();

  await expect(resultPromise).resolves.toMatchObject({
    ok: true,
    calendar: { ok: true, records: [] },
    queue: { ok: true, queue: [] },
    enforcedBy: "reception-snapshot-read",
  });
});

test("reception snapshot route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get(
    "/api/workspaces/clair-demo/reception/snapshot?date=2026-05-01",
  );
  expect(unauthenticated.status()).toBe(401);
  await expect(unauthenticated.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
  });

  const mockFallback = await request.get(
    "/api/workspaces/clair-demo/reception/snapshot?date=2026-05-01",
    { headers: { "x-clair-demo-session-user-id": "user-front-desk" } },
  );
  expect(mockFallback.status()).toBe(200);
  await expect(mockFallback.json()).resolves.toMatchObject({
    ok: true,
    calendar: {
      ok: true,
      records: [],
      enforcedBy: "reception-calendar-read",
    },
    queue: {
      ok: true,
      queue: [],
      enforcedBy: "reception-queue-read",
    },
    enforcedBy: "reception-snapshot-read",
  });
});

test("reception snapshot route loads one server-owned permission adapter", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/snapshot/route.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource.match(/await loadWorkspacePermissionAdapterFromDb/g)).toHaveLength(1);
  expect(routeSource).toContain("readReceptionSnapshot");
  expect(routeSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception live refresh uses one snapshot request and a visibility-aware fallback", () => {
  const moduleSource = readFileSync("src/features/reception/module.tsx", "utf8");

  expect(moduleSource).toContain("loadReceptionSnapshot");
  expect(moduleSource).toContain("receptionReadInFlightRef");
  expect(moduleSource).toContain('document.visibilityState !== "visible"');
  expect(moduleSource).toContain("window.setInterval(refresh, 60_000)");
  expect(moduleSource).not.toContain("window.setInterval(refresh, 9000)");
});
