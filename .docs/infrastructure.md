# Lead the Way infrastructure

This is the current runtime map. The limits below are product and safety policy; they are not a production-capacity claim. Start with [setup](./setup.md), and run the [checklist](./checklist-before-commit.md) before committing a change.

## Runtime boundaries

- The web app is Next.js 16.3.4 App Router code under [`src/app`](../src/app), split into two route groups: `(app)` for the signed-in product and `(landing)` for what a stranger can read. Neither name appears in a URL. Routes own the URL, page-level state, Convex subscriptions and mutations; route-private UI lives in each route's `_components` directory.
- The root layout gets a Better Auth token on the server and passes it to [`ConvexBetterAuthProvider`](../src/app/_components/ConvexClientProvider.tsx), so the first paint is not unauthenticated. `src/app/api/auth/[...all]/route.ts` forwards Better Auth GET and POST requests to Convex. **No auth secret is needed in the Next.js process.**
- Convex owns the database, realtime queries, mutations, actions, HTTP routes, file storage and cron. Registered functions are in [`convex`](../convex); [`convex/http.ts`](../convex/http.ts) mounts Better Auth's routes and `POST /elevenlabs/post-call`, the ElevenLabs post-call webhook (HMAC-verified raw body; 401 on a bad signature, 503 when `ELEVENLABS_WEBHOOK_SECRET` is unset, 200 otherwise, idempotent per conversation).
- [`convex/convex.config.ts`](../convex/convex.config.ts) mounts the components: Better Auth, migrations, presence, the rate limiter, Resend, and one named Workpool. `_generated` files are codegen output.
- Node-only code is isolated. `web-push` reaches for `crypto`, `https` and `url`, so it lives in [`convex/pushSend.ts`](../convex/pushSend.ts) behind `"use node"`, which may not appear in a file that also exports queries or mutations. Every database read it needs comes back through `ctx.runQuery`.

## Data

P0 reference knowledge is stored in `knowledgeEntries`, with source/citation/domain
indexes and the native `by_embedding` vector index (1,536 dimensions, domain
filter). It contains two shared reference entries, not tenant case evidence.
Only internal functions access it. See [the knowledge handoff](knowledge.md) for
the immutable source contract, lazy embedding lifecycle and #21 integration.

[`convex/schema.ts`](../convex/schema.ts) is composed from table modules in `convex/tables`:

| Table               | Holds                                                                                     | Indexes                                |
| ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| `profiles`          | The product's own record of a person: display name, avatar storage id, deletion tombstone | `by_user`, `by_deletedAt`              |
| `pushSubscriptions` | One row per browser that agreed to be notified                                            | `by_owner`, `by_endpoint`              |
| `notes`             | The example table. Delete it with `convex/notes.ts`                                       | `by_user`                              |
| `orgs`              | A workspace: name, and the slug its URLs are built from                                   | `by_slug`                              |
| `orgRoles`          | A role a workspace invented. A union on `kind`: owner carries no permission array         | `by_org`                               |
| `memberships`       | One person's seat in one workspace, pointing at their role                                | `by_user_and_org`, `by_org`, `by_role` |
| `orgInvites`        | A pending invitation: a 256-bit token, a pinned role, an optional address, an expiry      | `by_token`, `by_org`, `by_role`        |
| `dealerships`       | A dealership record in an OEM network; scope lives on the seat, not the row               | `by_org`                               |
| `requirementSets`   | An immutable, versioned per-dealership requirement set: items, params and extras          | `by_dealership_and_version`            |
| `warrantyMessages`  | One case's chat turn: author, text, attachments and any agent steps                       | `by_case_and_role_and_createdAt`       |
| `technicianCalls`   | A workspace technician clarification call: questions, status and transcript               | `by_technician_and_status`, `by_case`  |
| `voiceNotes`        | One recorded turn of a technician call and its transcript                                 | `by_call`                              |
| `demoPersonas`      | Demo sign-in credentials, shown only when `DEMO_ACCESS` is on                             | `by_org`                               |

`memberships` has no `by_user` index, deliberately: a compound index on `["userId", "orgId"]` already serves a prefix query on `userId` alone, and a second index would be a second thing to keep written.

