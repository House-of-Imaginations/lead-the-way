<div align="center">

<img src="src/app/icon.svg" alt="" width="64" height="64">

# From Zero to Hero

**One protected hour a week for a team to learn AI on real work.**

[Overview](#overview) · [Getting started](#getting-started) · [Demo](#the-demo) · [Development](#development) · [Project structure](#project-structure)

</div>

> [!IMPORTANT]
> Concept prototype. Not an official IBM product. Built to test a service idea for IBM SkillsBuild, not to run real teams.

## Overview

Mid-career people in AI-exposed roles can sign up for free AI courses, but the learning sits outside the working week, happens in private, and rarely reaches real work. From Zero to Hero (codename Lead the Way) moves it inside the week:

- **A manager sets it up.** Priya picks a team, protects one hour a week, works through a short manager pathway and drafts a Team AI Agreement with her team.
- **The team learns on the job.** Over a four-week sprint each person takes SkillsBuild courses, applies them to a work project, and shares what worked at a show and tell.
- **Progress is visible, people are not.** Managers see team totals only, hidden below five responses. Nobody's name ever sits next to a number in a manager view.
- **Learning earns a credential.** Finishing the sprint earns a shareable credential page that shows applied work, not just course completion.

The privacy rules are enforced in the backend, not the UI, and tested.

## Tech stack

| Layer | What |
|---|---|
| App | [Next.js](https://nextjs.org) 16 (App Router), React 19, Tailwind CSS v4, Radix primitives, Carbon icons |
| Backend | [Convex](https://convex.dev) (database, functions, scheduling) with `convex-helpers` |
| Auth | [Better Auth](https://better-auth.com) through `@convex-dev/better-auth`: email and password, optional Google, GitHub and Discord |
| Email | Resend through `@convex-dev/resend` (optional; without it invitations show copyable links) |
| Tests | Vitest with `convex-test`, Playwright with axe |

## Getting started

### Prerequisites

- Node.js 24 (what CI uses) and [pnpm](https://pnpm.io)
- A [Convex](https://convex.dev) account, or Docker for the self-hosted backend in `docker-compose.yml`

### Run it locally

1. Install dependencies and create your local env file:

   ```bash
   pnpm install
   cp .env.example .env.local
   ```

2. Start Convex. The first run asks you to pick or create a deployment and writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local`:

   ```bash
   npx convex dev
   ```

   Then add `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local` by hand: the same URL ending in `.convex.site`.

3. Set the deployment's own environment. Secrets live in Convex, not in `.env.local`:

   ```bash
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   npx convex env set SITE_URL http://localhost:3000
   npx convex env set DEMO_MODE on
   npx convex env set DEMO_PASSWORD <a password of 12 or more characters>
   ```

   `.env.example` lists the optional ones (social sign-in, Resend, the `APP_CLOSED` kill switch).

4. Seed the demo workspace and start Next.js in a second terminal:

   ```bash
   npx convex run seed:reset
   pnpm dev
   ```

Open <http://localhost:3000>.

> [!TIP]
> To sign in from the demo picker on `/login`, also put `DEMO_PASSWORD` in `.env.local`. The Next server reads it to sign in for you; it never reaches the browser.

## The demo

With `DEMO_MODE` on, the app is seeded with **Calder Lane**, a client services team of nine. The ones you will use most:

| Person | Role | Sees |
|---|---|---|
| Priya Raman | Team manager | Setup, the team dashboard, sprint, learning and outcomes (team totals only) |
| Dan Okafor | Senior Account Executive | This week's hour, courses, his work project, the agreement and his credential |

Choose either from the dropdown on `/login`. The demo clock moves the sprint through its four weeks, and `/guide` walks through the whole journey. `npx convex run seed:reset` puts everything back.

> [!WARNING]
> On a deployed copy, `DEMO_PASSWORD` must be set in **two** places with the **same** value: the Convex production env, which creates the demo accounts, and the hosting env (for example Vercel), which the `/login` picker signs in with. If they differ, the picker answers "We couldn't log in as that person."

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js on port 3000 (run `npx convex dev` beside it) |
| `pnpm test` | Unit and Convex tests (Vitest, no network) |
| `pnpm e2e` | Playwright end to end with axe, desktop and mobile; needs both dev servers |
| `pnpm typecheck` / `pnpm lint` / `pnpm format:check` | TypeScript, ESLint, Prettier |
| `pnpm copy-lint` | Checks product copy against the voice rules (sentence case, no em dashes) |

CI runs typecheck, lint, format and both test suites on pull requests to `main`. End to end tests run locally.

> [!NOTE]
> Before touching the UI, read [`DESIGN.md`](DESIGN.md): it holds the tokens, components and rules (square corners, one blue accent, IBM Plex Sans). Each screen has a wireframe in [`docs/design/wireframes/png/`](docs/design/wireframes/png/). Agents should also read [`AGENTS.md`](AGENTS.md).

## Project structure

```
src/app/
  (marketing)/      landing page
  (auth)/           sign up, log in, reset password
  setup/            the manager's setup flow: team, protected hour, pathway, agreement, invite
  (app)/manager/    Priya's views: dashboard, sprint, learning, agreement, outcomes
  (app)/me/         Dan's views: this week, project, agreement, show and tell, credential
  (app)/settings/   workspace and profile settings
  credential/       public credential pages
  guide/            the prototype guide
convex/             schema, queries and mutations; convex/lib/privacy.ts holds the aggregate rules
tests/              Vitest and convex-test suites
e2e/                Playwright specs
docs/design/        product brief, design system, wireframes and data model
```

## Learn more

- [`docs/design/product-brief.md`](docs/design/product-brief.md): the problem, personas and the assumptions this prototype tests
- [`docs/design/data-model.md`](docs/design/data-model.md): Convex schema, seed data and privacy rules
- [`docs/design/README.md`](docs/design/README.md): map of the design pack
