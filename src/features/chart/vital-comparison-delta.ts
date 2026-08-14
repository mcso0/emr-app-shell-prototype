export type VitalDeltaDirection = "increase" | "decrease" | "same";

export type VitalDeltaPart = {
  direction: VitalDeltaDirection;
  value: string;
};

export type VitalDelta = {
  accessibleLabel: string;
  parts: VitalDeltaPart[];
};

type SingleDeltaInput = {
  current: number | undefined;
  previous: number | undefined;
  precision: number;
  label: string;
};

type BloodPressureDeltaInput = {
  current: {
    systolic: number | undefined;
    diastolic: number | undefined;
  };
  previous: {
    systolic: number | undefined;
    diastolic: number | undefined;
  };
};

function buildDeltaPart(
  current: number | undefined,
  previous: number | undefined,
  precision: number,
): VitalDeltaPart | null {
  if (
    current === undefined ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }

  const signedDelta = Number((current - previous).toFixed(precision));
  if (signedDelta === 0) return { direction: "same", value: "0" };

  return {
    direction: signedDelta > 0 ? "increase" : "decrease",
    value: Math.abs(signedDelta).toFixed(precision),
  };
}

export function buildSingleVitalDelta(input: SingleDeltaInput): VitalDelta | null {
  const part = buildDeltaPart(input.current, input.previous, input.precision);
  if (!part || part.direction === "same") return null;

  return {
    accessibleLabel: `${input.label} 변화: ${part.value} ${
      part.direction === "increase" ? "증가" : "감소"
    }`,
    parts: [part],
  };
}

export function buildBloodPressureDelta(
  input: BloodPressureDeltaInput,
): VitalDelta | null {
  const systolic = buildDeltaPart(
    input.current.systolic,
    input.previous.systolic,
    0,
  );
  const diastolic = buildDeltaPart(
    input.current.diastolic,
    input.previous.diastolic,
    0,
  );

  if (!systolic || !diastolic) return null;
  if (systolic.direction === "same" && diastolic.direction === "same") {
    return null;
  }

  return {
    accessibleLabel: `혈압 변화: ${describeBloodPressurePart(
      "수축기",
      systolic,
    )}, ${describeBloodPressurePart("이완기", diastolic)}`,
    parts: [systolic, diastolic],
  };
}

function describeBloodPressurePart(name: string, part: VitalDeltaPart) {
  const directionLabel =
    part.direction === "same"
      ? "동일"
      : part.direction === "increase"
        ? "증가"
        : "감소";
  return `${name} ${part.value} ${directionLabel}`;
}
