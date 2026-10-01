/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agreements from "../agreements.js";
import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as authMethods from "../authMethods.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_account_avatar from "../lib/account/avatar.js";
import type * as lib_account_ensureProfile from "../lib/account/ensureProfile.js";
import type * as lib_account_profile from "../lib/account/profile.js";
import type * as lib_agreement from "../lib/agreement.js";
import type * as lib_auth_identity from "../lib/auth/identity.js";
import type * as lib_auth_providers from "../lib/auth/providers.js";
import type * as lib_clock from "../lib/clock.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_demo_calderLane from "../lib/demo/calderLane.js";
import type * as lib_demo_cast from "../lib/demo/cast.js";
import type * as lib_demo_moveClock from "../lib/demo/moveClock.js";
import type * as lib_demo_schedule from "../lib/demo/schedule.js";
import type * as lib_demo_script from "../lib/demo/script.js";
import type * as lib_email_messages from "../lib/email/messages.js";
import type * as lib_email_send from "../lib/email/send.js";
import type * as lib_email_template from "../lib/email/template.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_inviteRules from "../lib/inviteRules.js";
import type * as lib_orgs_cascade from "../lib/orgs/cascade.js";
import type * as lib_orgs_create from "../lib/orgs/create.js";
import type * as lib_orgs_email from "../lib/orgs/email.js";
import type * as lib_orgs_invites from "../lib/orgs/invites.js";
import type * as lib_orgs_join from "../lib/orgs/join.js";
import type * as lib_orgs_membership from "../lib/orgs/membership.js";
import type * as lib_orgs_people from "../lib/orgs/people.js";
import type * as lib_orgs_permissions from "../lib/orgs/permissions.js";
import type * as lib_orgs_slug from "../lib/orgs/slug.js";
import type * as lib_pathway from "../lib/pathway.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_setupOptions from "../lib/setupOptions.js";
import type * as lib_setupSteps from "../lib/setupSteps.js";
import type * as lib_shell from "../lib/shell.js";
import type * as lib_snapshots from "../lib/snapshots.js";
import type * as lib_sprint from "../lib/sprint.js";
import type * as lib_sprintTime from "../lib/sprintTime.js";
import type * as lib_surveys from "../lib/surveys.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_viewer from "../lib/viewer.js";
import type * as members from "../members.js";
import type * as onboarding from "../onboarding.js";
import type * as orgRoles from "../orgRoles.js";
import type * as orgs from "../orgs.js";
import type * as pathway from "../pathway.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as snapshots from "../snapshots.js";
import type * as sprints from "../sprints.js";
import type * as tables_demo from "../tables/demo.js";
import type * as tables_orgs from "../tables/orgs.js";
import type * as tables_profiles from "../tables/profiles.js";
import type * as tables_sprint from "../tables/sprint.js";
import type * as teams from "../teams.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agreements: typeof agreements;
  app: typeof app;
  auth: typeof auth;
  authMethods: typeof authMethods;
  demo: typeof demo;
  http: typeof http;
  invites: typeof invites;
  "lib/account/avatar": typeof lib_account_avatar;
  "lib/account/ensureProfile": typeof lib_account_ensureProfile;
  "lib/account/profile": typeof lib_account_profile;
  "lib/agreement": typeof lib_agreement;
  "lib/auth/identity": typeof lib_auth_identity;
  "lib/auth/providers": typeof lib_auth_providers;
  "lib/clock": typeof lib_clock;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/demo/calderLane": typeof lib_demo_calderLane;
  "lib/demo/cast": typeof lib_demo_cast;
  "lib/demo/moveClock": typeof lib_demo_moveClock;
  "lib/demo/schedule": typeof lib_demo_schedule;
  "lib/demo/script": typeof lib_demo_script;
  "lib/email/messages": typeof lib_email_messages;
  "lib/email/send": typeof lib_email_send;
  "lib/email/template": typeof lib_email_template;
  "lib/errors": typeof lib_errors;
  "lib/events": typeof lib_events;
  "lib/inviteRules": typeof lib_inviteRules;
  "lib/orgs/cascade": typeof lib_orgs_cascade;
  "lib/orgs/create": typeof lib_orgs_create;
  "lib/orgs/email": typeof lib_orgs_email;
  "lib/orgs/invites": typeof lib_orgs_invites;
  "lib/orgs/join": typeof lib_orgs_join;
  "lib/orgs/membership": typeof lib_orgs_membership;
  "lib/orgs/people": typeof lib_orgs_people;
  "lib/orgs/permissions": typeof lib_orgs_permissions;
  "lib/orgs/slug": typeof lib_orgs_slug;
  "lib/pathway": typeof lib_pathway;
  "lib/privacy": typeof lib_privacy;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/setupOptions": typeof lib_setupOptions;
  "lib/setupSteps": typeof lib_setupSteps;
  "lib/shell": typeof lib_shell;
  "lib/snapshots": typeof lib_snapshots;
  "lib/sprint": typeof lib_sprint;
  "lib/sprintTime": typeof lib_sprintTime;
  "lib/surveys": typeof lib_surveys;
  "lib/tenant": typeof lib_tenant;
  "lib/viewer": typeof lib_viewer;
  members: typeof members;
  onboarding: typeof onboarding;
  orgRoles: typeof orgRoles;
  orgs: typeof orgs;
  pathway: typeof pathway;
  profiles: typeof profiles;
  seed: typeof seed;
  snapshots: typeof snapshots;
  sprints: typeof sprints;
  "tables/demo": typeof tables_demo;
  "tables/orgs": typeof tables_orgs;
  "tables/profiles": typeof tables_profiles;
  "tables/sprint": typeof tables_sprint;
  teams: typeof teams;
  viewer: typeof viewer;
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
