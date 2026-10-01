import type { ConvexError } from "convex/values";
import { redirect } from "next/navigation";
import { cache } from "react";
import { api } from "@convex/_generated/api";
import { errorCode } from "@/lib/errors";
import { fetchAuthQuery } from "./auth-server";

/**
 * R1: the proxy no longer asks Convex whether the app is closed. Convex refuses
 * every public function while it is (FEATURE_UNAVAILABLE with flag "closed",
 * from `assertFlag` in `convex/app.ts`), and every page that reads Convex goes
 * through here, so a closed app sends people to "/". Another flag's refusal
 * is that feature's, not a closed app.
 */
export async function openOrHome<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    // A code means a ConvexError carrying an object (`errorCode`).
    if (
      errorCode(error) === "FEATURE_UNAVAILABLE" &&
      (error as ConvexError<{ flag?: string }>).data.flag === "closed"
    )
      redirect("/");
    throw error;
  }
}

/**
 * A manager page's read. A role in the manager area without the permission
 * the read needs (team:insights but not sprint:manage) goes to /manager, never
 * to an error page, and never to its home, which may be /setup/team.
 */
export async function managerRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await openOrHome(read);
  } catch (error) {
    if (errorCode(error) === "FORBIDDEN") redirect("/manager");
    throw error;
  }
}

// One read per request, however many layouts and pages ask.
export const getAuthMethods = cache(() =>
  openOrHome(() => fetchAuthQuery(api.authMethods.enabled, {})),
);
export const getHome = cache(() =>
  openOrHome(() => fetchAuthQuery(api.viewer.home, {})),
);
export const getShell = cache(() =>
  openOrHome(() => fetchAuthQuery(api.viewer.shell, {})),
);
export const getProfile = cache(() =>
  openOrHome(() => fetchAuthQuery(api.profiles.me, {})),
);
