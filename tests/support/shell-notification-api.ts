import type { Page } from "@playwright/test";
import {
  archiveLiveNotification,
  createDemoLiveNotificationStateStore,
  markAllLiveNotificationsRead,
  markLiveNotificationRead,
  readLiveNotifications,
  restoreLiveNotification,
} from "../../src/features/notifications/server-notifications-core";

// Exercise the real DTO mapper and state contract with one synthetic store per
// test. Next dev route bundles can otherwise own separate in-memory stores.
export async function installShellNotificationApi(page: Page) {
  const stateStore = createDemoLiveNotificationStateStore();
  await page.route("**/api/workspaces/clair-demo/notifications**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const tail = url.pathname.split("/notifications")[1];
    const input = {
      actorUserId: request.headers()["x-clair-demo-session-user-id"],
      workspaceId: "clair-demo",
      stateStore,
    };
    let result;
    if (request.method() === "GET" && tail === "") {
      result = await readLiveNotifications({
        ...input,
        filter: url.searchParams.get("filter"),
        limit: Number(url.searchParams.get("limit")),
      });
    } else if (request.method() === "POST" && tail === "/read-all") {
      result = await markAllLiveNotificationsRead(input);
    } else if (request.method() === "POST") {
      const [id, action] = tail.slice(1).split("/");
      const mutation = { ...input, notificationId: decodeURIComponent(id) };
      if (action === "read") result = await markLiveNotificationRead(mutation);
      else if (action === "archive") result = await archiveLiveNotification(mutation);
      else if (action === "restore") result = await restoreLiveNotification(mutation);
    }
    if (!result) throw new Error(`Unexpected synthetic notification request: ${request.method()} ${tail}`);
    await route.fulfill({ status: result.status, json: result });
  });
}
