import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { DispensingContent, DispensingContentAside, DispensingSidePanel } from "@/features/dispensing/module";
import { getOrderQueueItems } from "@/features/order-queue/data";
import { LEGACY_SALES_DEMO_WORKSPACE_ID } from "@/lib/emr-domain/demo-workspaces";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { useLayoutStore } from "@/stores/layout-store";

// Shared by three owned stories; actual source owns the header, filters,
// actions, tables and transition state. This legacy fixture is synthetic.
const selectedItem = getOrderQueueItems("dispensing")[1];
export const instructionCallerParameters = {
  nextjs: { appDirectory: true, navigation: { pathname: `/w/${LEGACY_SALES_DEMO_WORKSPACE_ID}/dispensing`, query: { date: "2026-04-29", queueItemId: selectedItem.id }, segments: [["workspaceId", LEGACY_SALES_DEMO_WORKSPACE_ID]] } },
};
export function prepareInstructionCaller() {
  if (getAuthRuntimeMode().authProvider !== "mock") throw new Error("Instruction caller requires the integration Storybook mock auth environment.");
  const previous = useLayoutStore.getState();
  const oldToastIds = new Set(toast.getToasts().map(item => item.id));
  useLayoutStore.setState({ contentAsideOpen: false, rightPanelOpen: false, activeDrawer: null, modulePanelOpen: true, selectedQueueItemIds: { dispensing: selectedItem.id } });
  const originalFetch = window.fetch;
  const fixtureFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
    if (url.pathname.endsWith("/fulfillment/work-items") && (!init?.method || init.method === "GET")) return Response.json({ ok: true, workItems: [], summary: { totalCount: 0 } });
    // Any unsupported source action reaches a local error; never a real API.
    return Response.json({ ok: false, error: "storybook-unhandled-api" }, { status: 503 });
  };
  window.fetch = fixtureFetch;
  return () => {
    if (window.fetch === fixtureFetch) window.fetch = originalFetch;
    useLayoutStore.setState(previous);
    for (const item of toast.getToasts()) if (!oldToastIds.has(item.id)) toast.dismiss(item.id);
  };
}
export function ActualInstructionCaller() {
  const historyOpen = useLayoutStore(state => state.contentAsideOpen);
  const [copied, setCopied] = useState("");
  const [navigation, setNavigation] = useState("");
  return <div className="h-[720px] min-h-0 w-full" onClickCapture={() => {
    const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const restore = () => {
      if (navigator.clipboard !== recorder) return;
      if (previous) Object.defineProperty(navigator, "clipboard", previous); else Reflect.deleteProperty(navigator, "clipboard");
    };
    const recorder = { writeText: async (value: string) => { setCopied(value); restore(); } };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: recorder });
    queueMicrotask(restore);
  }}>
    <div className="flex h-[650px] min-h-0 gap-3">
      {historyOpen ? <div className="w-[288px] shrink-0"><DispensingContentAside workspaceId={LEGACY_SALES_DEMO_WORKSPACE_ID} moduleId="dispensing" moduleLabel="조제" onNavigateWorkspaceSurface={href => setNavigation(href)} /></div> : null}
      <div className="min-w-0 flex-1"><DispensingContent workspaceId={LEGACY_SALES_DEMO_WORKSPACE_ID} moduleId="dispensing" moduleLabel="조제" hasRightPanel={false} onNavigateWorkspaceSurface={href => setNavigation(href)} /></div>
    </div>
    {copied ? <output aria-label="합성 지시서 복사 링크" className="block break-all text-xs">{copied}</output> : null}
    {navigation ? <output aria-label="합성 지시서 이동 경로">{navigation}</output> : null}
    <Toaster />
  </div>;
}

export function ActualQueueCaller() {
  const panelOpen = useLayoutStore(state => state.modulePanelOpen);
  const selected = useLayoutStore(state => state.selectedQueueItemIds.dispensing);
  return <div className="h-[580px] w-[288px]">
    {panelOpen ? <DispensingSidePanel workspaceId={LEGACY_SALES_DEMO_WORKSPACE_ID} moduleId="dispensing" moduleLabel="조제" /> : <button type="button" onClick={() => useLayoutStore.getState().setModulePanelOpen(true)}>대기열 다시 열기</button>}
    <output aria-label="선택 업무">{selected}</output>
  </div>;
}
