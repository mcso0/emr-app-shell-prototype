import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { expect, mocked, waitFor } from "storybook/test";
import { toast } from "sonner";

import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import { WorkspaceSpaceManagementScreen } from "@/features/hospital-admin/space-management/screen";
import { createDefaultWorkspaceSpaceManagementSnapshot, parseSpaceManagementMutationInput, parseWorkspaceSpaceManagementSnapshot, type SpaceManagementMutationInput, type WorkspaceSpaceManagementSnapshot } from "@/features/hospital-admin/space-management/model";
import { WorkspaceVitalSettingsScreen } from "@/features/hospital-admin/vital-settings/workspace-vital-settings-screen";
import { createDefaultWorkspaceVitalSettingsSnapshot, parseWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import { OrderSetsPanel } from "@/features/hospital-admin/order-sets-panel";
import { createEmptyOrderSetDefinition } from "@/features/hospital-admin/order-set-management";
import { RolePermissionManagementScreen } from "@/features/hospital-admin/role-permission-management/screen";
import type { OrderCatalogItem, OrderSetDefinition, OrderSetDetail, OrderSetRevision, OrderSetUpdateReview } from "@/features/hospital-admin/server-order-catalog";
import { Toaster } from "@/components/ui/sonner";
import { MOCK_AUTH_STORAGE_KEY, type MockAuthSession } from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createEmptySessionWorkspacesState, SESSION_WORKSPACES_STORAGE_KEY } from "@/features/auth/workspace-session";
import { HospitalBasicSettingsScreen } from "@/features/hospital-admin/settings/hospital-basic-settings-screen";
import { HospitalContactSettingsScreen } from "@/features/hospital-admin/settings/hospital-contact-settings-screen";
import { HospitalLogoEditor } from "@/features/hospital-admin/settings/hospital-logo-editor";
import { HospitalOperatingHoursSettingsScreen } from "@/features/hospital-admin/settings/hospital-operating-hours-settings-screen";
import { createInitialHospitalBasicSettingsDraft, type HospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";
import { parseHospitalContactUpdateInput, parseHospitalProfileChangeRequestInput, type HospitalProfile } from "@/features/hospital-admin/settings/hospital-profile-model";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthRuntimeMode } from "@/lib/supabase/config";

export type HospitalScenario = "ready" | "loading" | "error" | "denied" | "pending" | "conflict" | "empty" | "detail-error" | "review" | "read-only";
export type HospitalCallerArgs = { kind: "basic" | "contact" | "hours" | "logo" | "orders" | "roles" | "spaces" | "vitals"; scenario: HospitalScenario };
export type HospitalCommand = { method: string; path: string; body: unknown; headers?: Record<string, string> };
export const hospitalWorkspaceId = "storybook-hospital-parity";
const fixedDate = "2026-10-11T00:00:00Z";
const logoAsset = "/avatars/patient-avatar-choco.png";
const commandEvent = "storybook.hospitalParityCommand";
let commands: HospitalCommand[] = [];
let releasePending: (() => void) | null = null;
let unmountHospitalSource: (() => void) | null = null;
export const getHospitalCommands = () => commands;
export function resolveHospitalPending() { releasePending?.(); releasePending = null; }
export const hospitalCallerParameters = { nextjs: { appDirectory: true, navigation: { pathname: `/w/${hospitalWorkspaceId}/hospital-admin`, segments: [["workspaceId", hospitalWorkspaceId]] } } };

function recordCommand(command: HospitalCommand) {
  commands = [...commands, command];
  window.dispatchEvent(new Event(commandEvent));
}

