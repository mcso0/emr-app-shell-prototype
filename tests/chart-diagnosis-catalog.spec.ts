import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseDiagnosisCatalogGateway,
  searchDiagnosisCatalog,
  type DiagnosisCatalogSearchGateway,
} from "../src/features/chart/server-diagnosis-catalog-core";
import {
  getCachedDiagnosisCatalogPage,
  loadDiagnosisCatalogPage,
} from "../src/features/chart/diagnosis-catalog-client";

const workspaceId = "clair-demo";
const actorUserId = "user-vet";
const permissionAdapter = createMockWorkspacePermissionAdapter({
  users: [{ id: actorUserId, status: "active" }],
  memberships: [
    {
      id: "membership-vet",
      workspaceId,
      userId: actorUserId,
      roles: ["vet"],
      status: "active",
    },
  ],
});

const page = {
  systems: [
    { id: "11111111-1111-4111-8111-111111111111", name: "소화기계", count: 1 },
  ],
  diseaseGroups: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "위장관 질환",
      systemId: "11111111-1111-4111-8111-111111111111",
      count: 1,
    },
  ],
  diagnoses: [
    {
      catalogId: "33333333-3333-4333-8333-333333333333",
      masterId: "44444444-4444-4444-8444-444444444444",
      masterRevision: 1,
    code: null,
      name: "위장염",
      synonyms: [],
      system: { id: "11111111-1111-4111-8111-111111111111", name: "소화기계" },
      diseaseGroup: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "위장관 질환",
      },
    },
  ],
  nextCursor: null,
};

test("diagnosis catalog core enforces chart:view before querying the gateway", async () => {
  let calls = 0;
  const gateway: DiagnosisCatalogSearchGateway = {
    async search() {
      calls += 1;
      return { ok: true, page };
    },
  };
  const denied = await searchDiagnosisCatalog({
    actorUserId: "user-front-desk",
    workspaceId,
    input: {},
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
      permissionPolicies: [
        {
          workspaceId,
          role: "front_desk",
          permissionIds: ["reception:view"],
        },
      ],
    }),
    gateway,
  });
  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(calls).toBe(0);
});

test("diagnosis catalog core validates filter bounds and returns a mapped page", async () => {
  const invalid = await searchDiagnosisCatalog({
    actorUserId,
    workspaceId,
    input: { limit: 51 },
    permissionAdapter,
  });
  expect(invalid).toEqual({ ok: false, status: 400, error: "invalid_input" });

  const invalidCursor = await searchDiagnosisCatalog({
    actorUserId,
    workspaceId,
    input: { cursor: "위장염|not-a-uuid" },
    permissionAdapter,
  });
  expect(invalidCursor).toEqual({
    ok: false,
    status: 400,
    error: "invalid_input",
  });

  const result = await searchDiagnosisCatalog({
    actorUserId,
    workspaceId,
    input: { query: "위장", limit: 50 },
    permissionAdapter,
    gateway: {
      async search() {
        return { ok: true, page };
      },
    },
  });
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    page: { diagnoses: [{ name: "위장염", code: null }] },
  });
});

test("mock-mode veterinarian can open the local classification surface", async () => {
  const result = await searchDiagnosisCatalog({
    actorUserId: "user-vet",
    workspaceId,
    input: {},
  });
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    page: { diagnoses: [] },
  });
});

test("Supabase diagnosis catalog gateway sends only route-owned RPC parameters", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> =
    [];
  const gateway = createSupabaseDiagnosisCatalogGateway({
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return { data: page, error: null };
    },
  });
  const result = await gateway.search({
    workspaceId,
    query: null,
    systemId: null,
    diseaseGroupId: null,
    cursor: null,
    limit: 50,
  });
  expect(result.ok).toBe(true);
  expect(calls).toEqual([
    {
      functionName: "clair_search_diagnosis_catalog",
      args: {
        p_workspace_id: workspaceId,
        p_query: null,
        p_system_id: null,
        p_disease_group_id: null,
        p_cursor: null,
        p_limit: 50,
      },
    },
  ]);
});

test("diagnosis catalog client dedupes the initial request, caches by actor and workspace, and clears on permission loss", async () => {
  const originalFetch = globalThis.fetch;
  const actorKey = "catalog-client-vet";
  const clientWorkspaceId = "catalog-client-workspace";
  let calls = 0;
  let permissionDenied = false;

  globalThis.fetch = async (input) => {
    calls += 1;
    expect(String(input)).toContain(
      `/api/workspaces/${clientWorkspaceId}/chart/diagnosis-catalog?limit=50`,
    );
    if (permissionDenied) {
      return new Response(
        JSON.stringify({ ok: false, denialReason: "permission_missing" }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true, ...page }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const [first, second] = await Promise.all([
      loadDiagnosisCatalogPage({ actorKey, workspaceId: clientWorkspaceId }),
      loadDiagnosisCatalogPage({ actorKey, workspaceId: clientWorkspaceId }),
    ]);
    expect(calls).toBe(1);
    expect(first).toMatchObject({
      ok: true,
      page: {
        systems: [{ name: "소화기계", count: 1 }],
        diseaseGroups: [{ name: "위장관 질환", count: 1 }],
        catalog: [{ name: "위장염" }],
        nextCursor: null,
      },
    });
    expect(second).toEqual(first);
    expect(
      getCachedDiagnosisCatalogPage({
        actorKey,
        workspaceId: clientWorkspaceId,
      }),
    ).toMatchObject({ catalog: [{ name: "위장염" }] });
    expect(
      getCachedDiagnosisCatalogPage({
        actorKey: "different-actor",
        workspaceId: clientWorkspaceId,
      }),
    ).toBeUndefined();

    permissionDenied = true;
    const denied = await loadDiagnosisCatalogPage({
      actorKey,
      force: true,
      workspaceId: clientWorkspaceId,
    });
    expect(denied).toMatchObject({
      ok: false,
      status: 403,
      catalogStatus: "permission",
    });
    expect(
      getCachedDiagnosisCatalogPage({
        actorKey,
        workspaceId: clientWorkspaceId,
      }),
    ).toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
