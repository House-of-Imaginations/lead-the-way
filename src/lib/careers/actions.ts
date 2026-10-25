"use server";

import { fetchMutation } from "convex/nextjs";
import type { FunctionArgs } from "convex/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import type {
  CURRENT_ROLES,
  CredentialId,
  Hours,
  TargetId,
} from "@convex/lib/careers/catalog";
import { fetchAuthMutation } from "@/lib/account/auth-server";
import { getAccountShell } from "@/lib/account/queries";
import { startAccount } from "@/lib/account/start";
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
 * "Save my map" for a signed-in account, which sign-up would bounce. A seat
 * holder's only way in is MS3 (X3), which claims the draft itself; anyone
 * else claims it as a career sign-up does.
 */
export async function claimMap(): Promise<void> {
  if ((await getAccountShell())?.team) redirect("/tracks/private/new");
  const result = await startAccount(false, undefined, "career");
  redirect("next" in result ? result.next : "/start");
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

type Result = { error: string } | null;

/** A career mutation as the signed-in account; its refusal becomes a sentence. */
async function tryMutation(
  write: () => Promise<unknown>,
  fallback: string,
): Promise<Result> {
  try {
    await write();
    return null;
  } catch (error) {
    return { error: userMessage(error, fallback) };
  }
}

/** D8 and 6: one privacy or reminder switch, saved at once. */
export async function setCareerSetting(
  key: FunctionArgs<typeof api.careers.careerSettings.set>["key"],
  on: boolean,
): Promise<Result> {
  return tryMutation(
    () => fetchAuthMutation(api.careers.careerSettings.set, { key, on }),
    "That setting wasn't saved. Try again.",
  );
}

/** 6: the project's own switch, "Add this reflection to my proof" (P5). */
export async function setReflectionOnProof(on: boolean): Promise<Result> {
  return tryMutation(
    () => fetchAuthMutation(api.careers.demoDay.setAddToProof, { on }),
    "That setting wasn't saved. Try again.",
  );
}

/** 6: the Test Card measure, 1 to 5. */
export async function rateConfidence(
  credentialId: CredentialId,
  value: number,
): Promise<Result> {
  return tryMutation(
    () =>
      fetchAuthMutation(api.careers.proof.rateConfidence, {
        credentialId,
        value,
      }),
    "Your answer wasn't saved. Try again.",
  );
}

/** 6: the shareable link for a badge; the same one on a repeat. */
export async function createProofLink(
  credentialId: CredentialId,
): Promise<{ slug: string } | { error: string }> {
  try {
    return {
      slug: await fetchAuthMutation(api.careers.proof.createProofLink, {
        credentialId,
      }),
    };
  } catch (error) {
    return {
      error: userMessage(error, "The link wasn't made. Try again."),
    };
  }
}

/** D8 Profile: a private track's contact address (X3). */
export async function saveContactEmail(contactEmail: string): Promise<Result> {
  return tryMutation(
    () =>
      fetchAuthMutation(api.careers.tracks.setContactEmail, { contactEmail }),
    "Your email wasn't saved. Try again.",
  );
}

/** D8, P8: deletes the Pivot Map answers and the draft the cookie names. */
export async function deleteMapAnswers(): Promise<Result> {
  const token = await draftToken();
  const result = await tryMutation(
    () =>
      fetchAuthMutation(api.careers.careerSettings.deleteAnswers, {
        draftToken: token,
      }),
    "Your answers weren't deleted. Try again.",
  );
  if (!result && token) (await cookies()).delete(DRAFT_COOKIE);
  return result;
}

/** D8, MS4: deletes the whole career track. Badges and endorsements stay. */
export async function deleteCareerTrack(): Promise<Result> {
  return tryMutation(
    () => fetchAuthMutation(api.careers.tracks.deleteCareer, {}),
    "The track wasn't deleted. Try again.",
  );
}
