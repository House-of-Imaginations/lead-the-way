import { redirect } from "next/navigation";
import { cache } from "react";
import { api } from "@convex/_generated/api";
import { errorCode } from "@/lib/errors";
import { fetchAuthQuery } from "./auth-server";

/**
 * R1: the proxy no longer asks Convex whether the app is closed. Convex refuses
 * every public function while it is (FEATURE_UNAVAILABLE), and every page
 * that reads Convex goes through here, so a closed app sends people to "/".
 */
export async function openOrHome<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (errorCode(error) === "FEATURE_UNAVAILABLE") redirect("/");
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
