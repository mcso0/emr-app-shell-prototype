import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { expect, waitFor } from "storybook/test";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createMockChartOrderBillingSummaryFromMutationRows } from "@/features/chart/chart-order-billing-summary-contract";
import { getModule } from "@/modules/registry";
import { WorkspaceDocumentLayout } from "@/shell/workspace-document-layout";
import { useLayoutStore } from "@/stores/layout-store";
import type { Invoice, InvoiceLine, PaymentMethod } from "@/types/emr-domain";
import { buildBillingContractInvoiceSnapshot } from "./billing-data-contract";
import type { BillingQueueItem } from "./billing-queue";
import type { GuardianCheckoutSessionPayload } from "./server-guardian-checkout-core";
import { BillingSidePanel, BillingSlotAvailabilityProvider } from "./module";
import { useBillingStore } from "./store";

export type BillingScenario = "queue" | "detail" | "empty" | "error" | "denied";
export const billingWorkspaceId = "synthetic-billing-workspace";
export const billingInvoiceId = "99500000-0000-4000-8000-000000000001";
export const billingEncounterId = "99500000-0000-4000-8000-000000000002";
const now = "2026-10-11T00:00:00Z";
function createFixture(scenario: BillingScenario) {
  const invoice: Invoice = { id: billingInvoiceId, workspaceId: billingWorkspaceId, encounterId: billingEncounterId, guardianId: "synthetic-billing-guardian", invoiceNo: "SYN-BILL-01", status: "issued", paymentState: "none", subtotalAmount: 3000, discountAmount: 0, taxAmount: 0, totalAmount: 3000, issuedAt: now, createdAt: now };
  const lines: InvoiceLine[] = [1, 2].map(n => ({ id: `synthetic-billing-line-${n}`, invoiceId: invoice.id, description: `합성 청구 항목 ${n}`, quantity: 1, unitPrice: n * 1000, lineTotal: n * 1000 }));
  const rows: BillingQueueItem[] = scenario === "empty" ? [] : [{ invoice, encounter: { receptionType: "walk_in" }, patient: { name: "합성 수납 환자" }, guardian: { name: "합성 수납 보호자" }, lineCount: lines.length, lineSummary: "합성 청구 항목", requestedByName: "합성 수의사" }];
  const summary = createMockChartOrderBillingSummaryFromMutationRows({ encounterId: billingEncounterId, workspaceId: billingWorkspaceId, etag: '"synthetic-billing-summary"', generatedAt: now, rows: [] });
  summary.invoiceId = invoice.id;
  summary.context = { encounter: { id: billingEncounterId, encounterNo: "SYN-ENC-01", guardianId: invoice.guardianId!, patientId: "synthetic-billing-patient", status: "completed", createdAt: now, updatedAt: now }, guardian: { id: invoice.guardianId!, name: "합성 수납 보호자", createdAt: now, updatedAt: now }, patient: { id: "synthetic-billing-patient", name: "합성 수납 환자", patientNo: "SYN-PAT-01", breed: null, sex: "unknown", species: "cat", status: "active", createdAt: now, updatedAt: now } };
  const snapshot = buildBillingContractInvoiceSnapshot({ invoice, payments: [] });
  const checkout: GuardianCheckoutSessionPayload = { checkoutSession: { id: "synthetic-checkout-preview", status: "prepared", workspaceId: billingWorkspaceId, guardianId: invoice.guardianId, payerSnapshot: { name: "합성 수납 보호자" }, selectedInvoiceIds: [invoice.id], payableAmount: snapshot.payableAmount, excludedAmount: 0, excludedCount: 0, paymentMethod: "card", preparedAt: now }, invoiceSnapshots: [snapshot] };
  const requests: Array<{ method: string; path: string; body?: unknown }> = [], unhandled: string[] = [];
  let assignedToUserId: string | null = null, assignmentRevision = 1;
  const assignment = () => ({ assignedToUserId, assignedToDisplayName: assignedToUserId === "synthetic-billing-user" ? "합성 접수" : assignedToUserId ? "다른 합성 담당자" : null, canManage: !assignedToUserId || assignedToUserId === "synthetic-billing-user", revision: assignmentRevision, assignees: [{ userId: "synthetic-billing-user", displayName: "합성 접수" }, { userId: "synthetic-other-user", displayName: "다른 합성 담당자" }] });
  let healthy = scenario !== "error", unmount: (() => void) | undefined;
  let holdTransition = false, releaseTransition: (() => void) | undefined;
  let cleanup: (() => Promise<void>) | undefined;
  let restored = false;
  const install = () => {
    const previousFetch = globalThis.fetch, auth = useMockAuthStore.getState(), billing = useBillingStore.getState(), layout = useLayoutStore.getState();
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-billing-user", role: "front_desk", roleLabel: "합성 접수", storageMode: "session", issuedAt: now } });
    useBillingStore.setState({ invoices: [], invoiceLines: [], payments: [], selectedInvoiceId: scenario === "detail" ? invoice.id : "", selectedInvoiceIds: [], combinedInvoiceIds: [], invoiceAssignees: {} });
    useLayoutStore.setState({ contentAsideOpen: false, rightPanelOpen: true, activeDrawer: null });
    const pendingWriteBodies = new Set<symbol>();
    const trackedWrite = (response: Response, hold = false) => {
      const ticket = Symbol("synthetic billing write");
      pendingWriteBodies.add(ticket);
      const read = response.json.bind(response);
      const gate = hold ? new Promise<void>(resolve => { releaseTransition = resolve; }) : Promise.resolve();
      response.json = async () => {
        try { await gate; return await read(); }
        finally {
          // Actual denial handlers resume through Promise continuations and may
          // issue a fallback PATCH. Keep the ticket through that task boundary.
          setTimeout(() => pendingWriteBodies.delete(ticket), 0);
        }
      };
      return response;
    };
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return previousFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ method, path: url.pathname + url.search, body });
      const base = `/api/workspaces/${billingWorkspaceId}`;
      if (url.pathname === `${base}/billing/assignment`) {
        if (method === "GET") return Response.json({ ok: true, assignment: assignment() });
        if (method === "PATCH") {
          if (!assignment().canManage) return Response.json({ ok: false }, { status: 403 });
          const command = body as { action: string; assignedToUserId?: string; expectedRevision: number };
          if (command.expectedRevision !== assignmentRevision) return Response.json({ ok: false }, { status: 409 });
          assignedToUserId = command.action === "unassign" ? null : command.action === "claim" ? "synthetic-billing-user" : command.assignedToUserId ?? null;
          assignmentRevision += 1;
          return Response.json({ ok: true, assignment: assignment() });
        }
      }
      if (method === "GET" && url.pathname === `${base}/billing/queue`) {
        if (scenario === "denied") return Response.json({ ok: false }, { status: 403 });
        if (!healthy) return Response.json({ ok: false }, { status: 503 });
        return Response.json({ ok: true, rows });
      }
      if (method === "GET" && url.pathname === `${base}/billing/invoice-candidates` && url.searchParams.get("encounterId") === billingEncounterId) return Response.json({ ok: true, status: 200, candidates: [] });
      if (method === "GET" && url.pathname === `${base}/chart/order-billing-summary` && url.searchParams.get("encounterId") === billingEncounterId) return Response.json({ ok: true, status: 200, summary });
      if (method === "GET" && url.pathname === `${base}/billing/invoice-lines` && url.searchParams.get("invoiceId") === invoice.id) return Response.json({ ok: true, status: 200, invoice, lines, enforcedBy: "billing-invoice-line-persistence" });
      if (method === "GET" && url.pathname === `${base}/billing/payment-status` && url.searchParams.get("invoiceId") === invoice.id) return Response.json({ ok: true, status: 200, invoice, payments: [], enforcedBy: "billing-payment-status-persistence" });
      if (method === "GET" && url.pathname === `${base}/billing/guardian-checkout` && url.searchParams.get("guardianId") === invoice.guardianId) return Response.json({ ok: true, status: 200, rows: [snapshot], enforcedBy: "guardian-billing-ledger" });
      if (method === "POST" && url.pathname === `${base}/billing/guardian-checkout`) {
        const command = body as { invoiceIds?: string[]; paymentMethod?: string; paymentMemo?: string };
        if (command.invoiceIds?.length !== 1 || command.invoiceIds[0] !== invoice.id || !["card", "cash", "transfer", "other"].includes(command.paymentMethod ?? "")) throw new Error("Unexpected synthetic checkout preparation");
        return trackedWrite(Response.json({ ok: true, status: 200, ...checkout, checkoutSession: { ...checkout.checkoutSession, paymentMethod: command.paymentMethod as PaymentMethod, paymentMemo: command.paymentMemo }, enforcedBy: "guardian-checkout-session" }));
      }
      // Financial edits are rejected locally; the fixture never invents payment success.
      if (method === "PATCH" && [`${base}/billing/guardian-checkout`, `${base}/billing/invoice-lines`, `${base}/billing/payment-status`].includes(url.pathname)) {
        const hold = holdTransition && url.pathname.endsWith("/guardian-checkout");
        if (hold) holdTransition = false;
        return trackedWrite(Response.json({ ok: false, status: 403, denialReason: "permission_missing" }, { status: 403 }), hold);
      }
      unhandled.push(method + " " + url.pathname); throw new Error("Unexpected synthetic billing request");
    };
    globalThis.fetch = intercept;
    let cleaning: Promise<void> | undefined;
    cleanup = () => cleaning ??= (async () => {
      // These non-legacy reads only update mounted local state; unmount invalidates
      // their cancelled/sequence guards and removes shared queue listeners first.
      unmount?.();
      releaseTransition?.();
      await waitFor(() => expect(pendingWriteBodies.size).toBe(0));
      if (globalThis.fetch === intercept) globalThis.fetch = previousFetch;
      useMockAuthStore.setState(auth, true); useBillingStore.setState(billing, true); useLayoutStore.setState(layout, true);
      restored = globalThis.fetch === previousFetch;
    })();
    return cleanup;
  };
  return { invoice, rows, lines, requests, unhandled, setAssignee: (id: string | null) => { assignedToUserId = id; assignmentRevision += 1; window.dispatchEvent(new Event("clair-billing-assignment")); }, install, recover: () => { healthy = true; }, setUnmount: (callback: () => void) => { unmount = callback; }, holdNextTransition: () => { holdTransition = true; }, finish: () => cleanup?.(), isRestored: () => restored };
}
export let billingFixture: ReturnType<typeof createFixture>;
export function prepareBillingFixture(scenario: BillingScenario) { billingFixture = createFixture(scenario); return billingFixture.install(); }
export function BillingExample(args: { scenario: BillingScenario }) {
  void args;
  const instance = billingFixture, [mounted, setMounted] = useState(true), [route, setRoute] = useState("");
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  const props = { workspaceId: billingWorkspaceId, moduleId: "billing", moduleLabel: "수납", onNavigateWorkspaceSurface: (href: string) => setRoute(href) };
  return <div className="flex h-[900px] w-[1650px] max-w-full flex-col"><div className="flex min-h-0 flex-1">{mounted ? <><aside aria-label="수납 대기열" className="w-[300px] shrink-0"><BillingSidePanel {...props} /></aside><main className="min-w-0 flex-1"><BillingSlotAvailabilityProvider {...props}>{availability => <WorkspaceDocumentLayout moduleDefinition={getModule("billing")} slotProps={{ ...props, ...availability }} />}</BillingSlotAvailabilityProvider></main></> : null}</div><output aria-label="합성 수납 이동 경로">{route || "미선택"}</output></div>;
}
