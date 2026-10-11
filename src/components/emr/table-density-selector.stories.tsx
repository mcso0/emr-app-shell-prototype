import { useState } from "react";
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { EmrDataTable } from "./emr-data-table";
import { EmrTableDensitySelector } from "./table-density-selector";
import type { EmrTableDensity } from "./table-density";
import { CustomerDataTable } from "@/features/customer/components/customer-data-table";
import { createCustomerPatientColumns } from "@/features/customer/components/customer-table-columns";
import { getCustomerPatientRows } from "@/features/customer/data";
import { useCustomerStore } from "@/features/customer/store";
import { useLayoutStore } from "@/stores/layout-store";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

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
const patientRows = getCustomerPatientRows(customerSource);

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


function CustomerDensityExample() {
  const [opened, setOpened] = useState<string | null>(null);
  return <div className="flex h-[620px] min-w-0 flex-col">
    <CustomerDataTable columns={patientColumns} rows={patientRows} title="동물"
      testId="density-customer-table" emptyActionLabel="신규 동물" emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name} isActiveRow={(row) => opened === row.id}
      onOpenRow={(row) => setOpened(row.id)} onRetry={() => undefined}
      loading={false} readStatus="ready" pinnedIdentityColumnId="name"
      rowTestId={(row) => `density-customer-row-${row.id}`} />
  </div>;
}

type Surface = "lab" | "chart" | "imaging";
const triggerClasses = {
  // Exact caller styles from lab-imaging/module.tsx:2233 and chart/module.tsx:14792.
  lab: "h-7 min-h-7 w-[82px] rounded-[8px] px-2 py-1 text-xs leading-4 tracking-[0.3px] [&>svg]:!size-3",
  chart: "h-[var(--clair-control-height-sm)] min-h-[var(--clair-control-height-sm)] px-2 py-0 text-xs",
  imaging: undefined,
};
const surfaceNames = { lab: "검사 결과의 작은 버튼", chart: "차트 Order의 작은 버튼", imaging: "영상 Order의 기본 버튼" };

// Compare real caller trigger styles with the shared production table renderer.
// This intentionally does not claim to mount the private LabResultDataTable/ChartOrderTable.
function CallerTriggerExample({ surface }: { surface: Surface }) {
  const [density, setDensity] = useState<EmrTableDensity>(surface === "imaging" ? "comfortable" : "standard");
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: patientRows, columns: patientColumns,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getRowId: (row) => row.id });
  return <section className="grid min-w-0 gap-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{surfaceNames[surface]}</h2>
      <EmrTableDensitySelector value={density} onValueChange={setDensity} className={triggerClasses[surface]} />
    </div>
    <p className="text-sm text-muted-foreground">버튼과 행 높이 비교용 합성 고객 데이터 · 검사·차트 전체 화면 아님</p>
    <EmrDataTable aria-label="버튼 간격 비교 테이블" className="table-fixed" density={density}
      table={table} viewportMode="content" getRowProps={(row) => ({ className: undefined, "data-testid": `density-comparison-row-${row.id}` })} />
  </section>;
}

const meta = {
  title: "Design System/EMR/EmrTableDensitySelector",
  component: CustomerDensityExample,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      story: { inline: false, height: "860px" }, description: { component: "Default는 origin/main의 실제 CustomerDataTable과 고객 행 변환·열 정의를 재사용합니다. 좁은/기본/넓은 간격을 고르면 실제 DOM 행 높이가 36/40/52px로 바뀝니다. Lab Compact와 Chart Compact는 실제 호출자의 작은 버튼 className을 공통 EmrDataTable에 연결한 비교 예시입니다. Imaging Standard는 실제 영상 호출자의 기본 버튼과 초기 넓은 간격을 유지합니다. 비교 표는 동일한 합성 고객 행과 실제 고객 열 정의를 사용하며, 비공개 검사·차트·영상 테이블 전체를 재현하지 않습니다. 각 예시의 초기 상태와 라벨은 실제 호출자 설정으로 고정하여 가상 Controls를 제거했습니다. 실제 조회·등록·저장·경로 이동은 하지 않습니다." } },
  },
  render: () => <CustomerDensityExample />,
} satisfies Meta<typeof CustomerDensityExample>;
export default meta;
type Story = StoryObj<typeof meta>;

