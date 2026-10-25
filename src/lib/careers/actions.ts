"use server";

import { fetchMutation } from "convex/nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import type {
  CURRENT_ROLES,
  Hours,
  TargetId,
} from "@convex/lib/careers/catalog";
import { fetchAuthMutation } from "@/lib/account/auth-server";
import { userMessage } from "@/lib/errors";
import { DRAFT_COOKIE, draftToken } from "./draftCookie";

type CurrentRole = (typeof CURRENT_ROLES)[number];

/**
 * 2 Tell us: saves the answers as the anonymous draft (P9), keeps its token
 * in the cookie and opens the map. Convex validates every field.
 */
export async function saveMap(answers: {
  partner?: string;
  currentRole: CurrentRole;
  targetRole: TargetId;
  hoursPerWeek: Hours;
  consent: boolean;
}): Promise<{ error: string }> {
  let token: string;
  try {
    // Convex's validators reject anything outside the catalog.
    token = await fetchMutation(api.careers.drafts.saveAnswers, {
      ...answers,
      token: await draftToken(),
    });
  } catch (error) {
    return {
      error: userMessage(error, "We couldn't build your map. Try again."),
    };
  }
  (await cookies()).set(DRAFT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/careers/map");
}

/** 3 Pivot Map: the hours switcher. Nothing happens without a draft. */
export async function setMapHours(hoursPerWeek: Hours): Promise<void> {
  const token = await draftToken();
  if (token)
    await fetchMutation(api.careers.drafts.setHours, { token, hoursPerWeek });
}

/**
 * MS3: starts the private track, claiming the Pivot Map draft in the cookie
 * (spec 5.3), then drops the cookie. Convex checks the session and refuses a
 * work address (X3).
 */
export async function startPrivateTrack(
  contactEmail: string,
): Promise<{ error: string } | null> {
  const token = await draftToken();
  try {
    await fetchAuthMutation(api.careers.tracks.startPrivate, {
      contactEmail,
      draftToken: token,
    });
  } catch (error) {
    return {
      error: userMessage(error, "The track wasn't started. Try again."),
    };
  }
  if (token) (await cookies()).delete(DRAFT_COOKIE);
  return null;
}
