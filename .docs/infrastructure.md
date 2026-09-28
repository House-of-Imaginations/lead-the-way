# Lead the Way infrastructure

This is the current runtime map, not the finished plan. Start with [setup](setup.md), and run the [checklist](checklist-before-commit.md) before committing a change.

## Runtime boundaries

- The web app is Next.js 16 App Router code under [`src/app`](../src/app). Routes own the URL, page-level state, Convex subscriptions and mutations.
- The root layout reads a Better Auth token on the server and hands it to [`ConvexClientProvider`](../src/app/_components/ConvexClientProvider.tsx), so the first paint is not unauthenticated. `src/app/api/auth/[...all]/route.ts` forwards Better Auth requests to Convex. No auth secret is needed in the Next.js process.
- [`src/proxy.ts`](../src/proxy.ts) is today's kill switch only: while `APP_CLOSED` is on, every route but the landing page redirects home. Session and role-based redirects are planned for the routes a later phase adds.
- Convex owns the database, realtime queries, mutations, actions, HTTP routes and file storage. Registered functions live in [`convex`](../convex). [`convex/convex.config.ts`](../convex/convex.config.ts) mounts three components: Better Auth, the rate limiter, and Resend.
- [`convex/app.ts`](../convex/app.ts) is the one place feature flags are named. A flag maps to an env var and is on only when that var is exactly `"on"`. `assertFlag` refuses a call; `flag` (a public query) is how the frontend reads one. `APP_CLOSED` is the kill switch checked by every public function builder; `DEMO_MODE` is reserved for the demo workspace a later phase adds.

## Data

[`convex/schema.ts`](../convex/schema.ts) is composed from the table modules in `convex/tables`:

| Table         | Holds                                                                                              | Indexes                                |
| ------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `profiles`    | The product's own record of a person: display name, avatar storage id, the workspace the app opens | `by_user`, `by_deletedAt`              |
| `orgs`        | A workspace: name, the slug its URLs are built from, an optional picture                           | `by_slug`                              |
| `orgRoles`    | A role a workspace invented. A union on `kind`: the owner role carries no permission array         | `by_org`                               |
| `memberships` | One person's seat in one workspace, pointing at their role                                         | `by_user_and_org`, `by_org`, `by_role` |
| `orgInvites`  | A pending invitation: a 256-bit token, a pinned role, an optional address, an expiry               | `by_token`, `by_org`, `by_role`        |

`memberships` has no `by_user` index, deliberately: a compound index on `["userId", "orgId"]` already serves a prefix query on `userId` alone.

Better Auth's own user, session and account rows live inside the auth **component**, not in this schema. `profiles.userId` and `memberships.userId` are the Better Auth subject as a plain string, never a generated id: auth owns that row, and the product owns these. `profiles.deletedAt` and `profiles.purgeStartedAt` are reserved columns; nothing in the product sets them (soft delete is not built yet).

Avatars and workspace pictures are stored as `Id<"_storage">` and resolved through `ctx.storage.getUrl` on every read, never as a saved URL, which would be a signed, expiring string going stale on its own schedule.

## Authentication and identity

- Better Auth runs inside Convex ([`convex/auth.ts`](../convex/auth.ts)) with email and password, plus a username alternative and Google and Discord social providers that register **only when both halves of their credential pair are present in the deployment environment**. `api.auth.enabledSocialProviders` is what lets the UI hide a provider with no credentials.
- Identity is derived on the server in [`convex/lib/auth/identity.ts`](../convex/lib/auth/identity.ts) from `identity.subject`, and nowhere else. **No function accepts a user id as an argument for authorization.** An argument is something a client chooses.
- The custom function builders in [`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts) inject that identity: `publicQuery`/`publicMutation`/`publicAction` allow a signed-out caller and give `ctx.userId: string | null`; `authenticatedQuery`/`authenticatedMutation`/`authenticatedAction` refuse one and give `ctx.userId: string`. Every builder also refuses while the app is closed (`APP_CLOSED`).
- A single `getViewer` helper that resolves the active workspace and permissions in one call is planned for a later phase (P2). Until then, workspace-scoped functions resolve the seat themselves through `orgQuery`/`orgMutation`, below.

## Organizations and permissions

A workspace is this product's tenant. One person can be in several.

**Organizations live in this schema, not in Better Auth's organization plugin.** The plugin's tables would live inside the auth component, reachable only through its adapter and not through `ctx.db`, and a membership check is the hottest read in a multi-tenant app. Same split as `profiles`: auth owns identity, the product owns product data.

**`orgId` is an explicit argument on every scoped function, never an ambient claim.** `orgQuery("perm", …)` / `orgMutation("perm", …)` in [`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts) declare it, prove membership, check the named permissions, and hand the handler `args: {}` and a `ctx` already carrying `userId`, `orgId`, `membership`, `role` and `permissions` -- so no handler can forget the check.

**Permissions are a fixed vocabulary in code; roles are workspace-owned rows that bundle them.** [`convex/lib/orgs/permissions.ts`](../convex/lib/orgs/permissions.ts) is the only place the vocabulary may grow, because every entry has to correspond to a real gate. Today: `org:manage`, `members:read`, `members:manage`, `roles:manage`. `sprint:manage` (setup, agreement, launch) and `team:insights` (aggregate overview and outcomes) are in the design spec and arrive from P2.

Three rules keep custom roles from collapsing into two tiers, enforced by [`convex/lib/orgs/membership.ts`](../convex/lib/orgs/membership.ts):

- Any permission **added** to a role must be held by the caller.
- A role may only be **assigned** if its permissions are within the caller's own.
- You may not **remove or demote** somebody whose permissions are not within yours.

The invariant this product cannot survive losing is "somebody can still administer this org". That is a property of the member population, not of a role document, so `assertOwnerSurvives` reads the owner count **inside the transaction** before any role change or removal takes effect -- that read set is what makes two admins demoting each other at once serialize into one refusal rather than a workspace nobody can administer.

Invitations ([`convex/invites.ts`](../convex/invites.ts)) are bearer credentials, capped at seven days server-side, never taken from the caller, and omitted from every return validator a non-admin can reach. A pinned address is checked against the account's own email at accept time. `invites.resend` restarts the week; `invites.revoke` and `orgRoles.remove` are both permission-gated.

## Email

Every message this product sends goes through [`convex/lib/email`](../convex/lib/email): `template.ts` owns the shape, `messages.ts` owns the words, `send.ts` owns the Resend client and the env gate.

- **Env-gated, like every other optional feature here.** With no `RESEND_API_KEY` and no `RESEND_FROM`, nothing is sent and each sender returns false; whatever caused the email still happened (an invitation is still created, its link still works). That is also what keeps the network guard in `tests/setup.ts` satisfied without a stub.
- Better Auth's own senders (verification, password reset) use the same template. `requireEmailVerification` stays `false`: blocking sign-in on a click in an inbox would make a deployment with no sending domain one nobody could get into.

## Privacy

The design spec fixes the privacy rules Lead the Way enforces once the sprint and outcomes screens land: manager-facing queries return aggregates only, an aggregate built from fewer than 5 responses returns hidden rather than a number, and nothing sorts, ranks or labels people by activity. The members table is the one place a manager sees a list of people today, and it carries name, email, role and invitation state only -- never participation data. See spec section 5.1 in `docs/superpowers/specs/` for the full rule set and its required tests.
