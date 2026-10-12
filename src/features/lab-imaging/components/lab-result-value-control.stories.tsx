import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import type { LabResultRow } from "@/types/emr-domain";
import type { LabProfileRule } from "../result-profile-contract";
import { LabResultValueControl } from "./lab-result-value-control";

const numeric: LabProfileRule = {
  testMasterKey: "synthetic.numeric", code: "SYN", resultValueKind: "numeric", supported: true,
  unit: "mg/dL", decimalScale: 1, numericMin: 0, numericMax: null,
  referenceInterval: { low: 10, high: 20, lowInclusive: true, highInclusive: true }, displayRange: null,
  codes: [], referenceStatus: "synthetic_functional_fixture", provenance: { synthetic: true },
};
const row: LabResultRow = { id: "synthetic-row", analyteName: "합성 검사", judgment: "not_judged", interpretationRule: numeric, value: "15" };
function Example({ initialRow, disabled, onValueChange, onMetadataChange }: {
  initialRow: LabResultRow; disabled: boolean;
  onValueChange: (id: string, value: string) => void;
  onMetadataChange: (id: string, patch: Partial<LabResultRow>) => void;
}) {
  const [current, setCurrent] = useState(initialRow);
  return <div className="w-80 rounded-lg bg-[var(--emr-surface-muted)] p-3">
    <p className="mb-2 text-sm font-medium">{current.analyteName}</p>
    <LabResultValueControl row={current} disabled={disabled}
      onValueChange={(id, value) => { setCurrent(r => ({ ...r, value })); onValueChange(id, value); }}
      onMetadataChange={(id, patch) => { setCurrent(r => ({ ...r, ...patch })); onMetadataChange(id, patch); }} />
  </div>;
}
const meta = {
  title: "Features/Lab/Result Value Control",
  component: Example,
  args: { initialRow: row, disabled: false, onValueChange: fn(), onMetadataChange: fn() },
  render: (args) => <Example key={JSON.stringify(args.initialRow)} {...args} />,
  argTypes: { initialRow: { control: "object", description: "합성 초기 행. 변경 시 로컬 셀을 다시 마운트합니다." } },
  parameters: { docs: { description: { component: "검사결과 셀의 수치, 코드, 서술 입력과 읽기 전용 상태를 확인합니다. Example과 initialRow는 로컬 상태를 만드는 예제 설정입니다. 실제 LabResultValueControl은 row, disabled, onValueChange, onMetadataChange를 받습니다. 판정 규칙은 합성 데이터이며 실제 검사 기준이나 저장 정책을 뜻하지 않습니다. 호출 기능이 저장과 조회를 담당합니다." } } },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Numeric: Story = {
  parameters: { docs: { description: { story: "숫자 형식과 맞지 않는 값을 입력해도 원문을 유지하고 경고하는지 확인합니다." } } },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByLabelText("합성 검사 부등호")).toHaveTextContent("=");
    await userEvent.clear(canvas.getByRole("textbox"));
    await userEvent.type(canvas.getByRole("textbox"), "4 mg");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("입력한 값은 저장됩니다"));
    await expect(canvas.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(row.id, "4 mg");
  },
};
export const ExplicitQualifier: Story = {
  parameters: { docs: { description: { story: "합성 규칙이 허용한 부등호만 선택할 수 있는지 확인합니다." } } },
  args: { initialRow: { ...row, interpretationRule: { ...numeric, allowedQualifiers: ["exact", "greater_than"] } } },
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByLabelText("합성 검사 부등호"), "greater_than");
    await expect(args.onMetadataChange).toHaveBeenLastCalledWith(row.id, { qualifier: "greater_than" });
    await expect(canvas.getByLabelText("합성 검사 부등호")).toHaveValue("greater_than");
    await expect(canvas.queryByRole("option", { name: "<" })).toBeNull();
  },
};
export const Coded: Story = {
  parameters: { docs: { description: { story: "코드 선택과 직접 입력을 바꾸고 목록에 없는 값의 안내를 확인합니다." } } },
  args: { initialRow: { ...row, value: "", interpretationRule: { ...numeric, resultValueKind: "coded", unit: null, decimalScale: null,
    numericMin: null, numericMax: null, referenceInterval: null, codes: [
      { code: "negative", label: "음성", judgment: "normal" }, { code: "positive", label: "양성", judgment: "abnormal" },
    ] } } },
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByLabelText("합성 검사 결과값"), "code:positive");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(row.id, "positive");
    await userEvent.selectOptions(canvas.getByLabelText("합성 검사 결과값"), "direct");
    await userEvent.clear(canvas.getByRole("textbox"));
    await userEvent.type(canvas.getByRole("textbox"), "판독 보류");
    await expect(canvas.getByRole("status")).toHaveTextContent("선택지에 없는 결과");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(row.id, "판독 보류");
  },
};
export const Narrative: Story = {
  parameters: { docs: { description: { story: "여러 줄 서술 원문과 선행 0을 유지하는지 확인합니다." } } },
  args: { initialRow: { ...row, value: "001\n관찰 소견", interpretationRule: { ...numeric, resultValueKind: "text", unit: null,
    decimalScale: null, numericMin: null, referenceInterval: null } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toHaveValue("001\n관찰 소견");
    await expect(canvas.queryByRole("status")).toBeNull();
    await expect(canvas.queryByLabelText("합성 검사 부등호")).toBeNull();
  },
};
export const MeasurementUnavailable: Story = {
  parameters: { docs: { description: { story: "측정 불가 상태에서 결과 입력이 비활성화되는지 확인합니다." } } },
  args: { initialRow: { ...row, value: undefined, resultPresence: "instrument_no_result", qualifier: "exact" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveAttribute("placeholder", "측정 불가");
    await expect(canvas.queryByText("기존 입력은 체크 해제 시 복원됩니다.")).toBeNull();
  },
};
export const ReadOnly: Story = {
  parameters: { docs: { description: { story: "읽기 전용 상태에서 결과 입력을 바꿀 수 없는지 확인합니다." } } },
  args: { disabled: true },
  play: async ({ canvas }) => { await expect(canvas.getByRole("textbox")).toBeDisabled(); },
};
export const WarningReadOnly: Story = {
  parameters: { docs: { description: { story: "읽기 전용에서도 기존 원문과 형식 경고를 확인할 수 있는지 확인합니다." } } },
  args: { disabled: true, initialRow: { ...row, value: " 4 mg " } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveValue(" 4 mg ");
    await expect(canvas.getByRole("status")).toHaveTextContent("수치 형식이 아닙니다");
  },
};
export const CodedWarningReadOnly: Story = {
  parameters: { docs: { description: { story: "목록에 없는 기존 코드 원문과 경고를 읽기 전용으로 표시하는지 확인합니다." } } },
  args: { disabled: true, initialRow: { ...Coded.args!.initialRow!, value: "판독 보류" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveValue("판독 보류");
    await expect(canvas.getByRole("status")).toHaveTextContent("선택지에 없는 결과");
  },
};
export const CodedMeasurementUnavailable: Story = {
  parameters: { docs: { description: { story: "코드형 결과의 측정 불가 상태에서 선택을 비활성화하는지 확인합니다." } } },
  args: { initialRow: { ...row, value: undefined, resultPresence: "instrument_no_result", qualifier: "exact",
    interpretationRule: { ...numeric, resultValueKind: "coded", unit: null, decimalScale: null, numericMin: null,
      referenceInterval: null, codes: [{ code: "negative", label: "음성", judgment: "normal" }] } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toBeDisabled();
    await expect(canvas.getByRole("combobox")).toHaveValue("");
    await expect(canvas.getByRole("option", { name: "측정 불가" })).toBeInTheDocument();
    await expect(canvas.queryByRole("textbox")).toBeNull();
  },
};
