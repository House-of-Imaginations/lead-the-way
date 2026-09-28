# Lead the Way: master build prompt (Next.js + Convex)

## Before you paste this (for you, not for Claude)

1. Create an empty repo and copy this pack into it, so it contains `MASTER_PROMPT.md`, `CLAUDE.md` and `docs/design/`.
2. In Claude Code, install the two plugins this prompt relies on:
   ```
   /plugin install superpowers@claude-plugins-official
   /plugin install frontend-design@claude-plugins-official
   ```
   (Superpowers can also come from `/plugin marketplace add obra/superpowers-marketplace` then `/plugin install superpowers@superpowers-marketplace`.)
3. Start Claude Code in the repo and send: **"Read MASTER_PROMPT.md and follow the prompt in it."** You can also paste everything below the line.

---

## Prompt

### 0. Role and outcome

You are a senior product engineer and design engineer. Build **Lead the Way**, a manager-first team AI learning experience designed as a concept for IBM SkillsBuild, as a working web app on **Next.js + Convex**.

The design is finished and approved. Your job is to implement it faithfully and make the journey real: state lives in Convex, the manager and employee views share it, and the privacy promises are enforced on the server. This is a concept prototype for behavioural testing with managers and teams, not a production LMS. It must feel real enough that a manager and an employee can click through the whole story without explanation.

The story it must tell:

> Priya (manager) accepts a partner invitation, protects one paid hour a week, completes a short leadership pathway, builds a Team AI Agreement with her team and launches a four-week sprint. Dan (employee) joins inside that protected hour, learns, applies one idea to a real task, records before, change and after with two safety checks, presents it at the week 4 show and tell, and adds the applied reflection to his SkillsBuild badge. Priya sees team outcomes only, never individuals.

### 1. Read these first, in this order

The pack in `docs/design/` is the source of truth. When sources disagree, the earlier item wins.

1. `docs/design/design-system/README.md`: brand book (voice, colour, type, spacing, shape, motion, layout, privacy patterns, iconography).
2. `docs/design/design-system/tokens.json`, `tokens.css`, `tailwind-theme.css`: the tokens and their Tailwind v4 mapping. `components/*.md` hold guidelines per component. `components/bundle.css` and `bundle.js` are a **reference implementation** of every component (exact paddings, sizes and states), and `index.d.ts` shows their props.
3. `docs/design/wireframes/screens.md`: every screen with route, persona, research note, links and verbatim copy. The matching images are in `wireframes/png/` (read them). The exact CSS values are in `wireframes/source/*.dc.html` (read the `<style>` blocks; ignore the `<x-dc>` canvas markup and `support.js`, they are not React).
4. `docs/design/landing/landing.md` and `landing/index.html`: the approved marketing landing page for `/`, which replaces wireframe `02`.
5. `docs/design/data-model.md`: Convex schema draft, seed data, function map and the privacy rules.
6. `docs/design/product-brief.md`: the original brief (with the stack and auth sections updated). Use it for intent, assumptions A1 to A4, test targets and ethics. Its visual guidance is superseded by the design system.

Read all of 1 to 5 before brainstorming. Look at every PNG in `wireframes/png/` at least once.

### 2. Decided, do not reopen

- The visual system (IBM Plex, Carbon-style tokens, square corners, one blue accent, flat surfaces with hairlines).
- Every screen, its content and its copy. Improve only obvious bugs (such as `2:00-3:00 PM`, which must read `2:00 to 3:00 PM`).
- The app shell: a left side nav with no top header (spec in section 6).
- The landing page, including the glass header that stays visible on scroll, the circular-reveal mobile menu and the light footer.
- Sign up and log in (`02a`, `02b`): the shadcn `login-02` split layout (form left, brand panel right, panel hidden below 1024px), restyled to the design system.
- Aggregate-only manager views and the privacy rules in `data-model.md`.
- The stack in section 3.

### 3. Stack

