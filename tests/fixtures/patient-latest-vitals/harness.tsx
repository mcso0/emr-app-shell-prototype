import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { usePatientLatestVitalItems } from "../../../src/features/patient-vitals/use-patient-latest-vitals";

function Consumer({ name, scope }: { name: string; scope: { workspaceId: string; encounterId?: string; actor: string; headers?: Record<string, string> } }) {
  const latest = usePatientLatestVitalItems({ workspaceId: scope.workspaceId, encounterId: scope.encounterId, actorHeaders: scope.headers });
  const [inserted, setInserted] = useState("");
  const [feedback, setFeedback] = useState("");
  const text = latest.items.filter(item => item.value !== "—" && item.value !== "-").map(item => `${item.label}: ${item.value}`).join("\n");
  return <section data-testid={name}>
    <output data-testid="state">{JSON.stringify({ status: latest.status, canWrite: latest.canWriteVitals, vital: latest.vital, text, settingsStatus: latest.vitalSettingsStatus })}</output>
    <button onClick={async () => { try { const response = await fetch("/synthetic-save", { method: "POST" }); const vital = await response.json(); await latest.replaceVital(vital); setFeedback("saved"); } catch { setFeedback("refresh-failed"); } }}>Save</button>
    <button disabled={latest.status !== "ready" || latest.vital?.encounterId !== scope.encounterId} onClick={() => setInserted(text)}>Insert</button>
    <pre data-testid="inserted">{inserted}</pre><output data-testid="feedback">{feedback}</output>
  </section>;
}
function App() {
  const [scope, setScope] = useState({ workspaceId: "workspace-a", encounterId: "encounter-a", actor: "account-a" });
  const [mounted, setMounted] = useState(true);
  Object.assign(window, { changeScope: setScope, setMounted, syntheticActor: scope.actor });
  return mounted ? <><Consumer name="header" scope={scope}/><Consumer name="soap" scope={scope}/></> : null;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
