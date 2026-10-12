import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { useLayoutStore } from "@/stores/layout-store";
import { useCustomerStore } from "../store";
import { CustomerDataTable } from "./customer-data-table";
import { createCustomerPatientColumns, createCustomerGuardianColumns, type CustomerTableColumnDef } from "./customer-table-columns";
import { getCustomerPatientRows, getCustomerGuardianRows } from "../data";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

type SyntheticCustomerRow = {
  id: string;
  name: string;
  category: string;
  searchText: string;
};

const rows: SyntheticCustomerRow[] = [
  { id: "synthetic-z", name: "합성 Z", category: "분류 A", searchText: "합성 z 분류 a" },
  { id: "synthetic-a", name: "합성 A", category: "분류 B", searchText: "합성 a 분류 b" },
  { id: "synthetic-m", name: "합성 M", category: "분류 A", searchText: "합성 m 분류 a" },
];

const columns: CustomerTableColumnDef<SyntheticCustomerRow>[] = [
  { id: "name", accessorKey: "name", enableSorting: true, sortingFn: "alphanumeric", size: 220, meta: { label: "합성 이름", required: true, headerInteraction: "sortable", textMode: "one-line" } },
  { id: "category", accessorKey: "category", enableSorting: true, size: 180, meta: { label: "합성 분류", headerInteraction: "sortable", filterOptions: [{ label: "분류 A", value: "분류 A" }, { label: "분류 B", value: "분류 B" }], filterValues: (row) => [row.category] } },
];

type CustomerTableExampleArgs = ComponentProps<typeof CustomerDataTable<SyntheticCustomerRow>>;

function CustomerTableExample(args: CustomerTableExampleArgs) {
  const [opened, setOpened] = useState("없음");
  const [retries, setRetries] = useState(0);
  return (
    <div className="flex h-[620px] min-w-0 flex-col">
      <CustomerDataTable {...args} onOpenRow={(row) => setOpened(row.name)} onRetry={() => setRetries((count) => count + 1)} />
      <output className="p-2 text-sm" aria-label="합성 고객 표 결과">열기: {opened} · 재시도: {retries}</output>
    </div>
  );
}

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

function ActualCustomerList({ guardian = false, empty = false, loading = false, readStatus = "ready" }: { guardian?: boolean; empty?: boolean; loading?: boolean; readStatus?: CustomerTableExampleArgs["readStatus"] }) {
  const [opened, setOpened] = useState<{ id: string; name: string } | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [retries, setRetries] = useState(0);
  const retry = () => { setRetries((count) => count + 1); setRecovered(true); };
  const state = recovered ? "ready" : readStatus;
  const noRows = !recovered && (empty || loading || state !== "ready");
  return <div className="flex h-[620px] min-w-0 flex-col">
    {guardian ? <CustomerDataTable
      columns={guardianColumns} rows={noRows ? [] : guardianRows} title="보호자" testId="customer-guardian-table"
      emptyActionLabel="신규 보호자" emptyLabel="보호자 정보가 없습니다."
      getRowLabel={(row) => row.name} isActiveRow={(row) => opened?.id === row.id}
      onOpenRow={setOpened} onRetry={retry} loading={!recovered && loading} readStatus={state}
      pinnedIdentityColumnId="name" rowTestId={(row) => `customer-guardian-row-${row.id}`}
    /> : <CustomerDataTable
      columns={patientColumns} rows={noRows ? [] : patientRows} title="동물" testId="customer-patient-table"
      emptyActionLabel="신규 동물" emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name} isActiveRow={(row) => opened?.id === row.id}
      onOpenRow={setOpened} onRetry={retry} loading={!recovered && loading} readStatus={state}
      pinnedIdentityColumnId="name" rowTestId={(row) => `customer-patient-row-${row.id}`}
    />}
    <output className="p-2 text-sm" aria-label="실제 고객 구성 검증 결과">열기: {opened?.name ?? "없음"} · 재시도: {retries}</output>
  </div>;
}

