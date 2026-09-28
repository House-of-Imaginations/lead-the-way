# Frontend

[DESIGN.md](../DESIGN.md) is the source of truth for look and feel: tokens, type, spacing, components and copy rules. Read it before any UI work; this page is about how the pieces are wired, not what they should look like.

## Tokens, not a Tailwind config file

Tailwind v4 has no `tailwind.config.ts`. The theme lives in CSS:

- [`src/styles/tokens.css`](../src/styles/tokens.css) defines every design token as a CSS custom property on `:root`, generated from `DESIGN.md`'s front matter. Colours are the light values; dark values apply under `[data-theme="dark"]` or `prefers-color-scheme: dark`.
- [`src/styles/tailwind-theme.css`](../src/styles/tailwind-theme.css) maps each token into Tailwind's `@theme inline`, so `bg-layer-01`, `text-text-secondary`, `border-border-subtle` and the rest are ordinary utility classes that resolve to a `var()`. Never hard-code a hex value or a pixel size in a component; use the named utility.
- [`src/app/globals.css`](../src/app/globals.css) imports the theme, defines the `dark:` variant (a forced `data-theme` wins, otherwise the OS preference applies), sets `IBM Plex Sans` as the body font, and zeroes every border radius by default, because square is the brand: only `rounded-tag` and `rounded-round` opt back in.

## Dark mode

Follows the OS by default. A `?theme=light|dark` query param and a stored choice (`lead-the-way-theme` in `localStorage`) both override it. [`src/lib/theme.ts`](../src/lib/theme.ts) is the single resolution order, used both as an inline pre-paint script (so a stored choice never flashes the other mode) and as the browser-side function a settings control calls later; `theme.test.ts` runs both against the same case table so they cannot drift apart.

## Feature flags on the frontend

[`src/lib/flags.ts`](../src/lib/flags.ts) reads a Convex flag (`convex/app.ts`) server-side through `fetchQuery`, and fails closed to "off" if the backend is unreachable. It only decides what to render; the backend's own `assertFlag` is what actually refuses a call. [`src/proxy.ts`](../src/proxy.ts) is the one consumer today: it sends every route but the landing page home while `APP_CLOSED` is on.

## Components

`src/components/ui` (the base component library, built from `DESIGN.md` on Radix primitives) and `src/components/app` (product-specific composition) do not exist yet; they arrive in P1. Until then the only UI is [`src/app/page.tsx`](../src/app/page.tsx), the landing page, and [`src/app/not-found.tsx`](../src/app/not-found.tsx).

## Testing

Frontend unit tests live in `tests/src`, run in the `edge-runtime` Vitest environment with no network access. `pnpm e2e` runs Playwright against a running `pnpm dev` (and the Convex dev deployment already running from `npx convex dev`), with `@axe-core/playwright` wired through the `expectAxeClean` fixture in [`e2e/fixtures.ts`](../e2e/fixtures.ts) so every spec can assert no accessibility violations, not just visible behaviour.
