import { NextResponse, type NextRequest } from "next/server";

/**
 * Ruling 16: a session cookie Convex no longer accepts. The proxy only sees
 * that a cookie exists, so without this `/login` and `/home` would bounce
 * forever. Drop every Better Auth cookie, then log in.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  for (const { name } of request.cookies.getAll()) {
    if (/^(__Secure-)?better-auth\./.test(name))
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        secure: name.startsWith("__Secure-"),
      });
  }
  return response;
}