const meta = {
  title: "Features/Customer/Customer Data Table",
  component: CustomerTableExample,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: { story: { inline: false, height: "660px" }, description: { component: "Patient List와 Guardian List는 실제 앱의 row mapper와 column factory를 사용한 대표 화면입니다. Empty·Loading·Denied·Read Error도 실제 동물 목록의 열과 문구를 사용합니다. Search Sort And Selection·No Search Results는 이름·분류 2열의 공통 동작 검사이며 실제 열 구성은 아닙니다. Storybook 전용 주소 검색 모듈이 외부 스크립트와 팝업 대신 합성 주소를 제공합니다. 예제 beforeEach는 등록 lookup과 등록 endpoint를 503 합성 응답으로 차단합니다. 실제 CustomerDataTable을 그대로 사용하므로 등록 버튼을 교체하거나 비활성화하지 않았습니다. 표는 합성 행을 검색·정렬·선택합니다. 행 열기는 로컬 선택을 바꾸고 Read Error의 재시도는 합성 목록으로 복구합니다. query/layout singleton은 예제 종료 시 복원합니다. 현재 페이지 API는 없고 footer는 1/1과 비활성 이전·다음 버튼입니다. 서버 권한·등록·실제 고객 데이터 검증은 포함하지 않습니다." } },
  },
  args: {
    rows, columns, title: "합성 고객", testId: "synthetic-customer-table",
    emptyLabel: "등록된 합성 고객이 없습니다.", emptyActionLabel: "합성 등록 진입",
    getRowLabel: (row) => row.name,
    isActiveRow: () => false,
    onOpenRow: () => undefined,
    rowTestId: (row) => `customer-story-row-${row.id}`,
    pinnedIdentityColumnId: "name", readStatus: "ready", loading: false,
  },
  argTypes: {
    rows: { control: "object", description: "실제 rows prop의 합성 목록입니다." },
    columns: { control: false, description: "이름 정렬과 분류 필터를 제공하는 고정 실제 ColumnDef입니다." },
    loading: { control: "boolean", description: "행이 비어 있을 때 초기 로딩 UI를 표시합니다." },
    readStatus: { control: "radio", options: ["ready", "denied", "error"], description: "실제 조회 상태 표시 prop입니다. 권한 정책은 검증하지 않습니다." },
    onOpenRow: { control: false, description: "예제 render가 합성 행 이름을 output에 기록합니다." },
    onRetry: { control: false, description: "예제 render가 재시도 카운트만 올립니다." },
  },
  beforeEach: () => {
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
  },
  render: (args) => <CustomerTableExample key={`${args.readStatus}:${args.loading}`} {...args} />,
} satisfies Meta<typeof CustomerDataTable<SyntheticCustomerRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

async function waitForTableState(condition: () => boolean, message: string) {
  await waitFor(() => { if (!condition()) throw new Error(message); });
}

async function setSearch(canvasElement: HTMLElement, value: string) {
  const input = canvasElement.querySelector<HTMLInputElement>('input[aria-label="고객관리 검색"]');
  if (!input) throw new Error("The actual customer table must expose its named search input.");
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
}
const callerControls = Object.fromEntries(["rows", "columns", "title", "testId", "emptyLabel", "emptyActionLabel", "getRowLabel", "isActiveRow", "rowTestId", "pinnedIdentityColumnId"].map((key) => [key, { control: false }]));

async function assertActualCustomerList(canvasElement: HTMLElement, guardian: boolean) {
  const ids = Array.from(canvasElement.querySelectorAll('thead th[data-column-id]')).map((cell) => cell.getAttribute("data-column-id"));
  await expect(ids.filter((id) => id !== "select" && id !== "actions")).toEqual(guardian
    ? ["name", "mobilePhone", "patientSummary", "consentSummary", "recentCs", "recentWork", "registeredAt"]
    : ["name", "patientNo", "breed", "sex", "age", "workBadges", "guardianNames", "phone", "messageConsent", "registeredAt"]);
  const row = canvasElement.querySelector<HTMLElement>('tbody tr[data-emr-data-table-row="true"]')!;
  await userEvent.click(row);
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(canvasElement.querySelector('[aria-label="실제 고객 구성 검증 결과"]')).toHaveTextContent(guardian ? "합성 보호자 A" : "합성 동물 A");
  const header = canvasElement.querySelector<HTMLElement>('th[data-column-id="name"]')!;
  await expect(header).toHaveAttribute("data-emr-column-pinned", "left");
  await expect(header.getBoundingClientRect().width).toBe(184);
  await setSearch(canvasElement, guardian ? "합성 보호자 B" : "SYN-002");
  await waitFor(() => expect(canvasElement.querySelectorAll('tbody tr[data-emr-data-table-row="true"]')).toHaveLength(1));
  await setSearch(canvasElement, "");
  await waitFor(() => expect(canvasElement.querySelectorAll('tbody tr[data-emr-data-table-row="true"]')).toHaveLength(2));
}

