import type { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/account/auth-client";

/**
 * Sign out and back in as another demo persona, then load `to` in full: the
 * server layouts read the new session and paint its shell and banner. The
 * password comes from a DEMO_MODE-gated query, never the bundle (spec 6).
 * Anything that fails ends at log in, never silently where it started.
 */
export async function switchPersona(
  convex: ConvexReactClient,
  email: string,
  to = "/home",
) {
  let next = "/login";
  try {
    const password = await convex.query(api.demo.personaPassword, {});
    if (password) {
      await authClient.signOut();
      const { error } = await authClient.signIn.email({ email, password });
      if (!error) next = to;
    }
  } catch {
    // A rejection ends at log in too.
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
  window.location.assign(next);
}
