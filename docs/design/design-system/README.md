Lead the Way helps a manager give their team one protected hour a week to learn AI on real work, over a four-week sprint built on IBM SkillsBuild courses. The system follows IBM's Carbon language: flat, square, typographic, one blue accent. It should feel like a calm work tool, never like a campaign.

Every surface carries the line "Concept prototype. Not an official IBM product." somewhere quiet (the side nav footer, the page footer).

## Content fundamentals

- **Voice:** plain, specific, warm without being chatty. Say what happens and when: "One hour of your working week is protected for practical AI learning." Not "Unlock your team's AI potential."
- **Sentence case everywhere**: titles, buttons, tabs, nav, tags. "Team AI Agreement" is the one product term in title case.
- **Person:** "you" for the reader, the manager's first name for the manager ("Priya sees team totals"), "your team" not "resources" or "users".
- **Numbers and time:** "Wednesday 2:00 to 3:00 PM", "9 to 30 Sep 2026", "5 of 8 teammates", "40 min". Write ranges with "to", never a dash.
- **Punctuation:** no em or en dashes anywhere. At most one middle dot per line. No exclamation marks outside a completed badge.
- **Buttons** are 1 to 3 words starting with a verb: Continue, Save agreement, Send invitations, Start the lesson. One label per intent across a flow.
- **Privacy language** is exact and repeated where it matters: "Aggregate only." "Your answers are private to you." "Priya sees team totals, never your individual answers." Never soften it to "mostly private".
- **Names:** mock data uses Calder Lane (Client Services team), Priya Raman (manager), Dan Okafor (Senior Account Executive) and teammates Sarah Whitlock, Mei Tanaka, Tomás Reyes, Aisha Karimi, Luca Bianchi, Grace Oyelaran, Omar Haddad. No emoji.

## Visual foundations

**Colour.** `background` white with `layer-01` for tiles, fields and blocks; `border-subtle` hairlines separate everything else. `interactive` is the only accent: primary buttons, the active nav rule, progress fills, the current week, focus. Never use it as a card fill or for large headings. `highlight` marks the present (this week, the privacy promise). State colours always come with a word or icon: `support-success` for done, `support-info` for notes, `support-error` for errors only, `support-warning` for warning icons only. Tags use their paired tokens (`tag-blue-bg` with `tag-blue-text`, and so on). `layer-inverse` is reserved for toasts. Charts compare `chart-before` against `chart-after`, always with value labels.

**Type.** IBM Plex Sans only (Google Fonts, weights 300, 400, 600). Large type is light: `display-01` to `display-03` and `heading-01`, `heading-02` are weight 300; `heading-03` 400; `heading-04` 600. UI copy is `body-02` with 0.16px tracking; `label-01` for labels, captions and helper text. Keep running text under 65 characters. Use tabular numbers in tables and stats.

**Spacing.** Carbon's 2/4/8 scale: `spacing-01` between tiles in a grid, `spacing-03` label to field, `spacing-05` inside tiles, `spacing-06` between fields, `spacing-07` page padding and section gaps, `spacing-09` between editor and aside, `spacing-10` in setup flows.

**Shape.** `radius-none` on everything: buttons, fields, tiles, modals, avatars. `radius-tag` only on tags, `radius-round` only on status icons and the toggle knob. Mixing rounded buttons into this system breaks it.

**Depth.** Flat. Group with fills and hairlines, not shadows. `shadow-float` only on things that float: the account menu, toasts, modals.

**Controls.** Buttons are `size-control-lg` (48px) by default with the label left and icon right; `size-control-md` beside fields; `size-control-xl` for full-width footer pairs in setup flows and modals. Fields are `layer-01` with a `border-strong` bottom rule and no box. Focus is a 2px `focus` outline inset by 2px on every interactive element, solid, at least 3:1 on every surface.

**Motion.** Carbon productive easing, cubic-bezier(.2, 0, .38, .9): 70ms for hovers and toggles, 150ms for the side nav width, 240ms for progress fills. Nothing loops. Honour reduced motion.

## Layout

- The app is a left `SideNav` (`size-sidenav`, 256px; drag 200 to 400px; collapses to the 48px `size-sidenav-rail`) plus a main column padded `spacing-07`. There is no top header in the app.
- Nav order, top to bottom: brand (mark and name), organisation block, grouped links, Collapse, account block with its menu, disclaimer.
- Setup flows (onboarding, protected hour, invite) drop the nav for a centred 900px column with `ProgressSteps` on top and an `xl` button pair at the bottom.
- Settings pages use `Tabs` under the page title with rows separated by `border-subtle`.
- Mobile keeps the same tokens with 16px gutters and 48px touch targets.

## Privacy patterns

- Managers only ever see counts and totals: "5 of 8 teammates", never a named person's progress, answers or time.
- Put the privacy promise in an info `InlineNotification` with the `view--off` icon at the moment someone shares something.
- Workspace settings can hide totals below 5 responses; default it on.
- Members tables show name, role and invitation state only.

## Iconography

Carbon icons from the official `@carbon/icons` package, 32px viewBox, filled with `currentColor` when inlined (see the Icons group; `LeadTheWay.Icon` inlines them). 16px in UI, 20px in tiles, paired with a label. No emoji, no illustrations, no hand-drawn icons. The Lead the Way mark is in the Logos group; there is no wordmark file.
