# Setup and verification

## Install

Package manager: pnpm 10. Node 26 locally; CI runs Node 22.

```sh
pnpm install
```

Use the committed lockfile (`pnpm-lock.yaml`). Do not switch package managers.

## Configure a development backend

Copy [.env.example](../.env.example) to `.env.local` only if the latter does not exist. The template has placeholders, not usable credentials.

```sh
cp .env.example .env.local
npx convex login   # opens a browser; no-op if a CLI session already exists
npx convex dev     # selects or creates the Convex project, then leave it running
```

`npx convex dev` is a live backend watcher: it writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local`, pushes source and schema changes to the selected deployment, and regenerates `convex/_generated`. It does not write `NEXT_PUBLIC_CONVEX_SITE_URL`; add it by hand as the same host on `.convex.site` (or `http://127.0.0.1:3211` for the optional local backend in `docker-compose.yml`).

### Convex deployment environment

Set these on the **selected development deployment**, never in `.env.local`, with `npx convex env set <NAME> <value>`:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Private random secret, `openssl rand -base64 32` |
| `SITE_URL` | Frontend origin, `http://localhost:3000` in development |
| `DEMO_MODE` | Optional; `on` enables the seeded Calder Lane workspace, persona switch and demo clock |
| `DEMO_PASSWORD` | Shared password for the demo accounts, at least 12 characters |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional pair enabling Google sign-in |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Optional pair enabling Discord sign-in |
| `RESEND_API_KEY` / `RESEND_FROM` | Optional pair enabling outgoing email; without them nothing is emailed and invitations show copyable links |

A social provider is registered only when both halves of its pair are set, so email and username sign-in work before any OAuth app exists.

## Run it

```sh
npx convex dev   # terminal one: the backend watcher
pnpm dev         # terminal two: Next.js
```

## Verify a change

```sh
pnpm typecheck
pnpm lint
pnpm copy-lint
pnpm test          # Vitest and convex-test, no network
pnpm e2e            # Playwright with axe; needs both dev servers running
```

`pnpm e2e` also starts `pnpm dev` itself if nothing is already listening on port 3000, but it never starts the Convex watcher; run `npx convex dev` yourself first. No test in `pnpm test` may reach the network: [tests/setup.ts](../tests/setup.ts) replaces `fetch` with a guard, and [tests/globalsetup.ts](../tests/globalsetup.ts) fails the run for anything that fires after a worker's last hook.

## CI

Five independent workflows, each on every push to `main` and every pull request targeting it, each starting from `pnpm install --frozen-lockfile`:

| Workflow | Command |
| --- | --- |
| [lint.yml](../.github/workflows/lint.yml) | `pnpm lint`, then `pnpm copy-lint` |
| [format.yml](../.github/workflows/format.yml) | `pnpm format:check` |
| [typecheck.yml](../.github/workflows/typecheck.yml) | `pnpm build`, then `pnpm typecheck` |
| [test-frontend.yml](../.github/workflows/test-frontend.yml) | `pnpm test:frontend` (`tests/src` and `tests/scripts`) |
| [test-backend.yml](../.github/workflows/test-backend.yml) | `pnpm test:backend` (`tests/convex`, via `convex-test`) |

No provider keys and no deploy key are set in any of them, deliberately: the network guard is only a guard if there is nothing there to spend.

## Troubleshooting

- **`tsc` cannot find a route type.** Run `pnpm build` once to write `.next/types`.
- **`api.something` is not on the generated API.** Run `npx convex dev` to regenerate `convex/_generated`.
- **A component call fails in a test with "component not found".** Register it in [tests/convex/testHelpers.ts](../tests/convex/testHelpers.ts).
