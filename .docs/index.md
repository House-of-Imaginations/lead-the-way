# Lead the Way handbook

Start here whether you are a developer, a reviewer, or a coding agent. These documents describe the repository, not a promise that every deployed environment matches it.

The warranty P0 lives at `/claims`; see [P0 scope and demo](../plan/nam/p0-hackathon-mvp.md). It sits on a Next.js + Convex boilerplate with authentication, accounts, background work, notifications and a design system, plus the P0 knowledge backend: two cited reference entries and reusable embeddings. The signed-in front door opens the warranty workspace. The example feature (`convex/notes.ts` and the component that drives it) remains until a product screen replaces it.

| Guide                                                        | Read it for                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [Infrastructure](infrastructure.md)                          | Runtime boundaries, data, authentication, components, quotas                      |
| [Setup](setup.md)                                            | Install, environment variables, local development, tests, CI                      |
| [Coding conventions](coding-conventions.md)                  | File ownership, Convex patterns, frontend conventions                             |
| [Frontend](frontend.md)                                      | Tailwind v4 tokens, shadcn/ui, the app shell, reading Convex data                 |
| - [Workspace screens](frontend.md#workspace-screens)         | Navigation, dashboard, queues and the case split                                  |
| [P0 knowledge handoff](knowledge.md)                         | Seed sources, citation IDs, embedding lifecycle and retrieval integration         |
| [Retrieval handoff](retrieval.md)                            | Hybrid tools, official legal search, citations, original pages and OEM visibility |
| [Reusable OCR/context examples](../tests/fixtures/README.md) | Add file fixtures and expected extraction, passages and agent context checks      |
| [Checklist before commit](checklist-before-commit.md)        | What to run before committing, and which pipelines the diff triggers              |

The E-series workspace specs and implementation plans live under [`docs/superpowers/`](../docs/superpowers/): `specs/` states the design, `plans/` breaks it into tasks.

Agents must read the [root rules](../AGENTS.md) before changing files, and the checklist before committing. Claude's [entrypoint](../CLAUDE.md) imports those same root rules. Read the relevant guides, then verify claims against the code before editing.

Keep these documents updated in the same change that alters a command, an environment requirement, an ownership rule, an endpoint contract, or an infrastructure limit. The installed dependency versions and the [lockfile](../package-lock.json), [scripts](../package.json), and source code determine actual behaviour. Never copy real credentials or private deployment data into documentation.

## What is already here

- **Auth.** Better Auth inside Convex: email/password, username, and optional Google and Discord OAuth that register themselves only when their credentials are present.
- **Accounts.** A product-owned profile table, avatar upload through Convex storage, and a soft delete with a restore window and a daily purge.
- **Workspaces.** Multi-tenant organizations with per-workspace custom roles built from a fixed permission vocabulary, invitation links, a workspace picture, and a switcher. See [Organizations and permissions](infrastructure.md#organizations-and-permissions) before touching any of it: the rules that stop a workspace being seized or locked out are not obvious from the code alone.
- **Realtime data.** Convex queries as subscriptions, with custom function builders that inject server-derived identity, and a query cache so moving between routes does not refetch the same subscriptions.
- **Background work.** A Workpool for outbound sends, a rate limiter for per-caller and per-provider quotas, and a migrations component for backfills.
- **Notifications.** Web push end to end, self-disabling on a deployment with no VAPID keys.
- **Email.** One template behind every message — invitations, verification, password reset — with a plain-text part, escaped interpolation, and the same self-disabling behaviour when no sending domain is configured.
- **PWA.** Manifest, service worker, offline route, install and notification prompts.
- **Design system.** Harbor tokens in `src/app/globals.css`, contrast-checked in both colour schemes, with shadcn/ui vendored into `src/components/ui` and edited in place to sit inside them. `DESIGN.md` is the spec; the app shell is a sidebar, not a header band.
- **Tests and CI.** `convex-test` against the real function graph, a suite-wide network guard, and five independent GitHub Actions pipelines -- lint, format, typecheck, frontend tests, backend tests -- on `main` and on pull requests. All but Format are filtered to the application, so a documentation change does not pay for a build.

## Verification status

Run the checks yourself for your change; the numbers below are dated local evidence, not a guarantee.

At the time workspaces landed: `npm run format:check` and `npm run lint` passed (lint with five warnings, no errors), `npm run build` and `npm run typecheck` passed, `npm run test:frontend` passed 83 tests across 4 files and `npm run test:backend` passed 55 across 6, with no network access.
