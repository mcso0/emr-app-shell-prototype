"use client";

import { useState } from "react";

import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyPatientVitalWriteInput,
  hasPatientVitalValue,
  toPatientVitalWriteInput,
  type PatientVitalMeasurement,
  type PatientVitalWriteInput,
} from "@/features/patient-vitals/patient-vital-types";
import {
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  toCanonicalVitalValue,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

type VitalDialogDraft = Record<keyof PatientVitalWriteInput, string>;
type VitalMeasurementInput = Pick<
  PatientVitalMeasurement,
  | "weightKg"
  | "temperatureC"
  | "heartRateBpm"
  | "respiratoryRateRpm"
  | "bloodPressureSystolicMmhg"
  | "bloodPressureDiastolicMmhg"
>;

type VitalFieldErrors = Partial<
  Record<keyof PatientVitalWriteInput | "vitals", string>
>;

type VitalSaveResult =
  | { ok: true; vital: PatientVitalMeasurement }
  | { ok: false; error?: string; fieldErrors?: VitalFieldErrors };

export function ChartVitalDialog({
  ...props
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  measurement?: VitalMeasurementInput;
  mode: "waiting" | "in_consultation";
  onOpenChange: (open: boolean) => void;
  onSaved: (vital: PatientVitalMeasurement) => void | Promise<void>;
  open: boolean;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
  workspaceId: string;
}) {
  if (!props.open) return null;

  return <OpenChartVitalDialog key={props.encounterId} {...props} />;
}

function OpenChartVitalDialog({
  actorHeaders,
  encounterId,
  measurement,
  mode,
  onOpenChange,
  onSaved,
  open,
  vitalSettings,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  measurement?: VitalMeasurementInput;
  mode: "waiting" | "in_consultation";
  onOpenChange: (open: boolean) => void;
  onSaved: (vital: PatientVitalMeasurement) => void | Promise<void>;
  open: boolean;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
  workspaceId: string;
}) {
  const [draft, setDraft] = useState<VitalDialogDraft>(() =>
    createVitalDialogDraft(measurement, vitalSettings),
  );
  const [fieldErrors, setFieldErrors] = useState<VitalFieldErrors>({});
  const [saving, setSaving] = useState(false);

  const saveVital = async () => {
    const parsed = parseVitalDialogDraft(draft, vitalSettings);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }
    if (!measurement && !hasPatientVitalValue(parsed.values)) {
      setFieldErrors({ vitals: "새 바이탈은 한 가지 이상 입력해 주세요." });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    const result = await saveChartEncounterVital({
      actorHeaders,
      encounterId,
      values: parsed.values,
      workspaceId,
    });
    setSaving(false);

    if (!result.ok) {
      setFieldErrors(
        result.fieldErrors ?? {
          vitals: getVitalSaveErrorMessage(result.error),
        },
      );
      return;
    }

    await onSaved(result.vital);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) onOpenChange(nextOpen);
      }}
    >
      <EmrDialogShell
        variant="form"
        title={measurement ? "오늘 바이탈 수정" : "오늘 바이탈 입력"}
        description={
          mode === "waiting"
            ? "대기 중인 오늘 접수에 저장됩니다. 이전 내원 값은 바뀌지 않습니다."
            : "현재 진료 중인 접수에 저장됩니다. 이전 내원 값은 바뀌지 않습니다."
        }
        footerMeta={
          measurement
            ? "모든 값을 비우면 오늘 바이탈 행은 유지되고 값만 미표시로 바뀝니다."
            : "병원에서 사용하는 바이탈 중 실제로 측정한 항목만 입력해 주세요."
        }
        secondaryAction={
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
        }
        primaryAction={
          <Button type="button" disabled={saving} onClick={() => void saveVital()}>
            {saving ? "저장 중" : "저장"}
          </Button>
        }
      >
        <VitalEntryFields
          draft={draft}
          errors={fieldErrors}
          onChange={(key, value) => {
            setDraft((current) => ({ ...current, [key]: value }));
            setFieldErrors((current) => ({
              ...current,
              [key]: undefined,
              vitals: undefined,
            }));
          }}
          vitalSettings={vitalSettings}
        />
      </EmrDialogShell>
    </Dialog>
  );
}

