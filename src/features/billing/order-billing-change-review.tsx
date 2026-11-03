"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "./store";
import { orderBillingChangeSchema } from "./order-billing-change-contract";
import { orderFinancialLabels as labels, formatOrderFinancialValue as format, confirmedOrderErrors, type OrderFinancialValues } from "@/features/chart/confirmed-order-edit-contract";
export function OrderBillingChangeReview({ workspaceId, invoiceId, reviewKey, onApplied }: { workspaceId: string; invoiceId: string; reviewKey: string; onApplied: () => void }) {
 const [changes, setChanges] = useState<z.infer<typeof orderBillingChangeSchema>[]>([]), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
 const lastLoadedSignature = useRef<string | null>(null);
 const pending = useRef(false), generation = useRef(0), readVersion = useRef(0);
 const hasPersistedInvoice = z.uuid().safeParse(invoiceId).success;
 const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/order-changes`;
 useEffect(() => {
  if (!hasPersistedInvoice) return;
  useBillingStore.getState().setOrderChangeReview(reviewKey, { status: "loading", pending: false, signature: "" });
  lastLoadedSignature.current = null;
  const current = ++generation.current; const abort = new AbortController();
  const read = async () => {
   const version = ++readVersion.current;
   try {
    const response = await fetch(`${endpoint}?invoiceId=${invoiceId}`, { cache: "no-store", signal: abort.signal }); const body = await response.json();
    if (current !== generation.current || version !== readVersion.current || pending.current) return;
    const parsed = z.array(orderBillingChangeSchema).safeParse(body.changes);
    if (!response.ok || !body.ok || !parsed.success) throw new Error(body.error ?? "unavailable");
    setChanges(parsed.data); setError(null);
    const signature = JSON.stringify(parsed.data.map(item => [item.proposalId, item.version]));
    const changed = lastLoadedSignature.current !== null && lastLoadedSignature.current !== signature;
    lastLoadedSignature.current = signature;
    useBillingStore.getState().setOrderChangeReview(reviewKey, { status: "ready", pending: parsed.data.length > 0, signature });
    if (changed) window.dispatchEvent(new CustomEvent("clair-billing-order-change", { detail: { workspaceId, invoiceId } }));
   } catch (cause) { if (!abort.signal.aborted && current === generation.current && version === readVersion.current && !pending.current) {
      setError(confirmedOrderErrors[cause instanceof Error ? cause.message : "unavailable"] ?? confirmedOrderErrors.unavailable);
      useBillingStore.getState().setOrderChangeReview(reviewKey, { status: "error", pending: true, signature: "" });
    } }
  };
  void read(); const focus = () => { if (!pending.current) void read(); }; window.addEventListener("focus", focus); window.addEventListener("clair-billing-assignment", focus);
  const timer = window.setInterval(() => { if (document.visibilityState === "visible") focus(); }, 15000);
  return () => { generation.current = current + 1; abort.abort(); window.removeEventListener("focus", focus); window.removeEventListener("clair-billing-assignment", focus); window.clearInterval(timer); };
 }, [endpoint, hasPersistedInvoice, invoiceId, reload, reviewKey, workspaceId]);
 const approve = async (change: z.infer<typeof orderBillingChangeSchema>) => {
  if (pending.current) return; pending.current = true; ++readVersion.current; setBusy(true); const current = generation.current;
  try {
   const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId, orderId: change.orderId, proposalId: change.proposalId, version: change.version }) }); const body = await response.json();
   if (current !== generation.current) return;
   const parsed = z.array(orderBillingChangeSchema).safeParse(body.changes);
   if (!response.ok || !body.ok || !parsed.success) throw new Error(body.error ?? "unavailable");
   setChanges(parsed.data); setError(null);
   const signature = JSON.stringify(parsed.data.map(item => [item.proposalId, item.version]));
   lastLoadedSignature.current = signature;
   useBillingStore.getState().setOrderChangeReview(reviewKey, { status: "ready", pending: parsed.data.length > 0, signature });
   window.dispatchEvent(new CustomEvent("clair-billing-order-change", { detail: { workspaceId, invoiceId } }));
   onApplied();
  } catch (cause) { if (current === generation.current) setError(confirmedOrderErrors[cause instanceof Error ? cause.message : "unavailable"] ?? confirmedOrderErrors.unavailable); }
  finally { pending.current = false; if (current === generation.current) setBusy(false); }
 };
 if (!hasPersistedInvoice || (!changes.length && !error)) return null;
 return <section className="rounded-xl border bg-card p-4" aria-label="청구 변경 확인"><h2 className="text-sm font-semibold">청구 변경 확인 대기</h2>
  {changes.map(change => <div key={change.proposalId} className="mt-3 border-t pt-3"><h3 className="text-sm font-medium">{change.before.billingName}</h3>
   <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{(Object.keys(labels) as (keyof OrderFinancialValues)[]).filter(key => change.before[key] !== change.proposed[key]).map(key => <div className="contents" key={key}><dt className="text-muted-foreground">{labels[key]}</dt><dd>{format(change.before[key])} → {format(change.proposed[key])}</dd></div>)}</dl>
   <Button size="sm" disabled={busy || !change.canApprove} onClick={() => void approve(change)}>{busy ? "반영 중…" : "확인 후 금액 반영"}</Button>
   {!change.canApprove && <p className="mt-2 text-xs text-muted-foreground">현재 수납 담당자만 결제 전에 반영할 수 있어요.</p>}
  </div>)}
  {error && <div role="alert" className="mt-3 text-sm"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => setReload(n => n + 1)}>최신 변경안 조회</Button></div>}
 </section>;
}
