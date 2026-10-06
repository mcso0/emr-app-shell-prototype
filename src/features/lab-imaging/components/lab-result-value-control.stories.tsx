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
  parameters: { docs: { description: { component: "Actual result-cell controls using synthetic rules. Qualifier permissions are explicit fixtures, not hospital master settings. Save/read and measurement checkbox behavior are covered by the result-sheet tests." } } },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Numeric: Story = {
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
  args: { initialRow: { ...row, interpretationRule: { ...numeric, allowedQualifiers: ["exact", "greater_than"] } } },
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByLabelText("합성 검사 부등호"), "greater_than");
    await expect(args.onMetadataChange).toHaveBeenLastCalledWith(row.id, { qualifier: "greater_than" });
    await expect(canvas.getByLabelText("합성 검사 부등호")).toHaveValue("greater_than");
    await expect(canvas.queryByRole("option", { name: "<" })).toBeNull();
  },
};
export const Coded: Story = {
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
  args: { initialRow: { ...row, value: "001\n관찰 소견", interpretationRule: { ...numeric, resultValueKind: "text", unit: null,
    decimalScale: null, numericMin: null, referenceInterval: null } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toHaveValue("001\n관찰 소견");
    await expect(canvas.queryByRole("status")).toBeNull();
    await expect(canvas.queryByLabelText("합성 검사 부등호")).toBeNull();
  },
};
export const MeasurementUnavailable: Story = {
  args: { initialRow: { ...row, value: undefined, resultPresence: "instrument_no_result", qualifier: "exact" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveAttribute("placeholder", "측정 불가");
    await expect(canvas.queryByText("기존 입력은 체크 해제 시 복원됩니다.")).toBeNull();
  },
};
export const ReadOnly: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => { await expect(canvas.getByRole("textbox")).toBeDisabled(); },
};
export const WarningReadOnly: Story = {
  args: { disabled: true, initialRow: { ...row, value: " 4 mg " } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveValue(" 4 mg ");
    await expect(canvas.getByRole("status")).toHaveTextContent("수치 형식이 아닙니다");
  },
};
export const CodedWarningReadOnly: Story = {
  args: { disabled: true, initialRow: { ...Coded.args!.initialRow!, value: "판독 보류" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toHaveValue("판독 보류");
    await expect(canvas.getByRole("status")).toHaveTextContent("선택지에 없는 결과");
  },
};
export const CodedMeasurementUnavailable: Story = {
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
