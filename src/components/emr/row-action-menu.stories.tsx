import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CustomerDataTable } from "@/features/customer/components/customer-data-table";
import { createCustomerPatientColumns, createCustomerGuardianColumns } from "@/features/customer/components/customer-table-columns";
import { getCustomerPatientRows, getCustomerGuardianRows } from "@/features/customer/data";
import { useCustomerStore } from "@/features/customer/store";
import { useLayoutStore } from "@/stores/layout-store";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";
import { ProfileAssignedWorkCard, WorkNavigationDialog, type ProfileAssignedWorkItem } from "@/features/staff/components/profile-side-panel-v2-work";

// Use the same row mappers and column factories as customer/module.tsx.
const syntheticGuardians: Guardian[] = [
  { id: "story-guardian-a", workspaceId: "story-customer", name: "합성 보호자 A", mobilePhone: "010-0000-0000", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "story-guardian-b", workspaceId: "story-customer", name: "합성 보호자 B", mobilePhone: "010-0000-0001", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" },
];
const syntheticPatients: Patient[] = [
  { id: "story-patient-a", workspaceId: "story-customer", patientNo: "SYN-001", name: "합성 동물 A", species: "dog", breed: "말티즈", estimatedAgeText: "3세", sex: "male", neutered: true, status: "active", handlingCautionLocked: false, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "story-patient-b", workspaceId: "story-customer", patientNo: "SYN-002", name: "합성 동물 B", species: "cat", breed: "코리안 쇼트헤어", estimatedAgeText: "5세", sex: "female", neutered: true, status: "active", handlingCautionLocked: false, createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" },
];
const syntheticLinks: PatientGuardian[] = syntheticPatients.map((patient, index) => ({
  id: `story-link-${index}`, patientId: patient.id, guardianId: syntheticGuardians[index].id,
  isPrimary: true, canReceiveMessages: index === 0, createdAt: "2026-10-01T00:00:00Z",
}));
const customerSource = { guardians: syntheticGuardians, patients: syntheticPatients, patientGuardians: syntheticLinks, workspaceId: "story-customer" };
const patientColumns = createCustomerPatientColumns();
const guardianColumns = createCustomerGuardianColumns();
const patientRows = getCustomerPatientRows(customerSource);
const guardianRows = getCustomerGuardianRows(customerSource);

function CustomerMenuExample({ guardian = false }: { guardian?: boolean }) {
  const [opened, setOpened] = useState<{ id: string; name: string } | null>(null);
  return <div className="flex h-[620px] min-w-0 flex-col">
    {guardian ? <CustomerDataTable
      columns={guardianColumns} rows={guardianRows} title="보호자" testId="customer-guardian-table"
      emptyActionLabel="신규 보호자" emptyLabel="보호자 정보가 없습니다."
      getRowLabel={(row) => row.name} isActiveRow={(row) => opened?.id === row.id}
      onOpenRow={setOpened} onRetry={() => undefined} loading={false} readStatus="ready"
      pinnedIdentityColumnId="name" rowTestId={(row) => `customer-guardian-row-${row.id}`}
    /> : <CustomerDataTable
      columns={patientColumns} rows={patientRows} title="동물" testId="customer-patient-table"
      emptyActionLabel="신규 동물" emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name} isActiveRow={(row) => opened?.id === row.id}
      onOpenRow={setOpened} onRetry={() => undefined} loading={false} readStatus="ready"
      pinnedIdentityColumnId="name" rowTestId={(row) => `customer-patient-row-${row.id}`}
    />}
    <output className="p-2 text-sm" aria-label="실제 고객 구성 검증 결과">열기: {opened?.name ?? "없음"}</output>
  </div>;
}

function prepareCustomerFixture() {
    const previousQuery = useCustomerStore.getState().query;
    const previousLayout = useLayoutStore.getState();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (/^\/api\/workspaces\/[^/]+\/reception\/patient-guardian-lookup$/.test(url.pathname)) {
        return Response.json({ ok: false, error: "db_read_failed" }, { status: 503 });
      }
      if (/^\/api\/workspaces\/[^/]+\/reception\/patient-guardian-registration$/.test(url.pathname)) {
        return Response.json({ ok: false, status: 503, error: "db_write_failed" }, { status: 503 });
      }
      return originalFetch(input, init);
    };
    useCustomerStore.setState({ query: "" });
    return () => {
      globalThis.fetch = originalFetch;
      useCustomerStore.setState({ query: previousQuery });
      useLayoutStore.setState(previousLayout, true);
    };
}

