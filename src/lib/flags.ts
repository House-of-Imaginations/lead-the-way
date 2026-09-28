import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Flag } from "@convex/app";

/**
 * A Convex feature flag, read server-side. This only decides what to show; the
 * refusal belongs to `assertFlag` on the backend. An unreachable backend reads
 * as off, which for `closed` means open: the backend refuses on its own then.
 */
export async function flagOn(flag: Flag) {
  try {
    return await fetchQuery(api.app.flag, { flag });
  } catch {
    return false;
  }
}
