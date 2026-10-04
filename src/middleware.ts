import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const pathname = nextUrl.pathname;

  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/register") || pathname.startsWith("/api/admin/seed")) return NextResponse.next();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  const mustChange = (session.user as { mustChangePassword?: boolean }).mustChangePassword;
  if (mustChange && pathname !== "/dashboard/change-password" && !pathname.startsWith("/api/profile/change-password")) {
    return NextResponse.redirect(new URL("/dashboard/change-password", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/calendar/:path*", "/api/passwords/:path*", "/api/profile/:path*", "/api/admin/:path*"],
};
