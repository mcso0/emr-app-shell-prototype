export type PersistedOrderDefaultsSource =
  "generic" | "legacy_medication_metadata" | "missing";

/** Same persisted row only. Never fill individual gaps from schemas or legacy fields. */
export function readPersistedOrderDefaults(item: {
  defaultDetailInputs?: unknown;
  medicationMetadata?: unknown;
  defaultDetailInputsSource?: unknown;
}): {
  values: Record<string, unknown> | undefined;
  storedValues: Record<string, unknown> | undefined;
  source: PersistedOrderDefaultsSource;
} {
  const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const generic = item.defaultDetailInputs;
  const nested = record(item.medicationMetadata)
    ? item.medicationMetadata.defaultDetailInputs
    : undefined;
  // A transported projection can be empty after policy removal. Its marker
  // forbids reinterpreting that empty projection using legacy clinical values.
  const source =
    record(generic) &&
    (Object.keys(generic).length > 0 ||
      item.defaultDetailInputsSource === "generic" ||
      item.defaultDetailInputsSource === "legacy_medication_metadata")
      ? "generic"
      : record(nested) && Object.keys(nested).length > 0
        ? "legacy_medication_metadata"
        : "missing";
  if (source === "missing")
    return { values: undefined, storedValues: undefined, source };
  const values = structuredClone(
    (source === "generic" ? generic : nested) as Record<string, unknown>,
  );
  const storedValues = structuredClone(values);
  // Preserve these in raw Admin round-trips, but they are not clinical inputs.
  delete values.planOrderAuthority;
  delete values.manualQuantityReason;
  delete values.autoDispenseQuantityEnabled;
  return { values, storedValues, source };
}