- **Next.js**, latest stable (16.x at the time of writing), App Router, React Server Components, TypeScript `strict`.
- **Convex** for data, server functions, realtime, scheduling and file storage. Wrap the app in a `"use client"` `ConvexClientProvider` (`ConvexReactClient` with `NEXT_PUBLIC_CONVEX_URL`). Use `useQuery`/`useMutation` in client components. Use `preloadQuery` + `usePreloadedQuery` only where first paint matters (manager overview, this week), and at most once per page, since separate preloads are not guaranteed to be consistent with each other.
- **Tailwind CSS v4** with `docs/design/design-system/tailwind-theme.css` copied to `app/styles/` (utilities like `bg-layer-01`, `text-text-secondary`, `p-05`, `h-control-lg`, `text-heading-01`, `rounded-tag`).
- **Radix UI primitives** (Dialog, Tabs, Switch, Checkbox, DropdownMenu, Tooltip) wrapped in your own components and styled to the tokens. Own the component code (shadcn-style ownership), but never ship shadcn's default look.
- **@carbon/icons-react** for icons (names match `assets/icons/`, for example `Dashboard`, `DocumentTasks`, `Education`, `ChartColumn`, `ViewOff`, `CheckmarkFilled`). 16px in UI, 20px in tiles.
- **next/font/google** for IBM Plex Sans (300, 400, 600) and IBM Plex Mono.
- **GSAP + ScrollTrigger + @gsap/react** only on the landing page.
- **Vitest + convex-test** for Convex functions, **Playwright** for journeys and screenshots, **@axe-core/playwright** for accessibility.
- pnpm, ESLint, Prettier. Deploy target: Vercel + Convex cloud.

Identity: **real sign up and log in** on the custom `/signup` and `/login` screens.

- Recommended: **Convex Auth** (`@convex-dev/auth`) with the Password provider, so accounts, sessions and app data live in one deployment and the screens stay fully custom. Convex Auth is in beta and its Next.js support is still maturing: check its current Next.js guide first, and if it does not support the Next.js version you install, fall back to **Clerk** with custom forms built on its sign-in and sign-up hooks (no hosted Clerk UI). Brainstorming confirms this choice.
- Every function resolves the person only through `convex/lib/viewer.ts#getViewer(ctx)`, which maps the auth user to a `people` row. No feature code reads auth directly.
- "Log in with single sign-on" and "Sign up with single sign-on" are **simulated**: they open a small dialog explaining SSO is not set up for this demo workspace, with a button to continue with email.
- Seed Priya, Dan and the seven teammates as accounts with one shared demo password, shown only on `/guide`. The account menu's "Switch to Dan's view" / "Switch to Priya's view" signs out and back in as that seeded account through a dev-only action, so testers can still change perspective in one click.
- A new manager signing up gets a fresh workspace and team, then lands on `/setup/team`. A person who arrives through `/join/[token]` signs up with the invited email and is linked to their existing `people` row.

### 4. Architecture

```
app/
  (marketing)/page.tsx                 landing, from docs/design/landing
  (auth)/signup, (auth)/login          wireframes 02a, 02b (shared split layout and brand panel)
  guide/page.tsx                       prototype guide and demo controls (wireframe Main)
  demo/partner-email/page.tsx          wireframe 01
  setup/team, setup/protected-hour     wireframes 03, 04 (no side nav, centred 900px column)
  join/[token]/page.tsx                wireframe 09 / M1
  credential/[slug]/page.tsx           public read-only credential page (the "Copy credential link" target)
  (app)/layout.tsx                     side nav shell
  (app)/manager/...                    05 learning, 06 agreement, 07 sprint/launch, 08 overview, 16 outcomes
  (app)/me/...                         10 agreement, 11 this week, 12 project, 13 sprint, 14 show-and-tell, 15 credential, 19 settings
  (app)/settings, (app)/workspace/settings   17, 18
components/ui/                         design-system components (Button, Tag, TextInput, TextArea, Select, Checkbox, Toggle, Tabs, ContentSwitcher, SelectableTile, InlineNotification, Toast, ProgressBar, ProgressSteps, StatTile, Modal, SideNav)
components/app/                        screen-level pieces
convex/                                schema.ts, seed.ts, lib/viewer.ts, lib/privacy.ts, one file per area, *.test.ts
e2e/                                   Playwright journeys and screenshot specs
```

