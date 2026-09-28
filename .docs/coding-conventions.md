# Lead the Way coding conventions

These conventions describe the current tree. Keep changes small, preserve
existing behavior, and use the [infrastructure map](./infrastructure.md) for
runtime limits. Project entry points are [handbook index](./index.md), [setup](./setup.md),
and the [checklist before commit](./checklist-before-commit.md).

For anything visual -- tokens, shadcn/ui, the app shell, dark mode, reading
Convex data from a component -- read [Frontend](./frontend.md). It carries the
traps that have already cost somebody an afternoon.

## Where code lives

- **Every route sits in one of two groups: `(app)` or `(landing)`.** `(app)`
  holds the signed-in product -- workspaces, settings, restore, and the invite
  acceptance page. `(landing)` holds what a stranger can read: the front door,
  sign-in, sign-up and the offline fallback. Parentheses mean the folder name
  is not a URL segment, so `/settings` is still `/settings`. `layout.tsx`,
  `not-found.tsx`, `manifest.ts`, `globals.css` and `api/` stay at the root of
  `src/app`, because Next resolves each of those from there and a group would
  hide them.
- `src/app/(group)/<route>/page.tsx` owns the route's state, subscriptions,
  mutations, navigation, and loading/error behavior. Put route-only components
  in that route's `_components`; do not create a second subscription in an
  extracted child. `src/app/_components` is for app-shell owners such as the
  Convex provider and service worker.
- `src/components/ui` is VENDORED shadcn/ui. It is edited in place -- that is
  how the library is meant to be used -- and every edit that pulls a component
  inside `DESIGN.md` carries a comment saying which rule it is serving, so the
  next `shadcn add` does not quietly undo it. The "more than one route owns it"
  rule below does not apply to this directory.
- The other `src/components` files are shared primitives. A component belongs
  there only when more than one route owns the same behavior or visual
  contract. Keep pure browser/domain helpers in `src/lib`; keep Convex-only
  helpers in `convex/lib`.
- **Every React hook lives in `src/hooks`, one hook per file named after it.**
  A hook is never defined in the component or route that happens to use it
  first: two screens asking the same question is how a multi-step browser
  negotiation ends up written twice with one copy subtly wrong. Compose rather
  than grow -- `usePush` is the shape to copy, split from `usePushBrowser`
  (device facts, no server in it) so a screen that wants only the device half
  does not mount a subscription it has no use for.
- **`convex/lib` and `src/lib` are grouped by feature, one folder per feature.**
  Today that is `convex/lib/{account,auth,push}` and `src/lib/{account,pwa}`.
  A helper goes in the folder of the
  feature it serves, and the folder is the unit somebody reads to understand
  that feature.
- **The root of each `lib` is for cross-cutting plumbing only**, not for a
  feature that has not earned a folder: `convex/lib` keeps `customFunctions.ts`,
  `errors.ts`, `openai.ts` and `rateLimits.ts` there; `src/lib` keeps
  `errors.ts`, `help.ts`, `menu.ts` and `theme.ts`. If a new root file is about
  one feature, it is in the wrong place.
- Tests mirror production paths under root `tests/`: backend tests are in
  `tests/convex`, client/helper tests in `tests/src`, and both mirror the
  feature folders above. `import.meta.glob` module maps in a Convex test are
  relative paths, not import specifiers, so moving a test file a level deeper
  means fixing its glob by hand. Shared setup is in
  `tests/setup.ts` and `tests/globalsetup.ts`. Preserve the offline network
  guard. Convex tests use the repository's `convex-test` module map and the
  edge-runtime Vitest configuration.

## Convex boundaries

- Read [`convex/_generated/ai/guidelines.md`](../convex/_generated/ai/guidelines.md)
  before editing Convex code. Use object-form registered functions with `args`
  and `returns` validators, correct generated `api`/`internal` references, and
  `withIndex` for indexed reads. Use pagination or a deliberate `take` ceiling
  instead of an unbounded `collect` on growing data.
- Compose [`convex/schema.ts`](../convex/schema.ts) from the table modules in
  `convex/tables`. A validator shared by two domains stays with whichever module
  owns the concept, the way `providerValidator` sits in
  [`convex/lib/rateLimits.ts`](../convex/lib/rateLimits.ts); give one a file of its
  own once a third caller makes the ownership genuinely ambiguous.
  Use `v.id(...)` and `Doc`/`Id` types instead of stringly-typed database ids.
  Generated files are codegen output and are never hand-edited.
- User-facing failures use the stable codes and sentences in
  [`convex/lib/errors.ts`](../convex/lib/errors.ts); internal/provider failures
  may remain internal when the caller already owns the fallback behavior.
  Preserve endpoint-specific authorization guards when extracting helpers.

## Authorization and identity

