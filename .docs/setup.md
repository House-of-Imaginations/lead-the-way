# Setup and verification

## Install

Use Node.js and npm. The installed Next.js 16.3.4 requires Node >=20.9.0; CI runs Node 22. There is no repository Node-version pin. Check dependency engine requirements when changing runtimes.

From the repository root:

```sh
npm ci
```

Use the committed lockfile. Do not switch package managers or upgrade dependencies as a setup workaround.

## Configure an isolated development backend

Copy [.env.example](../.env.example) to `.env.local` only if the latter does not exist. Preserve an existing developer configuration. The template has placeholders, not usable credentials.

Before any Convex command that selects or affects a deployment, inspect the selected target and whether a `CONVEX_DEPLOY_KEY` override exists, without printing secrets. Announce whether the target is local, dev, preview, or production. Use a personal or isolated dev deployment; production changes require explicit authorization for that target and action.

There are two ways to get a development backend. Pick one.

**A local backend in Docker.** [docker-compose.yml](../docker-compose.yml) runs the open-source Convex
backend and its dashboard on this machine, with no account and no cloud project:

```sh
docker compose up -d
docker compose exec backend ./generate_admin_key.sh
```

Put the printed key in `.env.local` as `CONVEX_SELF_HOSTED_ADMIN_KEY`, alongside
`CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210`. The Convex CLI uses those two instead of
`CONVEX_DEPLOYMENT` and talks to the container. The dashboard is on `http://127.0.0.1:6791`.
State lives in the `data` volume: `docker compose down -v` wipes the database **and** the admin
key, so generate a new key after doing that.

**A hosted (cloud) Convex deployment.** Convex runs the backend. A free account covers
development. Log in, then select or create the intended development project interactively:

```sh
npx convex login   # opens a browser; no-op if a CLI session already exists
npx convex dev     # select or create the project, then leave it running
```

`npx convex dev` writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local` itself.
It does not write `NEXT_PUBLIC_CONVEX_SITE_URL`; add it by hand as the same host on `.convex.site`:

```sh
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

**Remove `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` from `.env.local` before
switching to a hosted deployment.** The CLI prefers the self-hosted pair whenever it is present,
so leaving it behind sends every push to a container instead, which presents as a hosted
deployment that silently never updates. The two configurations are exclusive, not layered.

Confirm which one is selected before any command that affects a deployment. `npx convex env list`
names the deployment it is reading; nothing else needs to be printed, and no secret does.

Either way, `npx convex dev` is a **live backend watcher**: it pushes source and schema changes to its selected deployment, and it is what regenerates `convex/_generated`. Stop it before edits that must remain undeployed, and stop only processes you own.

Until a deployment is linked, `convex/_generated/api.d.ts` is a hand-maintained stand-in that lists the modules in `convex/`. It is normally codegen output and is never hand-edited once `npx convex dev` has run; if you add a Convex module before linking a deployment, the first `convex dev` will overwrite the file correctly.

### Next.js environment: `.env.local`

| Variable                       | Purpose                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `CONVEX_DEPLOYMENT`            | Hosted deployment selector, written by `npx convex dev`; mutually exclusive with the self-hosted pair below                   |
| `CONVEX_SELF_HOSTED_URL`       | Local backend instead: `http://127.0.0.1:3210`                                                                                |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Its admin key, from `generate_admin_key.sh`                                                                                   |
| `NEXT_PUBLIC_CONVEX_URL`       | Convex client URL for the selected backend                                                                                    |
| `NEXT_PUBLIC_CONVEX_SITE_URL`  | Its HTTP actions URL; a cloud deployment uses the matching `.convex.site` URL, the local backend uses `http://127.0.0.1:3211` |

Use the URLs supplied by the selected deployment; do not substitute a production URL to make development work. Values prefixed `NEXT_PUBLIC_` are exposed to the browser. Restart Next after changing them, and rebuild for a production-mode run.

### Convex deployment environment

Set these in the **selected development deployment's** environment, with its dashboard or `npx convex env set`. They do not belong in browser configuration.

