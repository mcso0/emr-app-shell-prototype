import { expect, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../../src/lib/emr-domain/demo-workspaces";

export const modernLabWorkspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
export const labFixtureDate = "2026-05-21";
export const labFixtureWorkId = "ui-api-lab-cbc";
export const labFixtureResultId = `live-lab-${labFixtureWorkId}`;
export const labFixtureRowId = `${labFixtureResultId}-den194-labitem-cbc-wbc`;
const actorId = "user-tech";

export async function prepareLabApiFixture(page: Page, calls: string[], options: {
  workspaceId?: string;
  failReadOnce?: boolean;
  failSaveOnce?: boolean;
  initialOwner?: string | null;
} = {}) {
  const workspaceId = options.workspaceId ?? modernLabWorkspaceId;
  await page.addInitScript(({ key, workspaceId }) => {
    const inLab = location.pathname.startsWith(`/w/${workspaceId}/lab`);
    localStorage.setItem("clair.mockAuth.session.v1", JSON.stringify({
      id: "playwright-default-session", role: inLab ? "nurse" : "hospital_admin",
      roleLabel: inLab ? "테크니션" : "병원 관리자", storageMode: "local", issuedAt: "2026-05-02T00:00:00.000Z",
    }));
    const ids = [...new Set(["clair-demo", workspaceId])];
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: inLab ? workspaceId : "clair-demo",
      workspaces: ids.map(id => ({ id, displayName: "합성 검사 공간", representativeName: "합성 담당자",
        contactEmail: "fixture@synthetic.test", contactPhone: null, subscriptionStatus: "trialing",
        createdBySessionId: "playwright-default-session", createdAt: "2026-05-01T00:00:00Z" })),
      memberships: ids.map(id => ({ id: `fixture-${id}`, workspaceId: id, userSessionId: "playwright-default-session",
        displayName: "합성 담당자", email: "fixture@synthetic.test", roles: ["hospital_admin", "technician"],
        status: "active", createdAt: "2026-05-01T00:00:00Z", activatedAt: "2026-05-01T00:00:00Z" })), invitations: [] }));
  }, { key: SESSION_WORKSPACES_STORAGE_KEY, workspaceId });

  let owner = options.initialOwner ?? null;
  let revision = 1;
  let readAttempts = 0;
  let saveAttempts = 0;
  let phase2Reads = 0;
  const commands: Array<Record<string, unknown>> = [];
  const writes: Array<Record<string, unknown>> = [];
  const orderId = "order-ui-api-cbc";
  const encounterId = "encounter-ui-api-kong";
  const result = { ok: true, status: 200, workspaceId, workItemId: labFixtureWorkId, orderId, encounterId,
    resultId: labFixtureResultId, entryWriteRevision: 0, resultDefinitionSnapshot: { schemaVersion: 1 },
    rows: [{ id: labFixtureRowId, labTestItemId: "den194-labitem-cbc-wbc", analyteName: "WBC",
      unit: "10^3/uL", value: null as string | null, resultValueKind: "numeric", judgment: "not_judged", note: "" }],
  };
  const workItem = () => ({ id: labFixtureWorkId, workspaceId, orderId, encounterId,
    queueType: "lab", status: "requested", requestCycle: 1, rowRevision: revision,
    assignedToUserId: owner, assignedToDisplayName: owner === actorId ? "송하윤" : owner ? "합성 다른 담당자" : null,
    canManage: !owner || owner === actorId, createdAt: "2026-05-21T09:47:00+09:00", updatedAt: "2026-05-21T09:47:00+09:00",
    sourceSnapshot: { patientName: "API Lab Kong", guardianName: "API Guardian Synthetic",
      orderDisplayName: "DEN-194 CBC API Lab Kong", requestingVetName: "합성 수의사" },
  });
  const prefix = `/api/workspaces/${workspaceId}`;
  await page.route(url => url.pathname.startsWith(`${prefix}/fulfillment/work-items`), async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/assignees")) return route.fulfill({ json: { ok: true, assignees: [
      { userId: actorId, displayName: "송하윤" }, { userId: "user-admin", displayName: "합성 다른 담당자" },
    ] } });
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(request.headers()["x-clair-demo-session-user-id"]).toBe(actorId);
      expect(body.expectedRevision).toBe(revision);
      commands.push(body);
      if (body.action === "claim" ? Boolean(owner) : owner !== actorId) {
        return route.fulfill({ status: 403, json: { ok: false, denialReason: "permission_missing" } });
      }
      if (body.action === "claim") owner = actorId;
      else if (body.action === "unassign") owner = null;
      else if (body.action === "assign") {
        if (![actorId, "user-admin"].includes(String(body.assignedToUserId))) {
          return route.fulfill({ status: 403, json: { ok: false, denialReason: "permission_missing" } });
        }
        owner = String(body.assignedToUserId);
      }
      else throw new Error(`Unexpected lab fixture command: ${body.action}`);
      revision += 1;
    } else {
      expect(request.method()).toBe("GET");
      calls.push("fulfillment-lab");
    }
    return route.fulfill({ json: { ok: true, status: 200, workItems: [workItem()], enforcedBy: "fulfillment-work-item-read" } });
  });
  if (workspaceId === "clair-demo") {
    await page.route(url => url.pathname === `${prefix}/lab-imaging/result-sheet-catalog`, route =>
      route.fulfill({ json: { ok: true, status: 200, catalogItemId: "den194-catalog-cbc",
        items: [{ id: "den194-labitem-cbc-wbc", categoryId: "den194-labcat-hematology",
          categoryName: "Hematology", testItemName: "WBC", resultInputType: "number", resultUnit: "10^3/uL", sortOrder: 1 }] } }),
    );
  }
  await page.route(url => url.pathname === `${prefix}/lab-imaging/result-phase2`, route => {
    phase2Reads += 1;
    expect(new URL(route.request().url()).searchParams.get("resultId")).toBe(labFixtureResultId);
    return route.fulfill({ json: { ok: true, data: { resultId: labFixtureResultId, orderId,
      overallFinding: "", overallRevision: 0, canEdit: owner === actorId, canRequestRetest: owner === actorId,
      events: [], attachments: [] } } });
  });
  await page.route(url => url.pathname === `${prefix}/lab-imaging/result-entries`, async route => {
    const request = route.request();
    if (request.method() === "GET") {
      readAttempts += 1;
      const params = new URL(request.url()).searchParams;
      expect(params.get("workItemId")).toBe(labFixtureWorkId);
      expect(params.get("orderId")).toBe(orderId);
      calls.push("lab-result-definition-read");
      if (options.failReadOnce && readAttempts === 1) return route.fulfill({ status: 500, json: { ok: false, error: "forced_definition_failure" } });
      return route.fulfill({ json: result });
    }
    expect(request.method()).toBe("POST");
    const body = request.postDataJSON() as Record<string, unknown>;
    saveAttempts += 1;
    writes.push(body);
    expect(request.headers()["x-clair-demo-session-user-id"]).toBe(actorId);
    if (owner !== actorId) return route.fulfill({ status: 403, json: { ok: false, denialReason: "permission_missing" } });
    expect(body).toMatchObject({ workItemId: labFixtureWorkId, orderId, encounterId,
      resultId: labFixtureResultId, expectedEntryWriteRevision: result.entryWriteRevision,
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), rows: [{ rowId: labFixtureRowId, value: "21.4" }] });
    calls.push("lab-result-entry");
    if (options.failSaveOnce && saveAttempts === 1) return route.fulfill({ status: 500, json: { ok: false, error: "forced_save_failure" } });
    result.rows[0].value = "21.4";
    result.entryWriteRevision += 1;
    return route.fulfill({ json: { ok: true, status: 200, entryWriteRevision: result.entryWriteRevision,
      savedResult: result, enforcedBy: "lab-result-entry-server-boundary" } });
  });
  return {
    href: `/w/${workspaceId}/lab?date=${labFixtureDate}&modulePanel=open&aside=closed`,
    commands, writes,
    stats: () => ({ owner, revision, readAttempts, saveAttempts, phase2Reads, entryWriteRevision: result.entryWriteRevision }),
  };
}

export async function claimLabFixture(page: Page) {
  const input = page.getByTestId(`lab-result-input-${labFixtureRowId}`);
  await expect(input).toBeDisabled();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(input).toBeEnabled();
}
