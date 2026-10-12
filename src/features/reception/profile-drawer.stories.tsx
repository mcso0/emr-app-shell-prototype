import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { toast } from "sonner";
import { useMockAuthStore } from "@/features/auth/session-store";
import type { CustomerPatientProfile, CustomerPatientProfileUpdateInput, CustomerPatientProfileUpdateResult } from "@/features/customer/server-patient-profile-core";
import type { CustomerGuardianProfile, CustomerGuardianProfileUpdateInput, CustomerGuardianProfileUpdateResult } from "@/features/customer/server-guardian-profile-core";
import { useLayoutStore } from "@/stores/layout-store";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";
import { PatientProfileDrawer, GuardianProfileDrawer } from "./profile-drawer";
import { usePatientProfileStore } from "./patient-profile-store";

const workspaceId = "storybook-profile-drawer";
const id = (index: number) => `99300000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const date = "2026-10-11T00:00:00Z";
type Scenario = "patient" | "guardian" | "denied";
function createFixture(scenario: Scenario) {
  const patient: Patient = { id: id(1), workspaceId, patientNo: "SYN-PROFILE-01", name: "합성 서랍 환자", species: "cat", sex: "unknown", handlingCautionLocked: false, status: "active", specialNote: "합성 환자 메모", createdAt: date, updatedAt: date };
  const guardian: Guardian = { id: id(2), workspaceId, name: "합성 서랍 보호자", mobilePhone: "01000000000", email: "synthetic@example.invalid", memo: "합성 보호자 메모", createdAt: date, updatedAt: date };
  const link: PatientGuardian = { id: id(3), patientId: patient.id, guardianId: guardian.id, isPrimary: true, canReceiveMessages: false, createdAt: date };
  let patientProfile: CustomerPatientProfile = { ...patient, isMixedBreed: false, additionalBreedIds: [], ageIsEstimated: false, microchipType: "none", messageConsentStatus: "unknown" };
  let guardianProfile: CustomerGuardianProfile = { ...guardian, additionalPhoneNumbers: [], cashReceiptType: "none", referralSources: [], consents: [], status: "active" };
  const writes: Array<{ target: "patient" | "guardian"; input: CustomerPatientProfileUpdateInput | CustomerGuardianProfileUpdateInput; storeApplied: boolean; terminalTitle: string }> = [];
  const unhandled: string[] = [];
  let pending = 0, unmount: (() => void) | undefined;
  const install = () => {
    const previousFetch = globalThis.fetch, previousAuth = useMockAuthStore.getState(), previousProfile = usePatientProfileStore.getState(), previousLayout = useLayoutStore.getState();
    const previousToastIds = new Set(toast.getToasts().map(item => item.id));
    const previousHistoryIds = new Set(toast.getHistory().map(item => item.id));
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-profile-desk", role: "front_desk", roleLabel: "합성 접수", storageMode: "session", issuedAt: date }, hydrate: () => {} });
    usePatientProfileStore.setState({ patients: [patient], guardians: [guardian], patientGuardians: [link], consents: [] });
    const originalUpdatePatient = usePatientProfileStore.getState().updatePatient, originalUpdateGuardian = usePatientProfileStore.getState().updateGuardian;
    usePatientProfileStore.setState({
      updatePatient: (subjectId, patch) => { originalUpdatePatient(subjectId, patch); const receipt = writes.find(item => item.target === "patient" && !item.storeApplied && item.input.name === patch.name); if (subjectId === patient.id && receipt) receipt.storeApplied = true; },
      updateGuardian: (subjectId, patch) => { originalUpdateGuardian(subjectId, patch); const receipt = writes.find(item => item.target === "guardian" && !item.storeApplied && item.input.name === patch.name); if (subjectId === guardian.id && receipt) receipt.storeApplied = true; },
    });
    useLayoutStore.setState({ activeDrawer: scenario === "guardian" ? { type: "guardian", id: guardian.id } : { type: "patient", id: patient.id }, retainedReceptionDrawer: null });
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return previousFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const target = url.pathname === `/api/workspaces/${workspaceId}/customer/patients/${patient.id}/profile` ? "patient" : url.pathname === `/api/workspaces/${workspaceId}/customer/guardians/${guardian.id}/profile` ? "guardian" : null;
      if (!target || method !== "PATCH") { unhandled.push(method + " " + url.pathname); throw new Error("Unexpected synthetic profile request"); }
      pending++;
      try {
        const body = JSON.parse(String(init?.body)) as CustomerPatientProfileUpdateInput | CustomerGuardianProfileUpdateInput;
        if (typeof body.name !== "string" || !body.name.trim()) throw new Error("Synthetic profile name is required");
        writes.push({ target, input: structuredClone(body), storeApplied: false, terminalTitle: scenario === "denied" ? `이 workspace에서 ${target === "patient" ? "환자" : "보호자"} 정보를 수정할 권한이 없습니다.` : `${target === "patient" ? "환자" : "보호자"} 정보가 저장되었습니다.` });
        let result: CustomerPatientProfileUpdateResult | CustomerGuardianProfileUpdateResult;
        if (scenario === "denied") result = { ok: false, status: 403, denialReason: "permission_missing" };
        else if (target === "patient") { patientProfile = { ...patientProfile, ...body, updatedAt: "2026-10-11T01:00:00Z" } as CustomerPatientProfile; result = { ok: true, status: 200, profile: patientProfile, enforcedBy: "customer-patient-profile-update" }; }
        else { guardianProfile = { ...guardianProfile, ...body, updatedAt: "2026-10-11T01:00:00Z" } as CustomerGuardianProfile; result = { ok: true, status: 200, profile: guardianProfile, enforcedBy: "customer-guardian-profile-update" }; }
        const response = Response.json(result, { status: result.status }), json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    globalThis.fetch = intercept;
    return async () => {
      try {
        unmount?.();
        await waitFor(() => {
          if (pending || writes.some(item => scenario !== "denied" && !item.storeApplied)) throw new Error("Original profile store update is still settling");
          const terminalToasts = toast.getHistory().filter(item => !previousHistoryIds.has(item.id) && "title" in item);
          for (const title of new Set(writes.map(item => item.terminalTitle))) {
            if (terminalToasts.filter(item => "title" in item && item.title === title).length < writes.filter(item => item.terminalTitle === title).length) throw new Error("Original profile terminal toast is still settling");
          }
        });
      }
      finally { if (globalThis.fetch === intercept) globalThis.fetch = previousFetch; useMockAuthStore.setState(previousAuth, true); usePatientProfileStore.setState(previousProfile, true); useLayoutStore.setState(previousLayout, true); for (const item of toast.getToasts()) if (!previousToastIds.has(item.id)) toast.dismiss(item.id); }
    };
  };
  return { patient, guardian, writes, unhandled, install, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const drawer = useLayoutStore(state => state.activeDrawer);
  const [mounted, setMounted] = useState(true);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="h-[900px] w-[420px] max-w-full border bg-[var(--emr-surface-panel)]">{mounted && drawer?.type === "patient" ? <PatientProfileDrawer patientId={instance.patient.id} /> : mounted && drawer?.type === "guardian" ? <GuardianProfileDrawer guardianId={instance.guardian.id} /> : <output aria-label="합성 프로필 이후 선택">{drawer?.type ?? "닫힘"}</output>}</div>;
}
const meta = {
  title: "Features/Reception/Actual Profile Drawer", component: Example, tags: ["autodocs"], args: { scenario: "patient" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/w/${workspaceId}/customer`, segments: [["workspaceId", workspaceId]] } }, docs: { story: { inline: false, height: "940px" }, description: { component: "실제 PatientProfileDrawer/GuardianProfileDrawer가 원본 ProfileSidePanel과 정보 편집 필드를 구성합니다. 고유 합성 환자·보호자·관계를 store에 제공하고, 기존 local projection 분기를 사용합니다. 프로필 PATCH는 정확한 합성 workspace/subject 경로의 typed local 응답이며 실제 source updatePatient/updateGuardian을 호출합니다. 성공·권한 거절·취소·관련 보호자 이동과 접수 시작 returnTo 데이터를 확인합니다. 접수 시작 뒤의 폼·prepared workspace의 원격 overview/today 읽기·실제 고객 저장·DB 권한·메시지 발송은 포함하지 않습니다. 종료 시 실제 화면을 unmount하고 fetch/auth/profile/layout/toasts를 복원합니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); }, render: args => <Example {...args} />,
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PatientEditAndSave: Story = {
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "수정" })); const name = canvas.getByRole("textbox", { name: "환자명" }); await userEvent.clear(name); await userEvent.type(name, "합성 서랍 환자 변경"); await userEvent.click(canvas.getByRole("button", { name: "저장" })); await waitFor(() => expect(canvas.queryByRole("textbox", { name: "환자명" })).not.toBeInTheDocument()); await expect(usePatientProfileStore.getState().patients[0].name).toBe("합성 서랍 환자 변경"); await expect(fixture.writes).toHaveLength(1); await expect(fixture.writes[0]).toMatchObject({ target: "patient", input: { name: "합성 서랍 환자 변경" } }); await expect(canvas.getAllByText("합성 서랍 환자 변경").length).toBeGreaterThan(0); await expect(fixture.unhandled).toHaveLength(0); },
};
export const PatientSaveDeniedRetainsDraft: Story = {
  args: { scenario: "denied" },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "수정" })); const name = canvas.getByRole("textbox", { name: "환자명" }); await userEvent.type(name, " 변경"); await userEvent.click(canvas.getByRole("button", { name: "저장" })); await waitFor(() => expect(toast.getToasts().some(item => "title" in item && item.title === "이 workspace에서 환자 정보를 수정할 권한이 없습니다.")).toBe(true)); await expect(name).toHaveValue("합성 서랍 환자 변경"); await expect(usePatientProfileStore.getState().patients[0].name).toBe("합성 서랍 환자"); await expect(canvas.getByRole("button", { name: "저장" })).toBeEnabled(); await userEvent.click(canvas.getByRole("button", { name: "취소" })); await expect(canvas.queryByRole("textbox", { name: "환자명" })).not.toBeInTheDocument(); await expect(fixture.writes).toHaveLength(1); await expect(fixture.unhandled).toHaveLength(0); },
};
export const GuardianCancelThenSave: Story = {
  args: { scenario: "guardian" },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "수정" })); await userEvent.type(canvas.getByRole("textbox", { name: "보호자명" }), " 임시"); await userEvent.click(canvas.getByRole("button", { name: "취소" })); await expect(fixture.writes).toHaveLength(0); await userEvent.click(canvas.getByRole("button", { name: "수정" })); const name = canvas.getByRole("textbox", { name: "보호자명" }); await expect(name).toHaveValue("합성 서랍 보호자"); await userEvent.type(name, " 변경"); const save = canvas.getByRole("button", { name: "저장" }); save.focus(); await userEvent.keyboard("{Enter}"); await waitFor(() => expect(canvas.queryByRole("textbox", { name: "보호자명" })).not.toBeInTheDocument()); await expect(usePatientProfileStore.getState().guardians[0].name).toBe("합성 서랍 보호자 변경"); await expect(fixture.writes).toHaveLength(1); await expect(fixture.writes[0].target).toBe("guardian"); await expect(fixture.unhandled).toHaveLength(0); },
};
export const RelatedGuardianSelection: Story = {
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); const related = canvas.getByRole("button", { name: /합성 서랍 보호자/ }); related.focus(); await userEvent.keyboard("{Enter}"); await expect(useLayoutStore.getState().activeDrawer).toMatchObject({ type: "guardian", id: fixture.guardian.id }); await expect(canvas.getByRole("tab", { name: "보호자 정보" })).toBeVisible(); await expect(fixture.writes).toHaveLength(0); },
};
export const ReceptionStartReturnContext: Story = {
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole("button", { name: "접수/예약" })); const action = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "접수하기" }); await waitFor(() => expect(action).toBeVisible()); await userEvent.click(action); await expect(useLayoutStore.getState().activeDrawer).toMatchObject({ type: "reception-form", initialPatientId: fixture.patient.id, returnTo: { type: "patient", id: fixture.patient.id, profileTab: "info" } }); await expect(canvas.getByRole("status", { name: "합성 프로필 이후 선택" })).toHaveTextContent("reception-form"); await expect(fixture.writes).toHaveLength(0); },
};