| Variable                                                                                                     | Requirement                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                                                                                                   | Frontend origin, e.g. `http://localhost:3000`; used by Better Auth                                                                                                                                                                                |
| `BETTER_AUTH_SECRET`                                                                                         | A private random secret of at least 32 characters                                                                                                                                                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                   | Optional pair enabling Google OAuth                                                                                                                                                                                                               |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`                                                                 | Optional pair enabling Discord OAuth                                                                                                                                                                                                              |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`                                                                      | Optional pair enabling web push notifications                                                                                                                                                                                                     |
| `OPENAI_API_KEY`                                                                                             | Required for Dealer/OEM Agents SDK reasoning, P0 knowledge embeddings and `convex/notes.ts`; backend-only                                                                                                                                         |
| `TRUSTLANE_AGENT_MODEL`                                                                                      | Optional model name for the Dealer/OEM Agents; defaults to `gpt-4.1-mini`                                                                                                                                                                         |
| `TRUSTLANE_AGENT_TRACE`                                                                                      | `true` records each agent run's reasoning trace (development and eval deployments only; see Agent eval)                                                                                                                                           |
| `TRUSTLANE_AGENT_MOCK`                                                                                       | Optional; `on` makes both agents deterministic and free for `npm run verify:chat`; local or throwaway deployments only                                                                                                                            |
| `RESEND_API_KEY`, `RESEND_FROM`                                                                              | Optional pair enabling all outgoing email                                                                                                                                                                                                         |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `ELEVENLABS_WEBHOOK_SECRET` | Optional set enabling technician clarification calls; see [Technician calls](#technician-calls)                                                                                                                                                   |
| `APP_CLOSED`                                                                                                 | Optional kill switch (the `closed` flag in `convex/app.ts`, where every feature flag is registered); `on` refuses every public function and Better Auth route, and the frontend (`src/proxy.ts`) leaves only the landing page; crons keep running |
| `PRESENCE`                                                                                                   | Optional; the `presence` flag in `convex/app.ts`. Off unless exactly `on`, and off by default: nothing in `src/` reads the who-is-here heartbeats in `convex/presence.ts` yet. Turn it on with the first surface that shows them                  |

`RESEND_FROM` is a full from-address on a domain verified in the Resend dashboard, e.g. `Acme <hello@acme.example>`. The pair enables three messages: workspace invitations, email verification on sign-up, and password reset. With either half absent, every send is skipped and nothing else changes — invitations are still created and their links still work — which is what keeps the network guard in `tests/setup.ts` satisfied without a stub. Run `node scripts/upload-email-logo.mjs` once per deployment to put the email logo in Convex storage and set `EMAIL_LOGO_URL`. The component runs with `testMode: false`, because the env gate is already the safety: nothing goes out until somebody deliberately sets a from-address on a domain they verified.

Generate the VAPID pair with `npx web-push generate-vapid-keys`. Both halves are deployment secrets and are never committed; the public half reaches the browser only through `api.push.publicKey`, which is why it is not a `NEXT_PUBLIC_` build variable. With either absent, push self-disables end to end: `api.push.publicKey` answers null, the settings screen says notifications are not switched on for this deployment, and `convex/pushSend.ts` returns before it loads `web-push` or opens a socket. Subscriptions can still be stored, so setting the keys later starts delivery without a code change.

Email/password and username authentication are configured independently of the optional OAuth providers, and `convex/auth.ts` registers a provider only when both halves of its pair are present. Keep provider calls out of automated tests.

### Production on hosted Convex

A production deployment has its **own environment**. Nothing set on the development deployment
carries over, which is the point: a dev secret must never be a prod secret.

```sh
npx convex deploy                                            # create or update the prod deployment
npx convex env set --prod SITE_URL https://your-domain.example
npx convex env set --prod BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

Every optional pair in the table above that the deployment relies on has to be set again with
`--prod`, or the feature self-disables there exactly as it does on a bare dev deployment.

Give the hosting provider `npx convex deploy --cmd 'npm run build'` as its build command, plus
`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` for the production deployment. That form
pushes the backend and builds the frontend against the URLs it just provisioned, in one step.

Add the production callback to each OAuth provider's allowed redirect URLs. The development
callback will not match, and the failure surfaces as a provider-side redirect error rather than
anything this codebase logs.

`npx convex deploy` acts on production. Treat it as requiring explicit authorization for that
target; a deploy key in the environment does not supply
that authorization.

## Run it

```sh
npx convex dev   # terminal one: the backend watcher
npm run dev      # terminal two: Next.js
```

The service worker is registered in production builds only, so notifications and offline behaviour cannot be exercised under `npm run dev`. Use `npm run build && npm start` for those.

## Verify a change

```sh
npm run format:check   # `npm run format` rewrites; CI only checks
npm run lint
npm run build          # writes .next/types, which the typecheck needs
npm run typecheck
npm run test:frontend  # tests/src
npm run test:backend   # tests/convex
```

`npm test` still runs both suites at once; the split exists so a backend failure and a frontend failure are two separate answers rather than one.

Run the build before the typecheck on a clean checkout: `next build` generates the route types under `.next/types` that `tsc` reads, so a typecheck before the first build fails on a missing type. The build needs `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` to be valid URLs; nothing is called during it, so placeholders are correct in CI.

Formatting is Prettier with its defaults and no configuration file, so there is nothing to argue about. [.prettierignore](../.prettierignore) lists what is excluded and why -- build output, Convex codegen, and vendored agent skills, all of which are rewritten by a tool that does not read it.

`npm test` runs Vitest in the `edge-runtime` environment, because `convex-test` runs functions in Convex's own runtime rather than in Node.

**No test in this suite may reach the network.** [tests/setup.ts](../tests/setup.ts) replaces `globalThis.fetch` with a guard that records and rejects every attempt, and [tests/globalsetup.ts](../tests/globalsetup.ts) fails the run for attempts that fire after a worker's last hook. A test that wants a response stubs `globalThis.fetch` itself, and drains scheduled functions inside the test that posted them. A green suite is not evidence on its own if a scheduled job was left pending.

## CI

Five independent workflows, each on every push to `main` and every pull request targeting it, each
starting from `npm ci` against the committed lockfile. They are separate files so that one red
check names one thing, and so a single pipeline can be re-run without re-running the other four.

| Workflow                                                    | Command                                  | Notes                                                            |
| ----------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| [lint.yml](../.github/workflows/lint.yml)                   | `npm run lint`                           | ESLint                                                           |
| [format.yml](../.github/workflows/format.yml)               | `npm run format:check`                   | Prettier, check only; CI never rewrites a branch                 |
| [typecheck.yml](../.github/workflows/typecheck.yml)         | `npm run build` then `npm run typecheck` | The build is what writes `.next/types`, so it cannot be dropped  |
| [test-frontend.yml](../.github/workflows/test-frontend.yml) | `npm run test:frontend`                  | `tests/src`; no build first, nothing there reads generated types |
| [test-backend.yml](../.github/workflows/test-backend.yml)   | `npm run test:backend`                   | `tests/convex`, via `convex-test`; nothing is deployed           |

Concurrency is scoped per workflow, so a new push cancels only that pipeline's stale run and never
a sibling still answering a different question.

### What triggers them

Lint, typecheck and the two test pipelines are filtered to the application and the files the checks
actually read:

```
convex/**  src/**  tests/**  public/**
package.json  package-lock.json  tsconfig.json  *.ts  *.mjs
.github/workflows/<the pipeline's own file>
```

A change outside that list cannot change what those four commands answer, so running them would
burn minutes to re-confirm a known result. A pull request touching only `.docs/`, `docs/`, `README.md`,
`.github/ISSUE_TEMPLATE/`, `.claude/` or `.agents/` runs **Format alone**.

Format is deliberately unfiltered. Prettier's scope is the whole repository, Markdown included, so a
documentation-only change is exactly what it exists to catch -- and it is the cheapest job here.

Each pipeline also lists its own workflow file, so editing one re-runs it. Without that, a broken
workflow stays green until unrelated application code happens to land.

**A filtered-out pipeline does not report "skipped" -- it does not report at all.** Four missing
checks on a documentation pull request are correct and expected, not a stuck queue. Two consequences
follow:

- If these are ever made **required checks** in branch protection, a filtered-out pipeline blocks the
  merge forever, because GitHub waits for a check that will never arrive. Required checks and path
  filters need the companion no-op job pattern before both can be used together. Branch protection is
  unavailable on this repository's current plan, so nothing is required today.
- **CI silence is not evidence.** Green because it never ran is not green. Run the checks locally
  before you commit; [checklist-before-commit.md](checklist-before-commit.md) says which ones your
  diff needs.

No provider keys and no deploy key are set in any of them, deliberately -- the network guard is only
a guard if there is nothing there to spend.

## Troubleshooting

- **Every Tailwind class compiles to nothing.** A stray `package-lock.json` above the repository makes Turbopack infer that directory as the workspace root, and Tailwind v4's source detection follows it. `next.config.ts` pins the root for this reason; check it first.
- **`tsc` cannot find `LayoutProps` or a route type.** Run `npm run build` once to write `.next/types`.
- **`api.something` is not on the generated API.** Run `npx convex dev` to regenerate `convex/_generated`.
- **A component call fails in a test with "component not found".** Register it in [tests/convex/testHelpers.ts](../tests/convex/testHelpers.ts); a Workpool registers under its pool name, not under "workpool".

## Warranty P0

Open `/claims` after signing in. A single demo account operates clearly separated Dealer and OEM workspaces for its own synthetic cases. See [the P0 rehearsal](../plan/nam/p0-hackathon-mvp.md). Set `OPENAI_API_KEY` on the selected Convex development backend; optional `TRUSTLANE_AGENT_MODEL` defaults to `gpt-4.1-mini`. No browser API secret is needed. LiteParse is the single parsing/OCR layer in the Node ingestion action: ordinary text extraction where available, OCR fallback for scanned/image content, and preserved original page/location citations. Configure its runtime/dependencies and OCR data as described below; extracted facts remain proposed until human verification.

`npm run test:p0-extraction` exercises LiteParse against the captured scanned repair-order PDF in `tests/fixtures/warranty/easy/` and asserts reference fields, OCR, bounding boxes and usable page citations. It also covers digital text extraction, image OCR, the diagnostic TXT fixture, mixed-page ordering, proposed facts, ambiguity and missing OCR data. These files are shared with the manifest-driven context runner and the specialized compliance/live reference checks. Install the local English OCR data first (see below). The test runs in Node, blocks network access and needs neither Chromium nor model calls. Ordinary `npm test` remains network guarded and mocks provider responses for the SDK integration check. Live demo acceptance is separate from these checks.

### Case chat check

`npm run verify:chat` drives the case chat end to end (spec E §12.3) against a deterministic agent, never a real provider:

1. `npx convex env set TRUSTLANE_AGENT_MOCK on` on your own local deployment only.
2. `npm run dev` in another terminal.
3. `npm run verify:chat`.

Afterwards, run `npx convex env remove TRUSTLANE_AGENT_MOCK` if the deployment is shared by anything else.

### Demo workspace

`npm run demo:seed` (`npx convex run demo:seed`) against your own dev deployment only -- it writes a demo workspace (`convex/demo.ts`, scenario data in `convex/lib/demoData.ts`) with three dealerships (Harbour EV Melbourne, Southern Cross Motors, Capital EV Canberra), every persona including a second dealer and technician at Southern Cross for cross-dealership isolation checks, and about twenty warranty cases spread over roughly 120 days across every stage, each with documents, extracted facts, compliance results, mock agent turns, and some with dealer/OEM chat or technician calls. It makes no network calls -- every document is a short deterministic text blob. Seeding is resumable: rerunning it reuses the existing Better Auth users and workspace rather than failing.

`npm run demo:reset` (`npx convex run demo:reset`) deletes the demo workspace and everything hanging off it (cases, documents, dealerships, personas, memberships) via the same cascade `convex/lib/orgs/cascade.ts` uses for any org, guarded so it only ever touches the org at the reserved demo slug and only if it is flagged `demo: true`. Better Auth users are left in place, so `demo:reset` then `demo:seed` rebuilds cleanly. Then `npx convex env set DEMO_ACCESS on` shows the personas on the sign-in page; any other value (or unset) hides them.

The cron in `convex/crons.ts` runs `internal.demo.restart` every 30 minutes (aligned to the clock, `:00` and `:30`): `reset` then `seed`, so the demo workspace is never more than half an hour old. It is a no-op unless `DEMO_ACCESS` is exactly `"on"` (the `demo` flag in `convex/app.ts`) and while `APP_CLOSED` is on, so it fires harmlessly on every deployment and only ever does anything on the one where the demo is turned on. The `(app)` layout shows a persistent banner (`src/app/(app)/_components/demo-banner.tsx`) whenever the active workspace's `demo` flag is set, naming the time to the next reset; it has no dismiss control because the reset is a real consequence.

### Agent eval

`gradeTurn` (`convex/lib/warranty/agentEval.ts`) grades one Dealer or OEM Agent turn against a scenario: role tools (`ROLE_TOOLS`), tool discipline (required, forbidden and ordered tools, searched terms), context isolation, recommendation vocabulary, citations grounded in the run's tool results, citation support (each explanation cites its own compliance row's evidence, related facts or policy source), state consistency (an explanation's words agree with its row's state), the expected outcome (recommendation, requirement IDs, citations, regulatory issue, reimbursement notes), evidence requests (never asking again for what the compliance run already settles), required concepts, forbidden claims, and no claim that the agent acted. Prose is only read sentence by sentence against the narrow `CLAIMS` and `CONCEPTS` patterns; exact wording is never compared.

Scenarios live in `evals/warranty-agents/`:

- `scenarios.ts` `SCENARIOS` walks the reference case in order. `tests/convex/warranty/agentEval.test.ts` drives it with the mocked provider.
- `scenarios.ts` `BEHAVIOUR_SCENARIOS` are independent Dealer (`D…`), OEM (`O…`) and adversarial (`A…`) scenarios, each on a named fixture from `fixtures.ts` built on a fresh case through the same mutations `/claims` uses. `tests/convex/warranty/agentBehaviour.test.ts` builds every fixture, checks its compliance states, then drives the real Agents SDK loop with a scripted model twice: a grounded run that must be saved and pass every check, and the failure the scenario targets, which output validation must refuse or the grader must fail on exactly the named checks. This proves the harness and the deterministic guards, not the model.

Both run with `npm run test:backend` and make no network calls.

**Reasoning traces.** With `npx convex env set TRUSTLANE_AGENT_TRACE true` on a development or eval deployment, every agent run records its reasoning chain in `warrantyAgentTraces` and `warrantyAgentTraceItems` (`convex/lib/warranty/agentTrace.ts`): the input, each tool call with its arguments, each tool result exactly as the model read it (documents as `doc1`, `doc2`, with the handle map on the trace), any model text or reasoning summaries the model returns, the output, the validation violations it was sent and its revised output, for saved and refused runs alike. The case owner reads them with `api.warrantyAgentTrace.forCase` and `steps`. Traces hold case evidence text, so never enable tracing on a production deployment. `gpt-4.1-mini` returns no reasoning items; a reasoning model set through `TRUSTLANE_AGENT_MODEL` adds them when its provider returns them. To add a scenario, add a fixture if none fits, the scenario, and its entry in `FAILURES` in the behaviour test. A role-only tool is added to that role in `ROLE_TOOLS`.

`npm run eval:agents -- --live [--suite reference|behaviour|all] [--repeat N] [--only ID,ID]` runs scenarios with the real model against the Convex deployment in `.env.local` and rewrites `output/agent-evals/<timestamp>.json` after every scenario. On a tracing deployment it also saves each graded run's reasoning chain in the report and as a readable `output/agent-evals/<timestamp>-traces/<scenario>-<repetition>.md`, and grades context isolation on the tool results the agent actually read. The default suite is `reference`. `behaviour` skips `mockedOnly` scenarios, runs each of the rest `--repeat` times on a fresh case and reports a pass count per scenario; fixture gate assessments are real, ungraded agent runs, so one behaviour pass is 52 agent runs (33 graded, 19 gates). The deployment's `openaiDay` provider limit (200 model calls a day, `convex/lib/rateLimits.ts`) bounds how much fits in a day; the runner stops cleanly and keeps its report when a quota refuses a run. It sends `SITE_URL` from the shell (default `http://localhost:3000`) as the Origin Better Auth requires, so set it when the deployment trusts another frontend origin. It makes paid OpenAI calls, needs authorisation, and refuses to start without `--live` and `OPENAI_API_KEY` in the shell (the model key itself must also be set on the deployment). The live grader cannot see tool outputs: context isolation is checked on the saved output, the retrieved document IDs and the role's `warranty.view`. Each live run signs up throwaway `@example.invalid` accounts on that deployment (one for the reference suite and one per behaviour repetition; their verification emails are queued and will bounce); delete those users from the dashboard when they pile up.

`evals/warranty-agents/technicianCall.ts` is the technician-call scenario and its call grader. The reference run starts with it on the repair order and diagnostic report alone, where the Dealer Agent must leave a technician call awaiting approval (`preparesCall`: calling the tool and getting `NOT_ELIGIBLE` fails). On a `TECHNICIAN_CALL_MODE=demo` deployment with `ELEVENLABS_API_KEY` and the installed technician audio, a person then approves it (technician `+61 491 570 156`, a reserved fictional number; the runner refuses a real-mode deployment), the simulated call runs with real ElevenLabs speech-to-text, and the transcript's facts are verified. `gradeTechnicianCall` checks that the agent searched before calling, named only MISSING requirements, asked only about them and never put a voltage threshold to the technician, that the call asked for the reading before reading it back, and that every fact quotes the transcript, stays PROPOSED until verified and then settles the requirement; the result and the call turn by turn go to `<timestamp>-traces/technician-call.md`. Any later call an agent prepares is declined. After the OEM Agent recommends APPROVE a person approves, and the regulatory question is asked on the approved case. `--fallback`, on a deployment without `ELEVENLABS_API_KEY`, expects the approved call to fail visibly with no evidence and continues on the written dealer fix. On a tracing deployment every reference turn's reasoning is written to `reference-<n>-<scenario>.md`. `tests/convex/warranty/technicianCall.test.ts` and `technicianCallDemo.test.ts` cover the tool, approval, both providers, the signed webhook, review and the call grader with mocked providers.

### Technician calls

Calls run inside the technician's own Lead the Way app, not over the phone: see the "Technician calls" paragraph in [infrastructure.md](infrastructure.md) for the flow (`convex/calls.ts`, `convex/callVoice.ts`). In-app calls need no Twilio account or ElevenLabs agent id -- the only optional variable is `ELEVENLABS_API_KEY`, which switches the technician's voice-note transcription from simulated (`integrations/elevenlabs/technician-demo/scripts.json`) to real ElevenLabs Scribe, and is then a paid call per note. Run `npm run verify:calls` locally with `DEMO_ACCESS=on` and `TRUSTLANE_AGENT_MOCK=on` to drive one call end to end in a browser (a dealer's device and a technician's device, a fake microphone, and simulated transcription with no key set).

The rest of this section documents the phone transport the in-app calls replaced. That code (`convex/warrantyVoiceProvider.ts` dispatch/webhook/reconcile, `warrantyTechnicians`) is still in the repository but is unreachable from the workspace -- `calls.approve` always writes `mode: "app"`. Removing it needs its own authorisation.

The Dealer Agent's `request_technician_call` tool prepared a short ElevenLabs phone call to a technician when a dealer-owned requirement (`resting-voltage`, `accessories-disconnected` or `dtc`) is MISSING and blocks the claim now after the agent searched the evidence (a `MAY_BE_REQUESTED` row becomes eligible once the OEM requests it). Every question must be about a requirement the call names, and none may put a voltage to the technician ("was it below 12 V?"); a refusal names what can be called about now; [the specification](../plan/nam/elevenlabs-technician-call.md) has the flow. The tool never dialled. The case owner added a technician (name and E.164 phone, stored only in `warrantyTechnicians` and shown masked), approved, and only then did `convex/warrantyVoiceProvider.ts` call ElevenLabs over Twilio.

`TECHNICIAN_CALL_MODE` picks the provider behind the same tool, approval and recording path: `real` (the default) dials over ElevenLabs Agents and Twilio; `demo` simulates only the phone network. In demo mode the call runs turn by turn in `convex/warrantyVoiceProvider.ts`: the Lead the Way AI asks each approved question (spoken by the browser on the call card), the technician answers with a prerecorded line chosen deterministically for that question, real ElevenLabs speech-to-text (`scribe_v2`) transcribes it, and `convex/lib/warranty/technicianDemo.ts` extracts the evidence from that transcript, recording "can't verify" answers as unavailable rather than inventing a value. No model improvises the technician. The card and the transcript document say the call is simulated. Demo mode needs only `ELEVENLABS_API_KEY`; `TECHNICIAN_CALL_DEMO_SCENARIO=unavailable` switches to the fixture where the technician cannot verify the voltage. The technician lines live in `integrations/elevenlabs/technician-demo/scripts.json`; `ELEVENLABS_API_KEY=... node scripts/technician-call-fixtures.mjs` generates their ElevenLabs TTS audio into `public/demo/technician-call/` (committed; `--force` regenerates, `--stt` prints what speech-to-text hears), and `node scripts/technician-call-fixtures.mjs --install` uploads it to the deployment in `.env.local`, once per deployment.

All four `ELEVENLABS_*` variables are backend-only. With any absent, the card warns before approval and an approved call ends `FAILED` with `ELEVENLABS_NOT_CONFIGURED` without dialing; the rest of the workflow is unaffected. To set them up:

1. `ELEVENLABS_API_KEY`: an ElevenLabs API key with Agents access.
2. `ELEVENLABS_AGENT_ID`: `ELEVENLABS_API_KEY=... node scripts/elevenlabs-agent.mjs --apply` creates the agent from `integrations/elevenlabs/technician-agent.json` (prompt, AI-disclosure first message, read-back rule, dynamic variable placeholders, data collection) and prints its ID; with `ELEVENLABS_AGENT_ID` in the shell it updates that agent instead. It places no call.
3. `ELEVENLABS_AGENT_PHONE_NUMBER_ID`: import a Twilio number into ElevenLabs (Phone numbers) and copy its ID.
4. `ELEVENLABS_WEBHOOK_SECRET`: create an HMAC workspace webhook pointing at `<NEXT_PUBLIC_CONVEX_SITE_URL>/elevenlabs/post-call`, attach it to the agent as its post-call webhook with the transcript and call initiation failure events, and set its secret. Enable retries on the webhook if the plan allows it.

A finished call becomes a processed case document with its candidate facts PROPOSED; nothing counts toward compliance until the dealer verifies it. A call that never reports back is polled at 20, 40 and 60 minutes and then marked `FAILED` with `NO_RESULT`. Approvals are limited to 5 per account per hour. Tests stub every ElevenLabs request.

## LiteParse Node binding

`@llamaindex/liteparse` is pinned to **2.14.4**. Install the lockfile with
`npm ci`, including optional dependencies: the package selects the native binary
for the host platform. `convex.json` marks it as a Node external package so
Convex preserves its native binary and PDFium assets instead of bundling them.

Run `npm run test:liteparse` to verify native PDF text extraction, page rendering
and built-in English OCR locally. The script generates a small PDF in memory,
then parses its rendered image; it does not contact a model provider. This is a
runtime smoke check, not the P0 scanned-repair-order acceptance test.

Ingestion must import LiteParse only in a `"use node"` action module.
Pass a Convex storage ID, fetch the original in the action, enforce the 20 MiB
input limit, and use `ocrEnabled: true`, `ocrLanguage: "eng"`,
`ocrFailureFatal: true`, `continueOnPageError: false`, `maxPages: 30` and
`numWorkers: 1`. Check `totalPages` and reject documents over 30 pages rather
than treating a capped parse as complete. Preserve `pages[].pageNum`, text and
text-item bounding boxes; do not infer TEXT/OCR method from text presence alone.
Persist results through internal mutations with human verification still pending.

The extraction acceptance test requires a local `eng.traineddata`, which is
not installed by `npm ci`. Download the English model from the official
[Tesseract tessdata_fast 4.1.0 release](https://github.com/tesseract-ocr/tessdata_fast/blob/4.1.0/eng.traineddata)
once into the ignored `.ocr/` directory:

```sh
mkdir -p .ocr
curl --fail --location --output .ocr/eng.traineddata \
  https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata
npm run test:p0-extraction
```

For data already installed elsewhere, set `TRUSTLANE_TESSDATA` to its directory
(not the file). The test does not download assets or contact a deployment.

Run `npm run test:ocr-retrieval` for the full offline OCR/context pipeline, or
`npm run test:context` for all manifest-driven examples. To add a case, put its
source files and `example.json` under `tests/fixtures/warranty/<name>/`; the
shared runner discovers them automatically. Use `CONTEXT_EXAMPLE=<id>` to select
one example. See [the format and checks](../tests/fixtures/README.md).

Warranty examples run real storage, registration and Node LiteParse ingestion
in an in-memory Convex backend, then assert facts, original-page passages and
agent context. A real SDK tool loop uses scripted model/embedding responses.
Eligible examples can also declare submission and OEM context checks.
`npm run test:retrieval` runs the separate mocked knowledge/embedding and agent
integration suites. All offline checks retain the network guard and make no
real provider calls or deployment changes. Native `.smoke.ts` tests live under
`tests/convex/` and use the separate Node config; ordinary `.test.ts` suites use
edge-runtime.

`npm run test:legislation` selects captured system-reference examples, including
the pinned 23-page ACT repair Act and section 49 passages on PDF pages 9 and 10.
These use real LiteParse and the shared passage search utility without registering
legislation as a warranty upload. See [provenance](../tests/fixtures/legislation/README.md).
These are offline captured-file checks. The live Commonwealth adapter and its
15-minute freshness cache are separate; broader regulatory vector ingestion and
state/territory source adapters remain future work. See [live legal retrieval](retrieval.md#live-official-legal-context).

Ingestion runs in the `"use node"` action `convex/warrantyIngest.ts`. The
following operator command uploads OCR data to the selected Convex deployment;
it does **not** install local data. OCR data is installed once per deployment,
never fetched at parse time:

    node scripts/install-ocr-assets.mjs .ocr/eng.traineddata

To check a deployment's native runtime without creating a case:

    node scripts/install-ocr-assets.mjs --probe tests/fixtures/warranty/easy/01-scanned-repair-order.pdf

Hosted proof (2026-09-13, LiteParse 2.14.4, dev deployment): page 1 OCR,
reference fields extracted with bounding boxes, 5215 ms.

### Live legal context configuration

Set `TRUSTLANE_LEGAL_SEARCH` on the selected Convex deployment to `live` to use
the free Federal Register public API; default `seeded` returns labelled captured
demo context. No search-provider key or paid search call is required. The Dealer
and OEM reasoning agents still require their existing model configuration.
Setting deployment environment variables and deploying require authorization.

Live retrieval accepts short legal-topic queries and selected visible fact and
requirement references. `asOf` defaults to today; specifying an earlier date
requests that compilation, not a decision about legal applicability. Only `AU`
Commonwealth principal Acts are supported initially. Network, metadata or source
failures fail the run explicitly. The shared official-search budget is 10 cache
misses/minute and the query cache lasts 15 minutes. Existing citations retain
original source snapshots and provenance after refresh. Details and limits are
in [retrieval.md](retrieval.md#live-official-legal-context).
