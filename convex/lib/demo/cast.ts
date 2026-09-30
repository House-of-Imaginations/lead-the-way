import { components } from "../../_generated/api";
import type { ActionCtx, MutationCtx } from "../../_generated/server";

/**
 * The Calder Lane cast (`docs/design/data-model.md`). Everyone but Omar has an
 * account, so a tester can switch to them; Omar stays a pending invitation.
 * Job titles after Dan's are drafts for review.
 */
export const DEMO_DOMAIN = "calderlane.com.au";

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
 * An address as it is compared: trimmed, lowercased, and without the one
 * trailing dot a fully qualified domain may carry (it still delivers).
 */
export const normalEmail = (email: string) =>
  email.trim().toLowerCase().replace(/\.$/, "");

/** Demo addresses can't receive mail, so nothing is ever sent to one. */
export const isDemoAddress = (email: string) =>
  normalEmail(email).endsWith(`@${DEMO_DOMAIN}`);

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