const orderSession: AuthSession = { id: "storybook-hospital-admin", role: "hospital_admin", roleLabel: "합성 관리자", storageMode: "session", issuedAt: fixedDate };
const catalog: OrderCatalogItem[] = [{ id: "storybook-blood-test", workspaceId: hospitalWorkspaceId, standardOrderId: "storybook-standard-test", sourcePresetVersion: "storybook-v1", categoryGroup: "lab", categoryLabel: "합성 검사", standardOrderName: "합성 혈액검사", inHospitalOrderName: "합성 혈액검사", billingName: "합성 혈액검사", aliases: ["합성"], availabilityStatus: "active", priceKrw: 12000, salesUnit: "per_each", targetSpecies: ["dog", "cat"], defaultDestinationModule: "lab", defaultTaskRequired: true, billingReflectionEnabled: true, taxIncluded: true, roundingRule: "as_is", linkedLabItemIds: [], linkedLabCategoryIds: [], pricingRule: { priceBasis: "unit_price", priceKrw: 12000, salesUnit: "per_each", taxIncluded: true, roundingRule: "as_is", billingReflectionEnabled: true }, updatedAt: fixedDate }];
function syntheticOrderDetail(id: string, name: string, definition?: OrderSetDefinition, revisionNo = 1): OrderSetDetail {
  const sourceDefinition = definition ?? { ...createEmptyOrderSetDefinition(), setName: name, billingName: name, items: [{ childKind: "atomic", childOrderCatalogItemId: catalog[0].id, childOrderCatalogRevision: 1, childOrderSetId: null, childSetRevisionId: null, sortOrder: 0, defaultSelected: true, billingReflectionDefault: true, defaultQuantity: 1, quantitySource: "fixed_one" }] };
  const revisionId = id + "-revision-" + revisionNo;
  const revision: OrderSetRevision = { ...sourceDefinition, id: revisionId, orderSetId: id, workspaceId: hospitalWorkspaceId, revisionNo, validationStatus: "valid", validationErrors: [], createdByUserId: orderSession.id, createdAt: fixedDate, items: sourceDefinition.items.map((item, index) => ({ ...item, id: revisionId + "-item-" + index })), priceRanges: sourceDefinition.priceRanges.map((range, index) => ({ ...range, id: revisionId + "-range-" + index })), currentEtag: '"order-set-revision-' + revisionId + '"' };
  return { orderSetId: id, currentRevisionId: revisionId, currentRevisionNo: revisionNo, availabilityStatus: "active", currentEtag: revision.currentEtag, needsCompositionReview: false, setName: sourceDefinition.setName, billingName: sourceDefinition.billingName, salesUnit: sourceDefinition.salesUnit, targetSpecies: sourceDefinition.targetSpecies, amountBasis: sourceDefinition.amountBasis, setPriceKrw: sourceDefinition.setPriceKrw, rangeBasis: sourceDefinition.rangeBasis, taxType: sourceDefinition.taxType, rangePriceRanges: revision.priceRanges, pendingReviewCount: 0, workspaceId: hospitalWorkspaceId, sourceSetVersion: "storybook-v1", currentRevision: revision };
}

function applySyntheticSpaceCommand(snapshot: WorkspaceSpaceManagementSnapshot, command: SpaceManagementMutationInput, syntheticId: string): WorkspaceSpaceManagementSnapshot | null {
  const next = structuredClone(snapshot), categories = next.categories;
  if (command.action === "category.create") categories.push({ id: "storybook-category-" + syntheticId, name: command.name, iconKey: "default", sortOrder: categories.length, spaces: [] });
  if (command.action === "category.rename") { const category = categories.find(item => item.id === command.categoryId); if (!category) return null; category.name = command.name; }
  if (command.action === "category.delete") {
    const category = categories.find(item => item.id === command.categoryId); if (!category) return null;
    if (category.spaces.length) { const target = categories.find(item => item.id === command.moveTargetCategoryId && item.id !== category.id); if (!target) return null; target.spaces.push(...category.spaces.map(space => ({ ...space, categoryId: target.id }))); }
    next.categories = categories.filter(item => item.id !== command.categoryId);
  }
  if (command.action === "space.create") { const category = categories.find(item => item.id === command.categoryId); if (!category) return null; category.spaces.push({ id: "storybook-space-" + syntheticId, categoryId: category.id, name: command.name, sortOrder: category.spaces.length }); }
  if (command.action === "space.update") {
    const source = categories.find(item => item.spaces.some(space => space.id === command.spaceId)), target = categories.find(item => item.id === command.categoryId);
    const space = source?.spaces.find(item => item.id === command.spaceId); if (!source || !target || !space) return null;
    source.spaces = source.spaces.filter(item => item.id !== command.spaceId); target.spaces.push({ ...space, categoryId: target.id, name: command.name });
  }
  if (command.action === "space.delete") { const category = categories.find(item => item.spaces.some(space => space.id === command.spaceId)); if (!category) return null; category.spaces = category.spaces.filter(item => item.id !== command.spaceId); }
  next.categories = next.categories.map((category, sortOrder) => ({ ...category, sortOrder, spaces: category.spaces.map((space, index) => ({ ...space, sortOrder: index })) }));
  return parseWorkspaceSpaceManagementSnapshot(next);
}

