import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useShellNotifications } from "../../src/shell/use-shell-notifications";
import { LiveNotificationDelivery } from "../../src/features/notifications/live-notification-delivery";

function Harness() {
  const query = new URLSearchParams(location.search);
  const [login, setLogin] = useState(query.get("login") ?? "login-a");
  const workspaceId = query.get("workspace") ?? "synthetic-alpha";
  const [windowId] = useState(() => crypto.randomUUID());
  const actorHeaders = useMemo(() => ({ "x-synthetic-login": login, "x-synthetic-window": windowId }), [login, windowId]);
  const state = useShellNotifications({ actorHeaders, authHydrated: true, sessionId: "supabase-session-synthetic-user", sessionRole: "supabase", workspaceId });
  return <>
    <output data-testid="state">{JSON.stringify({ requestState: state.requestState, counts: state.counts, ids: state.notifications.map(item => item.id), unread: state.notifications.map(item => item.unread) })}</output>
    <button onClick={state.retry}>Retry</button>
    <button onClick={() => { window.dispatchEvent(new Event("focus")); }}>Focus</button>
    <button onClick={() => { window.dispatchEvent(new Event("clair:session-ended")); }}>Logout</button>
    <button onClick={() => setLogin("login-b")}>Change login</button>
    <button onClick={() => { void state.markRead("synthetic-one"); }}>Read</button>
    <button onClick={() => { void state.markRead("synthetic-one", { silent: true }); }}>Silent read</button>
    <button onClick={() => { void state.archive("synthetic-one"); }}>Archive</button>
    <button onClick={() => { void state.restore("synthetic-one"); }}>Restore</button>
    <button onClick={() => { void state.markAllRead(); }}>Read all</button>
    <LiveNotificationDelivery key={`${workspaceId}:${state.deliveryGeneration}`} workspaceId={workspaceId} userId="synthetic-user"
      notifications={state.notifications} ready={state.requestState === "ready"} currentRoute={`/w/${workspaceId}/reception`}
      onArchive={state.archive} onOpenSource={() => undefined} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