export const PatientList: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  parameters: { docs: { description: { story: "origin/main PatientTable과 같은 10개 열·합성 row mapper·184px 동물명 고정을 사용합니다. 행 열기는 로컬 활성 행만 바꾸며 실제 프로필/등록/서버 동작은 포함하지 않습니다." } } },
  play: async ({ canvasElement }) => assertActualCustomerList(canvasElement, false),
};

export const GuardianList: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} guardian loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  parameters: { docs: { description: { story: "origin/main GuardianTable과 같은 7개 열과 합성 row mapper를 사용합니다. 연결 동물·동의 상태·최근 CS·발송/업무를 실제 열 renderer로 표시합니다. 원격 조회/통신은 실행하지 않습니다." } } },
  play: async ({ canvasElement }) => assertActualCustomerList(canvasElement, true),
};

export const SearchSortAndSelection: Story = {
  parameters: { docs: { description: { story: "실제 표 검색·정렬·선택 해제·행 열기 콜백을 검증합니다. 복합 필터 builder와 등록 동작은 이 play에서 실행하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    await canvasElement.ownerDocument.fonts.ready;
    const frame = canvasElement.firstElementChild as HTMLElement;
    const previousWidth = frame.style.width;
    const textLeft = (element: Element) => {
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    };
    try {
      for (const width of [1440, 720]) {
        frame.style.width = `${width}px`;
        await waitFor(() => {
          for (const id of ["name", "category"]) {
            const header = canvasElement.querySelector<HTMLElement>(`th[data-column-id="${id}"]`)!;
            const button = header.querySelector<HTMLButtonElement>('button[data-row-interactive="true"]')!;
            const label = button.querySelector("span")!;
            const body = canvasElement.querySelector<HTMLElement>(`tbody tr:first-child td[data-column-id="${id}"] .emr-data-table-cell-content`)!;
            expect(Math.abs(textLeft(label) - textLeft(body))).toBeLessThan(1);
            expect(getComputedStyle(button).paddingInlineStart).toBe("8px");
            expect(getComputedStyle(button).paddingInlineEnd).toBe("8px");
            expect(getComputedStyle(label).paddingInlineStart).toBe("2px");
            expect(getComputedStyle(label).paddingInlineEnd).toBe("2px");
            const inset = id === "name" ? 10 : 20;
            expect(Math.abs(textLeft(label) - header.getBoundingClientRect().left - inset)).toBeLessThan(1);
            if (id === "category") {
              expect(Math.abs(button.getBoundingClientRect().left - header.getBoundingClientRect().left - 10)).toBeLessThan(1);
              expect(getComputedStyle(body).marginInlineStart).toBe("10px");
              expect(getComputedStyle(body).paddingInlineStart).toBe("10px");
            }
            expect(button.getBoundingClientRect().left).toBeGreaterThanOrEqual(header.getBoundingClientRect().left);
          }
        });
      }
    } finally {
      frame.style.width = previousWidth;
    }
    const dataRows = () => canvasElement.querySelectorAll<HTMLElement>('[data-testid^="customer-story-row-"]');
    await setSearch(canvasElement, "합성 m");
    await waitForTableState(() => dataRows().length === 1 && dataRows()[0]?.textContent?.includes("합성 M") === true, "Search must filter the actual table to the matching synthetic row.");
    await setSearch(canvasElement, "");
    await waitForTableState(() => dataRows().length === 3, "Clearing the query must restore the synthetic rows.");
    const sort = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="합성 이름 오름차순 정렬"]');
    if (!sort) throw new Error("The name column must expose its ascending sort action.");
    await userEvent.click(sort);
    await waitForTableState(() => dataRows()[0]?.textContent?.includes("합성 A") === true && canvasElement.querySelector('[data-column-id="name"]')?.getAttribute("aria-sort") === "ascending", "Sorting must reorder rows and expose the ascending header state.");
    const checkbox = canvasElement.querySelector<HTMLElement>('[role="checkbox"][aria-label="합성 A 선택"]');
    if (!checkbox) throw new Error("The synthetic row selection control is missing.");
    await userEvent.click(checkbox);
    await waitForTableState(() => checkbox.getAttribute("aria-checked") === "true" && canvasElement.textContent?.includes("선택한 합성 고객 1개") === true, "Row selection must update both checked state and the selection toolbar.");
    const clear = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "선택 해제");
    if (!clear) throw new Error("The selection toolbar must expose clear selection.");
    await userEvent.click(clear);
    await waitForTableState(() => checkbox.getAttribute("aria-checked") === "false" && !canvasElement.textContent?.includes("선택한 합성 고객 1개"), "Clearing selection must remove the toolbar and checked state.");
    await userEvent.click(dataRows()[0]);
    await waitForTableState(() => canvasElement.querySelector('output[aria-label="합성 고객 표 결과"]')?.textContent?.includes("열기: 합성 A") === true, "Opening a row must invoke the inert local callback.");
    const footer = canvasElement.querySelector('[data-testid="customer-table-footer"]');
    const pageButtons = footer?.querySelectorAll<HTMLButtonElement>("button");
    if (!footer?.textContent?.includes("1/1 페이지") || pageButtons?.length !== 2 || Array.from(pageButtons).some((button) => !button.disabled)) {
      throw new Error("The current table has one fixed page and disabled pagination controls.");
    }
  },
};