async function saveChartEncounterVital({
  actorHeaders,
  encounterId,
  values,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  values: PatientVitalWriteInput;
  workspaceId: string;
}): Promise<VitalSaveResult> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/encounter-vitals`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders },
        body: JSON.stringify({ encounterId, vitals: values }),
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      vital?: PatientVitalMeasurement;
      error?: string;
      fieldErrors?: VitalFieldErrors;
      denialReason?: string;
    };
    if (!response.ok || !body.ok || !body.vital) {
      return {
        ok: false,
        error: body.denialReason ?? body.error,
        fieldErrors: body.fieldErrors,
      };
    }
    return { ok: true, vital: body.vital };
  } catch {
    return { ok: false, error: "db_write_failed" };
  }
}

function VitalEntryFields({
  draft,
  errors,
  onChange,
  vitalSettings,
}: {
  draft: VitalDialogDraft;
  errors: VitalFieldErrors;
  onChange: (key: keyof PatientVitalWriteInput, value: string) => void;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const enabledSettings = getEnabledWorkspaceVitalSettings(vitalSettings);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-5 text-[var(--emr-text-tertiary)]">
        실제로 측정한 값만 입력해 주세요. 입력하지 않은 값은 표에서 미표시로 보여요.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {enabledSettings.flatMap((setting) => {
          const preset = vitalSettings.presets.find(
            (item) => item.key === setting.key,
          );
          if (!preset) return [];
          if (setting.key === "blood_pressure") {
            return [
              <VitalDialogInput
                draft={draft}
                errors={errors}
                inputMode="numeric"
                inputKey="bloodPressureSystolicMmhg"
                key="bloodPressureSystolicMmhg"
                label="수축기 혈압"
                onChange={onChange}
                unit={setting.displayUnit}
              />,
              <VitalDialogInput
                draft={draft}
                errors={errors}
                inputMode="numeric"
                inputKey="bloodPressureDiastolicMmhg"
                key="bloodPressureDiastolicMmhg"
                label="이완기 혈압 (선택)"
                onChange={onChange}
                unit={setting.displayUnit}
              />,
            ];
          }
          const inputKey = inputKeyByVitalKey[setting.key];
          if (!inputKey) return [];
          return [
            <VitalDialogInput
              draft={draft}
              errors={errors}
              inputMode={
                setting.key === "weight" || setting.key === "temperature"
                  ? "decimal"
                  : "numeric"
              }
              inputKey={inputKey}
              key={setting.key}
              label={preset.label}
              onChange={onChange}
              unit={setting.displayUnit}
            />,
          ];
        })}
      </div>
      {errors.vitals ? (
        <p role="alert" className="text-sm text-[var(--emr-status-danger-text)]">
          {errors.vitals}
        </p>
      ) : null}
    </div>
  );
}

function VitalDialogInput({
  draft,
  errors,
  inputKey,
  inputMode,
  label,
  onChange,
  unit,
}: {
  draft: VitalDialogDraft;
  errors: VitalFieldErrors;
  inputKey: keyof PatientVitalWriteInput;
  inputMode: "decimal" | "numeric";
  label: string;
  onChange: (key: keyof PatientVitalWriteInput, value: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`chart-vital-${inputKey}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`chart-vital-${inputKey}`}
          aria-describedby={errors[inputKey] ? `chart-vital-${inputKey}-error` : undefined}
          aria-invalid={Boolean(errors[inputKey])}
          inputMode={inputMode}
          placeholder="미입력"
          value={draft[inputKey]}
          onChange={(event) => onChange(inputKey, event.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--emr-text-tertiary)]">
          {unit}
        </span>
      </div>
      {errors[inputKey] ? (
        <p
          id={`chart-vital-${inputKey}-error`}
          className="text-xs text-[var(--emr-status-danger-text)]"
        >
          {errors[inputKey]}
        </p>
      ) : null}
    </div>
  );
}