async function verifyDensity(canvasElement: HTMLElement, surface?: Surface) {
  const canvas = within(canvasElement);
  const rows = () => Array.from(canvasElement.querySelectorAll<HTMLElement>(surface ? '[data-testid^="density-comparison-row-"]' : '[data-testid^="density-customer-row-"]'));
  const trigger = () => canvas.getByRole("button", { name: /^테이블 보기 밀도:/ });
  const checkRows = async (height: number) => {
    await waitFor(() => {
      expect(rows()).toHaveLength(2);
      for (const row of rows()) expect(row.getBoundingClientRect().height).toBeCloseTo(height, 0);
    });
  };
  await checkRows(surface === "imaging" ? 52 : 40);
  if (surface === "lab") {
    expect(trigger().getBoundingClientRect().height).toBe(28);
    expect(trigger().getBoundingClientRect().width).toBe(82);
    expect(trigger().querySelector("svg")!.getBoundingClientRect().width).toBe(12);
  } else if (surface === "chart") {
    const tokenHeight = parseFloat(getComputedStyle(trigger()).getPropertyValue("--clair-control-height-sm"));
    expect(trigger().getBoundingClientRect().height).toBe(tokenHeight);
    expect(getComputedStyle(trigger()).fontSize).toBe("12px");
    expect(getComputedStyle(trigger()).paddingLeft).toBe("8px");
  } else expect(trigger().getBoundingClientRect().height).toBe(32);

  for (const [label, height, key] of [["좁은 간격", 36, ""], ["넓은 간격", 52, "{Enter}"], ["기본 간격", 40, " "]] as const) {
    if (key) { trigger().focus(); await userEvent.keyboard(key); }
    else await userEvent.click(trigger());
    await waitFor(() => expect(trigger()).toHaveAttribute("aria-expanded", "true"));
    const menu = canvasElement.ownerDocument.getElementById(trigger().getAttribute("aria-controls")!)!;
    await waitFor(() => expect(menu).toBeVisible());
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(3);
    const option = within(menu).getByRole("menuitemradio", { name: label });
    if (key) { option.focus(); await userEvent.keyboard("{Enter}"); }
    else await userEvent.click(option);
    await waitFor(() => expect(trigger()).toHaveAttribute("aria-label", `테이블 보기 밀도: ${label}`));
    // Radio selection keeps the production menu open; Escape dismisses it.
    await expect(option).toHaveAttribute("aria-checked", "true");
    await checkRows(height);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger()).toHaveAttribute("aria-expanded", "false"));
  }
  await userEvent.click(trigger());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(trigger()).toHaveFocus());
  await checkRows(40);
}

export const Default: Story = {
  beforeEach: prepareCustomerFixture,
  parameters: { docs: { description: { story: "실제 고객 목록의 헤더·검색·필터·열 설정·고정 열·행 선택·페이지 구성을 재사용합니다. 세 가지 간격을 선택해 실제 행 높이 36/40/52px 변화를 확인합니다. 합성 행 상세는 로컬 선택만 기록합니다." } } },
  play: async ({ canvasElement }) => verifyDensity(canvasElement),
};
export const LabCompact: Story = {
  render: () => <CallerTriggerExample surface="lab" />,
  parameters: { docs: { description: { story: "검사·영상 모듈의 검사 결과 호출자와 같은 82×28px 버튼, 12px 아이콘입니다. 공통 EmrDataTable과 합성 고객 행을 연결한 밀도 비교이며 검사 결과 입력 표 전체는 아닙니다." } } },
  play: async ({ canvasElement }) => verifyDensity(canvasElement, "lab"),
};
export const ChartCompact: Story = {
  render: () => <CallerTriggerExample surface="chart" />,
  parameters: { docs: { description: { story: "차트 Order 호출자의 clair-control-height-sm 높이·12px 글자·좌우 8px 여백을 그대로 적용합니다. 합성 고객 행으로 밀도 변화를 비교하며 차트 Order 전체 기능은 포함하지 않습니다." } } },
  play: async ({ canvasElement }) => verifyDensity(canvasElement, "chart"),
};
export const ImagingStandard: Story = {
  render: () => <CallerTriggerExample surface="imaging" />,
  parameters: { docs: { description: { story: "같은 검사·영상 모듈에서도 영상 Order는 작은 버튼을 쓰지 않습니다. 실제 호출자처럼 기본 32px 버튼과 초기 comfortable을 유지하고 합성 고객 행으로 간격을 비교합니다." } } },
  play: async ({ canvasElement }) => verifyDensity(canvasElement, "imaging"),
};