function PatientMenuExample() {
  return <CustomerMenuExample />;
}

function StaffWorkMenuExample({ unavailable = false }: { unavailable?: boolean }) {
  const [selected, setSelected] = useState<ProfileAssignedWorkItem | null>(null);
  const [result, setResult] = useState("없음");
  const item: ProfileAssignedWorkItem = {
    id: "story-row-menu-work", category: "lab", categoryLabel: "검사",
    status: "in_progress", statusLabel: "진행 중", title: "합성 검사 업무",
    subtitle: "혈액 검사", patientName: "합성 동물 A", guardianName: "합성 보호자 A",
    requestedByName: "합성 수의사", requestedAtLabel: "오전 10:20 요청",
    href: unavailable ? null : "/lab", navigationAvailable: !unavailable,
  };
  return <div className="grid w-[348px] max-w-full gap-3">
    <ProfileAssignedWorkCard item={item} onRequestNavigation={setSelected} />
    <WorkNavigationDialog item={selected} open={Boolean(selected)}
      onOpenChange={(open) => !open && setSelected(null)}
      onConfirm={(work) => { setSelected(null); setResult(work.id); }}
    />
    <output aria-label="업무 이동 검증 결과">이동 요청: {result}</output>
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrRowActionMenu",
  component: PatientMenuExample,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      story: { inline: false, height: "740px" }, description: { component: "실제 origin/main의 CustomerDataTable과 ProfileAssignedWorkCard를 재사용합니다. Default와 Non Destructive Only는 동물·보호자 목록의 행 메뉴, Compact Work와 Compact Unavailable은 직원 업무 카드의 compact 메뉴입니다. 기존 샘플 복사/제거 항목과 가상 Controls는 제거했습니다. 각 화면이 실제 메뉴 항목·크기·비활성 조건을 정합니다. 데이터는 합성이며 상세 열기와 최종 업무 이동은 로컬 결과만 기록합니다. 등록 요청은 합성 실패로 차단하며 실제 조회·발송·저장·복제·삭제·경로 이동은 실행하지 않습니다. 병원 일정·Order 세트·멤버십 등 다른 호출자의 전체 흐름까지 재현한 것은 아닙니다." } },
  },
  render: () => <PatientMenuExample />,
} satisfies Meta<typeof PatientMenuExample>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openMenu(canvasElement: HTMLElement, label: string, key?: string) {
  const trigger = within(canvasElement).getByRole("button", { name: label });
  if (key) { trigger.focus(); await userEvent.keyboard(key); }
  else await userEvent.click(trigger);
  await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
  const menu = canvasElement.ownerDocument.getElementById(trigger.getAttribute("aria-controls")!)!;
  await waitFor(() => expect(menu).toBeVisible());
  return { trigger, menu };
}

async function verifyCustomerMenu(canvasElement: HTMLElement, guardian: boolean) {
  const canvas = within(canvasElement);
  const label = guardian ? "합성 보호자 A" : "합성 동물 A";
  const result = canvas.getByLabelText("실제 고객 구성 검증 결과");
  const row = canvas.getByTestId(guardian ? "customer-guardian-row-story-guardian-a" : "customer-patient-row-story-patient-a");
  await userEvent.hover(row);
  let { trigger, menu } = await openMenu(canvasElement, `${label} 행 작업`);
  await expect(result).toHaveTextContent("열기: 없음");
  await expect(trigger.getBoundingClientRect().width).toBe(24);
  await waitFor(() => expect(menu.getBoundingClientRect().width).toBe(224));
  await expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);
  for (const name of ["상세 보기 프로필 drawer 열기", "차트 보러가기 진료/차트 화면 연결 전", "카카오톡 발송 외부 발송 미연동"]) {
    await expect(within(menu).getByRole("menuitem", { name })).not.toHaveAttribute("aria-disabled", "true");
  }
  await userEvent.click(within(menu).getByRole("menuitem", { name: /차트 보러가기/ }));
  await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  await expect(canvas.getByTestId("customer-row-action-feedback")).toHaveTextContent("차트 보기는 아직 직접 연결되지 않았습니다");
  await expect(result).toHaveTextContent("열기: 없음");
  await userEvent.click(canvas.getByRole("button", { name: "확인" }));
  ({ trigger, menu } = await openMenu(canvasElement, `${label} 행 작업`, "{Enter}"));
  await userEvent.click(within(menu).getByRole("menuitem", { name: /카카오톡 발송/ }));
  await expect(canvas.getByTestId("customer-row-action-feedback")).toHaveTextContent("카카오톡 발송은 아직 연결되지 않았습니다");
  await expect(result).toHaveTextContent("열기: 없음");
  await userEvent.click(canvas.getByRole("button", { name: "확인" }));
  ({ trigger, menu } = await openMenu(canvasElement, `${label} 행 작업`, " "));
  const first = within(menu).getByRole("menuitem", { name: /상세 보기/ });
  first.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(result).toHaveTextContent(`열기: ${label}`));
  await expect(row).toHaveAttribute("aria-current", "true");
  ({ trigger } = await openMenu(canvasElement, `${label} 행 작업`));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await openMenu(canvasElement, `${label} 행 작업`);
}