`publicQuery`, `publicMutation`, and `publicAction` inject optional identity;
the authenticated builders require and inject the server-derived current user.
“Public” means the endpoint may be reached without an account, not that it may
read or write arbitrary documents. A builder does not replace resource
authorization: an id in `args` names a target, never the caller.

The persisted ownership contract uses Better Auth `identity.subject` through
[`convex/lib/auth/identity.ts`](../convex/lib/auth/identity.ts). Do not switch a
single call site to `tokenIdentifier` or accept a client `userId`; an
identity-key change needs an explicit compatibility migration. Deleted-account
checks are intentionally endpoint-specific: use `requireLiveUserId` where a
tombstoned account must not create new state, and the plain guards where it
may -- deletion status and restoration have to work for a deleted account by
definition.

## Workspace scoping

`orgId` in `args` names a **tenant**, and like every other id in `args` it is a
target the caller chose, never a fact. It is verified by the wrapper, never
trusted by a handler. Use `orgQuery("perm", …)` / `orgMutation("perm", …)` from
[`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts): they
declare the argument, prove membership, check the permissions the function
named, and hand the handler `args: {}` and a `ctx` already carrying
`userId`, `orgId`, `membership`, `role` and `permissions`. The permissions are
closed over at module scope, so they can never arrive as an argument.

Scoping a new feature to a workspace is two changes. Put `orgId` **first** in
the index, so other tenants are excluded by the index itself rather than by a
filter after the read:

```ts
things: defineTable({ orgId: v.id("orgs"), userId: v.string() })
  .index("by_org", ["orgId"])
  .index("by_org_and_user", ["orgId", "userId"]),

export const list = orgQuery("things:read")({ args: {}, returns: …,
  handler: async (ctx) =>
    ctx.db.query("things").withIndex("by_org", (q) => q.eq("orgId", ctx.orgId)).take(MAX),
});
```

Then add `things:read` and `things:write` to `PERMISSIONS` in
[`convex/lib/orgs/permissions.ts`](../convex/lib/orgs/permissions.ts). Existing
custom roles keep working, because a permission absent from a role's array
simply is not granted. Do not add a permission that no function gates.

- Warranty functions use the case, dealership and call builders with a named permission; never `authenticatedQuery`/`authenticatedMutation` for case data.

Never write a `memberships` row outside
[`convex/lib/orgs/membership.ts`](../convex/lib/orgs/membership.ts). The
invariant that a workspace still has an owner has to be re-checked by every
path that could break it, and scattered copies of that check are chances to
omit one. `convex-helpers/server/rowLevelSecurity` is deliberately not used
here: it filters rows after the read rather than changing index selection, so
it would hide a scan behind a rule.

## Quotas, queues, and provider calls

Do not use a read-only quota check as if it consumed capacity. `check` is for
UI/preflight information; reservation mutations call `limit` and are the only
admission boundary. Reserve all applicable policies atomically before the
upstream call, fail closed when the limiter store is unavailable, and reserve
once per physical provider attempt. A timeout or retry has already spent its
reservation.

Push delivery is the one Workpool path today. Give a second kind of background
work its own named pool in `convex/convex.config.ts` rather than sharing that
one: two workloads with nothing in common sharing one parallelism budget means
a burst of either starves the other. Decide retries per attempt, where the
target is known -- a pool-level retry re-runs a whole fan-out because one
recipient out of four was briefly unreachable. Do not add a generic retrier,
dedupe abstraction, or queue schema for a hypothetical case.

## Files and storage

Store Convex storage ids, never signed URLs: a stored URL is a string that
expires on its own schedule with nothing here to notice. Resolve through
`ctx.storage.getUrl` on every read. Uploads go from the browser straight to
storage and hand back an id -- a mutation cannot take a multi-megabyte argument,
and an action relaying the bytes would double the transfer. Check the stored
metadata server-side after the bytes land: anything the browser enforces the
browser can also skip.

Remember that a mutation is a transaction, so `throwUserError` rolls back a
`ctx.storage.delete` above it. A path that must actually delete the file returns
instead of throwing.

## Change discipline

Prefer an existing helper over a new wrapper. Add a tiny abstraction only when
multiple callers share one invariant; keep one-off logic local. When moving a
component, keep its owner of state and callbacks, preserve imports and focus/
error/loading behavior, and remove the old path only after a whole-repo caller
search. For non-trivial branches, leave one focused regression test at the
smallest boundary that would fail if the behavior regressed.

Preserve the identity contract, the soft delete and restore semantics, the
notification content rule, and the current bounded reads unless the task
explicitly changes policy. Verify with the smallest targeted test first, then
the repository lint, build, typecheck and test checks described in
[setup](./setup.md).

The example feature -- `convex/notes.ts`, `convex/tables/notes.ts`,
`src/app/_components/NotesDemo.tsx` and `tests/convex/notes.test.ts` -- is a
worked reference, not a dependency. Delete the four together when the first real
feature replaces it.
