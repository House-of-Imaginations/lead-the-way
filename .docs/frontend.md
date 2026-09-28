# Working on the frontend

How to change what Lead the Way looks like without breaking it. Read
[coding conventions](./coding-conventions.md) for where files go and
[checklist before commit](./checklist-before-commit.md) for what to run; this
document is about the parts that are surprising, and every entry here is
something that has already cost somebody an afternoon.

Entry points: [handbook index](./index.md), [setup](./setup.md),
[infrastructure](./infrastructure.md).

---

## The one-minute version

```sh
npm run dev                 # localhost:3000, Convex dev must also be running
npm run format              # src/components is NOT in .prettierignore
npm run lint                # 0 errors required; warnings are tolerated
npm run build               # MUST run before typecheck -- it writes route types
npm run typecheck
npm run test:frontend
```

`build` before `typecheck` is not a style preference. `tsc` reads the route
types `next build` writes into `.next/types`, so a typecheck on a cold tree
fails on things that are fine.

---

## The layer cake

Three layers, and keeping them apart is what makes the rest of this work.

| Layer          | Where                      | Who owns it                              |
| -------------- | -------------------------- | ---------------------------------------- |
| **Tokens**     | `src/app/globals.css`      | Harbor. `DESIGN.md` is the spec.         |
| **Primitives** | `src/components/ui/`       | shadcn/ui, VENDORED and edited in place. |
| **Screens**    | `src/app/(group)/<route>/` | The route, and its own `_components/`.   |

shadcn owns behaviour and accessibility. Harbor owns colour, radius, type,
motion and the named rules. A change that reaches for a hex value in a
component has skipped a layer.

---

## Tailwind v4: there is no config file

`tailwind.config.ts` does not exist and must not be created. Tailwind v4 is
CSS-first: `src/app/globals.css` starts with `@import "tailwindcss"` and every
design token is a CSS custom property registered through `@theme inline`.

To add a colour utility, add the variable to `@theme inline`:

```css
@theme inline {
  --color-signal: var(
    --signal
  ); /* now `bg-signal`, `text-signal`, `border-signal` exist */
}
```

The `--color-*` name is what Tailwind turns into a class. `--color-signal`
makes `bg-signal`. Nothing outside `@theme inline` generates a utility, which
is why a token can exist, resolve correctly in devtools, and still have no
class that uses it.

### Two vocabularies, one namespace

Harbor and shadcn both have a `--primary` and an `--accent`, and they mean
DIFFERENT things: Harbor's accent is the interactive green, shadcn's is a muted
hover ground. That collision is resolved once, in `globals.css`, and the
resolution is:

- **shadcn's names win in Tailwind.** `bg-background`, `text-foreground`,
  `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`,
  `bg-primary`, `bg-accent` all mean what a shadcn component expects.
- **Harbor's roles keep their own names, renamed out of the way.** The Harbour
  Navy is `--institution`; the Signal Green is `--signal` / `--signal-mark` /
  `--signal-deep`. The shadcn tokens are then defined IN TERMS of them:
  `--primary: var(--signal)`.

So `bg-primary` and `bg-signal` are the same colour today, and the first is
what a button should say. Reach for the Harbor name only where shadcn has no
word for the thing: `text-verified`, `border-disputed`, `bg-well`,
`text-on-institution`.

### The dark mode trap

**Tailwind's `dark:` variant matches a `.dark` class. This app has never set
one.** The theme is an attribute — `data-theme="dark"` on `<html>`, written
before first paint by `themeScript` in `src/lib/theme.ts` — with a
`prefers-color-scheme` fallback for the "system" setting.

`globals.css` therefore redefines the variant:

```css
@custom-variant dark {
  &:where([data-theme="dark"], [data-theme="dark"] *) {
    @slot;
  }
  @media (prefers-color-scheme: dark) {
    &:where(
      :root:not([data-theme="light"]),
      :root:not([data-theme="light"]) *
    ) {
      @slot;
    }
  }
}
```

Both halves are needed. Delete the media half and an explicit choice still
works while "system" silently stops. Delete the attribute half and the toggle
stops.

**The failure mode is invisible.** A wrong `@custom-variant` does not error --
every `dark:` class just never matches, and the app looks slightly flat at
night instead of broken. Whenever you touch that block, check a page in all
three states: Night, Auto, Day.

