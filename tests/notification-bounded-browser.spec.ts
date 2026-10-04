import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  archivePersistedLiveNotification, createSupabaseNotificationPersistenceGateway,
  markAllPersistedLiveNotificationsRead, markPersistedLiveNotificationRead,
  readPersistedLiveNotifications, restorePersistedLiveNotification,
} from "../src/features/notifications/server-notification-persistence";

// Opt in: real local SQL RPC -> production server mapper -> browser UI, with
// intercepted HTTP transport. No hosted DB, clinical content or remote login.
test("250 SQL events stay bounded through browser read/archive/restore/read-all", async ({ page }) => {
  test.skip(process.env.NOTIFICATION_LOCAL_SQL !== "1", "requires guarded local synthetic database");
  const actorUserId = "94000000-0000-4000-8000-000000000001";
  const workspaceId = "notification-alpha";
  const sql = (query: string) => execFileSync("docker", ["exec", "-i", "supabase_db_emr-app-shell-prototype", "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", "notification_bounded_local", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  const fixture = readFileSync("tests/sql/notification-bounded-snapshot.sql", "utf8");
  sql(fixture.slice(fixture.indexOf("begin;"), fixture.indexOf("-- FIXTURE_END")) + "commit;");
  const permissionAdapter = createMockWorkspacePermissionAdapter({ users: [{ id: actorUserId, status: "active" }],
    memberships: [{ id: "synthetic-member", workspaceId, userId: actorUserId, status: "active", roles: ["hospital_admin"] }],
  });
  const calls: string[] = [];
  const gateway = createSupabaseNotificationPersistenceGateway({ async rpc(name, args) {
    if (name !== "clair_read_notification_snapshot_v2" && name !== "clair_mutate_notification_user_state_v2") throw new Error("legacy RPC used");
    calls.push(name);
    const parameters = Object.entries(args).map(([key, value]) => {
      if (!/^p_[a-z_]+$/.test(key)) throw new Error("invalid RPC parameter");
      return `${key} => ${value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`}`;
    }).join(",");
    const output = sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actorUserId}',true);
      select public.${name}(${parameters}); commit;`);
    return { data: JSON.parse(output.split("\n").at(-1)!), error: null };
  } });
  const input = { actorUserId, workspaceId, gateway, permissionAdapter };
  try {
    await page.route("**/api/workspaces/clair-demo/notifications**", async route => {
      const url = new URL(route.request().url());
      const tail = url.pathname.split("/notifications")[1];
      let result;
      if (route.request().method() === "GET" && tail === "") {
        result = await readPersistedLiveNotifications({ ...input, filter: url.searchParams.get("filter"), limit: Number(url.searchParams.get("limit")) });
      } else if (tail === "/read-all") {
        result = await markAllPersistedLiveNotificationsRead(input);
      } else {
        const [id, action] = tail.slice(1).split("/");
        const mutation = { ...input, notificationId: decodeURIComponent(id) };
        if (action === "read") result = await markPersistedLiveNotificationRead(mutation);
        else if (action === "archive") result = await archivePersistedLiveNotification(mutation);
        else if (action === "restore") result = await restorePersistedLiveNotification(mutation);
        else { await route.continue(); return; }
      }
      await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify({ ...result, workspaceId: "clair-demo" }) });
    });
    await page.goto("/w/clair-demo/reception?modulePanel=open");
    const bell = () => page.getByRole("button", { name: /알림 센터 열기/ });
    await expect(bell()).toHaveAccessibleName("알림 센터 열기, 중요 알림 247개");
    await bell().click();
    const drawer = page.getByRole("dialog", { name: "알림" });
    await expect(drawer.locator('[data-testid^="global-notification-row-"]')).toHaveCount(100);
    const row51 = drawer.getByTestId("global-notification-row-synthetic-0051");
    await row51.getByRole("button", { name: "Synthetic alert 읽음 처리" }).click();
    await expect(row51).toHaveAttribute("data-notification-state", "read");
    await expect(page.locator('button[aria-label^="알림 센터"]')).toHaveAttribute("aria-label", "알림 센터 열기, 중요 알림 246개");
    // ID beyond the browser's 100 rows remains operable through the public API.
    const deepRead = await page.evaluate(async () => (await fetch("/api/workspaces/clair-demo/notifications/synthetic-0200/read", { method: "POST" })).json());
    expect(deepRead).toMatchObject({ ok: true, notification: { id: "synthetic-0200", readAt: expect.any(String) }, counts: { unread: 245 } });
    await row51.getByRole("button", { name: "Synthetic alert 보관" }).click();
    await drawer.getByRole("button", { name: "보관 1" }).click();
    await row51.getByRole("button", { name: "Synthetic alert 보관 해제" }).click();
    await drawer.getByRole("button", { name: /전체 100/ }).click();
    await expect(row51).toHaveAttribute("data-notification-state", "read");
    await drawer.getByRole("button", { name: "전체 읽음" }).click();
    await expect(page.locator('button[aria-label^="알림 센터"]')).toHaveAttribute("aria-label", "알림 센터 열기");
    await expect(drawer.getByRole("button", { name: "전체 읽음" })).toBeDisabled();
    expect(sql(`select count(*) from public.notification_user_states where actor_user_id='${actorUserId}' and read_at is null and archived_at is null;`)).toBe("0");
    expect(sql(`select count(*) from public.notification_events e left join public.notification_user_states s using(workspace_id,notification_id) where s.read_at is null and s.archived_at is null;`)).toBe("0");
    expect(calls).not.toContain("clair_list_notification_events");
    // All loaded rows are read, but an older unread row must still keep the
    // full-set action enabled. Without the global count prop this is disabled.
    sql(`update public.notification_user_states set read_at=null where notification_id='synthetic-0201';`);
    await page.reload();
    await expect(bell()).toHaveAccessibleName("알림 센터 열기, 중요 알림 1개");
    await bell().click();
    await expect(drawer).toContainText("안 읽음 1개");
    await expect(drawer.getByRole("group", { name: "알림 필터" })).toContainText("안 읽음 0");
    await expect(drawer.getByRole("button", { name: "전체 읽음" })).toBeEnabled();
    await drawer.getByRole("button", { name: "전체 읽음" }).click();
    await expect(drawer.getByRole("button", { name: "전체 읽음" })).toBeDisabled();
    expect(sql(`select read_at is not null from public.notification_user_states where notification_id='synthetic-0201';`)).toBe("t");
  } finally {
    sql(`begin; do $$ begin if current_database()<>'notification_bounded_local'
      or exists(select 1 from public.users where id::text not like '94000000-0000-4000-8000-%')
      or exists(select 1 from auth.users where id::text not like '94000000-0000-4000-8000-%')
        or exists(select 1 from public.workspaces where id not in ('notification-alpha','notification-beta'))
      then raise exception 'refuse non-synthetic cleanup'; end if; end $$;
      truncate public.workspaces,public.users,auth.users cascade; commit;`);
  }
});
