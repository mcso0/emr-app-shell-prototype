import { DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF } from "@/lib/emr-domain/demo-workspaces";

export const loginEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isLoginEmailValid(email: string) { return loginEmailPattern.test(email.trim()); }
export function canSubmitPasswordLogin(email: string, password: string) {
  return isLoginEmailValid(email) && password.length > 0;
}
export function getSafeLoginNextHref(value: string | null) {
  const fallback = DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF;
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://clair.local");
    if (url.origin !== "https://clair.local" || url.pathname.startsWith("/login") || url.pathname.startsWith("/auth/")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
export function getEmailAuthError(error: unknown, verification = false) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const status = error && typeof error === "object" && "status" in error ? error.status : null;
  if (status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (code === "otp_expired") return "인증번호가 만료되었거나 올바르지 않습니다. 번호를 확인하거나 다시 받아 주세요.";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
  return verification ? "인증번호를 확인하지 못했습니다. 번호를 확인하거나 다시 받아 주세요." : "요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
