import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { lastLoginMethod } from "better-auth/plugins";
import { username } from "better-auth/plugins/username";
import type { BetterAuthOptions } from "better-auth";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { flagOn } from "./app";
import type { DataModel } from "./_generated/dataModel";
import { publicQuery } from "./lib/customFunctions";
import { insertProfile, profileOf } from "./lib/account/profile";
import { isDemoAddress } from "./lib/demo/cast";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "./lib/email/messages";
import type { EmailCtx } from "./lib/email/send";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

const authFunctions: AuthFunctions = internal.auth;

/**
 * The profile row is created at sign-up by this trigger, in the same
 * transaction as the auth user, so no product screen meets an account without
 * one. `ensureProfile` covers accounts from before the trigger existed.
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        if (!(await profileOf(ctx, doc._id))) {
          await insertProfile(ctx, doc._id, doc.name);
        }
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

/**
 * Social providers are registered only when their credentials are present in the
 * Convex deployment env. This keeps email/username sign-in working before the
 * OAuth apps exist -- add creds with `npx convex env set GOOGLE_CLIENT_ID ...`
 * and the buttons start working with no code change.
 */
const socialProviders = (): BetterAuthOptions["socialProviders"] => {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.discord = {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    };
  }

  return providers;
};

/**
 * Better Auth's senders, given a ctx that can actually send.
 *
 * `GenericCtx` is the union of query, mutation and action contexts, and only
 * the last two carry `runMutation`, which is what queueing an email needs.
 * Better Auth only ever calls a sender from an HTTP action, so this narrows
 * rather than throws -- but it narrows with a CHECK instead of a cast, because
 * a cast here would be a claim about somebody else's call graph.
 */
function emailCtx(ctx: GenericCtx<DataModel>): EmailCtx | null {
  return "runMutation" in ctx ? (ctx as EmailCtx) : null;
}

/** What a signed-in persona may not do to the account every tester shares. */
const DEMO_LOCKED = new Set([
  "/change-password",
  "/change-email",
  "/update-user",
  "/delete-user",
]);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // Deliberately still false. Verification is SENT (below) but not
      // demanded: blocking sign-in on a click in an inbox turns a deployment
      // with no sending domain into one where nobody can get in, and this
      // product's rule is that an unconfigured feature is inert, not fatal.
      // Nothing in the product depends on a verified address: an invitation
      // checks only that the address matches (spec 5).
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        const sender = emailCtx(ctx);
        if (sender) {
          await sendPasswordResetEmail(sender, { to: user.email, link: url });
        }
      },
    },
    emailVerification: {
      // On sign-up, because that is the only moment the address is fresh in
      // somebody's mind. A courtesy, not a gate: an invitation pinned to an
      // address asks only that the account's address matches, verified or not.
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        const sender = emailCtx(ctx);
        if (sender) {
          await sendVerificationEmail(sender, { to: user.email, link: url });
        }
      },
    },
    user: {
      // Settings > Profile. The new address only replaces the old one once its
      // link is clicked -- Better Auth sends that link through the
      // `sendVerificationEmail` above. An invitation pinned to an address needs
      // that address and its link; the link, which only the inbox has, is the
      // proof (spec 5).
      changeEmail: { enabled: true },
    },
    socialProviders: socialProviders(),
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // While the app is closed: no sign-in, sign-up or session. See `convex/app.ts`.
        if (flagOn("closed"))
          throw new APIError("SERVICE_UNAVAILABLE", {
            message: "FEATURE_UNAVAILABLE",
          });
        if (!flagOn("demo")) return;

        // The demo accounts are shared: every tester holds the one demo
        // password, and a reset reuses the accounts as they are. So nobody
        // may change one, and only the seed may create one: its
        // `auth.api.signUpEmail` call has no `ctx.request`, while anything
        // from a browser does. Real accounts pass untouched.
        if (ctx.path === "/sign-up/email") {
          const email: unknown = ctx.body?.email;
          if (ctx.request && typeof email === "string" && isDemoAddress(email))
            throw new APIError("FORBIDDEN", {
              message:
                "Demo accounts are made by the seed. Use the persona switch.",
            });
        } else if (DEMO_LOCKED.has(ctx.path)) {
          const session = await getSessionFromCtx(ctx);
          if (session && isDemoAddress(session.user.email))
            throw new APIError("FORBIDDEN", {
              message:
                "Demo accounts can't be changed. Reset the demo instead.",
            });
        }
      }),
    },
    // `username()` layers username sign-in on top of email+password, so either
    // identifier works. It is on the Convex component's supported-plugin list.
    // `lastLoginMethod` sets a readable cookie so the sign-in page can tag the
    // method used last. Username sign-in shares the email form, so it counts
    // as "email"; returning null falls back to the plugin's own mapping.
    plugins: [
      username(),
      lastLoginMethod({
        customResolveMethod: (ctx) =>
          ctx.path === "/sign-in/username" ? "email" : null,
      }),
      convex({ authConfig }),
    ],
  });

const authUserValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  name: v.string(),
  email: v.string(),
  emailVerified: v.boolean(),
  image: v.optional(v.union(v.null(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
  twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
  isAnonymous: v.optional(v.union(v.null(), v.boolean())),
  username: v.optional(v.union(v.null(), v.string())),
  displayUsername: v.optional(v.union(v.null(), v.string())),
  phoneNumber: v.optional(v.union(v.null(), v.string())),
  phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
  userId: v.optional(v.union(v.null(), v.string())),
});

/** Current signed-in user, or null when signed out. */
export const getCurrentUser = publicQuery({
  args: {},
  returns: v.union(v.null(), authUserValidator),
  handler: async (ctx) => {
    return (await authComponent.safeGetAuthUser(ctx)) ?? null;
  },
});

/** Which social providers are actually configured, so the UI can hide dead buttons. */
export const enabledSocialProviders = publicQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async () => Object.keys(socialProviders() ?? {}),
});
