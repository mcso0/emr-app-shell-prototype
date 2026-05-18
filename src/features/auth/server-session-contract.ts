import type { AuthMode } from "@/lib/supabase/config";

export type ServerSessionClaims = {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  aal?: unknown;
  session_id?: unknown;
};

export type ServerSessionClaimsResponse = {
  data: { claims?: ServerSessionClaims | null } | null;
  error: { name?: string; message?: string; status?: number } | null;
};

export type ServerSessionReaderRequest = {
  authMode: AuthMode;
  hasSupabasePublicConfig: boolean;
  getClaims?: () => Promise<ServerSessionClaimsResponse>;
};

export type ServerSessionReaderResult =
  | {
      ok: true;
      status: "authenticated";
      sessionUserId: string;
      email: string | null;
      role: string | null;
      aal: string | null;
      sessionId: string | null;
      source: "supabase_claims";
    }
  | {
      ok: false;
      status: "mock_mode";
      reason: "mock_mode" | "supabase_env_missing_auto_fallback";
      sessionUserId: null;
      source: "mock_fallback";
    }
  | {
      ok: false;
      status: "misconfigured";
      reason: "supabase_env_missing" | "supabase_client_missing";
      sessionUserId: null;
      source: "supabase_claims";
    }
  | {
      ok: false;
      status: "unauthenticated";
      reason: "no_session" | "claims_missing" | "subject_missing";
      sessionUserId: null;
      source: "supabase_claims";
    }
  | {
      ok: false;
      status: "error";
      reason: "claims_error";
      sessionUserId: null;
      message: string;
      source: "supabase_claims";
    };

export async function readServerSessionFromSupabase({
  authMode,
  hasSupabasePublicConfig,
  getClaims,
}: ServerSessionReaderRequest): Promise<ServerSessionReaderResult> {
  if (authMode === "mock") {
    return {
      ok: false,
      status: "mock_mode",
      reason: "mock_mode",
      sessionUserId: null,
      source: "mock_fallback",
    };
  }

  if (!hasSupabasePublicConfig) {
    if (authMode === "auto") {
      return {
        ok: false,
        status: "mock_mode",
        reason: "supabase_env_missing_auto_fallback",
        sessionUserId: null,
        source: "mock_fallback",
      };
    }

    return {
      ok: false,
      status: "misconfigured",
      reason: "supabase_env_missing",
      sessionUserId: null,
      source: "supabase_claims",
    };
  }

  if (!getClaims) {
    return {
      ok: false,
      status: "misconfigured",
      reason: "supabase_client_missing",
      sessionUserId: null,
      source: "supabase_claims",
    };
  }

  const { data, error } = await getClaims();

  if (error) {
    if (isMissingSessionError(error)) {
      return {
        ok: false,
        status: "unauthenticated",
        reason: "no_session",
        sessionUserId: null,
        source: "supabase_claims",
      };
    }

    return {
      ok: false,
      status: "error",
      reason: "claims_error",
      sessionUserId: null,
      message: error.message ?? error.name ?? "Unknown Supabase claims error",
      source: "supabase_claims",
    };
  }

  const claims = data?.claims;

  if (!claims) {
    return {
      ok: false,
      status: "unauthenticated",
      reason: "claims_missing",
      sessionUserId: null,
      source: "supabase_claims",
    };
  }

  const sessionUserId = getStringClaim(claims.sub);

  if (!sessionUserId) {
    return {
      ok: false,
      status: "unauthenticated",
      reason: "subject_missing",
      sessionUserId: null,
      source: "supabase_claims",
    };
  }

  return {
    ok: true,
    status: "authenticated",
    sessionUserId,
    email: getStringClaim(claims.email),
    role: getStringClaim(claims.role),
    aal: getStringClaim(claims.aal),
    sessionId: getStringClaim(claims.session_id),
    source: "supabase_claims",
  };
}

function getStringClaim(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isMissingSessionError(error: { name?: string; message?: string; status?: number }) {
  return (
    error.name === "AuthSessionMissingError" ||
    error.message?.toLowerCase().includes("auth session missing") ||
    error.status === 401
  );
}
