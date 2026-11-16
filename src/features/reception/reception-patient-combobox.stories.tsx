import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrPageLoadingBoundary } from "@/components/emr/page-loading-boundary";
import { ReceptionPatientCombobox } from "./reception-patient-combobox";
import type { ReceptionPatientSummary } from "./data";
import { getReceptionPatientOptionLabel } from "./reception-patient-lookup-model";
const summaries: ReceptionPatientSummary[] = ["합성 환자 가", "합성 환자 나"].map((name, index) => ({
  patient: { id: `synthetic-patient-${index}`, workspaceId: "synthetic-sdk", name, patientNo: `SYN-${index}`, species: "cat", sex: "unknown", status: "active", handlingCautionLocked: false, createdAt: "2026-11-16T00:00:00Z", updatedAt: "2026-11-16T00:00:00Z" },
  primaryGuardian: { id: `synthetic-guardian-${index}`, workspaceId: "synthetic-sdk", name: `합성 보호자 ${index + 1}`, mobilePhone: `0100000000${index}`, createdAt: "2026-11-16T00:00:00Z", updatedAt: "2026-11-16T00:00:00Z" }, searchText: name,
}));
function Example({ status = "idle" }: { status?: "idle" | "loading" | "error" }) {
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState<ReceptionPatientSummary>(); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false);
  return <div className="grid w-80 gap-3">
    <button type="button" onClick={() => setLoading((value) => !value)}>화면 로딩 전환</button>
    <EmrPageLoadingBoundary loading={loading}><ReceptionPatientCombobox inputClassName="h-9 bg-card" lookupState={status} query={query} open={open} onOpenChange={setOpen} summaries={status === "idle" && query !== "없음" ? summaries : []} selectedSummary={selected}
      onQueryChange={(value) => { setQuery(value); setSelected(undefined); setOpen(true); }}
      onClear={() => { setQuery(""); setSelected(undefined); setOpen(true); }}
      onSelect={(summary) => { setSelected(summary); setQuery(getReceptionPatientOptionLabel(summary)); setOpen(false); }} /></EmrPageLoadingBoundary>
    <output aria-label="선택한 합성 환자">{selected?.patient.id ?? "미선택"}</output>
  </div>;
}
const meta = { title: "Features/Reception/Patient Combobox", component: Example, tags: ["autodocs"], args: { status: "idle" }, parameters: { docs: { description: { component: "접수와 예약의 drawer/side-panel 네 호출자가 사용하는 실제 환자/보호자 검색 UI입니다. 합성 결과만 주입하며 DB/API/메시지 발송은 실행하지 않습니다. 기존 hook이 조회·debounce·stale result·권한을 소유하고 UI SDK만 키보드와 목록 상호작용을 소유합니다." } } } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardAndClear: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body), input = body.getByRole("combobox", { name: "환자 검색" });
  await userEvent.type(input, "합성"); await userEvent.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(body.getByLabelText("선택한 합성 환자")).toHaveTextContent("synthetic-patient-0"));
  await expect(input).toHaveValue(getReceptionPatientOptionLabel(summaries[0]));
  await userEvent.click(body.getByRole("button", { name: "환자 선택 초기화" }));
  await expect(input).toHaveValue(""); await expect(body.getByLabelText("선택한 합성 환자")).toHaveTextContent("미선택");
  await userEvent.type(input, "미완료 검색"); await userEvent.keyboard("{Escape}");
  await expect(input).toHaveValue("미완료 검색");
  await expect(input).toHaveAttribute("aria-expanded", "false");
} };
export const Loading: Story = { args: { status: "loading" }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body); await userEvent.type(body.getByRole("combobox", { name: "환자 검색" }), "합성");
  await expect(await body.findByRole("status", { name: "조회 상태" })).toHaveTextContent("DB 환자 검색 중입니다.");
  await expect(body.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
} };
export const Error: Story = { args: { status: "error" }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body); await userEvent.type(body.getByRole("combobox", { name: "환자 검색" }), "합성");
  await expect(await body.findByRole("status", { name: "조회 상태" })).toHaveTextContent("환자 검색을 불러오지 못했습니다.");
} };
export const HiddenWhilePageLoads: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body); await userEvent.type(body.getByRole("combobox", { name: "환자 검색" }), "합성");
  await expect(await body.findByRole("listbox")).toBeVisible();
  await userEvent.click(body.getByRole("button", { name: "화면 로딩 전환" }));
  await waitFor(() => expect(body.queryByRole("listbox")).not.toBeInTheDocument());
  await userEvent.click(body.getByRole("button", { name: "화면 로딩 전환" }));
  await expect(body.queryByRole("listbox")).not.toBeInTheDocument();
} };
