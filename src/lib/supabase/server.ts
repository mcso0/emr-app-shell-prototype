import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type SupabaseServerClientOptions = {
  requestId?: string | null;
};

const safeRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeSupabaseRequestId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && safeRequestIdPattern.test(normalized)
    ? normalized
    : null;
}

export async function createClient(options: SupabaseServerClientOptions = {}) {
  const config = getSupabasePublicConfig();

  if (!config) return null;

  const cookieStore = await cookies();
  const requestId = normalizeSupabaseRequestId(options.requestId);

  return createServerClient(config.url, config.publishableKey, {
    ...(requestId
      ? {
          global: {
            headers: { "x-request-id": requestId },
          },
        }
      : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but cannot write them.
        }
      },
    },
  });
}
