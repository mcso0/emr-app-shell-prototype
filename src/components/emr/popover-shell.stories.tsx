import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { ChartPatientContextBar } from "@/features/chart/components/chart-figma-workspace";
import { ChartProfilePreviewCard } from "@/features/chart/components/chart-profile-preview-card";
import { formatPatientVitalDisplayItemsForSettings } from "@/features/patient-vitals/patient-vital-types";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import { Button } from "@/components/ui/button";
import { emptyHistoryDateRange } from "@/lib/history-controls";
import { EmrHistoryFilterPopover } from "./history-controls";
import { EmrMainContentHeader } from "./main-content-header";

// Fixed chart caller composition; synthetic data and local action receipts only.
function ChartMemoExample() {
  const narrow = false;
  const guardianMissing = false;
  const longPatientName = false;
  const emptyMemos = false;
  const [lastAction, setLastAction] = useState("없음");
  const patientNotes = emptyMemos ? [] : ["합성 환자 주의사항"];
  const patientName = longPatientName ? "합성 긴 환자 이름으로 가로 스크롤 확인" : "합성 환자";
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3" style={{ width: narrow ? 420 : "100%", maxWidth: "100%" }}>
      <EmrMainContentHeader heightMode="fixed">
        <ChartPatientContextBar
          patientName={patientName}
          patientMeta="말티즈 · 중성화 수컷 · 3세"
          patientInteraction={{
            ariaLabel: `${patientName} 환자 프로필 열기`,
            onActivate: () => setLastAction("환자 프로필"),
            preview: <ChartProfilePreviewCard badge="정상" kind="patient" title={patientName} items={[
              { label: "환자번호", value: "SYN-001" },
              { label: "축종·품종", value: "개 · 말티즈" },
              { label: "나이", value: "3세" },
              { label: "성별", value: "중성화 수컷" },
            ]} notes={patientNotes} />,
          }}
          guardianName={guardianMissing ? "보호자 미지정" : "합성 보호자(주보호자)"}
          guardianPhone={guardianMissing ? "연락처 미입력" : "010-0000-0000"}
          guardianInteraction={guardianMissing ? undefined : {
            ariaLabel: "합성 보호자 보호자 프로필 열기",
            onActivate: () => setLastAction("보호자 프로필"),
            preview: <ChartProfilePreviewCard badge="주보호자" kind="guardian" title="합성 보호자" items={[
              { label: "대표 연락처", value: "010-0000-0000" },
              { label: "이메일", value: "synthetic@example.invalid" },
              { label: "환자 관계", value: `${patientName}의 주보호자` },
            ]} />,
          }}
          vitalItems={formatPatientVitalDisplayItemsForSettings({
            weightKg: 5, temperatureC: 38.5, heartRateBpm: 100,
            respiratoryRateRpm: 24, bloodPressureSystolicMmhg: 120,
            bloodPressureDiastolicMmhg: 80,
          }, createDefaultWorkspaceVitalSettingsSnapshot())}
          vitalAction={{
            ariaLabel: "오늘 바이탈 수정",
            onActivate: () => setLastAction("바이탈 수정"),
            disabled: false,
          }}
          doctorName="합성 수의사"
          memoItems={[
            { label: "방문목적", summary: emptyMemos ? "방문 목적 기록 없음" : "합성 정기 검진" },
            { label: "보호자메모", summary: emptyMemos || guardianMissing ? "보호자 메모 없음" : "합성 보호자 메모" },
            { label: "환자메모", summary: patientNotes.join(" · ") || "환자 특이 메모 없음" },
            { label: "수납메모", disabled: true, summary: "수납 화면 연동 후 사용할 수 있습니다." },
          ]}
        />
      </EmrMainContentHeader>
      <output aria-label="차트 구성 검증 결과">실행: {lastAction}</output>
    </div>
  );
}