Better Auth's own user, session and account rows live inside the auth **component**, not in this schema. `profiles.userId` is the Better Auth subject as a plain string, never an `Id<"users">`: auth owns that row, and the product owns this one.

Avatars are stored as `Id<"_storage">` and resolved through `ctx.storage.getUrl` on every read. A stored URL would be a signed, expiring string sitting in a row, going stale on its own schedule with nothing to notice.

## Authentication and identity

- Better Auth runs inside Convex ([`convex/auth.ts`](../convex/auth.ts)) with email/password and the username plugin, plus Google and Discord social providers that are registered **only when both halves of their credential pair are present in the deployment environment**. Adding the credentials starts the buttons working with no code change; `api.auth.enabledSocialProviders` is what lets the UI hide the dead ones.
- Identity is derived on the server in [`convex/lib/auth/identity.ts`](../convex/lib/auth/identity.ts) from `identity.subject`, and nowhere else. **No function accepts a user id as an argument for authorization.** An argument is something a client chooses.
- The custom function builders in [`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts) inject that identity: `publicQuery`/`publicMutation`/`publicAction` allow a signed-out caller and give `ctx.userId: string | null`; the `authenticated*` builders refuse one and give `ctx.userId: string`.
- "Public" means the endpoint may be reached without an account. It does not mean the endpoint may read or write arbitrary documents -- resource authorization is separate, and still the caller's job.
- `requireLiveUserId` is the stricter gate: signed in **and** not soft-deleted. Use it on anything that creates state a deletion would later have to clean up.

## Account lifecycle

Deletion is soft, and the shape is deliberate:

1. `profiles.deletedAt` is set immediately and `profiles.me` starts returning null, so the product behaves as though the account is gone from the first render after the tap.
2. Push subscriptions are dropped immediately and are **not** restored by a restore. Re-subscribing is one tap; buzzing the phone of somebody who deleted their account is not something to get wrong.
3. The row survives the window, because a restore with nothing to restore is not a restore. `account.purgeExpired` erases it once the window closes.

`convex/lib/account/window.ts` owns the arithmetic, imported by both the backend and the screens so the number is written once. `account.deletionStatus` is the only function that admits a tombstoned profile is still there.

The daily cron in [`convex/crons.ts`](../convex/crons.ts) drives the purge. Its range is bounded at **both** ends on purpose: a document with no `deletedAt` is still in the `by_deletedAt` index and sorts before every number, so a one-sided `lt(cutoff)` would match every live profile and delete the accounts of people who never asked.

The purge takes what the account owned alone -- warranty cases, their documents and the stored files behind them, notes, the avatar -- before the profile row. Warranty rows can each be near 1 MiB, so they are not counted against the 500-delete notes budget: the purge reads `ctx.meta.getTransactionMetrics()` before each one and stops while 2 MiB of read and write headroom remain. An account that does not fit keeps its tombstone and is finished by the scheduled continuation. The first run stamps `profiles.purgeStartedAt` before deleting anything, and `account.restoreAccount` refuses with `ACCOUNT_PURGE_STARTED` from then on: a restore in the middle would bring back an account with part of its evidence gone.

Anything this product adds that is not one person's data alone -- a seat in a shared room, an item somebody else depends on -- must be released at the tap, not at the purge. Shared state waiting on a departed account is a deadlock with a two-week fuse.

## Organizations and permissions

A workspace is this product's tenant. One person can be in several, and the switcher in the header moves between them.

**Organizations live in this schema, not in Better Auth's organization plugin.** The plugin exists, but with the Convex adapter its tables live inside the auth component, reachable only through `authComponent.adapter(ctx)` and not through `ctx.db`. A membership check is the hottest read in a multi-tenant app and it has to be an index this codebase owns. The plugin's access control also gates Better Auth's endpoints rather than Convex functions, so it would be a second permission model to keep in sync. Same reasoning as `profiles`: auth owns identity, the product owns product data.

**`orgId` is an explicit argument on every scoped function, never an ambient claim.** Putting the active workspace in the JWT was considered and rejected: `@convex-dev/better-auth` mints Convex tokens with a fixed lifetime, so a permission read from a claim would go stale for up to fifteen minutes after a role change or a removal. The argument names a tenant; it is never trusted. `orgQuery`/`orgMutation` in [`convex/lib/customFunctions.ts`](../convex/lib/customFunctions.ts) declare it, prove membership, check the permissions the function named, and then hand the handler `args: {}` so no handler can skip the check.

**Permissions are a fixed vocabulary in code; roles are workspace-owned rows that bundle them.** [`convex/lib/orgs/permissions.ts`](../convex/lib/orgs/permissions.ts) is the one place the vocabulary may grow, because every entry has to correspond to a real gate. A workspace can invent a role, never a permission.

Three rules keep custom roles from collapsing into two tiers. Without them `roles:manage` is owner in everything but name, because its holder could edit their own role to include the rest of the vocabulary.

- Any permission **added** to a role must be held by the caller. Narrowing a role is not an escalation, so only the additions are checked.
- A role may only be **assigned** if its permissions are within the caller's own.
- You may not **remove or demote** somebody whose permissions are not within yours.

The failure this design exists to prevent is a workspace nobody can administer, which is unrecoverable from inside the product. The guard is a property of the member **population**, not of a role document: a role saying `kind: "owner"` guarantees the capability exists, never that anybody holds it. So [`convex/lib/orgs/membership.ts`](../convex/lib/orgs/membership.ts) is the only writer of `memberships` rows, and every write goes through `assertOwnerSurvives`, which reads `by_role` **inside the transaction** — that read set is what makes two admins demoting each other at once serialize into one refusal. Roles held by somebody are refused deletion rather than cascaded or reassigned; both alternatives are surprises.

A sole owner deleting their account is refused with `ORG_OWNERSHIP_HELD` naming the workspace, and the refusal rolls the tombstone back with it. A sole owner who is also the sole member takes the workspace with them. Auto-promoting somebody would be a silent privilege grant to a person nobody chose.

Ownership can be handed over from the members screen, by an owner only. This is not a convenience: three separate refusals tell a sole owner to hand the workspace over before they can leave or delete their account, so without the control their only exit was destroying the workspace for everybody in it, and account deletion was unreachable.

A member with no `profiles` row yet is listed by the address they signed up with, read from the auth component. The "Someone" placeholder is left only for a seat whose auth user is also gone.

Invitations are bearer credentials: 256 bits from `crypto.getRandomValues`, capped at seven days server-side and never taken from the caller, never pinned to the owner role, and omitted from every return validator a non-admin can reach. A **pinned address is checked against the auth component's own user document, never against the JWT** — Better Auth's Convex plugin puts the user record in the token camelCased, and Convex maps `identity.emailVerified` from the OIDC `email_verified` claim, so the claim is always absent and a pinned invitation would fail closed forever. Expired rows are swept when the next invitation is created, so the cap counts live invitations only. Accepting is **insert-only** — if it patched an existing membership's role, any link would be a self-demotion primitive, and an owner opening a "member" link would demote themselves out of their own workspace. Accepting deletes the row rather than stamping it used, so `by_org` is exactly the set of pending invitations. Widening a role revokes the invitations pinned to it, because those were written for what the role was.

A new workspace is created with **Admin** and **Member** roles beside its owner, because an invitation grants a role and the owner role cannot be invited into — a workspace born with only "Owner" had nothing to invite anybody as. `invites.preview` returns `access` (`ready`, `confirmEmail`, `wrongAccount`) so `/join/[token]` can say what stands in the way before the tap, without ever naming the pinned address; `accept` refuses an unconfirmed but matching address with `EMAIL_UNVERIFIED` rather than "a different address". `invites.resend` re-sends a pinned invitation and restarts its week. The screens are `/orgs/[slug]/members` (invite, pending invitations, people) and `/orgs/[slug]/roles`; each skips a subscription the caller's permissions would refuse, because a refused query throws into the page.

## Email

Every message this product sends goes through [`convex/lib/email`](../convex/lib/email): `template.ts` owns the shape, `messages.ts` owns the words, `send.ts` owns the Resend client and the env gate.

- **Env-gated, like every other optional feature here.** With no `RESEND_API_KEY` and no `RESEND_FROM` nothing is sent and each sender returns false; whatever caused the email still happened, so an invitation is still created and its link still works. That is also what keeps the network guard in `tests/setup.ts` satisfied without a stub.
- **Queued from inside the mutation.** The component owns delivery through its own workpool, so the send and the row it describes commit together. No email about a row that rolled back, and no row whose email was never queued.
- **Colours are hex literals, not tokens, and the layout is a table.** An email has no stylesheet: clients strip `<style>`, do not resolve `var()`, and Outlook lays out with Word. The palette is copied from the light-mode Harbor tokens in `src/app/globals.css` and has to be maintained as a copy. The ground is light, because several clients force their own background and leave the text colour alone; dark-on-light survives that. The header logo is `public/brand/logo-email.png` uploaded to Convex storage by `node scripts/upload-email-logo.mjs` (add `--prod` for production), which sets `EMAIL_LOGO_URL` to its public URL — storage rather than `SITE_URL`, because a dev `SITE_URL` is localhost and an inbox cannot load it. A PNG, because Gmail and Outlook do not render SVG. With `EMAIL_LOGO_URL` unset the header falls back to the word.
- **Preview locally.** `npx tsx scripts/preview-email.ts out.html` renders the invitation with sample data through the same `inviteEmail()` and `renderEmail()` that send it.
- **Every interpolation is escaped, and every URL is scheme-checked.** A workspace name is chosen by whoever created it and one signup away from anybody, so an unescaped name is a one-tap injection into somebody else's inbox. A URL that is not plainly http(s) becomes `#` in all three places it appears — the `href`, the visible paste-this fallback, and the plain-text part — because telling somebody to paste a `javascript:` URL is the same attack as linking it.
- **Every message has a plain-text part.** Not politeness: a message with no `text/plain` alternative scores worse with every major spam filter, and its link is unreachable in a terminal, on a watch, or through a screen reader that prefers text.

Better Auth's own senders use the same template. `sendOnSignUp` is on, because nothing else ever sets `emailVerified` for an email-and-password account and pinned invitations check that flag. `requireEmailVerification` stays **false**: blocking sign-in on a click in an inbox would make a deployment with no sending domain one nobody can get into. Password reset is wired and has no UI yet.

## Notifications

- Subscriptions are owned by the signed-in account. `owner` is an opaque key so a second kind of principal can be added later under a prefix built in one place, rather than as a second column and a second index on the delivery path.
- `subscribe` upserts on the endpoint. A browser hands back the same endpoint after a service-worker update or a permission toggle, so an insert would give one phone two rows and every notification twice.
- `unsubscribe` checks ownership. An endpoint is a string a client supplies; without the check, anybody holding one could silence its owner.
- Sending is queued through the `pushDelivery` Workpool, never awaited inside the mutation that caused it. Pool-level retries are off: a 404 or 410 from a push service is authoritative and deletes the subscription, and anything else is logged, because a pool retry would re-run a whole fan-out over one unreachable device.
- **A notification never names private content.** The payload is decrypted by the browser and drawn on a locked screen, in front of whoever is holding the phone, and the endpoint may have outlived the recipient's access to whatever it describes. Say that something happened and where to go; let the app, behind auth, say what.
- With no VAPID keys the whole feature is inert and says so.

## Quotas

[`convex/lib/rateLimits.ts`](../convex/lib/rateLimits.ts) declares every limit in one place, in two kinds that must not be merged:

- **Per-caller**, keyed on the account, protecting the product from one person.
- **Per-provider**, unkeyed, protecting an upstream account's quota from the whole deployment at once.

A shared bucket means one heavy user spends the budget everyone else is queued behind, and neither cap can be tuned without moving the other.

`check` is read-only and is for drawing a control. **Never use a check as a gate**: between the check and the work, somebody else spends the token. `reserve*` consumes, and is the only admission boundary. Reserve before the upstream call, once per physical attempt -- a timeout or a retry has already spent its reservation. The wrappers in [`convex/rateLimits.ts`](../convex/rateLimits.ts) exist because `limit` writes, so an action can only reach it through `runMutation`; a function that is already a mutation calls the lib directly.

## Migrations

Convex tables have no `ALTER`, so a column added after launch is `v.optional(...)` forever and read through a default, unless something walks the existing rows. [`convex/migrations.ts`](../convex/migrations.ts) is that walk: batched, resumable, and idempotent per row. Run one with `npx convex run migrations:run '{"fn":"migrations:yourMigration"}'` after deploying the code that defines it.

## PWA and offline

`src/app/manifest.ts` is served as `/manifest.webmanifest`; its colours are literals because a manifest is fetched without a document and has no stylesheet for a `var()` to resolve against. `public/sw.js` is served with `Cache-Control: no-store` from `next.config.ts` and registered with `updateViaCache: "none"` -- a service worker outlives the page that registered it, so a bad one served from the HTTP cache is a bad one the browser keeps choosing. The worker is registered in production builds only.

## Design system

Tokens live in `src/app/globals.css` and are the only source of colour. Every pair in use is contrast-checked in both schemes, and the file records the measured ratios; a disabled control drops its fill rather than taking opacity, because opacity on a coloured field fails the AA floor. The theme is a `data-theme` attribute written by a pre-paint inline script, not `prefers-color-scheme`, so the app's own toggle can win over the OS.

## Warranty P0 runtime

Public functions are split by concern rather than living in one file: `convex/warranty.ts` owns case lifecycle and the role-shaped `view` (`seed`, `list`, `view`, `uploadUrl`, `submit`, `sendResponse`, `decide`, `close`); `convex/warrantyFacts.ts` owns documents and facts (`registerDocument`, `retryDocument`, `removeDocument`, `verifyFact`, `verifyDocument`, `correctFact`, `rejectFact`, `supersede`); `convex/warrantyAgentState.ts` and `convex/warrantyAgents.ts` own the agents. `convex/tables/warranty.ts` declares `warrantyCases`, `warrantyDocuments`, `warrantyComplianceRuns`, `warrantyAgentTurns` and `reimbursementTariffs`. Every rule lives in a pure library under `convex/lib/warranty/` (`facts.ts`, `requirements.ts`, `compliance.ts`, `reimbursement.ts`, `tariffs.ts`, `gates.ts`, `agentOutput.ts`, `caseState.ts`, `evidence.ts`, `parse.ts`) so mutations, the parse action, the agent tools and the extraction script all call the same code. Knowledge is not a warranty table: it lives in the #20 layer (`knowledgeEntries`, [knowledge handoff](knowledge.md)). Cases belong to a workspace and a dealership. Every public warranty function names its permission through `caseQuery`/`caseMutation` or `orgQuery`/`orgMutation` in `convex/lib/customFunctions.ts`, and a seat with `dealershipId` reaches only that dealership (`convex/lib/orgs/scope.ts`). Not-found codes merge missing, other workspace and out of scope.

**Requirement sets.** Versions are immutable: a save inserts the next version and never patches an earlier one. The dealership's current set is frozen onto a case at creation (`requirementSetId`), and `recordCompliance` always evaluates against that frozen set, never the dealership's latest.

**Metrics.** `metrics.overview` scans at most 500 cases and 500 calls and reports `truncated` when either cap was hit, so the dashboard never claims a complete picture from a partial scan.

**Demo access.** `demo:seed` (an internal action, data in `convex/lib/demoData.ts`) writes a demo workspace: three dealerships, every persona (including a second dealer/technician pair at Southern Cross for cross-dealership isolation checks), and about twenty warranty cases spread across every stage over roughly 120 days, each with documents, facts, compliance runs and mock agent turns, and some with chat messages or technician calls. It makes no network calls and is resumable -- rerunning it reuses the existing Better Auth users and workspace instead of failing. `demo:reset` (an internal mutation) deletes the demo org and everything hanging off it through the same cascade `deleteOrg` uses for any workspace, guarded to only ever act on the org at the reserved demo slug with `demo: true`; Better Auth users are left in place so `reset` then `seed` rebuilds cleanly. `demo.personas` returns the sign-in credentials only when the deployment's `DEMO_ACCESS` environment variable is exactly `"on"`; any other value hides them from the sign-in page. `internal.demo.restart` (`reset` then `seed`) is scheduled every 30 minutes by the cron in `convex/crons.ts`, and no-ops unless `DEMO_ACCESS` is `"on"` -- `reset`'s own transaction stays inside the bounded ceilings on memberships/invites/roles, and hands the unbounded warranty rows to `warrantyCascade.purgeOrg`'s existing batched reschedule, so `restart` needs no batching of its own, and `seed` does not wait for that drain because it starts a new org under a new id the instant `reset` returns.

`warrantyCascade.purgeOrg` drains a deleted workspace's warranty rows -- cases, documents, calls and requirement sets -- in scheduled batches after `deleteOrg` removes the org itself.

Stages are `DEALER_PREPARATION → OEM_REVIEW ⇄ OEM_NEEDS_MORE_INFO → APPROVED → CLOSED`, tracked in `warrantyCases.stage` with `workflowOwner` (`caseState.ts`) saying who acts next: DEALER in preparation and while answering an information request, OEM from submission through decision, NONE once closed. `REJECTED` and a `REJECT` final outcome remain in the schema only for rows written before this workflow; no button, agent recommendation or human decision can produce one today -- `decide` accepts only `APPROVE`/`REQUEST_MORE_INFORMATION`, and `convex/lib/warranty/gates.ts` (`submitBlockers`, `responseBlockers`, `decisionBlockers`, `approvalBlockers`, `closeBlockers`, `requestBlockers`) is what every mutation and the view's `readiness` payload refuse against, so a disabled button always shows the reason the server would give.

**Ingestion.** Every upload is registered by `registerDocument` (type/size/count checks; `documentKind` accepts PDF, PNG, JPEG, TXT, MD and CSV up to 20 MiB) and its parse is queued through the named `warrantyIngest` Workpool (`convex/lib/warranty/ingestQueue.ts`), not a bare `ctx.scheduler.runAfter`: the pool bounds parallel parses to 4 Node containers at once (`retryActionsByDefault: false` -- `parse` classifies and records its own failures, and the user retries with `retryDocument`, which bumps `attempt`), and its `onComplete` (`convex/warrantyIngestState.ts`) marks a parse that died without reporting -- a timeout or out-of-memory kill the action's own `catch` never sees -- FAILED for that attempt only, so a document can no longer stay PROCESSING forever and a subsequent retry is never overwritten by a stale completion. `convex/warrantyIngest.ts` (`"use node"`) runs LiteParse itself: ordinary text extraction where available, OCR fallback for scanned/image content, original page numbers and per-item bounding boxes preserved (proven on hosted dev, see [setup](setup.md#liteparse-node-binding)). Do not add a separate OCR pipeline. Extracted facts are proposed, never accepted automatically; a human verifies, corrects, rejects or supersedes each one against the original page (`convex/lib/warranty/facts.ts`, `factStatus`). P0 limits, enforced where the code that owns them says (`caseState.ts`, `fileTypes.ts`): 20 MiB and 30 pages per file, 40,000 characters per page, 512 KiB of extracted text per document, 20 documents, 4 MiB of extracted text and 400 labelled facts per case (case-wide totals, not per document). The text budget is checked when a parse completes: a document that would take the case past 4 MiB ends FAILED with `LIMIT_EXCEEDED`, and the user removes a document before adding it again. These caps are what let the compliance run, the agent tools and evidence search read a whole case without pagination; `warranty.view` never returns page text.

**Compliance runs are recomputed, not authored.** `convex/lib/warranty/requirements.ts` checks eleven stable requirement IDs (`vin`, `ro`, `dtc`, `battery-serial`, `odometer`, `complaint`, `resting-voltage`, `cause`, `warranty-dates`, `hv-isolation`, `accessories-disconnected`) against accepted facts and assigns one of six states: `SATISFIED`, `MISSING` (absent once evidence processing is complete, `UNCERTAIN` while it is not), `CONFLICT`, `UNSUPPORTED`, `UNCERTAIN` and `NOT_APPLICABLE`, which never blocks anything. A resting-voltage reading with only wrong-context evidence -- a freeze-frame value, or a measurement not taken with the vehicle off for 30+ minutes -- is `MISSING`, not `SATISFIED`; the fictional `RESTING_VOLTAGE_THRESHOLD_V` (12.0 V) and the 730-day coverage window build the same numbers the seeded OEM policy text states, so the check and the cited policy cannot disagree. `convex/lib/warranty/compliance.ts` decorates each check into a `ComplianceRow` (expected text, `impact`: `BLOCKS_SUBMISSION`/`BLOCKS_APPROVAL`/`MAY_BE_REQUESTED`/`NONE`, `owner`, `nextAction`, `resolution`, and `source: POLICY_SOURCE` = `knowledge:aster-aux-12`). `caseState.recordCompliance`/`bumpRevision` is the **only** path that writes a `warrantyComplianceRuns` row, always inside the same mutation that changed the case, so a run and the revision it describes commit together; runs are immutable and `latestRun` reads the newest one for a revision. The OEM reviews the frozen submission snapshot's documents, never the dealer's live edits after submission.

**Reimbursement** is deterministic integer-cents arithmetic over a seeded synthetic tariff (`convex/lib/warranty/tariffs.ts`, `reimbursementTariffs` table, citation `tariff:au-aster-ev-2026.1`). `checkReimbursement` (`convex/lib/warranty/reimbursement.ts`) matches each claim line to its tariff rate, caps both LABOUR and PART reimbursement at the claimed amount, rounds half-up, and returns a status (`IN_TARIFF`/`NOT_IN_TARIFF`) and a justification per line; it never recommends paying more than was claimed.

Agents run through `runAgent` (`convex/lib/warranty/agentRunner.ts`). `warrantyAgents.run` is the synchronous path for `scripts/eval-agents.mjs`. The case chat is the product path. `warrantyChat.send` inserts a USER message and an AGENT reply in `warrantyMessages` (thread = case + role). The reply waits until its attachments are PROCESSED or FAILED, then `warrantyAgents.respond` runs as the sender's `userId` (scheduled functions carry no identity, so every agent internal takes it explicitly and re-checks the seat). Text streams into the row at most every 250 ms; tool steps patch immediately. The run ends with the `record_turn` tool; its args pass `outputViolations` and `extraViolations` and are saved as a turn in the same mutation that marks the reply DONE. Citation tokens `[[id]]` a tool did not return are removed and counted. A missing or invalid `record_turn` leaves the reply UNVERIFIED; other failures leave it FAILED with the user-facing code. `expireReply` fails a reply still RUNNING after five minutes. `TRUSTLANE_AGENT_MOCK=on` replaces the OpenAI provider with a deterministic agent (`convex/lib/warranty/mockAgent.ts`); set it only on local or throwaway deployments.

**Technician calls** are `warrantyVoiceTasks` rows in `mode: "app"`, answered inside the technician's own Lead the Way app rather than over the phone.

- The Dealer Agent's `request_technician_call` tool calls `internal.warrantyVoice.propose`, which re-checks eligibility server-side (`convex/lib/warranty/voice.ts`: the run already inspected the case, ran compliance and searched the evidence for that requirement; processing is complete; the row is MISSING and dealer-owned; one open call per case) and inserts a row `AWAITING_APPROVAL`; an ineligible request returns `NOT_ELIGIBLE` rather than throwing, because a throwing tool ends the run. A dealer can also start a call directly with `calls.startDirect`, with no questions and no requirement-gap check. Both appear as a call card attached to a message in the dealer thread (`postCallMessage`).
- `calls.approve` re-checks the gap, hashes the approved questions and addresses a dealership member holding `calls:answer` (`requireTechnician`) instead of a phone contact. It schedules the internal `calls.ring`, which re-verifies the case, the technician and the gap, marks the row `CALLING`, pushes the content-free "Incoming call" notice (`TECHNICIAN_CALL_PUSH`, body "Open Lead the Way to answer.") to that member, and gives up with `NO_ANSWER` after two minutes (`RING_TIMEOUT_MS`) if nobody answers. Every outcome -- ringing, missed, declined (`calls.reject`), cancelled or rescheduled (`calls.reschedule`) -- posts a line in the dealer thread.
- The technician answers with `calls.answer`, then Hold-to-talk voice notes (`calls.sendNote`, capped at `MAX_NOTE_BYTES`, about 90 seconds of Opus audio). `callVoice.hear` transcribes each one with ElevenLabs Scribe when `ELEVENLABS_API_KEY` is set; otherwise it simulates the technician's line from `integrations/elevenlabs/technician-demo/scripts.json` (`scriptLine`), so the two-device demo runs with no paid key. `calls.noteHeard` advances the same deterministic `demoPlan` the landed phone flow used, extracting evidence with `extractAnswer`. On a direct call (no plan) both sides talk; on a Dealer-Agent call the dealer only listens.
- Ending the call (`calls.end`, or the plan running out) hands the live turns to `callVoice.finish`, which waits briefly for a note in flight and then calls the landed `storeConversation`/`recordConversation`: a single PROCESSED transcript document and PROPOSED `VOICE_CALL` facts, bounded by the same document and fact caps, bumping the revision. A call with no spoken turn at all is CANCELLED with no transcript. Submission and the dealer response wait while a call is `SCHEDULED`, `CALLING` or `IN_PROGRESS`.
- The phone transport this replaces (`warrantyVoiceProvider.dispatch`, the ElevenLabs/Twilio webhook, the reconcile poll, `warrantyTechnicians`) remains in the codebase but is unreachable from the workspace -- `calls.approve` always writes `mode: "app"`. Removing it is destructive cleanup that needs its own authorisation. `inspect_case` gives the Dealer Agent each call's status, mode, transcript, evidence and unavailable evidence, identically for either mode.

**Regulatory metadata.** `knowledgeEntries` carries `jurisdiction`, `section`, `effectiveDate` and `version` alongside the existing citation fields (`convex/tables/knowledge.ts`); policy sources leave them unset, the regulatory ACL s.54 paraphrase carries all four. `search_regulatory_knowledge` filters retrieved hits to the case's own jurisdiction with `inJurisdiction` before returning them to the model, and surfaces the same fields so an agent (or a human reading the citation) can see which jurisdiction, section, date and legislative version a regulatory hit came from. See [retrieval](retrieval.md) and [knowledge](knowledge.md) for the full contract.

**Agent behaviour is graded, not just wired.** `convex/lib/warranty/agentEval.ts` (`gradeTurn`) checks a saved turn against a scenario for role-tool coverage, context isolation (no dealer-only marker reaches an OEM turn or vice versa, and every citation's document ID is in what that role may see), recommendation vocabulary, grounded citations (every citation was actually retrieved in that run), tool discipline, evidence requests, required concepts, forbidden claims and no false claim of having acted. `evals/warranty-agents/scenarios.ts` defines the reference-case walk and independent behaviour scenarios on the fixtures in `evals/warranty-agents/fixtures.ts`; `tests/convex/warranty/agentEval.test.ts` and `agentBehaviour.test.ts` run them with a scripted model in `npm run test:backend` (no network, no cost). Output validation refuses a Dealer `READY_FOR_SUBMISSION` while any row blocks submission, as it refuses an OEM `APPROVE` with an unsatisfied request. `npm run eval:agents -- --live` runs the same scenarios with the real model against the deployment in `.env.local` and is a paid, authorisation-gated operation -- see [setup](setup.md#agent-eval).

`warranty.list` returns only `_id`, `title`, `stage`, `workflowOwner` and `updatedAt`, most recently updated first. `warranty.view` is role-shaped (`kind: "dealer" | "oem" | "oem-unsubmitted" | "legacy"`): it never returns a storage ID, only per-document/per-page signed URLs generated for the caller; a storage ID can be attached to one document only, so an upload cannot be re-attached elsewhere. See [P0 scope, limitations and rehearsal](../plan/nam/p0-hackathon-mvp.md).

## Official legal-source boundary

Live legal search is opt-in (`TRUSTLANE_LEGAL_SEARCH=live`) and runs in the
existing Node agent action. It uses only server-built Federal Register API URLs
and refuses redirects. Public legislation snapshots and immutable passages live
in Convex storage and `legalPassages`, separate from the two seeded knowledge
entries and uploaded warranty evidence. `legalSearchCaches` is indexed by a
hashed adapter/jurisdiction/date/query key; `warrantyLegalContexts` is indexed by
case/role/passage and stores selected assessment targets. Citation reads enforce
case access and a visible role's retrieval link. Neither web text nor a selected
legal context link verifies a fact or changes compliance/reimbursement. See
[retrieval](retrieval.md#live-official-legal-context) for limits and errors.
