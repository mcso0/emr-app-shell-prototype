import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    (process.env.VERCEL_ENV === "preview" ||
      process.env.NODE_ENV === "development") &&
    (path === "/review/chart-search" ||
      path.startsWith("/chart-search-review/"))
  ) {
    return NextResponse.next();
  }
  const response = await updateSession(request);
  if (path === "/review/cheongdam") {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
