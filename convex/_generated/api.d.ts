/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_account_avatar from "../lib/account/avatar.js";
import type * as lib_account_ensureProfile from "../lib/account/ensureProfile.js";
import type * as lib_account_profile from "../lib/account/profile.js";
import type * as lib_auth_identity from "../lib/auth/identity.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_email_messages from "../lib/email/messages.js";
import type * as lib_email_send from "../lib/email/send.js";
import type * as lib_email_template from "../lib/email/template.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_orgs_cascade from "../lib/orgs/cascade.js";
import type * as lib_orgs_email from "../lib/orgs/email.js";
import type * as lib_orgs_invites from "../lib/orgs/invites.js";
import type * as lib_orgs_membership from "../lib/orgs/membership.js";
import type * as lib_orgs_people from "../lib/orgs/people.js";
import type * as lib_orgs_permissions from "../lib/orgs/permissions.js";
import type * as lib_orgs_slug from "../lib/orgs/slug.js";
import type * as lib_pathway from "../lib/pathway.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as members from "../members.js";
import type * as orgRoles from "../orgRoles.js";
import type * as orgs from "../orgs.js";
import type * as profiles from "../profiles.js";
import type * as tables_demo from "../tables/demo.js";
import type * as tables_orgs from "../tables/orgs.js";
import type * as tables_profiles from "../tables/profiles.js";
import type * as tables_sprint from "../tables/sprint.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  auth: typeof auth;
  http: typeof http;
  invites: typeof invites;
  "lib/account/avatar": typeof lib_account_avatar;
  "lib/account/ensureProfile": typeof lib_account_ensureProfile;
  "lib/account/profile": typeof lib_account_profile;
  "lib/auth/identity": typeof lib_auth_identity;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/email/messages": typeof lib_email_messages;
  "lib/email/send": typeof lib_email_send;
  "lib/email/template": typeof lib_email_template;
  "lib/errors": typeof lib_errors;
  "lib/orgs/cascade": typeof lib_orgs_cascade;
  "lib/orgs/email": typeof lib_orgs_email;
  "lib/orgs/invites": typeof lib_orgs_invites;
  "lib/orgs/membership": typeof lib_orgs_membership;
  "lib/orgs/people": typeof lib_orgs_people;
  "lib/orgs/permissions": typeof lib_orgs_permissions;
  "lib/orgs/slug": typeof lib_orgs_slug;
  "lib/pathway": typeof lib_pathway;
  "lib/rateLimits": typeof lib_rateLimits;
  members: typeof members;
  orgRoles: typeof orgRoles;
  orgs: typeof orgs;
  profiles: typeof profiles;
  "tables/demo": typeof tables_demo;
  "tables/orgs": typeof tables_orgs;
  "tables/profiles": typeof tables_profiles;
  "tables/sprint": typeof tables_sprint;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
