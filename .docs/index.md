# Lead the Way handbook

Lead the Way is a manager-first team AI learning experience, built as a concept prototype for IBM SkillsBuild on Next.js (App Router) and Convex. It is not an official IBM product.

Start here whether you are a developer, a reviewer, or a coding agent. These documents describe the repository as it actually is, not the finished plan.

| Guide | Read it for |
| --- | --- |
| [Infrastructure](infrastructure.md) | Runtime boundaries, data, authentication, workspaces and permissions, quotas |
| [Setup](setup.md) | Install, environment variables, local development, tests, CI |
| [Coding conventions](coding-conventions.md) | File ownership, Convex patterns, frontend conventions |
| [Frontend](frontend.md) | Tailwind v4 tokens, the app shell, reading Convex data |
| [Checklist before commit](checklist-before-commit.md) | What to run before committing, and which pipelines the diff triggers |

The design spec and its implementation plans live under [`docs/superpowers/`](../docs/superpowers/): `specs/` states the design, `plans/` breaks it into tasks. Neither is committed to the repository (see [checklist-before-commit.md](checklist-before-commit.md)).

Agents must read the [root rules](../AGENTS.md) before changing files, and the checklist before committing. Read the relevant guides, then verify claims against the code before editing.

Keep these documents updated in the same change that alters a command, an environment requirement, an ownership rule, or a data model. The installed dependency versions, the [lockfile](../pnpm-lock.yaml), [scripts](../package.json), and source code determine actual behaviour. Never copy real credentials or deployment data into documentation.

## What is already here

- **Auth.** Better Auth inside Convex: email and password (with a username alternative), and Google and Discord OAuth switched on automatically once their client id and secret are set in the Convex deployment environment. `.env.example` also reserves a GitHub pair for when that provider is wired in.
- **Workspaces.** Multi-tenant organizations (`orgs`) with per-workspace custom roles built from a fixed permission vocabulary (`orgRoles`), invitation links with resend and revoke (`orgInvites`), and anti-escalation rules on every role and membership write. See [Organizations and permissions](infrastructure.md#organizations-and-permissions).
- **Email.** Invitation, verification and password reset mail sent through Resend, gated on `RESEND_API_KEY` and `RESEND_FROM`. With either unset nothing sends, and an invitation still shows a copyable link.
- **Demo mode.** The `DEMO_MODE` flag exists (`convex/app.ts`), naming the switch a later phase will use for a seeded demo workspace, a persona switch and a demo clock.
- **Privacy.** The product's privacy rules are fixed by the design spec: manager-facing aggregates only, hidden below 5 responses, never a name next to a number. Enforcement code lands with the screens that need it. See [Privacy](infrastructure.md#privacy).

Run the checks yourself for your change; see [setup.md](setup.md) for the commands and [checklist-before-commit.md](checklist-before-commit.md) for which ones your diff needs.
