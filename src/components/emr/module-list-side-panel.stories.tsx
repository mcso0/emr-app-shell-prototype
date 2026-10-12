import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { ModuleSidePanelContext } from "./module-side-panel-context";
import { CustomerSidePanel } from "@/features/customer/module";
import { useCustomerStore } from "@/features/customer/store";
import { HospitalAdminSidePanel } from "@/features/hospital-admin/module";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useLayoutStore } from "@/stores/layout-store";

type Args = { title: string; kind: "customer" | "hospital-admin" };
function EmrModuleListSidePanelExample({ title, kind }: Args) {
  const open = useLayoutStore(state => state.modulePanelOpen);
  const [receipt, setReceipt] = useState("");
  // The actual caller suppresses its remote background read for the current module.
  return <div className="h-[600px] w-[288px]">
    <ModuleSidePanelContext.Provider value={{ moduleId: kind, ownerId: kind, isCurrentModule: true, visible: true, floating: false,
      pathname: `/w/storybook-emr/${kind}`, search: "", onToggle: () => useLayoutStore.getState().setModulePanelOpen(!open),
      onDateChange: href => setReceipt(href), onNavigate: href => setReceipt(href) }}>
      {open ? kind === "customer" ? <CustomerSidePanel workspaceId="storybook-emr" moduleId={kind} moduleLabel={title} />
        : <HospitalAdminSidePanel workspaceId="storybook-emr" moduleId={kind} moduleLabel={title} />
        : <Button onClick={() => useLayoutStore.getState().setModulePanelOpen(true)}>목록 다시 열기</Button>}
    </ModuleSidePanelContext.Provider>
    {receipt ? <output role="status">{receipt}</output> : null}
  </div>;
}
const meta = {
  title: "Design System/EMR/EmrModuleListSidePanel", component: EmrModuleListSidePanelExample, tags: ["autodocs"],
  args: { title: "고객 관리", kind: "customer" }, argTypes: { title: { control: "text" }, kind: { control: false, table: { disable: true } } },
  beforeEach: () => {
    const customer = useCustomerStore.getState(); const hospital = useHospitalAdminStore.getState();
    const profiles = usePatientProfileStore.getState(); const layout = useLayoutStore.getState();
    useCustomerStore.setState({ listMode: "patient", archiveCount: 0, archiveCountLoading: false, profileReadState: { status: "ready", workspaceId: "storybook-emr" } });
    useHospitalAdminStore.setState({ activeSection: "settings", settingsDirty: false, pendingSection: null, orders: [], catalogWorkspaceId: "storybook-emr", catalogReadStatus: "ready" });
    usePatientProfileStore.setState({ patients: [], guardians: [], patientGuardians: [] });
    useLayoutStore.setState({ modulePanelOpen: true });
    return () => { useCustomerStore.setState(customer); useHospitalAdminStore.setState(hospital); usePatientProfileStore.setState(profiles); useLayoutStore.setState(layout); };
  },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/w/storybook-emr/customer", segments: [["workspaceId", "storybook-emr"]], query: {} } }, docs: {
      story: { inline: false, height: "740px" }, description: { component: "기본 예시는 실제 CustomerSidePanel입니다. GroupedNavigation은 실제 HospitalAdminSidePanel입니다. EmrModuleListSidePanel, 실제 private menu factories·아이콘·미구현 disabled 항목·탐색 store·접기 동작을 그대로 사용합니다. current-module Context로 배경 API 읽기를 끄고 메모리 store에 빈 합성 목록을 넣습니다. 모든 store는 beforeEach cleanup에서 복원합니다. Next.js 탐색은 Storybook mock입니다." } } },
  render: args => <EmrModuleListSidePanelExample {...args} />,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    getRouter().push.mockClear();
    const guardian = canvas.getByTestId("customer-side-panel-guardian"); guardian.focus();
    await userEvent.keyboard("{Enter}"); await expect(guardian).toHaveAttribute("aria-pressed", "true");
    await expect(getRouter().push).not.toHaveBeenCalled();
    await expect(canvas.getByTestId("customer-side-panel-patient")).toHaveAttribute("aria-pressed", "false");
    const disabled = canvas.getByRole("button", { name: /스케줄 관리/ }); await expect(disabled).toBeDisabled();
    await userEvent.click(disabled); await expect(guardian).toHaveAttribute("aria-pressed", "true");
    const section = canvas.getByRole("button", { name: /보호자\/동물 관리/ });
    await userEvent.click(section); await expect(section).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(section); await expect(section).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: /사이드 패널 접기/ }));
    await expect(canvas.getByRole("button", { name: "목록 다시 열기" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "목록 다시 열기" }));
    await expect(canvas.getByTestId("customer-side-panel-guardian")).toHaveAttribute("aria-pressed", "true");
  },
};
export const GroupedNavigation: Story = {
  args: { title: "병원관리", kind: "hospital-admin" },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: "/w/storybook-emr/hospital-admin", segments: [["workspaceId", "storybook-emr"]], query: { section: "settings" } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("병원 설정", { exact: true })).toBeVisible();
    await expect(canvas.getByText("조직 및 접근", { exact: true })).toBeVisible();
    getRouter().push.mockClear();
    const contact = canvas.getByRole("button", { name: "연락처 및 채널" });
    await userEvent.click(contact); await waitFor(async () => { await expect(contact).toHaveAttribute("aria-pressed", "true"); });
    await expect(getRouter().push).toHaveBeenCalledWith("/w/storybook-emr/hospital-admin?section=settings-contact");
    await expect(canvas.getByRole("button", { name: /프린터 설정/ })).toBeDisabled();
    const orders = canvas.getByTestId("hospital-admin-menu-order-management");
    await userEvent.click(orders); await expect(orders).toHaveAttribute("aria-expanded", "false");
    orders.focus(); await userEvent.keyboard("{Enter}"); await expect(orders).toHaveAttribute("aria-expanded", "true");
  },
};
