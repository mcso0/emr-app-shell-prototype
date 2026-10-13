import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSafeLoginNextHref } from "@/features/auth/login-entry-contract";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeLoginNextHref(request.nextUrl.searchParams.get("next"));
  if (code) {
    const client = await createClient();
    if (client) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("method", "otp");
  login.searchParams.set("reason", "otp_link_invalid");
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
