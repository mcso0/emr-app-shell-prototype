export const hospitalProfileChangeRequestFields = [
  "hospital_name",
  "representative_name",
  "address",
] as const;

export type HospitalProfileChangeRequestField =
  (typeof hospitalProfileChangeRequestFields)[number];

export type HospitalContact = {
  phone: string;
  fax: string;
  homepage: string;
  instagram: string;
  customerGuideMemo: string;
};

export type HospitalProfilePendingChangeRequest = {
  id: string;
  fields: HospitalProfileChangeRequestField[];
  createdAt: string;
  status: "pending" | "reviewing";
};

export type HospitalProfile = {
  workspaceId: string;
  name: string;
  representativeName: string | null;
  address: string | null;
  countryCode: "KR";
  timezone: string;
  contact: HospitalContact;
  logo: { hasCustomLogo: boolean; url: string | null };
  revision: number;
  profileComplete: boolean;
  pendingChangeRequest: HospitalProfilePendingChangeRequest | null;
};

export type HospitalContactUpdateInput = {
  revision: number;
  contact: HospitalContact;
};

export type HospitalProfileChangeRequestInput = {
  fields: HospitalProfileChangeRequestField[];
  detail: string;
};

export type HospitalProfileInputField =
  | "root"
  | "revision"
  | keyof HospitalContact
  | "fields"
  | "detail";

export type HospitalProfileInputFieldErrors = Partial<
  Record<HospitalProfileInputField, "required" | "too_long" | "invalid_url" | "invalid_revision" | "invalid_field" | "unknown_field">
>;

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "invalid_input"; fieldErrors: HospitalProfileInputFieldErrors };

const contactKeys = [
  "phone",
  "fax",
  "homepage",
  "instagram",
  "customerGuideMemo",
] as const;

const approvedChangeRequestFieldSet = new Set<string>(
  hospitalProfileChangeRequestFields
);

export function parseHospitalContactUpdateInput(
  input: unknown
): ParseResult<HospitalContactUpdateInput> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["revision", "contact"])) {
    return invalid({ root: "unknown_field" });
  }
  if (!isRecord(input.contact) || !hasOnlyKeys(input.contact, [...contactKeys])) {
    return invalid({ root: "unknown_field" });
  }

  const fieldErrors: HospitalProfileInputFieldErrors = {};
  const revision = input.revision;
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) {
    fieldErrors.revision = "invalid_revision";
  }

  const contact = {
    phone: normalizeString(input.contact.phone),
    fax: normalizeString(input.contact.fax),
    homepage: normalizeString(input.contact.homepage),
    instagram: normalizeString(input.contact.instagram),
    customerGuideMemo: normalizeString(input.contact.customerGuideMemo),
  };

  if (!contact.phone) fieldErrors.phone = "required";
  if (contact.phone.length > 50) fieldErrors.phone = "too_long";
  if (contact.fax.length > 50) fieldErrors.fax = "too_long";
  if (contact.homepage.length > 200) {
    fieldErrors.homepage = "too_long";
  } else if (contact.homepage && !isHttpUrl(contact.homepage)) {
    fieldErrors.homepage = "invalid_url";
  }
  if (contact.instagram.length > 100) fieldErrors.instagram = "too_long";
  if (contact.customerGuideMemo.length > 300) {
    fieldErrors.customerGuideMemo = "too_long";
  }

  return Object.keys(fieldErrors).length
    ? invalid(fieldErrors)
    : { ok: true, value: { revision: Number(revision), contact } };
}

export function parseHospitalProfileChangeRequestInput(
  input: unknown
): ParseResult<HospitalProfileChangeRequestInput> {
  if (!isRecord(input) || !hasOnlyKeys(input, ["fields", "detail"])) {
    return invalid({ root: "unknown_field" });
  }

  const fieldErrors: HospitalProfileInputFieldErrors = {};
  const fields = Array.isArray(input.fields)
    ? Array.from(
        new Set(
          input.fields
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
        )
      )
    : [];
  const detail = normalizeString(input.detail);

  if (
    !Array.isArray(input.fields) ||
    fields.length === 0 ||
    fields.some((field) => !approvedChangeRequestFieldSet.has(field)) ||
    input.fields.some((field) => typeof field !== "string")
  ) {
    fieldErrors.fields = "invalid_field";
  }
  if (!detail) fieldErrors.detail = "required";
  if (detail.length > 2_000) fieldErrors.detail = "too_long";

  return Object.keys(fieldErrors).length
    ? invalid(fieldErrors)
    : {
        ok: true,
        value: {
          fields: fields as HospitalProfileChangeRequestField[],
          detail,
        },
      };
}

function invalid(fieldErrors: HospitalProfileInputFieldErrors) {
  return { ok: false as const, error: "invalid_input" as const, fieldErrors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]) {
  const keys = Object.keys(value);
  return (
    keys.length === allowedKeys.length &&
    keys.every((key) => allowedKeys.includes(key))
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
