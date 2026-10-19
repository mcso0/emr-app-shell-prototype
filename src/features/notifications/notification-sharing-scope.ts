import { createHash } from "node:crypto";

// An isolation key, never an authorization credential. Only verified server
// session claims may supply these inputs; demo sessions do not participate.
export function createNotificationSharingScope({
  actorUserId, sessionId, workspaceId,
}: { actorUserId: string; sessionId: string | null; workspaceId: string }) {
  if (!sessionId) return undefined;
  return createHash("sha256")
    .update(JSON.stringify(["notification-poll-v1", actorUserId, sessionId, workspaceId]))
    .digest("hex");
}