export function prepareHospitalCaller({ args }: { args: HospitalCallerArgs }) {
  if (getAuthRuntimeMode().authProvider !== "mock") throw new Error("Hospital stories require the existing synthetic mock-auth Storybook runtime.");
  commands = []; releasePending = null;
  const auth = useMockAuthStore.getState(), settings = useHospitalBasicSettingsStore.getState(), admin = useHospitalAdminStore.getState();
  const fetchBefore = globalThis.fetch, toastBefore = new Set(toast.getToasts().map(item => item.id));
  const session: MockAuthSession = { id: "storybook-hospital-admin", role: args.kind === "roles" && args.scenario === "denied" ? "front_desk" : "hospital_admin", roleLabel: "합성 관리자", storageMode: "session", issuedAt: fixedDate };
  const storageKeys = [MOCK_AUTH_STORAGE_KEY, SESSION_WORKSPACES_STORAGE_KEY, `clair.workspaceRoleWorkDefaults.v1:${hospitalWorkspaceId}`];
  const storageBefore = [sessionStorage, localStorage].map(storage => ({ storage, values: storageKeys.map(key => ({ key, value: storage.getItem(key) })) }));
  sessionStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  sessionStorage.setItem(SESSION_WORKSPACES_STORAGE_KEY, JSON.stringify(createEmptySessionWorkspacesState(fixedDate)));
  localStorage.removeItem(SESSION_WORKSPACES_STORAGE_KEY);
  for (const storage of [sessionStorage, localStorage]) storage.removeItem(`clair.workspaceRoleWorkDefaults.v1:${hospitalWorkspaceId}`);
  useMockAuthStore.setState({ hydrated: true, session });
  const records = { ...settings.records }, profiles = { ...settings.profiles };
  delete records[hospitalWorkspaceId]; delete profiles[hospitalWorkspaceId];
  useHospitalBasicSettingsStore.setState({ records, profiles });
  const draft = createInitialHospitalBasicSettingsDraft();
  draft.contact = { phone: "02-000-0000", fax: "", homepage: "", instagram: "", customerGuideMemo: "합성 고객 안내" };
  useHospitalBasicSettingsStore.getState().ensureWorkspace(hospitalWorkspaceId);
  useHospitalBasicSettingsStore.getState().setDraft(hospitalWorkspaceId, draft);
  useHospitalBasicSettingsStore.getState().save(hospitalWorkspaceId);
  let profile: HospitalProfile = { workspaceId: hospitalWorkspaceId, name: "합성 병원", representativeName: "합성 원장", address: "합성 주소", countryCode: "KR", timezone: "Asia/Seoul", contact: { ...draft.contact }, logo: { hasCustomLogo: true, url: logoAsset }, revision: 1, profileComplete: true, pendingChangeRequest: null };
  let hours: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "holidayPolicy" | "exceptions"> = { timezone: draft.timezone, weeklyHours: draft.weeklyHours, holidayPolicy: draft.holidayPolicy, exceptions: draft.exceptions };
  const inFlightMutations = new Set<object>(), pendingBodies = new Set<object>(), expectedWrites = new Map<object, () => boolean>(), abortHeld = new Set<() => void>();
  const reviewWorkflows = new Set<{ orderSetId: string; detailRead: boolean; summariesRead: boolean; catalogRead: boolean }>();
  const checkWrites = () => { for (const [key, condition] of expectedWrites) if (condition()) expectedWrites.delete(key); };
  const unsubscribeSettings = useHospitalBasicSettingsStore.subscribe(checkWrites);
  const response = (body: unknown, status = 200, expected?: () => boolean, onRead?: () => void) => {
    const result = Response.json(body, { status }), token = {};
    if (expected) expectedWrites.set(token, expected);
    const json = result.json.bind(result);
    result.json = async () => {
      // Track reads only after the source starts them. An aborted paired GET and
      // review/discard commands legitimately leave a response body unconsumed.
      pendingBodies.add(token);
      try { const body = await json(); onRead?.(); return body; }
      finally { queueMicrotask(() => pendingBodies.delete(token)); }
    };
    return result;
  };
  let readFailed = args.scenario === "error", detailReadFailed = args.scenario === "detail-error";
  let spaceIdSequence = 0;
  let spaceSnapshot = createDefaultWorkspaceSpaceManagementSnapshot(hospitalWorkspaceId);
  spaceSnapshot.canManage = args.scenario !== "read-only";
  if (args.scenario === "empty") spaceSnapshot.categories = [];
  let vitalSnapshot = createDefaultWorkspaceVitalSettingsSnapshot(args.scenario !== "read-only");
  let orderDetails = args.scenario === "empty" ? [] : [syntheticOrderDetail("storybook-order-a", "합성 기본 검사"), syntheticOrderDetail("storybook-order-b", "합성 건강 검진")];
  let reviews: OrderSetUpdateReview[] = args.scenario === "review" ? [{ id: "storybook-review", workspaceId: hospitalWorkspaceId, parentOrderSetId: "storybook-order-a", parentRevisionId: "storybook-order-a-revision-1", childOrderSetId: "storybook-order-b", pinnedChildRevisionId: "storybook-order-b-revision-1", availableChildRevisionId: "storybook-order-b-revision-2", status: "pending", resultParentRevisionId: null, createdAt: fixedDate, resolvedAt: null, resolvedByUserId: null }] : [];
  if (reviews.length) orderDetails = orderDetails.map(detail => detail.orderSetId === "storybook-order-a" ? { ...detail, pendingReviewCount: 1, needsCompositionReview: true } : detail);
  const sdk = mocked(getBrowserSupabaseClient), sdkBefore = sdk.getMockImplementation();
  const sdkFixture: typeof getBrowserSupabaseClient = () => ({ storage: { from: (bucket: string) => ({ uploadToSignedUrl: async (_path: string, _token: string, file: File) => {
    recordCommand({ method: "LOCAL_SDK", path: bucket, body: { fileName: file.name, mime: file.type } }); return { data: null, error: null };
  } }) } }) as unknown as NonNullable<ReturnType<typeof getBrowserSupabaseClient>>;
  sdk.mockImplementation(sdkFixture);
  const fixtureFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (!url.pathname.startsWith("/api/")) return fetchBefore(input, init);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET"), path = url.pathname;
    const base = `/api/workspaces/${hospitalWorkspaceId}/hospital-admin`;
    const mutationToken = method === "GET" ? null : {};
    if (mutationToken) inFlightMutations.add(mutationToken);
    try {
    if (method === "GET" && args.scenario === "loading" && [base + "/settings/profile", base + "/basic-settings/operating-hours", base + "/order-sets", base + "/space-management", `/api/workspaces/${hospitalWorkspaceId}/vital-settings`].includes(path)) {
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => { abortHeld.delete(abort); reject(new DOMException("Synthetic read aborted", "AbortError")); };
        abortHeld.add(abort);
        const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    if (method === "GET" && [base + "/settings/profile", base + "/basic-settings/operating-hours"].includes(path)) {
      const profileRead = path.endsWith("/profile");
      if (args.scenario === "denied") return response({ ok: false }, 403, profileRead ? () => useHospitalBasicSettingsStore.getState().profiles[hospitalWorkspaceId]?.status === "denied" : undefined);
      if (readFailed) { readFailed = false; return response({ ok: false }, 503, profileRead ? () => useHospitalBasicSettingsStore.getState().profiles[hospitalWorkspaceId]?.status === "error" : undefined); }
      if (profileRead) {
        const returnedProfile = profile;
        // Register before fetch returns: useHospitalProfile hydrates after JSON,
        // even if its AbortSignal is canceled while that continuation is pending.
        return response({ ok: true, profile: returnedProfile }, 200, () => {
          const state = useHospitalBasicSettingsStore.getState();
          return state.profiles[hospitalWorkspaceId]?.status === "ready"
            && state.profiles[hospitalWorkspaceId]?.profile?.revision === returnedProfile.revision
            && state.records[hospitalWorkspaceId]?.savedDraft.contact.phone === returnedProfile.contact.phone;
        });
      }
      return response({ ok: true, settings: hours });
    }
    if (method === "GET" && [base + "/space-management", `/api/workspaces/${hospitalWorkspaceId}/vital-settings`].includes(path)) {
      if (args.scenario === "denied") return response({ ok: false }, 403);
      if (readFailed) { readFailed = false; return response({ ok: false }, 503); }
      return response(path.endsWith("/space-management") ? spaceSnapshot : vitalSnapshot);
    }
    if (method === "GET" && path === base + "/order-catalog") return response({ items: catalog }, 200, undefined, () => {
      for (const workflow of reviewWorkflows) if (workflow.summariesRead) workflow.catalogRead = true;
    });
    if (method === "GET" && path.startsWith(base + "/order-sets")) {
      if (args.scenario === "denied") return response({ ok: false }, 403);
      if (readFailed) { readFailed = false; return response({ ok: false }, 503); }
      if (path === base + "/order-sets") return response({ summaries: orderDetails }, 200, undefined, () => {
        for (const workflow of reviewWorkflows) if (workflow.detailRead) workflow.summariesRead = true;
      });
      if (detailReadFailed) { detailReadFailed = false; return response({ ok: false }, 503); }
      const detail = orderDetails.find(item => path.endsWith("/" + item.orderSetId));
      return detail ? response({ orderSet: detail, history: [detail.currentRevision], reviews }, 200, undefined, () => {
        for (const workflow of reviewWorkflows) if (workflow.orderSetId === detail.orderSetId) workflow.detailRead = true;
      }) : response({ ok: false }, 404);
    }
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (method !== "GET") {
      recordCommand({ method, path, body, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      if (args.scenario === "pending") await new Promise<void>(resolve => { releasePending = resolve; });
    }
    if (method === "POST" && path === base + "/space-management") {
      if (!spaceSnapshot.canManage) return response({ error: "permission_missing" }, 403);
      const command = parseSpaceManagementMutationInput(body), next = command ? applySyntheticSpaceCommand(spaceSnapshot, command, String(++spaceIdSequence)) : null;
      if (!next) return response({ error: "invalid_input" }, 400);
      spaceSnapshot = next; return response(spaceSnapshot);
    }
    if (method === "PUT" && path === `/api/workspaces/${hospitalWorkspaceId}/vital-settings`) {
      if (!vitalSnapshot.canManage) return response({ error: "permission_missing" }, 403);
      const next = parseWorkspaceVitalSettingsSnapshot({ ...vitalSnapshot, ...(body as { items: unknown }) });
      if (!next) return response({ error: "invalid_input" }, 400);
      vitalSnapshot = next; return response(vitalSnapshot);
    }
    if (method === "POST" && path.startsWith(base + "/order-sets")) {
      if (path.includes("/reviews/")) {
        const action = (body as { action: "accept" | "dismiss" }).action;
        // resolveReview intentionally skips POST.json, then awaits loadDetail
        // and onSaved→loadData. Keep transport installed through that chain.
        reviewWorkflows.add({ orderSetId: "storybook-order-a", detailRead: false, summariesRead: false, catalogRead: false });
        orderDetails = orderDetails.map(detail => detail.orderSetId === "storybook-order-a" ? { ...detail, pendingReviewCount: 0, needsCompositionReview: false } : detail);
        reviews = reviews.map(review => ({ ...review, status: action === "accept" ? "accepted" : "dismissed", resolvedAt: fixedDate, resolvedByUserId: orderSession.id }));
        return response({ ok: true });
      }
      const command = body as { availabilityStatus: OrderSetDetail["availabilityStatus"]; definition: OrderSetDefinition };
      const existing = orderDetails.find(item => path.endsWith("/" + item.orderSetId));
      if (args.scenario === "conflict" && existing) return response({ ok: false }, 409);
      const id = existing?.orderSetId ?? "storybook-created-order";
      const detail = { ...syntheticOrderDetail(id, command.definition.setName, command.definition, (existing?.currentRevisionNo ?? 0) + 1), availabilityStatus: command.availabilityStatus };
      orderDetails = [...orderDetails.filter(item => item.orderSetId !== id), detail];
      return response({ ok: true, result: { orderSet: detail } });
    }
    if (path === base + "/settings/profile" && method === "PATCH") {
      const parsed = parseHospitalContactUpdateInput(body);
      if (!parsed.ok) return response({ ok: false }, 400);
      if (args.scenario === "conflict") return response({ ok: false }, 409);
      profile = { ...profile, contact: parsed.value.contact, revision: profile.revision + 1 };
      const revision = profile.revision, phone = profile.contact.phone;
      return response({ ok: true, profile }, 200, () => {
        const state = useHospitalBasicSettingsStore.getState();
        return state.profiles[hospitalWorkspaceId]?.profile?.revision === revision && state.records[hospitalWorkspaceId]?.savedDraft.contact.phone === phone;
      });
    }
    if (path === base + "/settings/profile-change-requests" && method === "POST") {
      const parsed = parseHospitalProfileChangeRequestInput(body);
      if (!parsed.ok) return response({ ok: false }, 400);
      const request: NonNullable<HospitalProfile["pendingChangeRequest"]> = { id: "storybook-profile-request", fields: parsed.value.fields, createdAt: fixedDate, status: "pending" };
      profile = { ...profile, pendingChangeRequest: request };
      return response({ ok: true, request }, 200, () => useHospitalBasicSettingsStore.getState().profiles[hospitalWorkspaceId]?.profile?.pendingChangeRequest?.id === request.id);
    }
    if (path === base + "/basic-settings/operating-hours" && method === "PUT") {
      if (args.scenario === "conflict") return response({ ok: false, error: "future_appointment_conflict" }, 409);
      hours = body as typeof hours;
      return response({ ok: true, settings: hours }, 200, () => JSON.stringify(useHospitalBasicSettingsStore.getState().records[hospitalWorkspaceId]?.savedDraft.weeklyHours) === JSON.stringify(hours.weeklyHours));
    }
    if (path === base + "/settings/logo" && method === "DELETE") {
      profile = { ...profile, logo: { hasCustomLogo: false, url: null }, revision: profile.revision + 1 };
      const revision = profile.revision;
      return response({ ok: true, revision }, 200, () => useHospitalBasicSettingsStore.getState().profiles[hospitalWorkspaceId]?.profile?.revision === revision);
    }
    if (path === base + "/settings/logo" && method === "POST") {
      const command = body as { action: string };
      if (command.action === "prepare") return response({ ok: true, objectPath: "storybook/logo.png", uploadId: "storybook-logo-upload", uploadToken: "synthetic-local-placeholder" });
      if (command.action === "discard") return Response.json({ ok: true }); // Source intentionally does not consume this response body.
      if (command.action === "finalize") {
        profile = { ...profile, logo: { hasCustomLogo: true, url: logoAsset + "?storybook=uploaded" }, revision: profile.revision + 1 };
        const revision = profile.revision;
        return response({ ok: true, logoUrl: profile.logo.url, revision, cleanupPending: false }, 200, () => useHospitalBasicSettingsStore.getState().profiles[hospitalWorkspaceId]?.profile?.revision === revision);
      }
    }
    return response({ ok: false, error: "storybook-local-api-block" }, 503);
    } finally { if (mutationToken) inFlightMutations.delete(mutationToken); }
  };
  globalThis.fetch = fixtureFetch;
  return async () => {
    try {
      for (const abort of abortHeld) abort();
      resolveHospitalPending();
      await waitFor(() => {
        checkWrites(); expect(inFlightMutations.size).toBe(0); expect(pendingBodies.size).toBe(0); expect(expectedWrites.size).toBe(0);
        for (const workflow of reviewWorkflows) {
          expect(workflow.detailRead && workflow.summariesRead && workflow.catalogRead).toBe(true);
          const panel = document.querySelector('[data-testid="order-set-management"]');
          if (panel) {
            // Reading JSON precedes React state updates. Require the actual
            // post-review list commit, not merely completed transport reads.
            expect(panel.querySelector('[data-testid="order-set-header-count-skeleton"]')).toBeNull();
            const row = panel.querySelector(`[data-testid="order-set-row-${workflow.orderSetId}"]`);
            if (row) expect(row).not.toHaveTextContent("구성 검토 필요");
            else expect(panel).toHaveTextContent("조건에 맞는 Order 세트가 없습니다");
            const drawer = document.querySelector('[data-testid="order-set-drawer"]');
            const save = Array.from(drawer?.querySelectorAll("button") ?? []).find(button => button.textContent === "새 revision 저장");
            if (save) expect(save).not.toBeDisabled();
          }
        }
        const busy = Array.from(document.querySelectorAll("button")).some(button => /저장 중|접수 중|요청 중/.test(button.textContent ?? ""));
        expect(busy).toBe(false);
      }, { timeout: 3000 });
    } finally {
      try {
        // Commit the actual subtree's effect cleanup before restoring captured settingsDirty.
        // flushSync is called from Storybook teardown, outside React render/effect execution.
        unmountHospitalSource?.();
      } finally {
        unsubscribeSettings();
        if (globalThis.fetch === fixtureFetch) globalThis.fetch = fetchBefore;
        if (sdk.getMockImplementation() === sdkFixture) sdk.mockImplementation(sdkBefore ?? (() => null));
        useMockAuthStore.setState(auth, true); useHospitalBasicSettingsStore.setState(settings, true); useHospitalAdminStore.setState(admin, true);
        for (const { storage, values } of storageBefore) for (const { key, value } of values) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
        for (const item of toast.getToasts()) if (!toastBefore.has(item.id)) toast.dismiss(item.id);
      }
    }
  };
}

function LogoOnly() {
  const [value, setValue] = useState<string | null>(logoAsset), [receipt, setReceipt] = useState("미적용");
  return <div className="p-6"><HospitalLogoEditor value={value} onChange={(next, file) => { setValue(next); setReceipt(`${file?.name ?? "기본 로고"} 적용`); }} /><output aria-label="로고 적용 결과">{receipt}</output></div>;
}

export function HospitalCallerExample({ kind }: HospitalCallerArgs) {
  const [sourceMounted, setSourceMounted] = useState(true);
  useEffect(() => {
    const unmount = () => flushSync(() => setSourceMounted(false));
    unmountHospitalSource = unmount;
    return () => { if (unmountHospitalSource === unmount) unmountHospitalSource = null; };
  }, []);
  const [receipt, setReceipt] = useState(commands), [clipboard, setClipboard] = useState("미실행");
  useEffect(() => { const update = () => setReceipt(getHospitalCommands()); window.addEventListener(commandEvent, update); return () => window.removeEventListener(commandEvent, update); }, []);
  const captureClipboard = (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (target?.getAttribute("aria-label") !== "주소 복사") return;
    if ("key" in event && !["Enter", " "].includes(event.key)) return;
    const owner = navigator.clipboard, previous = Object.getOwnPropertyDescriptor(owner, "writeText");
    const restore = () => { if (owner.writeText !== localWrite) return; if (previous) Object.defineProperty(owner, "writeText", previous); else delete (owner as Partial<Clipboard>).writeText; };
    const localWrite = async (text: string) => { setClipboard(text); restore(); };
    Object.defineProperty(owner, "writeText", { configurable: true, value: localWrite }); queueMicrotask(restore);
  };
  return <>
    <div className="flex h-[800px] min-w-0 flex-col" onClickCapture={captureClipboard} onKeyDownCapture={captureClipboard}>
      {sourceMounted && (kind === "basic" ? <HospitalBasicSettingsScreen workspaceId={hospitalWorkspaceId} /> : kind === "contact" ? <HospitalContactSettingsScreen workspaceId={hospitalWorkspaceId} /> : kind === "hours" ? <HospitalOperatingHoursSettingsScreen workspaceId={hospitalWorkspaceId} /> : kind === "orders" ? <OrderSetsPanel session={orderSession} workspaceId={hospitalWorkspaceId} /> : kind === "roles" ? <RolePermissionManagementScreen workspaceId={hospitalWorkspaceId} onOpenMemberManagement={() => recordCommand({ method: "LOCAL_NAVIGATION", path: "members", body: null })} /> : kind === "spaces" ? <WorkspaceSpaceManagementScreen workspaceId={hospitalWorkspaceId} actorHeaders={getDemoActorHeaders(orderSession)} /> : kind === "vitals" ? <WorkspaceVitalSettingsScreen workspaceId={hospitalWorkspaceId} actorHeaders={getDemoActorHeaders(orderSession)} /> : <LogoOnly />)}
    </div>
    <output aria-label="합성 병원 명령" className="block break-all text-xs">{JSON.stringify(receipt)}</output>
    <output aria-label="합성 주소 복사">{clipboard}</output><Toaster />
  </>;
}
