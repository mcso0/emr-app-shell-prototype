import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CdsMedicalPawPrintIcon } from "@/components/cds-icons/medical-and-domain";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import {
  EmrRegistrationAddressControls,
  EmrRegistrationAgeControls,
  EmrRegistrationCheckboxLabel,
  EmrRegistrationDialogShell,
  EmrRegistrationFieldRow,
  EmrRegistrationFooter,
  EmrRegistrationInlineControl,
  EmrRegistrationSection,
  EmrRegistrationSignatureConsentCard,
  EmrRegistrationSummaryItem,
  emrRegistrationControlClassName,
  type EmrRegistrationDialogKind,
  type EmrRegistrationSignatureStatus,
} from "./registration-dialog";

type RegistrationArgs = {
  kind: EmrRegistrationDialogKind;
  invalid: boolean;
  addressState: "idle" | "loading" | "error";
  initialSignatureStatus: EmrRegistrationSignatureStatus;
};

function RegistrationExample({ kind, invalid, addressState, initialSignatureStatus }: RegistrationArgs) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState(initialSignatureStatus);
  const [result, setResult] = useState("없음");
  const nameId = `${id}-name`;
  const errorId = `${id}-error`;
  return <div className="grid gap-3">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>합성 등록 예시 열기</DialogTrigger>
      <EmrRegistrationDialogShell kind={kind} title="합성 등록 예시" stepLabel={kind === "confirm" ? "확인" : "정보 입력"} closeAriaLabel="합성 등록 창 닫기" description="합성 UI 예시이며 실제 등록·주소 조회·전자서명은 수행하지 않습니다." footer={<EmrRegistrationFooter showPrevious nextLabel={kind === "confirm" ? "합성 등록 확인" : "다음"} nextDisabled={invalid} onCancel={() => { setResult("취소"); setOpen(false); }} onPrevious={() => setResult("이전")} onNext={() => setResult(kind === "confirm" ? "등록 확인" : "다음")} />}>
        {kind === "confirm" ? <>
          <EmrRegistrationSummaryItem title="합성 환자" icon={<CdsMedicalPawPrintIcon />} details={["합성 종류", "합성 품종"]} />
          <EmrRegistrationSummaryItem title="합성 보호자" icon={<CdsMedicalPawPrintIcon />} badgeLabel="기존" badgeTone="neutral" details={["합성 연락처"]} />
        </> : <>
          <EmrRegistrationSection title="합성 기본 정보" separated={false}>
            <EmrRegistrationFieldRow label="보호자명" controlId={nameId} required error={invalid ? "합성 필수 입력 오류입니다." : undefined} errorId={errorId}>
              <input id={nameId} className={emrRegistrationControlClassName} value={invalid ? "" : "합성 보호자"} readOnly aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} />
            </EmrRegistrationFieldRow>
            <EmrRegistrationFieldRow label="나이">
              <EmrRegistrationAgeControls years={<input aria-label="합성 나이 년" className="min-w-0 w-full border px-2" value="3년" readOnly />} months={<input aria-label="합성 나이 개월" className="min-w-0 w-full border px-2" value="2개월" readOnly />} estimate={<EmrRegistrationCheckboxLabel control={<input type="checkbox" defaultChecked />}>추정</EmrRegistrationCheckboxLabel>} />
            </EmrRegistrationFieldRow>
            <EmrRegistrationInlineControl control={<Button variant="outline" size="sm" onClick={() => setResult("합성 중복 확인")}>중복 확인</Button>}><span className="text-sm">합성 식별 정보</span></EmrRegistrationInlineControl>
          </EmrRegistrationSection>
          <EmrRegistrationSection title="합성 주소">
            <EmrRegistrationAddressControls postalCode={<input aria-label="합성 우편번호" className="min-w-0 w-full border px-2" value="합성 우편번호" readOnly />} road={<input aria-label="합성 도로명" className="w-full border px-2" value="합성 도로명" readOnly />} detail={<input aria-label="합성 상세주소" className="w-full border px-2" value="합성 상세주소" readOnly />} searchLoading={addressState === "loading"} searchError={addressState === "error" ? "합성 주소 검색 오류입니다." : undefined} onSearchAddress={() => setResult("주소 검색")} />
          </EmrRegistrationSection>
          <EmrRegistrationSection title="합성 동의">
            <EmrRegistrationSignatureConsentCard controlId={`${id}-signature`} signatureStatus={signature} error={invalid ? "합성 동의 확인이 필요합니다." : undefined} errorId={`${id}-signature-error`} onRequestSignature={() => setSignature("pending")} onCompleteSignature={() => setSignature("completed")} />
          </EmrRegistrationSection>
        </>}
      </EmrRegistrationDialogShell>
    </Dialog>
    <output>합성 콜백: {result}</output>
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrRegistrationDialog",
  component: RegistrationExample,
  tags: ["autodocs"],
  parameters: { docs: { story: { inline: false, height: "840px" }, description: { component: "접수 profile-drawer에서 사용하는 공통 등록 shell·footer·field·section·주소·나이·checkbox·inline control·서명·summary 조합입니다. 실제 form 상태, 검증, 주소 provider, 서명 provider, 등록 처리는 호출 기능이 소유합니다. 예시는 합성 read-only 입력과 로컬 callback만 사용합니다. kind는 shell API이며 invalid/addressState/initialSignatureStatus는 fixture Controls입니다. signature idle/pending/completed는 요청·완료·비활성 버튼으로 구분합니다." } } },
  args: { kind: "form", invalid: false, addressState: "idle", initialSignatureStatus: "idle" },
  argTypes: {
    kind: { control: "radio", options: ["form", "confirm"], description: "등록 shell의 form/confirm 너비·높이 계약입니다." },
    invalid: { control: "boolean", description: "합성 field 오류, aria 연결과 다음 버튼 비활성을 표시합니다." },
    addressState: { control: "radio", options: ["idle", "loading", "error"], description: "주소 조회를 호출하지 않는 합성 표시 상태입니다." },
    initialSignatureStatus: { control: "radio", options: ["idle", "pending", "completed"], description: "로컬 서명 표시의 시작 상태입니다. 실제 서명을 요청하지 않습니다." },
  },
  render: (args) => <RegistrationExample key={`${args.kind}:${args.initialSignatureStatus}`} {...args} />,
} satisfies Meta<RegistrationArgs>;

