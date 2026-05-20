export type AuthMode = "mock" | "supabase" | "auto";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type AuthRuntimeMode = {
  authMode: AuthMode;
  authProvider: "mock" | "supabase";
  supabaseConfigured: boolean;
  clientSessionSource: "mock_storage" | "supabase_cookie";
  serverSessionSource: "mock_fallback" | "supabase_claims";
  missingConfigBehavior:
    | "none"
    | "auto_mock_fallback"
    | "supabase_configuration_error";
};

const authModes = new Set<AuthMode>(["mock", "supabase", "auto"]);

export function getAuthMode(): AuthMode {
  const value = process.env.NEXT_PUBLIC_AUTH_MODE;

  if (authModes.has(value as AuthMode)) {
    return value as AuthMode;
  }

  return "auto";
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;

  return { url, publishableKey };
}

export function hasSupabasePublicConfig() {
  return getSupabasePublicConfig() !== null;
}

export function shouldUseSupabaseAuth() {
  return getAuthRuntimeMode().authProvider === "supabase";
}

export function getAuthRuntimeMode(): AuthRuntimeMode {
  const authMode = getAuthMode();
  const supabaseConfigured = hasSupabasePublicConfig();

  if (authMode === "mock") {
    return {
      authMode,
      authProvider: "mock",
      supabaseConfigured,
      clientSessionSource: "mock_storage",
      serverSessionSource: "mock_fallback",
      missingConfigBehavior: "none",
    };
  }

  if (authMode === "supabase") {
    return {
      authMode,
      authProvider: "supabase",
      supabaseConfigured,
      clientSessionSource: "supabase_cookie",
      serverSessionSource: "supabase_claims",
      missingConfigBehavior: supabaseConfigured ? "none" : "supabase_configuration_error",
    };
  }

  if (supabaseConfigured) {
    return {
      authMode,
      authProvider: "supabase",
      supabaseConfigured,
      clientSessionSource: "supabase_cookie",
      serverSessionSource: "supabase_claims",
      missingConfigBehavior: "none",
    };
  }

  return {
    authMode,
    authProvider: "mock",
    supabaseConfigured,
    clientSessionSource: "mock_storage",
    serverSessionSource: "mock_fallback",
    missingConfigBehavior: "auto_mock_fallback",
  };
}