- A dev-only `/dev/components` page shows every UI component in all states, mirroring the design-system previews. Use it to check components before screens.
- Manager-only routes redirect to `/me` for employees and the reverse, with a toast, based on the viewer's role. Signed-out visitors to any `(app)`, `setup` or `guide` route go to `/login?next=...`; signed-in visitors to `/login` or `/signup` go to their home.

### 5. Design system rules (the ones most often broken)

- Square corners everywhere. `rounded-tag` only on tags, `rounded-round` only on status icons and the toggle knob. Never `rounded-md`/`lg`/`xl`.
- One accent. `interactive` blue for primary buttons, the active nav rule, progress fills, the current week and focus. Never as a card fill or large heading colour.
- Surfaces: `background`, `layer-01` tiles, `border-subtle` hairlines. Shadows only on things that float (menus, toasts, modals: `shadow-float`).
- Type: Plex only. Large type is light (300). Body copy 14/20 with 0.16px tracking. Labels 12/16 with 0.32px.
- Buttons: 48px default, label left and icon right; 40px beside inputs; 64px full-width pairs in setup and modal footers (secondary left, primary right, no gap).
- Fields: `layer-01` fill with a `border-strong` bottom rule, label above, helper or error below. Never placeholder-as-label.
- Focus: a 2px `focus` outline inset 2px on every interactive element.
- Motion in the app: productive easing, 70ms hovers, 150ms side nav width, 240ms progress fills. No looping animation. Honour `prefers-reduced-motion`.
- Copy: sentence case, no em or en dashes anywhere, at most one middle dot per line, ranges written with "to", buttons of 1 to 3 words starting with a verb, no emoji. Every surface carries "Concept prototype. Not an official IBM product." somewhere quiet.
- Dark mode: tokens already define it. Follow the OS by default, and add a theme choice in Settings.

### 6. App shell (side nav), exact behaviour

Specified in `components/SideNav.md` and visible on every `(app)` screen PNG.

- Order, top to bottom: brand (24px blue square mark with the white stair path `M5 18h4.5v-4.5H14V9h5`, then "Lead the Way"), organisation block (CL avatar, Calder Lane, Client Services team, sort chevron; opens workspace settings for managers, static for employees), grouped links, a status block (week, next protected hour, "Your learning activity is private" for employees), a Collapse row, the account block (avatar, name, role) that opens a menu upward, and the disclaimer caption.
- Manager links: Team (Overview, Sprint, Team agreement, Outcomes) and You (My learning, Resources). During setup, a Sprint setup checklist (Protected hour, Manager pathway, Team agreement, Invite team) shows progress.
- Employee links: This week, My sprint, Work project, Show and tell, Credential, Team agreement.
- Account menu, manager: Settings, Workspace settings, Help and resources, Switch to Dan's view, Sign out (to `/`). Employee: Settings, Workspace settings (disabled, "Managed by Priya Raman"), Team AI Agreement, Switch to Priya's view, Sign out.
- Width 256px by default. Drag the right edge to resize between 200 and 400px; below 140px it snaps to the 48px rail. Arrow keys on the handle resize by 16px, Enter or Space toggles, double-click toggles. Persist width and collapsed state per browser.
- Collapsed rail: logo, org avatar, icons (with `title`), section headings become 1px dividers, the Collapse chevron rotates 180deg, the account avatar stays. **Every label, caption and status block is hidden.** (An earlier build leaked labels into the rail; test this.)
- The current page gets `layer-selected` and a 3px `interactive` rule on the left.

### 7. Screens

Build every screen in `wireframes/screens.md` at 1440px and make the core employee loop (`/join/[token]`, `/me`, `/me/project`, `/me/credential`) match the 390px mobile PNGs. Tablet reflows cleanly between the two.

Interactions that must be real (Convex-backed):