Most of the time you do not need `dark:` at all. `--ground`, `--text`,
`--surface` and friends are already redefined in the two dark blocks, so
`bg-background text-foreground` is correct in both themes by construction.
Reach for `dark:` only when the two themes need genuinely different treatment,
not different values of the same role.

### Do not rewrite these two lines

```css
--h-night: #0c1f1c;
--h-paper: #f4f6f5;
```

`tests/src/lib/theme.test.ts` reads `globals.css` OFF DISK and regex-matches
`--<name>:\s*(#[0-9a-fA-F]{3,8})`. They are the `theme-color` meta values, which
a browser reads as a literal string with no `var()` to resolve. Turn either into
a `var()` or an `oklch()` and the suite fails with "`--h-night` is not declared
in globals.css".

---

## Adding a shadcn component

```sh
$(which npx) shadcn@latest add dialog tooltip
```

**`$(which npx)` is required in this environment.** A shell hook rewrites a bare
`npx` to `npm`, and `npm shadcn@latest add ...` fails with
`npm error Missing script: shadcn@latest`.

Then, every time, in this order:

1. **Repoint `cn`.** The CLI writes `import { cn } from "cn"` — the raw registry
   literal, not the alias. Change every one to `@/lib/utils`.
2. **Delete anything it appended to `globals.css`.** The CLI likes to add a
   `.dark { --sidebar-*: ... }` block of generic slate greys, on a class this app
   never sets. It is dead weight and it contradicts the token bridge.
3. **Bring it inside the rules** — the table below.
4. `npm run format`. `src/components` is NOT in `.prettierignore`, and the
   Format pipeline is the one CI job that is not path-filtered.
5. `npm run lint`. `@typescript-eslint/no-empty-object-type` is an ERROR here,
   and older shadcn output writes `interface X extends React.ComponentProps<"input"> {}`.

**NEVER run `shadcn init`.** It rewrites `globals.css` with its own token block
and takes Harbor with it. `components.json` is written by hand and already
correct.

Registry URLs, if you need to fetch one directly:
`https://ui.shadcn.com/r/styles/new-york-v4/<name>.json`. The shorter
`https://ui.shadcn.com/r/<name>.json` 404s.

### What generated components get wrong

Each row is a rule in `DESIGN.md` that shadcn's defaults break. Fix it in the
vendored file and leave a comment saying which rule, so the next `shadcn add`
does not quietly undo it.

