import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/url";

// /careers/map and /careers/map/new are public: the map works from a draft before sign-up (spec 5.3).
export const PRIVATE =
  /^\/(manager|me|settings|workspace|setup|guide|home|join\/preview|tracks|careers(?!\/map(?:\/new)?\/?$))(\/|$)/;
const AUTH_PAGES = /^\/(login|signup)\/?$/;

/**
 * R1: cookie presence only, no Convex call. Whether the session is real is
 * Convex's answer (`viewer.home`); a stale cookie ends at /signed-out. A
 * closed app is refused by Convex and turned into "/" by `openOrHome`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = getSessionCookie(request) !== null;
  if (!signedIn && PRIVATE.test(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    // L: a careers page asks for the From Zero to Hero log in.
    if (pathname.startsWith("/careers/"))
      login.searchParams.set("track", "career");
    return NextResponse.redirect(login);
  }
  // GET only: the forms' own server action (`startAccount`) posts back to
  // /signup or /login once the cookie is set, and must reach the page.
  if (signedIn && request.method === "GET" && AUTH_PAGES.test(pathname)) {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next ?? "/home", request.url));
  }
  // A layout can't see its path; the (app) layout needs it to send a
  // career-only account from /settings to /careers/settings (D8).
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

export const PATH_HEADER = "x-ltw-path";

export const config = {
  // Build output, API routes and anything with an extension pass untouched.
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
