"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LabResultRow } from "@/types/emr-domain";
import { evaluateLabProfileValue, getLabResultWarning, type LabResultQualifier } from "../result-profile-contract";

export function LabResultValueControl({ row, disabled = false, onValueChange, onMetadataChange }: {
  row: LabResultRow;
  disabled?: boolean;
  onValueChange: (rowId: string, value: string) => void;
  onMetadataChange: (rowId: string, patch: Partial<LabResultRow>) => void;
}) {
  const rule = row.interpretationRule;
  const noResult = row.resultPresence === "instrument_no_result";
  const label = `${row.analyteName} 결과값`;
  const warningId = useId();
  const [directInput, setDirectInput] = useState(false);
  const evaluation = rule ? evaluateLabProfileValue(rule, {
    value: row.value ?? null, qualifier: row.qualifier, deviceFlag: row.deviceFlag, resultState: row.resultPresence,
  }) : null;
  const warning = evaluation?.valid ? getLabResultWarning(evaluation.state) : null;
  const kind = rule?.resultValueKind ?? row.resultValueKind;
  const code = rule?.codes.find(code => code.code === row.value?.trim());
  const custom = !noResult && (directInput || Boolean(row.value?.trim() && !code));
  const allowed = rule?.allowedQualifiers ?? ["exact"];
  const qualifier = row.qualifier ?? "exact";
  // Existing frozen qualified values remain visible until explicitly changed.
  const qualifiers = allowed.includes(qualifier) ? allowed : [...allowed, qualifier];
  const inputProps = {
    "aria-label": label,
    "aria-describedby": warning ? warningId : undefined,
    "aria-invalid": Boolean(warning),
    "data-testid": `lab-result-input-${row.id}`,
    disabled: disabled || noResult,
    maxLength: 4096,
    placeholder: noResult ? "측정 불가" : "검사 결과값 입력",
    value: row.value ?? "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(row.id, event.target.value),
  };
  return <div className="flex w-full min-w-0 flex-col gap-1">
    <div className="flex min-w-0 items-start gap-1">
      {kind === "numeric" ? qualifiers.length > 1 ? <select
        aria-label={`${row.analyteName} 부등호`}
        className="h-7 w-12 shrink-0 rounded-md border border-input bg-card px-1 text-xs"
        disabled={disabled || noResult || !row.value?.trim()}
        value={qualifier}
        onChange={event => onMetadataChange(row.id, { qualifier: event.target.value as LabResultQualifier })}
      >{qualifiers.map(q => <option key={q} value={q} disabled={q !== "exact" && !allowed.includes(q)}>
        {q === "exact" ? "=" : q === "less_than" ? "<" : ">"}
      </option>)}</select> : <span aria-label={`${row.analyteName} 부등호`} className="flex h-7 w-6 shrink-0 items-center justify-center text-xs">=</span> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {kind === "coded" && rule ? <>
          <select aria-label={custom ? `${row.analyteName} 입력 방식` : label}
            className="h-7 min-w-0 w-full rounded-md border border-input bg-card px-2 text-xs"
            disabled={disabled || noResult}
            value={custom ? "direct" : code ? `code:${code.code}` : ""}
            onChange={event => {
              const value = event.target.value;
              setDirectInput(value === "direct");
              if (value !== "direct") onValueChange(row.id, value.startsWith("code:") ? value.slice(5) : "");
            }}>
            <option value="">{noResult ? "측정 불가" : "선택 안 함"}</option>
            {rule.codes.map(code => <option key={code.code} value={`code:${code.code}`}>{code.label}</option>)}
            <option value="direct">직접 입력</option>
          </select>
          {custom ? <Input {...inputProps} className="h-7 min-w-0 bg-card text-xs" /> : null}
        </> : kind === "text" ? <Textarea {...inputProps} rows={2} className="min-h-7 min-w-0 resize-y bg-card py-1 text-xs" />
          : <Input {...inputProps} inputMode={kind === "numeric" || row.resultInputType === "number" ? "decimal" : undefined}
            className="h-7 min-w-0 bg-card !text-[12px] !leading-4 !tracking-[0.3px]" />}
      </div>
    </div>
    {warning ? <p id={warningId} role="status" className="emr-text-metadata min-w-0 whitespace-normal break-words text-[var(--emr-status-warning-text)]">{warning}</p> : null}
  </div>;
}
