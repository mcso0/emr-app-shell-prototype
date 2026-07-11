import { expect, test, type APIRequestContext } from "@playwright/test";

async function archiveMembership(
  request: APIRequestContext,
  options: {
    actor?: string;
    membershipId?: string;
    action?: "soft_delete" | "restore";
    reason?: string;
  } = {}
) {
  return request.post(
    `/api/workspaces/workspace-a/memberships/${options.membershipId ?? "membership-vet"}/archive`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: {
        action: options.action ?? "soft_delete",
        ...(options.reason ? { reason: options.reason } : {}),
      },
    }
  );
}

test("membership archive route soft-deletes and restores a member through the server boundary", async ({
  request,
}) => {
  const softDeleted = await archiveMembership(request, {
    actor: "user-admin",
    reason: "퇴사 처리",
  });

  expect(softDeleted.status()).toBe(200);
  await expect(softDeleted.json()).resolves.toEqual(
    expect.objectContaining({
      ok: true,
      updatedStatus: "soft_deleted",
      action: "soft_delete",
    })
  );

  const restored = await archiveMembership(request, {
    actor: "user-admin",
    action: "restore",
  });

  expect(restored.status()).toBe(200);
  await expect(restored.json()).resolves.toEqual(
    expect.objectContaining({
      ok: true,
      updatedStatus: "inactive",
      action: "restore",
    })
  );
});

test("membership archive route blocks missing reason, self actions, and unauthorized actors", async ({
  request,
}) => {
  const missingReason = await archiveMembership(request, { actor: "user-admin" });
  expect(missingReason.status()).toBe(400);
  await expect(missingReason.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, error: "invalid_reason" })
  );

  const selfAction = await archiveMembership(request, {
    actor: "user-admin",
    membershipId: "membership-admin",
    reason: "테스트",
  });
  expect(selfAction.status()).toBe(409);
  await expect(selfAction.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, denialReason: "self_action_protected" })
  );

  const denied = await archiveMembership(request, {
    actor: "user-vet",
    reason: "권한 없음",
  });
  expect(denied.status()).toBe(403);
  await expect(denied.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, denialReason: "permission_missing" })
  );
});
