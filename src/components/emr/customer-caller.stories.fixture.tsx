import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { CustomerDataTable } from "@/features/customer/components/customer-data-table";
import { createCustomerPatientColumns } from "@/features/customer/components/customer-table-columns";
import { getCustomerPatientRows } from "@/features/customer/data";
import { useCustomerStore } from "@/features/customer/store";
import { useLayoutStore } from "@/stores/layout-store";
import type { Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

// Shared by two owned stories. Source row mapper, column factory and
// CustomerDataTable own all table and header interactions.
const guardians: Guardian[] = [
  { id: "header-guardian-a", workspaceId: "story-customer", name: "합성 보호자 A", mobilePhone: "010-0000-0000", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "header-guardian-b", workspaceId: "story-customer", name: "합성 보호자 B", mobilePhone: "010-0000-0001", createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" },
];
const patients: Patient[] = [
  { id: "header-patient-a", workspaceId: "story-customer", patientNo: "SYN-001", name: "합성 동물 A", species: "dog", breed: "말티즈", estimatedAgeText: "3세", sex: "male", neutered: true, status: "active", handlingCautionLocked: false, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "header-patient-b", workspaceId: "story-customer", patientNo: "SYN-002", name: "합성 동물 B", species: "cat", breed: "코리안 쇼트헤어", estimatedAgeText: "5세", sex: "female", neutered: true, status: "active", handlingCautionLocked: false, createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" },
];
const patientGuardians: PatientGuardian[] = patients.map((patient, index) => ({ id: `header-link-${index}`, patientId: patient.id, guardianId: guardians[index].id, isPrimary: true, canReceiveMessages: false, createdAt: "2026-10-01T00:00:00Z" }));
const rows = getCustomerPatientRows({ guardians, patients, patientGuardians, workspaceId: "story-customer" });
const columns = createCustomerPatientColumns();
export const customerCallerParameters = { nextjs: { appDirectory: true, navigation: { pathname: "/w/story-customer/customer", segments: [["workspaceId", "story-customer"]] } } };
export function prepareCustomerCaller() {
  const query = useCustomerStore.getState().query, layout = useLayoutStore.getState();
  const previousFetch = globalThis.fetch, previousToasts = new Set(toast.getToasts().map(item => item.id));
  const fixtureFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname.startsWith("/api/")) return Response.json({ ok: false, status: 503, error: "storybook-local-api-block" }, { status: 503 });
    return previousFetch(input, init);
  };
  globalThis.fetch = fixtureFetch; useCustomerStore.setState({ query: "" });
  return () => {
    if (globalThis.fetch === fixtureFetch) globalThis.fetch = previousFetch;
    useCustomerStore.setState({ query }); useLayoutStore.setState(layout, true);
    for (const item of toast.getToasts()) if (!previousToasts.has(item.id)) toast.dismiss(item.id);
  };
}
export function ActualCustomerTable({ loading = false, title = "동물" }: { loading?: boolean; title?: string }) {
  const [opened, setOpened] = useState<{ id: string; name: string } | null>(null);
  return <div className="flex h-[620px] min-w-0 flex-col">
    <CustomerDataTable columns={columns} rows={loading ? [] : rows} title={title} testId="header-customer-table" emptyActionLabel="신규 동물" emptyLabel="동물 정보가 없습니다." getRowLabel={row => row.name} isActiveRow={row => row.id === opened?.id} onOpenRow={setOpened} loading={loading} readStatus="ready" pinnedIdentityColumnId="name" rowTestId={row => `header-customer-row-${row.id}`} />
    <output aria-label="고객 행 열기">{opened?.name ?? "없음"}</output><Toaster />
  </div>;
}
export async function verifyCustomerHeader(canvasElement: HTMLElement) {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
  await expect(canvas.getByRole("heading", { name: "동물" })).toBeVisible();
  const search = canvas.getByRole("textbox", { name: "고객관리 검색" });
  await userEvent.type(search, "SYN-001");
  await waitFor(() => expect(canvas.queryByTestId("header-customer-row-header-patient-b")).not.toBeInTheDocument());
  await expect(canvas.getByTestId("header-customer-row-header-patient-a")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "고객관리 검색어 초기화" }));
  await expect(canvas.getByTestId("header-customer-row-header-patient-b")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "환자/보호자 등록" }));
  const menu = await body.findByRole("menu"); await waitFor(() => expect(menu).toBeVisible());
  await expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
  await userEvent.keyboard("{Escape}");
  await userEvent.click(canvas.getByRole("button", { name: "동물 필터 설정" }));
  const field = await body.findByRole("combobox", { name: "그룹 1 조건 1 필터 필드" });
  await waitFor(() => expect(field).toBeVisible());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(canvas.getByRole("button", { name: "동물 필터 설정" })).toHaveAttribute("aria-expanded", "false"));
  await waitFor(() => expect(body.queryByRole("combobox", { name: "그룹 1 조건 1 필터 필드" })).not.toBeInTheDocument());
}