const inputKeyByVitalKey: Partial<
  Record<WorkspaceVitalKey, keyof PatientVitalWriteInput>
> = {
  weight: "weightKg",
  temperature: "temperatureC",
  heart_rate: "heartRateBpm",
  respiratory_rate: "respiratoryRateRpm",
};

function createVitalDialogDraft(
  measurement: VitalMeasurementInput | undefined,
  settings: WorkspaceVitalSettingsSnapshot,
): VitalDialogDraft {
  const values = toPatientVitalWriteInput(measurement);
  return Object.fromEntries(
    Object.entries(values).map(([rawKey, value]) => {
      const key = rawKey as keyof PatientVitalWriteInput;
      if (value === null) return [key, ""];
      const setting = getVitalSettingForInputKey(settings, key);
      return [
        key,
        setting
          ? String(
              fromCanonicalVitalValue(setting.key, value, setting.displayUnit),
            )
          : String(value),
      ];
    }),
  ) as VitalDialogDraft;
}

function parseVitalDialogDraft(
  draft: VitalDialogDraft,
  settings: WorkspaceVitalSettingsSnapshot,
): { ok: true; values: PatientVitalWriteInput } | { ok: false; fieldErrors: VitalFieldErrors } {
  const values: PatientVitalWriteInput = { ...emptyPatientVitalWriteInput };
  const fieldErrors: VitalFieldErrors = {};

  for (const key of Object.keys(values) as (keyof PatientVitalWriteInput)[]) {
    const rawValue = draft[key].trim();
    if (!rawValue) continue;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      fieldErrors[key] = "0보다 큰 숫자를 입력해 주세요.";
      continue;
    }
    if (key === "weightKg" && !hasAtMostVitalDecimalPlaces(parsed, 2)) {
      fieldErrors[key] = "소수점 둘째 자리까지 입력해 주세요.";
      continue;
    }
    if (key === "temperatureC" && !hasAtMostVitalDecimalPlaces(parsed, 1)) {
      fieldErrors[key] = "소수점 첫째 자리까지 입력해 주세요.";
      continue;
    }
    if (
      (key === "respiratoryRateRpm" ||
        key === "heartRateBpm" ||
        key === "bloodPressureSystolicMmhg" ||
        key === "bloodPressureDiastolicMmhg") &&
      !Number.isInteger(parsed)
    ) {
      fieldErrors[key] = "정수로 입력해 주세요.";
      continue;
    }
    const setting = getVitalSettingForInputKey(settings, key);
    values[key] = setting
      ? toCanonicalVitalValue(setting.key, parsed, setting.displayUnit)
      : parsed;
  }

  if (
    values.bloodPressureSystolicMmhg === null &&
    values.bloodPressureDiastolicMmhg !== null
  ) {
    fieldErrors.bloodPressureSystolicMmhg =
      "이완기 혈압을 입력하려면 수축기 혈압이 필요합니다.";
  }

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : { ok: true, values };
}

function getVitalSettingForInputKey(
  settings: WorkspaceVitalSettingsSnapshot,
  inputKey: keyof PatientVitalWriteInput,
) {
  const key =
    inputKey === "weightKg"
      ? "weight"
      : inputKey === "temperatureC"
        ? "temperature"
        : inputKey === "heartRateBpm"
          ? "heart_rate"
          : inputKey === "respiratoryRateRpm"
            ? "respiratory_rate"
            : "blood_pressure";
  return settings.items.find((item) => item.key === key);
}

function getVitalSaveErrorMessage(error?: string) {
  if (error === "stale_status") {
    return "대기 중이거나 진료 중인 접수에서만 바이탈을 저장할 수 있어요.";
  }
  if (error === "vital_value_required") {
    return "새 바이탈은 한 가지 이상 입력해 주세요.";
  }
  if (error === "permission_missing" || error === "vital_writer_role_required") {
    return "오늘 바이탈을 입력할 권한이 없어요.";
  }
  return "바이탈을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function hasAtMostVitalDecimalPlaces(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return (
    Math.abs(value * factor - Math.round(value * factor)) <
    Number.EPSILON * factor * 8
  );
}
