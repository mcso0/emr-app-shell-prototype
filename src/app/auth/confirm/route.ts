import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSafeInviteNextHref } from "@/features/auth/invite-otp-handoff";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeInviteNextHref(request.nextUrl.searchParams.get("next"));

  if (tokenHash && type && next) {
    const supabase = await createClient();
    const { error } = supabase
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("supabase-not-configured") };

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?reason=invite_email_otp_error", request.url));
}