// billing/module.tsx: custom-date trigger and draft/apply/cancel ownership.
// Start with an already applied synthetic custom range; no billing API is used.
function BillingPeriodExample() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(true);
  const [dates, setDates] = useState({ start: "2026-07-11", end: "2026-10-11" });
  const [draftDates, setDraftDates] = useState(dates);
  return (
    <div className="grid justify-items-start gap-3">
      <EmrHistoryFilterPopover
        open={open}
        trigger={<Button type="button" size="sm" variant={custom ? "secondary" : "outline"} className="h-7 bg-card px-2 emr-text-metadata" aria-pressed={custom}>직접</Button>}
        title="수납 이력 기간"
        dateLabel="수납 이력일"
        dates={draftDates}
        onDatesChange={setDraftDates}
        requireDates
        onOpen={() => {
          setDraftDates(custom ? dates : { start: "2026-07-11", end: "2026-10-11" });
          setOpen(true);
        }}
        onReset={() => setDraftDates(emptyHistoryDateRange)}
        onCancel={() => setOpen(false)}
        onApply={() => { setDates(draftDates); setCustom(true); setOpen(false); }}
      />
      {custom ? <Button size="sm" variant="outline" onClick={() => setCustom(false)} aria-label="직접 기간 조건 해제" className="max-w-full"><span className="truncate">{dates.start} ~ {dates.end} ×</span></Button> : null}
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrPopoverShell",
  component: ChartMemoExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "origin/main의 실제 사용 컴포넌트를 재사용합니다. Default는 ChartPatientContextBar의 메모 조회, Compact Fields는 수납 이력의 EmrHistoryFilterPopover입니다. 합성 데이터와 로컬 상태만 사용하며 프로필 이동·서버 조회·저장·결제는 실행하지 않습니다. 두 예시는 고정된 앱 구성이므로 Shell의 title/width/density/bodyScroll Controls를 노출하지 않습니다. 다른 사용처인 워크스페이스 전환과 오더 빠른 검색 전체 흐름은 이 두 예시의 검증 범위가 아닙니다.",
      },
    },
  },
  render: () => <ChartMemoExample />,
} satisfies Meta<typeof ChartMemoExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { docs: { description: { story: "차트 환자 정보 바에서 방문목적·보호자메모·환자메모를 누르면 동일한 실제 메모 팝오버가 열립니다. 현재 앱과 같이 조회 전용이며 수납메모는 비활성입니다. 폭 lg, 기본 밀도, bodyScroll=false는 실제 호출자가 정합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const trigger = canvas.getByRole("button", { name: "방문목적 메모 보기" });
    const findPopup = async () => {
      await waitFor(() => expect(doc.querySelector('[data-slot="popover-content"][data-open]')).toBeInTheDocument());
      const popup = doc.querySelector<HTMLElement>('[data-slot="popover-content"][data-open]')!;
      await waitFor(() => expect(popup).toBeVisible());
      return popup;
    };
    await userEvent.click(trigger);
    let popup = await findPopup();
    await expect(popup).toHaveTextContent("메모");
    await expect(popup).toHaveTextContent("환자 인포바");
    const options = popup.querySelectorAll('[data-slot="emr-popover-option"]');
    await expect(options).toHaveLength(4);
    for (const option of options) await expect(option).toBeDisabled();
    for (const text of ["합성 정기 검진", "합성 보호자 메모", "합성 환자 주의사항", "수납 화면 연동 후 사용할 수 있습니다."]) await expect(popup).toHaveTextContent(text);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popup).not.toHaveAttribute("data-open"));
    // main's memo trigger does not forward injected ref/ARIA; do not claim a fix.
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    popup = await findPopup();
    await userEvent.click(within(popup).getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(popup).not.toHaveAttribute("data-open"));
    trigger.focus();
    await userEvent.keyboard(" ");
    await findPopup();
    await expect(canvas.getByLabelText("차트 구성 검증 결과")).toHaveTextContent("실행: 없음");
  },
};

export const CompactFields: Story = {
  render: () => <BillingPeriodExample />,
  parameters: { docs: { description: { story: "수납 이력의 직접 기간 선택 팝오버입니다. 실제 EmrHistoryFilterPopover를 사용하므로 bodyScroll=true, compact, md, align=end가 그대로 적용됩니다. 초기화는 초안만 비우고, 취소/Escape는 적용 값을 유지하며, 적용은 유효한 두 날짜만 반영합니다. 날짜가 짧아 스크롤바는 없어도 본문 스크롤 속성은 활성입니다. 실제 수납 목록 조회는 포함하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "직접" });
    const openPopup = async (key?: string) => {
      if (key) { trigger.focus(); await userEvent.keyboard(key); }
      else await userEvent.click(trigger);
      const popup = await body.findByRole("dialog", { name: "수납 이력 기간" });
      await waitFor(() => expect(popup).toBeVisible());
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      return popup;
    };
    let popup = await openPopup();
    const scrollBody = popup.querySelector<HTMLElement>('[data-slot="emr-popover-body"]')!;
    await expect(getComputedStyle(scrollBody).overflowY).toBe("auto");
    await expect(getComputedStyle(scrollBody).maxHeight).not.toBe("none");
    await userEvent.click(within(popup).getByRole("button", { name: "초기화" }));
    await expect(within(popup).getByRole("button", { name: "적용" })).toBeDisabled();
    await expect(within(popup).getByRole("alert")).toHaveTextContent("시작일과 종료일을 모두 입력해 주세요.");
    await userEvent.click(within(popup).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await expect(canvas.getByRole("button", { name: "직접 기간 조건 해제" })).toHaveTextContent("2026-07-11 ~ 2026-10-11");
    popup = await openPopup("{Enter}");
    await expect(within(popup).getByLabelText("시작일")).toHaveValue("2026-07-11");
    await fireEvent.change(within(popup).getByLabelText("시작일"), { target: { value: "2026-11-01" } });
    await expect(within(popup).getByRole("button", { name: "적용" })).toBeDisabled();
    await expect(within(popup).getByRole("alert")).toHaveTextContent("종료일은 시작일 이후로 선택해 주세요.");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    popup = await openPopup(" ");
    await expect(within(popup).getByLabelText("시작일")).toHaveValue("2026-07-11");
    await fireEvent.change(within(popup).getByLabelText("시작일"), { target: { value: "2026-10-01" } });
    await userEvent.click(within(popup).getByRole("button", { name: "적용" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await expect(canvas.getByRole("button", { name: "직접 기간 조건 해제" })).toHaveTextContent("2026-10-01 ~ 2026-10-11");
    popup = await openPopup();
    await expect(within(popup).getByLabelText("시작일")).toHaveValue("2026-10-01");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await userEvent.click(canvas.getByRole("button", { name: "직접 기간 조건 해제" }));
    await expect(trigger).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.queryByRole("button", { name: "직접 기간 조건 해제" })).not.toBeInTheDocument();
    await openPopup();
  },
};
