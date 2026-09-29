# Lead the Way

Concept prototype of a manager-first team AI learning experience for IBM SkillsBuild. Next.js (App Router) + Convex. Not an official IBM product.

## Start here

- **Design: read @DESIGN.md before any UI work.** It is the single design reference (tokens in its front matter, rules and components in its body). Follow it over any general design advice or skill defaults.
- Build brief: @MASTER_PROMPT.md. Detailed design sources: `docs/design/` (map in @docs/design/README.md). Screen layouts: `docs/design/wireframes/`.
- Specs and plans from superpowers live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Skills every agent and subagent must invoke

This applies to the main session and to every subagent it dispatches. Put it in each subagent's prompt.

- **Always: `ponytail:ponytail`** before writing any code. Take the simplest thing that works; no speculative abstractions.
- **Backend (anything in `convex/`): the Convex skills.** Start with `convex`, which routes to the rest. Use `convex-design` or `convex-expert` for schema and functions, `convex-authz` for access and privacy checks, `convex-test` for tests and `convex-reviewer` before calling backend work done.
- **Frontend (anything in `src/app/` or `src/components/`): the React skills.** Use `vercel-react-best-practices` for React and Next.js code, plus `frontend-design:frontend-design` for craft only. @DESIGN.md wins over any skill's advice on look and feel.

## Commands

- `pnpm dev` runs Next.js; `npx convex dev` runs the Convex dev deployment (run both).
- `pnpm test` (Vitest and convex-test, no network), `pnpm e2e` (Playwright with axe; needs both dev servers), `pnpm lint`, `pnpm typecheck`, `pnpm copy-lint`.
- `npx convex run seed:reset` reseeds Calder Lane (from P2).
- `npx @google/design.md lint DESIGN.md` checks the design file after edits (one expected warning: disabled button contrast).
- Specs and plans in `docs/superpowers/` are never committed.

## Rules that are easy to break (full list in @DESIGN.md, "Do's and Don'ts")

- Square corners. Only tags (`rounded-tag`) and status dots or the toggle knob (`rounded-round`) are round.
- One accent (`interactive`). Surfaces are `background` and `layer-01`, split by `border-subtle` hairlines. Shadows only on floating things.
- IBM Plex Sans only (Plex Mono for code-like text). Large type is weight 300.
- Icons from `@carbon/icons-react`, 16px in UI. No emoji, no third-party logos.
- Copy: sentence case, no em or en dashes, ranges with "to", buttons 1 to 3 words starting with a verb. "Concept prototype. Not an official IBM product." appears on every surface.
- Privacy is enforced in Convex: manager-facing queries return aggregates only, below 5 responses they return hidden. Never put a name next to a number in a manager view.
- All identity goes through `convex/lib/viewer.ts#getViewer` (from P2). Every public Convex function has argument and return validators.
- Match the wireframe PNG for any screen you touch (`docs/design/wireframes/png/`), and check both light and dark tokens.
- Before saying something is done: typecheck, lint, copy lint, unit and e2e tests, and a screenshot compared with its wireframe.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
