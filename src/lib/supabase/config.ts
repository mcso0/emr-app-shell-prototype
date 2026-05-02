export type AuthMode = "mock" | "supabase" | "auto";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
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
  const mode = getAuthMode();

  if (mode === "mock") return false;
  if (mode === "supabase") return true;

  return hasSupabasePublicConfig();
}