export default meta;
type Story = StoryObj<typeof meta>;
async function openRegistration(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "합성 등록 예시 열기" }));
  const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  return within(dialog);
}
export const FormAndSignature: Story = {
  parameters: { docs: { description: { story: "실제 provider 없이 로컬 서명 표시를 idle→pending→completed로 전환합니다. 주소 검색·이전·다음은 합성 callback 결과만 바꿉니다." } } },
  play: async ({ canvasElement }) => {
    const dialog = await openRegistration(canvasElement);
    await userEvent.click(dialog.getByRole("button", { name: "태블릿 서명 요청" }));
    await userEvent.click(await dialog.findByRole("button", { name: "서명 완료 처리" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "서명 완료" })).toBeDisabled());
    await userEvent.click(dialog.getByRole("checkbox", { name: "추정" }));
    await expect(dialog.getByRole("checkbox", { name: "추정" })).not.toBeChecked();
    const result = within(canvasElement).getByText(/^합성 콜백:/);
    for (const name of ["주소 검색", "이전", "다음"]) {
      const button = dialog.getByRole("button", { name }); button.focus(); await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(result).toHaveTextContent(name));
    }
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(result).toHaveTextContent("취소");
  },
};
export const FieldAndAddressError: Story = {
  args: { invalid: true, addressState: "error" },
  parameters: { docs: { description: { story: "필수 field 오류는 input의 aria-invalid/aria-describedby와 연결합니다. 주소 조회 실패는 별도 설명을 표시하며 다음 작업은 비활성입니다." } } },
  play: async ({ canvasElement }) => {
    const dialog = await openRegistration(canvasElement);
    const field = dialog.getByRole("textbox", { name: /보호자명/ });
    const errorId = field.getAttribute("aria-describedby");
    if (!errorId || !canvasElement.ownerDocument.getElementById(errorId)?.textContent?.includes("필수 입력 오류")) throw new Error("Expected field error association.");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("합성 주소 검색 오류입니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "다음" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "주소 검색" }));
    await expect(within(canvasElement).getByText(/^합성 콜백:/)).toHaveTextContent("주소 검색");
  },
};
export const AddressLoading: Story = { args: { addressState: "loading", initialSignatureStatus: "pending" }, parameters: { docs: { description: { story: "주소 검색 버튼이 검색 중으로 비활성이고 서명은 pending입니다. 실제 비동기 요청은 없습니다." } } }, play: async ({ canvasElement }) => { const dialog = await openRegistration(canvasElement); await expect(dialog.getByRole("button", { name: "검색 중" })).toBeDisabled(); await userEvent.click(dialog.getByRole("button", { name: "서명 완료 처리" })); await expect(dialog.getByRole("button", { name: "서명 완료" })).toBeDisabled(); } };
export const Confirmation: Story = { args: { kind: "confirm", initialSignatureStatus: "completed" }, argTypes: { addressState: { table: { disable: true } }, initialSignatureStatus: { table: { disable: true } } }, parameters: { docs: { description: { story: "신규/기존 summary tone과 confirm shell을 보여줍니다. 합성 등록 확인은 로컬 결과만 바꾸며 저장하지 않습니다." } } }, play: async ({ canvasElement }) => { const dialog = await openRegistration(canvasElement); await expect(dialog.getByText("합성 환자")).toBeVisible(); await expect(dialog.getByText("합성 보호자")).toBeVisible(); const confirm = dialog.getByRole("button", { name: "합성 등록 확인" }); confirm.focus(); await userEvent.keyboard("{Enter}"); await expect(within(canvasElement).getByText(/^합성 콜백:/)).toHaveTextContent("등록 확인"); } };
