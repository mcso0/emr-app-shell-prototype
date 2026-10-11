import { toast } from "sonner";
import { waitFor } from "storybook/test";
import type { LabResult } from "@/types/emr-domain";
import type { LabResultAttachment, LabResultPhase2Data } from "../use-lab-result-phase2";

export type Phase2Scenario = "ready" | "empty" | "readonly" | "read-error" | "save-error" | "lost-response" | "upload-error" | "upload-hold" | "finalize-hold" | "delete-error";
let sequence = 0;

/** Local API and signed-byte transport. No real storage/client/URL is used. */
export function createPhase2Fixture(scenario: Phase2Scenario, options: {
  workspaceId?: string;
  handleAdditionalRequest?: (url: URL, method: string, body: Record<string, unknown> | undefined, signal: AbortSignal | null | undefined) => Promise<Response | undefined>;
} = {}) {
  const workspaceId = options.workspaceId ?? "storybook-lab-phase2";
  const resultId = `96000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const rowId = "96000000-0000-4000-8001-000000000001";
  const result: LabResult = { id: resultId, workspaceId, patientId: "96000000-0000-4000-8002-000000000001", encounterId: "96000000-0000-4000-8003-000000000001", orderId: "96000000-0000-4000-8004-000000000001", resultName: "합성 검사", status: "entered", rows: [{ id: rowId, analyteName: "합성 항목 A", value: "2", unit: "synthetic-unit", judgment: "not_judged", note: "합성 항목 소견" }] };
  const makeAttachment = (id: string, name: string, mimeType: string, scope: string | null): LabResultAttachment => ({ id, name, mimeType, rowId: scope, size: 64, uploadedAt: "2026-10-11T00:00:00Z", uploadedByUserId: "synthetic-user", uploadedByName: "합성 직원" });
  const state: LabResultPhase2Data = { resultId, orderId: result.orderId!, overallFinding: "합성 종합소견", overallRevision: 3, canEdit: scenario !== "readonly", events: [], attachments: scenario === "empty" ? [] : [makeAttachment("96000000-0000-4000-8005-000000000001", "synthetic-note.txt", "text/plain", null), makeAttachment("96000000-0000-4000-8005-000000000002", "synthetic-table.csv", "text/csv", null), makeAttachment("96000000-0000-4000-8005-000000000003", "synthetic-row.txt", "text/plain", rowId)] };
  const errors: string[] = [];
  const commands: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const downloads: string[] = [];
  const byteUploads: Array<{ file: File; headers: Record<string, string>; credentials: boolean }> = [];
  const pending = new Map<string, LabResultAttachment>();
  const workflows = new Set<string>();
  let fetchInFlight = 0, jsonInFlight = 0;
  const xhrs = new Set<SyntheticUpload>();
  let releaseFinalize: (() => void) | undefined;
  let readFailed = scenario === "read-error", saveFailed = scenario === "save-error", uploadFailed = scenario === "upload-error", deleteFailed = scenario === "delete-error";
  let originalFetch: typeof fetch, originalXHR: typeof XMLHttpRequest, originalOpen: typeof window.open;
  let disposed = false;
  let teardown: (() => Promise<void>) | undefined;
  let responseLost = scenario === "lost-response";
  const endpoint = `/api/workspaces/${workspaceId}/lab-imaging`;

  class SyntheticUpload extends EventTarget {
    upload = new EventTarget(); status = 0; withCredentials = false;
    private path = ""; private headers: Record<string, string> = {}; private ended = false;
    open(method: string, url: string) {
      const target = new URL(url, window.location.origin);
      if (method !== "PUT" || target.origin !== window.location.origin || !target.pathname.startsWith("/synthetic-lab-upload/")) throw new Error("Unexpected synthetic signed upload");
      this.path = target.pathname;
    }
    setRequestHeader(name: string, value: string) { this.headers[name] = value; }
    send(form: FormData) {
      const file = form.get("");
      if (!(file instanceof File) || form.get("cacheControl") !== "0" || this.headers["x-upsert"] !== "false" || !pending.has(this.path.split("/").at(-1)!)) throw new Error("Synthetic upload form mismatch");
      byteUploads.push({ file, headers: { ...this.headers }, credentials: this.withCredentials }); xhrs.add(this);
      queueMicrotask(() => {
        if (this.ended || disposed) return;
        this.upload.dispatchEvent(new ProgressEvent("progress", { lengthComputable: true, loaded: file.size / 2, total: file.size }));
        if (uploadFailed) { uploadFailed = false; this.finish(503); }
        else if (scenario !== "upload-hold") this.finish(200);
      });
    }
    finish(status: number) { if (this.ended) return; this.ended = true; this.status = status; xhrs.delete(this); this.dispatchEvent(new Event("load")); }
    abort() { if (this.ended) return; this.ended = true; xhrs.delete(this); this.dispatchEvent(new Event("abort")); }
  }

  const install = () => {
    const previousToastIds = new Set(toast.getToasts().map(item => item.id));
    originalFetch = globalThis.fetch; originalXHR = globalThis.XMLHttpRequest; originalOpen = window.open;
    globalThis.XMLHttpRequest = SyntheticUpload as unknown as typeof XMLHttpRequest;
    window.open = (url) => { downloads.push(String(url)); return null; };
    const handleFetch: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      commands.push({ method, path: url.pathname, body });
      const additional = await options.handleAdditionalRequest?.(url, method, body, init?.signal);
      if (additional) return additional;
      if (!url.pathname.startsWith(endpoint)) throw new Error(`Unexpected API ${url.pathname}`);
      // Teardown may cancel a transport or release a held finalizer. Keep its
      // terminal cleanup route local until the caller has consumed the response.
      if (body?.action === "discard" && body.resultId === result.id) { pending.delete(String(body.attachmentId)); workflows.delete(String(body.attachmentId)); return Response.json({ ok: true }); }
      if (disposed && method !== "DELETE") return Response.json({ ok: false }, { status: 410 });
      if (url.pathname === `${endpoint}/result-phase2`) {
        if (method === "GET") {
          if (url.searchParams.get("resultId") !== result.id) throw new Error("Synthetic result scope mismatch");
          if (readFailed) { readFailed = false; return Response.json({ ok: false }, { status: 503 }); }
          return Response.json({ ok: true, data: structuredClone(state) });
        }
        if (method === "PUT" && body?.resultId === result.id && typeof body.finding === "string" && Number.isSafeInteger(body.expectedRevision)) {
          if (body.expectedRevision !== state.overallRevision) return Response.json({ ok: false, error: "lab_overall_revision_conflict" }, { status: 409 });
          if (saveFailed) { saveFailed = false; return Response.json({ ok: false }, { status: 503 }); }
          if (body.finding === state.overallFinding) return Response.json({ ok: true, data: { revision: state.overallRevision, finding: state.overallFinding } });
          const before = { finding: state.overallFinding, revision: state.overallRevision };
          state.overallFinding = body.finding; state.overallRevision++;
          state.events.push({ kind: "overall_changed", resultId, rowId: null, actorUserId: "synthetic-user", actorName: "합성 직원", before, after: { finding: body.finding, revision: state.overallRevision }, createdAt: "2026-10-11T00:01:00Z" });
          if (responseLost) { responseLost = false; throw new Error("Synthetic response lost after commit"); }
          return Response.json({ ok: true, data: { revision: state.overallRevision, finding: state.overallFinding } });
        }
      }
      if (url.pathname === `${endpoint}/result-attachments` && method === "POST" && body?.resultId === result.id) {
        if (body.action === "prepare") {
          const id = crypto.randomUUID(); const item = makeAttachment(id, String(body.name), String(body.mimeType), body.rowId === null ? null : String(body.rowId)); item.size = Number(body.size); pending.set(id, item); workflows.add(id);
          return Response.json({ ok: true, attachmentId: id, objectPath: `${workspaceId}/${resultId}/${id}`, uploadToken: "synthetic-token", uploadUrl: `${window.location.origin}/synthetic-lab-upload/${id}` });
        }
        if (body.action === "discard") { pending.delete(String(body.attachmentId)); workflows.delete(String(body.attachmentId)); return Response.json({ ok: true }); }
        if (body.action === "finalize") {
          if (scenario === "finalize-hold") await new Promise<void>(resolve => { releaseFinalize = resolve; });
          const item = pending.get(String(body.attachmentId)); if (!item || disposed) return Response.json({ ok: false }, { status: 410 });
          pending.delete(item.id); state.attachments.push(item); return Response.json({ ok: true });
        }
      }
      if (url.pathname.startsWith(`${endpoint}/result-attachments/`)) {
        const id = url.pathname.split("/").at(-1)!; const item = state.attachments.find(attachment => attachment.id === id);
        if (!item || url.searchParams.get("resultId") !== result.id) return Response.json({ ok: false }, { status: 404 });
        if (method === "DELETE") {
          if (deleteFailed) { deleteFailed = false; return Response.json({ ok: false }, { status: 503 }); }
          state.attachments = state.attachments.filter(attachment => attachment.id !== id); workflows.delete(id); return Response.json({ ok: true });
        }
        if (method === "GET") return new Response(item.mimeType === "text/csv" ? "item,value\nsynthetic A,2\nsynthetic B,4\n" : "합성 첨부 문서\n합성 안내 내용입니다.\n", { headers: { "Content-Type": item.mimeType } });
      }
      const message = `Synthetic result command mismatch: ${method} ${url.pathname} ${JSON.stringify(body)} (current ${result.id} revision ${state.overallRevision})`; errors.push(message); throw new Error(message);
    };
    globalThis.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
      const command = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      fetchInFlight++;
      return new Promise<Response>((resolve, reject) => {
        void handleFetch(input, init).then(response => {
          const readJson = response.json.bind(response);
          response.json = () => {
            jsonInFlight++;
            return new Promise((resolveJson, rejectJson) => {
              void readJson().then(value => {
                resolveJson(value);
                // The awaiting caller resumes before this acknowledgement. It
                // has now started discard/delete/refresh or finished its work.
                queueMicrotask(() => {
                  if (command?.action === "finalize") workflows.delete(String(command.attachmentId));
                  jsonInFlight--;
                });
              }, error => { rejectJson(error); queueMicrotask(() => { jsonInFlight--; }); });
            });
          };
          resolve(response);
          queueMicrotask(() => { fetchInFlight--; });
        }, error => { reject(error); queueMicrotask(() => { fetchInFlight--; }); });
      });
    };
    return async () => {
      await teardown?.();
      disposed = true; for (const xhr of xhrs) xhr.abort(); releaseFinalize?.();
      await waitFor(() => {
        if (xhrs.size || workflows.size || fetchInFlight || jsonInFlight) throw new Error(`Synthetic upload cleanup pending: transports=${xhrs.size}, workflows=${workflows.size}, requests=${fetchInFlight}, bodies=${jsonInFlight}`);
      }, { timeout: 5000 });
      globalThis.fetch = originalFetch; globalThis.XMLHttpRequest = originalXHR; window.open = originalOpen;
      for (const item of toast.getToasts()) if (!previousToastIds.has(item.id)) toast.dismiss(item.id);
    };
  };
  return { result, state, commands, errors, downloads, byteUploads, install, setTeardown: (callback: (() => Promise<void>) | undefined) => { teardown = callback; }, releaseUploads: () => { for (const xhr of xhrs) xhr.finish(200); }, releaseFinalize: () => releaseFinalize?.() };
}
