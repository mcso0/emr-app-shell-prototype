import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("avatar route keeps raw files out of the function body and derives identity paths server-side", async () => {
  const routeSource = await readFile(
    "src/app/api/users/me/avatar/route.ts",
    "utf8",
  );
  const serverSource = await readFile(
    "src/features/staff/server-profile-avatar.ts",
    "utf8",
  );

  expect(routeSource).toContain('export const runtime = "nodejs"');
  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain('identity.source !== "supabase_session"');
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("randomUUID()");
  expect(routeSource).toContain('action: "prepare"');
  expect(routeSource).toContain('action: "finalize"');
  expect(routeSource).toContain('action: "discard"');
  expect(routeSource).toContain("maxRequestBytes = 2_048");
  expect(routeSource).not.toMatch(/\.formData\(|request\.blob\(|request\.arrayBuffer\(/);
  expect(routeSource).not.toMatch(/payload\.(userId|objectPath|avatarId)/);
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("avatar route accepts only bounded action-specific JSON keys", async () => {
  const routeSource = await readFile(
    "src/app/api/users/me/avatar/route.ts",
    "utf8",
  );

  expect(routeSource).toContain("hasOnlyKeys");
  expect(routeSource).toContain('["action", "workspaceId"]');
  expect(routeSource).toMatch(
    /\[\s*"action",\s*"workspaceId",\s*"uploadId",\s*"declaredMime",?\s*\]/,
  );
  expect(routeSource).toContain('["workspaceId"]');
  expect(routeSource).toContain("unsupported_media_type");
  expect(routeSource).toContain("request_too_large");
});
