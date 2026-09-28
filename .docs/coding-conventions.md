# Lead the Way coding conventions

These describe the current tree, not the finished plan. Keep changes small and preserve existing behaviour. See the [infrastructure map](infrastructure.md) for runtime limits and [frontend](frontend.md) for tokens and the app shell.

## Where code lives

- `src/app/<route>/page.tsx` owns the route's state, subscriptions, mutations and navigation. Route-only components go in that route's `_components`. `src/app/_components` is for app-shell owners such as the Convex provider.
- `src/components/ui` (base components) and `src/components/app` (product composition) do not exist yet; they land in P1. Until then, keep UI in `src/app`.
- `convex/lib` and `src/lib` are grouped by feature, one folder per feature: `convex/lib/{account,auth,email,orgs}`, `src/lib/account`. The root of each `lib` is for cross-cutting plumbing only, not for a feature that has not earned a folder: `convex/lib` keeps `customFunctions.ts`, `errors.ts` and `rateLimits.ts` there; `src/lib` keeps `errors.ts`, `flags.ts`, `theme.ts` and `url.ts`.
- `convex/schema.ts` is composed from the table modules in `convex/tables`, one module per concept (`orgs.ts` holds `orgs`, `orgRoles`, `memberships` and `orgInvites`; `profiles.ts` holds `profiles`). Generated files under `convex/_generated` are codegen output and are never hand-edited.
- Tests mirror production paths under root `tests/`: backend tests in `tests/convex` (further split into `tests/convex/workspace` for the org layer), client and script tests in `tests/src` and `tests/scripts`. Shared setup is in `tests/setup.ts` and `tests/globalsetup.ts`; preserve the network guard.

## Convex patterns

- Use object-form registered functions with `args` and `returns` validators on every public function. No `any`.
- User-facing failures go through `throwUserError(code, message)` in [`convex/lib/errors.ts`](../convex/lib/errors.ts), which throws a `ConvexError` carrying `{ code, message }`. A plain `Error` never reaches the client: its text is redacted to "Server Error" on a production Convex deployment, and it is for an internal fault nobody can act on. `code` is a stable, machine-readable string the client can branch on; `message` is the sentence already written at the call site, so a copy change happens there, never in `errors.ts`.
- Build on the function factories in [`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts) rather than the raw `query`/`mutation`/`action`:
  - `publicQuery`/`publicMutation`/`publicAction` give `ctx.userId: string | null` and allow a signed-out caller.
  - `authenticatedQuery`/`authenticatedMutation`/`authenticatedAction` give `ctx.userId: string` and refuse a signed-out one.
  - `orgQuery(...permissions)` / `orgMutation(...permissions)` additionally declare `orgId` as an argument, prove membership, check the named permissions, and hand the handler `args: {}` plus `ctx.orgId`, `ctx.membership`, `ctx.role` and `ctx.permissions`. Permissions are closed over at module scope so they can never arrive as a client-chosen argument.
  - Every builder refuses while `APP_CLOSED` is on.
  - A single `getViewer` helper that resolves the active workspace, person and permissions in one call is planned for P2. Until it lands, use `orgQuery`/`orgMutation` for anything scoped to a workspace.
- Never write a `memberships` row outside [`convex/lib/orgs/membership.ts`](../convex/lib/orgs/membership.ts). The "a workspace still has an owner" invariant has to be re-checked by every path that could break it; a second writer is a chance to skip that check.
- Use `v.id(...)` and `Doc`/`Id` types instead of stringly-typed database ids. Use `withIndex` for indexed reads, never an unbounded `collect` on a table that can grow with usage; see `MAX_ORGS_PER_USER` and `MAX_MEMBERS_PER_ORG` in `convex/lib/orgs/membership.ts` for the pattern of an enforced ceiling checked at the one door in, not a page size checked after the fact.

## Workspace scoping

Adding a new workspace-scoped table is two changes. Put `orgId` first in the index, so other tenants are excluded by the index itself rather than by a filter after the read:

```ts
things: defineTable({ orgId: v.id("orgs"), userId: v.string() })
  .index("by_org", ["orgId"]),

export const list = orgQuery("things:read")({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) =>
    ctx.db.query("things").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).collect(),
});
```

Then add `things:read` (and `things:write` if it needs one) to `PERMISSIONS` in [`convex/lib/orgs/permissions.ts`](../convex/lib/orgs/permissions.ts). Existing custom roles keep working, because a permission absent from a role's array simply is not granted. Do not add a permission that no function gates.

## Files and storage

Store Convex storage ids, never signed URLs: a stored URL is a string that expires on its own schedule with nothing here to notice. Resolve through `ctx.storage.getUrl` on every read. Uploads go from the browser straight to storage and hand back an id.

## Copy rules

Every string a person reads follows [DESIGN.md](../DESIGN.md), "Content and voice": sentence case, no em or en dashes, ranges written with "to" ("2 to 5", not "2-5"), no emoji, at most one middle dot per line, and a button label of 1 to 3 words starting with a verb. `pnpm copy-lint` checks `src/**` and `convex/**` for all of these automatically; it does not read `.docs/**` or comments, so review still catches copy in a doc or a code comment.

## Change discipline

Prefer an existing helper over a new wrapper. Add a small abstraction only when multiple callers share one invariant; keep one-off logic local. Verify with the smallest targeted test first, then the checks in [setup.md](setup.md).
