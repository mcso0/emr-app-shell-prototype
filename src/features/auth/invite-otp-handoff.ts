export type InviteOtpContext = {
  invitationId: string;
  workspaceId: string;
  email: string;
};

const localOrigin = "http://clair.local";

export function normalizeInviteEmail(value: unknown) {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return email;
}

export function getSafeInviteNextHref(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const url = new URL(value, localOrigin);
  if (url.origin !== localOrigin) return null;
  if (!url.pathname.startsWith("/invite/")) return null;

  return `${url.pathname}${url.search}`;
}

export function readInviteContextFromNext(next: string): InviteOtpContext | null {
  const safeNext = getSafeInviteNextHref(next);
  if (!safeNext) return null;

  const url = new URL(safeNext, localOrigin);
  const [, route, invitationId] = url.pathname.split("/");
  const workspaceId = url.searchParams.get("workspaceId");
  const email = normalizeInviteEmail(url.searchParams.get("email"));

  if (route !== "invite" || !invitationId || !workspaceId || !email) return null;

  return {
    invitationId,
    workspaceId,
    email,
  };
}

export function createInviteOtpRedirectTo({
  origin,
  next,
}: {
  origin: string;
  next: string;
}) {
  const safeNext = getSafeInviteNextHref(next);
  const redirectTo = new URL("/auth/confirm", origin);

  if (safeNext) {
    redirectTo.searchParams.set("next", safeNext);
  }

  return redirectTo.toString();
}