- Sign up and log in: working password auth, show/hide password toggle, "Create account" disabled until the terms box is ticked, field errors in the design-system pattern (one combined "Check your email and password and try again." on log in), "Forgot your password?" inline confirmation that never reveals whether the account exists, simulated single sign-on dialog, redirect by role and setup progress after log in.
- Setup: team profile, a norms-confidence baseline (1 to 5), recurring protected hour (day selector with dates, start time, fixed 1 hour), a commitment checkbox that gates "Protect this learning hour", and the "I'm not ready to commit" dialog that records an optional reason.
- Pathway modules complete one by one; the "Ready to launch?" state appears when all three are done, plus the after-pathway confidence rating.
- Agreement builder with a live one-page preview: add and remove tools, toggle and add "never goes in" items and checks, escalation text, AI question contact. Save bumps the version and shows "Your team now has a shared AI working agreement."
- Launch: invite list of 8, add by email, a message from the manager, "Send invitations" creates invitation records and shows the toast "Invitations sent to 8 team members." No real email: the invitation opens at `/join/[token]`.
- Employee: accept invitation, read and sign the agreement, continue learning (simulated session progress), work project with before, change, after, result types, headline, two safety checks that gate "Save project", simulated screenshot upload to Convex storage, draft autosave.
- Show and tell shows only projects their owners chose to present. "Add reflection to badge" links the project to the badge. "Share on LinkedIn" and "Copy credential link" confirm with toasts (the copy button really copies a `/credential/[slug]` URL).
- Outcomes: aggregate counts, before and after bars on a 1 to 5 scale with values labelled, "Individual course activity remains private.", "Run another sprint" clones the sprint as a draft.
- Settings: notification toggles, privacy and sharing controls (Dan's opt-out of team totals really changes the counts), workspace members (roles only) and the small-group threshold.

### 8. Privacy (fixed requirements)

Implement every rule in `docs/design/data-model.md`, "Privacy rules", in Convex functions with return validators, and write a test for each **before** the function. Aggregates below the threshold render "Hidden until 5 responses". The manager overview has the "Why can't I see individual progress?" disclosure from the wireframe.

### 9. Guide and evidence for the assumptions

- `/guide` implements wireframe `Main`: HMW, the walkthrough (links into each step with the right persona), the assumptions table A1 to A4, and the test targets. Replace canvas wording ("Press Play", "research notes above each screen") with app wording.
- Add demo controls there: Reset demo data, Jump to week 1, 2, 3 or 4 / sprint complete (moves `workspace.demoNow`), Start as Priya / Start as Dan, and the seeded demo accounts with their shared password. `/guide` requires sign-in like the app, except that it offers the two "Start as" buttons to signed-out visitors.
- Add a discreet "Prototype notes" toggle (off by default, remembered per browser) that shows each screen's research note (WHY, HMW, TESTS, EVIDENCE from `screens.md`) in a side panel. Normal users never see it.
- Log behavioural events for A1 to A4 in the `events` table (commit or not ready with reason, agreement saved, sign, project saved with fields filled, presented, survey answers). The guide shows event counts only, no names.

### 10. How to work (superpowers)

Follow the superpowers workflow in order and do not skip steps:

1. **brainstorming**: the design is done, so keep this short. After reading the pack, ask me only about these open points, one at a time, with your recommendation first:
   1. Auth provider: Convex Auth with Password (recommended, after checking its Next.js support) or Clerk with custom forms.
   2. Dark mode: follow the OS plus a Settings choice (recommended), or light only.
   3. Prototype notes: page plus toggle panel (recommended), or guide page only.
   4. Demo clock: guide controls only (recommended), or also a small floating control.
   Then write the spec to `docs/superpowers/specs/<date>-lead-the-way-design.md`. The spec **references** the files in `docs/design/` instead of copying them, and records the answers above. Wait for my approval of the written spec.
2. **using-git-worktrees**: create an isolated worktree for the build.
3. **writing-plans**: plan in these phases, each ending in something that runs and is reviewable:
   - P0 scaffold: Next.js, Convex dev deployment, Tailwind v4 theme, fonts, lint, Vitest, Playwright, CI script, copy lint (fails on `—`, `–` and title-case buttons in `app/` and `components/`).
   - P1 design-system components plus `/dev/components`, each matched against `bundle.css` and its preview.
   - P2 Convex schema, seed, `getViewer`, `privacy.ts` and the privacy tests.
   - P3 auth and app shell: sign up, log in, route protection, seeded accounts, persona switch; side nav with drag, collapse, keyboard, persistence; account menu.
   - P4 manager setup (01, 03, 04, 05, 06, 07). P5 manager overview (08).
   - P6 employee journey (09 to 15, plus M1 to M4). P7 outcomes and settings (16 to 19).
   - P8 landing page port. P9 guide, demo controls, prototype notes and events.
   - P10 accessibility, responsive and visual QA.
   Each task names exact files, the PNG and `screens.md` section it implements, the tests to write first, and the commands that prove it works.
4. **subagent-driven-development** (preferred) or **executing-plans**. Give every UI subagent the PNG path, the `screens.md` section and the `source/*.dc.html` file for its screen, and tell it to load the **frontend-design** skill and `docs/design/design-system/README.md` before writing markup.
5. **test-driven-development** throughout: Convex functions and privacy rules test-first with convex-test; each screen gets a Playwright journey spec first (copy present, gates work, state persists across the persona switch), then the implementation.
6. **systematic-debugging** when something fails twice.
7. **requesting-code-review** at the end of every phase. Review for fidelity to the PNGs, the design-system rules in section 5, and the privacy rules.
8. **verification-before-completion** before any "done": run typecheck, lint, copy lint, Vitest, Playwright and axe, then capture every route at 1440 and 390, and read your screenshot next to the wireframe PNG. List every visible difference and fix it or justify it.
9. **finishing-a-development-branch** at the end.

### 11. Using frontend-design here

The frontend-design skill normally pushes for a new, distinctive aesthetic. **In this project the aesthetic is already chosen**, so use the skill for craft and not direction: typographic rhythm, spacing discipline, hierarchy, states, empty and loading states, and purposeful motion. Do not change the palette, typeface, corner shape or layout of an approved screen. Where the skill's advice conflicts with the design system (for example choosing new typefaces), the design system wins. Its warnings against templated tells still apply: no gradient text, no emoji, no numbered eyebrows that aren't sequences, no decorative coloured left borders on cards, no hover animation on every card. (The 3px left rule on inline notifications, toasts and the active nav item is a Carbon pattern from the design system: keep it.)

### 12. Quality bar

- Visual: each route matches its PNG at 1440 (and 390 for the mobile set) in layout, spacing, type and copy. After approval, store Playwright `toHaveScreenshot` baselines.
- Accessibility: WCAG 2.2 AA; axe clean; everything reachable by keyboard; visible focus; semantic landmarks and labels; modals trap focus and restore it; `prefers-reduced-motion` respected.
- Privacy: all tests in `data-model.md` pass; manually confirm no manager view can show a name next to a number.
- Performance: landing LCP under 2.5s on a mid laptop, no layout shift from fonts or images.
- Code: strict TypeScript with no `any`, Convex argument and return validators on every public function, no business logic in components.

### 13. Do not

- Do not build real IBM, Credly, LinkedIn, email or calendar integrations. Simulate them and confirm with toasts.
- Do not add screens, features or marketing sections that are not in the pack. If something seems missing, ask.
- Do not show named individual progress, time, scores or rankings anywhere a manager can see.
- Do not use rounded cards, gradients, emoji, Inter/Roboto, or a second accent colour.
- Do not claim a step is done without the verification in section 10.8.

### 14. Definition of done

A reviewer can start at `/`, create an account, go through the whole Priya then Dan then Priya journey without help, log out and back in, reset it from `/guide`, and answer the ten questions in section 34 of the product brief from the interface alone. All tests pass, every route matches its wireframe, and the privacy rules hold under test.