| shadcn ships                                      | Change it to                                                      | Why                                                                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled:opacity-50`                             | dashed `border-border` + `text-muted-foreground`, fill removed    | Half opacity composites the control over an unknown ground, which invalidates every measured contrast ratio at once                                                                                     |
| `focus-visible:ring-[3px]` + `outline-none`       | strip both from real controls                                     | `globals.css` already draws ONE `:focus-visible` outline on everything; the ring is a second indicator. Keep `outline-none` on Radix-managed panels (dialog, popover, dropdown, select, sheet, tooltip) |
| `shadow-sm` on cards, buttons, inputs             | remove                                                            | The Flat Record Rule: only things that genuinely leave the page cast a shadow. Keep shadows on popover/dialog/sheet/toast, mapped to `--shadow-lifted` / `--shadow-floating`                            |
| `hover:bg-primary/90`                             | `hover:bg-signal-deep`                                            | Hover is a colour, not an alpha. Every ratio in Harbor is measured against a named ground, and an alpha composite is on a ground nobody measured                                                        |
| `h-9` default control                             | `h-8` (32px), plus `size="touch"` at 44px                         | Spec density. 44px is a product requirement on anything a technician taps                                                                                                                               |
| `rounded-full` badges                             | 4px radius, 20px high, transparent fill, 1px status-colour border | A chip is not a pill                                                                                                                                                                                    |
| `useTheme()` from `next-themes`                   | `src/lib/theme.ts` and `data-theme`                               | Do not add `next-themes`. `theme.ts` owns the resolution order in two forms with a test pinning them together; a third implementation is the drift it exists to stop                                    |
| `const THEMES = { dark: ".dark" }` in `chart.tsx` | `'[data-theme="dark"]'`                                           | See the dark mode trap above                                                                                                                                                                            |
| `Math.random()` in a render body                  | anything deterministic                                            | `react-hooks/purity` is an error here, and it desyncs server and client markup                                                                                                                          |
| `useState` + `useEffect` to read a media query    | `useSyncExternalStore`                                            | `react-hooks/set-state-in-effect` is an error here                                                                                                                                                      |

---

## The shell

Two layouts, and every route is inside one of them.

- **`src/app/(app)/layout.tsx`** — `SidebarProvider` + `AppSidebar` +
  `SiteHeader` + `SidebarInset`. Signed-in product. The sidebar carries the
  wordmark, the nav, the workspace switcher and the account menu; the header
  carries the trigger, the title and the theme toggle.
- **`src/app/(landing)/layout.tsx`** — a pass-through. Its routes draw different
  chrome, so the group shares none:
  - **`/`** (`(landing)/page.tsx`) is the full-bleed marketing page, built from
    `(landing)/_components/` and styled by `(landing)/landing.css`. It draws
    its own navigation, `<main>` and footer. It is **light-only on purpose**:
    `.tl-landing` re-declares the light values of both the Harbor tokens and
    the shadcn bridge names (the bridge resolves on `:root`, so overriding
    `--ground` alone would not reach `bg-background`), and it never writes
    `data-theme`, so the visitor's theme choice survives for the next route.
    Landing components use no `dark:` variants. The stylesheet sits in
    `@layer components` so Tailwind utilities still win over it. The page
    deliberately steps outside the Scarce Green, Charge and Flat Record rules;
    those govern the product, not the front door.
    **Motion** (`motion`) owns its animation: server sections render
    `motion/react-client` elements with plain-data props, and anything that
    needs a hook (`useScroll`, `useInView`, `animate`) lives in
    `(landing)/_components/motion/`. The page is wrapped in
    `MotionConfig reducedMotion="user"`; components that branch markup on
    reduced motion use `useCalm`, which is hydration-safe where Motion's
    `useReducedMotion` is not. Every element that starts hidden carries
    `data-motion`, and a `<noscript>` style puts those at rest, so the page
    still reads without JavaScript. Do not add a CSS `transform` (least of all
    `!important`) to an animated element -- it overrides Motion's inline one.
    Signed-in readers who reach it see "Open workspace" instead of "Try it
    now", and no "Sign in" link.
  - **`/join/[token]`** gets the header band with the full logo lockup over a
    centred column from `(landing)/join/layout.tsx`.
- `src/app/not-found.tsx` and `src/app/offline/page.tsx` sit OUTSIDE both groups
  and draw their own `<main>`. That is deliberate: the offline page is served
  from the service worker cache with none of its JS, so it cannot depend on a
  layout that hydrates.

A page therefore never renders its own header or its own `<main>` -- the front
door above is the one exception. Inside `(app)`, wrap content in `PageBody` from
`(app)/_components/page-body.tsx`, which owns the 940/1120px measure and the
`gap-8` rhythm. Under `join/`, the layout already owns the measure — use a
plain wrapper.

### Settings screens

`/settings/profile`, `/settings/notifications`, `/settings/account` and a
workspace's `/orgs/[slug]` are built from `src/components/settings.tsx`: a
`SettingsHeading`, then `SettingsSection` rows (title and description left,
controls right), `FormSection` for a row that saves on its own, and a danger
zone of `DangerItem`s. Every destructive action goes through `ConfirmDialog`,
which stays open while the action runs so a failure shows inside it.
`/settings` redirects to the profile page, and `settings/layout.tsx` owns the
signed-out and pending-deletion states for all three.

### The sidebar is resizable

The rail between sidebar and content is a `role="separator"`: drag to resize
(180–420px), click without dragging to collapse, arrow keys to nudge. The width
lives in a `sidebar_width` cookie that `(app)/layout.tsx` reads **on the server**
and clamps. That is why the layout is a server component — reading the cookie in
an effect instead would paint the default width and then snap, on every
navigation, for anyone who had ever touched it.

Cookie values are user-writable. Clamp anything read from one.

---

## Reading data

```tsx
import { useQuery } from "convex-helpers/react/cache"; // NOT "convex/react"
import { useMutation } from "convex/react";
```

`convex-helpers/react/cache` keeps subscriptions alive across navigation, so
moving between routes does not refetch the same data. Use it for every query.

### Three states, not two

`useQuery` returns `undefined` while it is still asking, and that is **not** an
answer. Rendering the empty or not-found state for `undefined` flashes the wrong
screen on every load.

```tsx
if (seated === undefined) return <PagePending />; // still asking
if (seated === null) return <NotFound />; // asked, and the answer is no
```

### `authenticatedQuery` THROWS for a guest

`api.orgs.mine`, `api.orgs.bySlug` and friends are built on `authenticatedQuery`.
For a signed-out caller they throw rather than returning empty, and
`convex-helpers/react/cache` re-throws during render. **There is no `error.tsx`
anywhere under `src/app`**, so that is a blank screen.

The guard is `"skip"`, and it has to be the argument — a guarded `if` after the
hook has already issued the query:

```tsx
const user = useQuery(api.auth.getCurrentUser, {});
const orgs = useQuery(api.orgs.mine, user ? {} : "skip");
```

### The route owns the subscriptions and the mutations

A `_components/` file is presentational: it takes props and callbacks. This is
what keeps one screen's writes in one place where a single error region can see
all of them. Do not open a second subscription to the same data in a child.

Hooks cannot be called conditionally, so declare every `useMutation` above the
early returns and bind the id at call time:

```tsx
const setImage = useMutation(api.orgs.setImage);
const orgId = seated?.org._id; // may be undefined on the first render
// ...later, inside a callback:
await setImage({ orgId, storageId });
```

### Uploading an image

Two steps, and the file never passes through a Convex function — a mutation
cannot take a multi-megabyte argument. `useImageUpload` in `src/hooks/` does the
dance; give it the two mutations:

```tsx
const picture = useImageUpload({
  noun: "workspace picture",
  onError: setError,
  getUploadUrl: () => uploadUrl({ orgId }),
  attach: (storageId) => setImage({ orgId, storageId }),
  detach: () => clearImage({ orgId }),
});
```

The browser-side type and size check is a courtesy that saves a phone spending
its upload on a file that will be refused. **It is not the gate.** The server
re-checks against what `_storage` actually recorded, because anything the
browser enforces the browser can skip.

Store the storage id, never the URL: a Convex storage URL is signed and
expiring, so a stored one goes stale in a row nobody thinks to refresh. Resolve
it per read and keep the id off the wire.

### Case chat

AI Elements live in `src/components/ai-elements/` (generated, Harbor-fixed;
see "What generated components get wrong"). Convex rows map to their props in
`src/lib/chat.ts`; there is no `useChat`. The route owns
`warrantyChat.messages`, `send`, `retry` and `citation`; `_components/chat/*`
are presentational. Rows expose `data-chat-author` and `data-chat-status` for
browser checks. Card buttons only navigate.

### Calls

`src/components/calls/CallCard.tsx` (dealer thread) and `CallScreen.tsx`
(`/technician`) share the same building blocks. `useRecorder`
(`src/hooks/useRecorder.ts`) wraps `MediaRecorder`, caps a note at 90 s
(`MAX_NOTE_MS`) and turns a denied microphone into "Allow microphone access to
reply." rather than a thrown error. `HoldToTalk` drives it from a single
button with both pointer (`onPointerDown`/`onPointerUp`) and keyboard (Space
or Enter) events, so it works with a mouse, a touchscreen or a keyboard.
`useCallPlayback` plays each new turn as it arrives -- the agent's line
through `speechSynthesis`, the technician's through its recorded
`audioUrl` -- and `primeAudio` (`src/hooks/useCallPlayback.ts`) must be called
synchronously inside the Answer tap, because iOS only lets audio and speech
start from a user gesture. The technician's scenario picker on `CallScreen`
fetches a scripted answer from `scenarioClip(scenario, response)`, which
resolves to `/demo/technician-call/<scenario>/<response>.mp3`, and sends it
as an ordinary voice note instead of recording one.

---

## Hooks

Every React hook lives in `src/hooks`, one per file, named after the hook.
`useIsMobile`, not `use-mobile`. A hook is never defined in the component that
happens to use it — the test suite has no DOM, so a rule living inside a
component cannot be tested at all.

Pure browser and domain logic goes in `src/lib` for the same reason.

---

## Testing

**There are no component or page tests, and you cannot write one today.**
`vitest.config.ts` runs the whole suite on `edge-runtime`, not jsdom. Nothing
renders. Adding component tests means jsdom + `@testing-library/react` + a
per-directory environment override that must not break `convex-test`, and it is
its own change.

So frontend logic is tested by being moved OUT of components: `src/lib/*` and
`src/hooks/*` that do not touch the DOM. `tests/src/` mirrors that tree.

The suite has no network access. A test that reaches out fails the run.

### What the harness cannot do

`convex-test`'s `ctx.storage.store()` **drops the blob's content type**.
`ctx.db.system.get()` returns `sha256` and `size` and no `contentType`, so any
server check on the uploaded type is unreachable from a test. Set the storage id
with `ctx.db.patch` directly when you need a row that has a file, and test the
authorisation and cascade paths instead. `tests/convex/orgs.test.ts` says this
in place so nobody re-attempts it.

---

## Things that will waste your afternoon

- **Every Tailwind class compiles to nothing.** Check `next.config.ts` still
  pins `turbopack.root`. A stray `package-lock.json` in a parent directory (a
  `~/package-lock.json` will do it) moves the inferred root and Tailwind stops
  finding the stylesheet. No error, just an unstyled app.
- **`git checkout src/app/globals.css`** discards the token bridge along with
  whatever you meant to undo. That file is 700 lines of load-bearing work; edit
  it surgically.
- **Regex over a whole `.tsx` file** to strip Tailwind variants will eat real
  code. `const THEMES = { light: "", dark: ".dark" }` became
  `{ light:"",".dark"}` exactly this way. Scope any codemod to string literals
  that actually look like class lists.
- **Prettier runs unfiltered in CI.** A generated file left unformatted fails the
  Format pipeline even when the other four are path-filtered away.
- **`@typescript-eslint/no-explicit-any` and `no-empty-object-type` are errors**,
  not warnings. `no-unused-vars` is a warning.
- **Reduced motion is global.** `globals.css` forces every transition to 1ms with
  `!important` under `prefers-reduced-motion: reduce`, and that now governs Radix
  animations too. Test with it on.

---

## Before you commit

Run [the checklist](./checklist-before-commit.md). Then, by hand at
`npm run dev`, the things no command checks:

- **All three theme states** — Night, Auto, Day — on the pages you touched.
- **Focus.** Tab through a form, a dropdown and a dialog. Exactly one focus
  indicator per control; a doubled ring means a shadcn ring survived.
- **Disabled.** The control must lose its fill and show a dashed border, never a
  50% ghost.
- **Three widths.** 375 / 1024 / 1440. The sidebar goes overlay drawer → 56px
  icon rail → 240px.
- **Signed out.** `/`, `/sign-in`, `/join/<token>`. Any `authenticatedQuery`
  without its `"skip"` guard is a blank screen here, not an error message.

---

## Workspace screens

- **Navigation** comes from `mainNav(permissions)` in `src/lib/nav.ts`. Add a section there, not in the sidebar. The server still checks every function; hiding a link is only convenience.
- **Dashboard** (`/dashboard`) reads `metrics.overview` once. `asOf` is passed from the client, rounded to the minute, because queries have no clock. Charts use the vendored shadcn `chart.tsx` (recharts); the stage pipeline is plain CSS bars that link to the filtered queue.
- **Inbox** (`/inbox`) lists `inbox.list`, the in-app copy of every notification `deliverNotification` (`convex/lib/push/inbox.ts`) sends; any new notification goes through that helper so the inbox and push stay in step. The sidebar row (`nav-inbox.tsx`) reads `inbox.unreadCount`. Row urls pass through `inboxHref` before navigation.
- **Queues** (`/claims`, `/oem`) are pure helpers in `src/lib/workspace/queue.ts` over one `warranty.list` subscription. Filters live in the URL.
- **Case page** splits into a tabbed main pane and a chat pane (`?pane=main|split|chat`, `?tab=`). Panels collapse rather than unmount so drafts survive. The split is remembered per browser through `safeStorage`.
- **Pure rules** live in `src/lib/**` with Vitest tests under `tests/src/lib`. Intake limits and claim views are re-exported from `convex/lib/warranty`, so client and server share one source.
- `npm run test:workspace` runs the role flows against a local demo deployment. It never calls a paid provider.

**Stage display.** Stages render as a coloured `StagePill` (`src/components/kit/StagePill.tsx`), not a chip. This is an exception to the "chip is not a pill" rule and applies only to stages.
