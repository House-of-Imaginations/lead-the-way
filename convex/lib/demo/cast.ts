import { components } from "../../_generated/api";
import type { ActionCtx, MutationCtx } from "../../_generated/server";
import { normalEmail } from "../inviteRules";

/**
 * The Calder Lane cast (`docs/design/data-model.md`). Everyone but Omar has an
 * account, so a tester can switch to them; Omar stays a pending invitation.
 * Job titles after Dan's are drafts for review.
 */
/** Calder Lane's domain, and the careers cast's reserved one (spec 7). */
export const DEMO_DOMAINS = ["calderlane.com.au", "pivotcrews.example"];

export const DEMO_CAST = [
  {
    key: "priya",
    name: "Priya Raman",
    email: "priya.raman@calderlane.com.au",
    jobTitle: "Team manager",
    account: true,
  },
  {
    key: "dan",
    name: "Dan Okafor",
    email: "dan.okafor@calderlane.com.au",
    jobTitle: "Senior Account Executive",
    account: true,
  },
  {
    key: "sarah",
    name: "Sarah Whitlock",
    email: "sarah.whitlock@calderlane.com.au",
    jobTitle: "Account Manager",
    account: true,
  },
  {
    key: "mei",
    name: "Mei Tanaka",
    email: "mei.tanaka@calderlane.com.au",
    jobTitle: "Client Coordinator",
    account: true,
  },
  {
    key: "tomas",
    name: "Tomás Reyes",
    email: "tomas.reyes@calderlane.com.au",
    jobTitle: "Account Executive",
    account: true,
  },
  {
    key: "aisha",
    name: "Aisha Karimi",
    email: "aisha.karimi@calderlane.com.au",
    jobTitle: "Client Services Analyst",
    account: true,
  },
  {
    key: "luca",
    name: "Luca Bianchi",
    email: "luca.bianchi@calderlane.com.au",
    jobTitle: "Account Executive",
    account: true,
  },
  {
    key: "grace",
    name: "Grace Oyelaran",
    email: "grace.oyelaran@calderlane.com.au",
    jobTitle: "Client Coordinator",
    account: true,
  },
  {
    key: "omar",
    name: "Omar Haddad",
    email: "omar.haddad@calderlane.com.au",
    jobTitle: "Account Manager",
    account: false,
  },
] as const;

export type CastKey = (typeof DEMO_CAST)[number]["key"];

export const ACCOUNT_HOLDERS = DEMO_CAST.filter((person) => person.account);

export function castOf(key: CastKey) {
  const person = DEMO_CAST.find((p) => p.key === key);
  if (!person) throw new Error(`No demo cast member called ${key}.`);
  return person;
}

/**
 * The Change careers cast's login accounts (spec 7, plan A1). Amara learns;
 * Lena and Kofi are Pathway Guides. Not in the /login picker (`loginCast`).
 */
export const CAREER_CAST = [
  { key: "amara", name: "Amara Okoye", email: "amara@pivotcrews.example" },
  { key: "lena", name: "Lena Fischer", email: "lena@pivotcrews.example" },
  { key: "kofi", name: "Kofi Mensah", email: "kofi@pivotcrews.example" },
] as const;

/** Demo addresses can't receive mail, so nothing is ever sent to one. */
export const isDemoAddress = (email: string) => {
  const address = normalEmail(email);
  return DEMO_DOMAINS.some((domain) => address.endsWith(`@${domain}`));
};

/** The auth user id for an address, or null. */
export async function demoUserId(
  ctx: Pick<ActionCtx | MutationCtx, "runQuery">,
  email: string,
): Promise<string | null> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email }],
  })) as { _id: string } | null;
  return user?._id ?? null;
}
