import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublicConfig,
  shouldUseSupabaseAuth,
} from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!shouldUseSupabaseAuth()) {
    return response;
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        Object.entries(headersToSet).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}
