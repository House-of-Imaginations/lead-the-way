import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { handler } from "@/lib/account/auth-server";

/**
 * Log in as a demo person from /login (Task 9). The browser sends only an
 * email; the shared password is read here, from the server env, and goes
 * straight to Better Auth's own sign-in through the auth route's proxy, so it
 * never reaches the bundle, a response body or a log. Only an email in
 * `demo.loginCast` is accepted, and that list is empty with DEMO_MODE off.
 * The answer carries Better Auth's session cookie and nothing else.
 */
export async function POST(request: Request) {
  const cast = await fetchQuery(api.demo.loginCast, {}).catch(() => []);
  const password = process.env.DEMO_PASSWORD;
  if (cast.length === 0 || !password)
    return new Response(null, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const email =
    body && typeof body === "object" && "email" in body ? body.email : null;
  if (!cast.some((person) => person.email === email))
    return new Response(null, { status: 401 });

  // The browser's own headers (origin included) go through, so Better Auth's
  // origin check still applies.
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const signedIn = await handler.POST(
    new Request(new URL("/api/auth/sign-in/email", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    }),
  );
  if (!signedIn.ok) return new Response(null, { status: 401 });

  const answer = new Response(null, { status: 204 });
  for (const cookie of signedIn.headers.getSetCookie())
    answer.headers.append("set-cookie", cookie);
  return answer;
}
