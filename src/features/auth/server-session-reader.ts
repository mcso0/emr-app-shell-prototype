import "server-only";

import {
  type ServerSessionClaims,
  type ServerSessionReaderResult,
  readServerSessionFromSupabase,
} from "@/features/auth/server-session-contract";
import { getAuthMode, hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function readServerSession(): Promise<ServerSessionReaderResult> {
  const client = await createClient();

  return readServerSessionFromSupabase({
    authMode: getAuthMode(),
    hasSupabasePublicConfig: hasSupabasePublicConfig(),
    getClaims: client
      ? async () => {
          const { data, error } = await client.auth.getClaims();

          return {
            data: data ? { claims: data.claims as ServerSessionClaims } : null,
            error: error
              ? {
                  name: error.name,
                  message: error.message,
                  status: "status" in error ? error.status : undefined,
                }
              : null,
          };
        }
      : undefined,
  });
}

export type { ServerSessionReaderResult } from "@/features/auth/server-session-contract";
