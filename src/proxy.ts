import { NextResponse, type NextRequest } from "next/server";
import { flagOn } from "@/lib/flags";

/**
 * The kill switch. While the `closed` flag is on, every page
 * but the landing page sends the visitor home. Auth and data are refused by the
 * backend itself.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/" || !(await flagOn("closed")))
    return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  // Build output, API routes and anything with an extension pass untouched.
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