async function verifyWorkMenu(canvasElement: HTMLElement, unavailable: boolean) {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  const result = canvas.getByLabelText("업무 이동 검증 결과");
  let { trigger, menu } = await openMenu(canvasElement, "합성 검사 업무 더보기", "{Enter}");
  const action = within(menu).getByRole("menuitem", { name: "업무 보러가기" });
  await expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
  await expect(menu.querySelector('[role="separator"]')).toBeNull();
  await waitFor(() => expect(menu.getBoundingClientRect().width).toBe(160));
  await expect(action.getBoundingClientRect().height).toBe(32);
  if (unavailable) {
    await expect(action).toHaveAttribute("aria-disabled", "true");
    await expect(getComputedStyle(action).pointerEvents).toBe("none");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(result).toHaveTextContent("이동 요청: 없음");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await openMenu(canvasElement, "합성 검사 업무 더보기");
    return;
  }
  action.focus();
  await userEvent.keyboard("{Enter}");
  let dialog = await body.findByRole("dialog", { name: "업무 화면으로 이동할까요?" });
  await expect(dialog).toHaveTextContent("합성 동물 A · 합성 보호자 A · 합성 검사 업무");
  await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await expect(result).toHaveTextContent("이동 요청: 없음");
  ({ trigger, menu } = await openMenu(canvasElement, "합성 검사 업무 더보기", " "));
  await userEvent.click(within(menu).getByRole("menuitem", { name: "업무 보러가기" }));
  dialog = await body.findByRole("dialog", { name: "업무 화면으로 이동할까요?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "이동" }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await expect(result).toHaveTextContent("이동 요청: story-row-menu-work");
  ({ trigger } = await openMenu(canvasElement, "합성 검사 업무 더보기"));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  await openMenu(canvasElement, "합성 검사 업무 더보기");
}

export const Default: Story = {
  beforeEach: prepareCustomerFixture,
  parameters: { docs: { description: { story: "실제 동물 목록 10열·행 메뉴를 합성 데이터로 표시합니다. 상세 보기/차트 보러가기/카카오톡 발송의 실제 항목과 피드백을 재사용합니다. 상세 프로필 대신 로컬 활성 행만 변경합니다." } } },
  play: async ({ canvasElement }) => verifyCustomerMenu(canvasElement, false),
};
export const NonDestructiveOnly: Story = {
  beforeEach: prepareCustomerFixture,
  render: () => <CustomerMenuExample guardian />,
  parameters: { docs: { description: { story: "기존 ID를 유지한 실제 보호자 목록 7열·행 메뉴입니다. 실제 고객 메뉴에 복제·삭제가 없으므로 가상 destructive 토글은 제거했습니다. 미연동 항목은 실제 앱처럼 비활성화 대신 안내를 표시합니다." } } },
  play: async ({ canvasElement }) => verifyCustomerMenu(canvasElement, true),
};
export const CompactWork: Story = {
  render: () => <StaffWorkMenuExample />,
  parameters: { docs: { description: { story: "실제 직원 배정 업무 카드의 compact 메뉴입니다. 업무 보러가기 선택 시 실제 이동 확인창이 열립니다. 취소는 유지하고 이동은 로컬 결과만 기록하며 경로를 바꾸지 않습니다." } } },
  play: async ({ canvasElement }) => verifyWorkMenu(canvasElement, false),
};
export const CompactUnavailable: Story = {
  render: () => <StaffWorkMenuExample unavailable />,
  parameters: { docs: { description: { story: "실제 카드의 navigationAvailable=false, href=null 조건으로 업무 보러가기가 비활성인 compact 메뉴입니다. 선택해도 확인창과 이동 콜백이 실행되지 않습니다." } } },
  play: async ({ canvasElement }) => verifyWorkMenu(canvasElement, true),
};
