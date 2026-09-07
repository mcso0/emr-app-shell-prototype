export type PersonalPasswordInput = {
  currentPassword: string;
  password: string;
  confirmation: string;
};
export function validatePersonalPassword(
  value: unknown,
): PersonalPasswordInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["currentPassword", "password", "confirmation"].includes(key),
    )
  )
    return null;
  if (
    typeof input.currentPassword !== "string" ||
    !input.currentPassword ||
    input.currentPassword.length > 1024 ||
    typeof input.password !== "string" ||
    input.password.length < 8 ||
    input.password.length > 1024 ||
    input.password !== input.confirmation ||
    input.password === input.currentPassword
  )
    return null;
  return input as PersonalPasswordInput;
}

export function isSameOriginPasswordRequest(request: Request) {
  try {
    const source = new URL(request.headers.get("origin") ?? "");
    return (
      ["http:", "https:"].includes(source.protocol) &&
      source.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}

export function isRecentPasswordRecoveryClaim(
  claims: unknown,
  userId: string,
  now = Date.now(),
) {
  if (!claims || typeof claims !== "object") return false;
  const value = claims as Record<string, unknown>;
  if (value.sub !== userId || !Array.isArray(value.amr)) return false;
  return value.amr.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      entry.method === "recovery" &&
      typeof entry.timestamp === "number" &&
      entry.timestamp <= now / 1000 + 60 &&
      entry.timestamp >= now / 1000 - 3600,
  );
}