export const NoSearchResults: Story = {
  parameters: { docs: { description: { story: "검색 결과가 없을 때 실제 조건 초기화 버튼으로 합성 행을 복원합니다. 등록 버튼은 실행하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    await setSearch(canvasElement, "없는 합성 항목");
    await waitForTableState(() => canvasElement.textContent?.includes("조건에 맞는 합성 고객 정보가 없습니다") === true, "An unmatched search must show the no-filter-results state.");
    const reset = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "조건 초기화");
    if (!reset) throw new Error("The empty search result must offer filter reset.");
    await userEvent.click(reset);
    await waitForTableState(() => canvasElement.querySelectorAll('[data-testid^="customer-story-row-"]').length === 3, "Resetting conditions must restore all synthetic rows.");
  },
};

export const Empty: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} empty loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  args: { rows: [] },
  parameters: { docs: { description: { story: "실제 no-data 상태입니다. 등록 진입은 합성 실패 응답으로 격리하며 실제 등록 흐름을 검증하지 않습니다." } } },
};

export const Loading: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  args: { rows: [], loading: true },
  parameters: { docs: { description: { story: "초기 로딩 스켈레톤과 -/- 페이지를 표시합니다. 실제 데이터를 조회하지 않습니다." } } },
};

export const Denied: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  args: { rows: [], readStatus: "denied" },
  parameters: { docs: { description: { story: "readStatus=denied의 표시 경계입니다. 실제 사용자 권한을 바꾸거나 검사하지 않습니다." } } },
};

export const ReadError: Story = {
  render: (args) => <ActualCustomerList key={`${args.readStatus}:${args.loading}`} loading={args.loading} readStatus={args.readStatus} />,
  argTypes: callerControls,
  args: { rows: [], readStatus: "error" },
  parameters: { docs: { description: { story: "실제 동물 목록의 조회 실패 문구를 표시하고 다시 시도로 합성 동물 2행을 복구합니다. 등록 관련 요청은 예제 fetch fixture가 503으로 차단하고 외부 주소 검색은 Storybook 전용 합성 모듈로 대체합니다." } } },
  play: async ({ canvasElement }) => {
    const retry = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "다시 시도");
    if (!retry || !canvasElement.querySelector('[data-testid="customer-patient-table-read-error"]')) throw new Error("The table read-error state must offer the supplied retry callback.");
    await userEvent.click(retry);
    await waitForTableState(() => canvasElement.querySelector('output[aria-label="실제 고객 구성 검증 결과"]')?.textContent?.includes("재시도: 1") === true && canvasElement.querySelectorAll('tbody tr[data-emr-data-table-row="true"]').length === 2, "Retry must update the local callback result once.");
  },
};
