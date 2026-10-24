---
version: alpha
name: Lead the Way
description: "A calm, Carbon-flavoured work tool for team AI learning. White and Gray 10 surfaces split by hairlines, charcoal type, IBM Plex Sans set light at large sizes, square corners everywhere except tags, and one blue (#0f62fe) reserved for the next action, progress and focus. It should read like a trustworthy enterprise product that respects privacy, never like a campaign."
colors:
  primary: "#0f62fe"
  on-primary: "#ffffff"
  neutral: "#ffffff"
  surface: "#f4f4f4"
  on-surface: "#161616"
  error: "#da1e28"
  background: "#ffffff"
  layer-01: "#f4f4f4"
  layer-hover: "#e8e8e8"
  layer-selected: "#e0e0e0"
  border-subtle: "#e0e0e0"
  border-strong: "#8d8d8d"
  border-inverse: "#161616"
  text-primary: "#161616"
  text-secondary: "#525252"
  text-helper: "#6f6f6f"
  text-on-color: "#ffffff"
  text-inverse: "#f4f4f4"
  layer-inverse: "#393939"
  interactive: "#0f62fe"
  interactive-hover: "#0050e6"
  interactive-active: "#002d9c"
  link: "#0f62fe"
  link-hover: "#0043ce"
  focus: "#0f62fe"
  button-secondary: "#393939"
  button-secondary-hover: "#474747"
  button-disabled: "#c6c6c6"
  text-disabled: "#8d8d8d"
  highlight: "#edf5ff"
  support-info: "#0043ce"
  support-success: "#24a148"
  support-success-inverse: "#42be65"
  support-success-bg: "#defbe6"
  support-error: "#da1e28"
  support-warning: "#f1c21b"
  tag-gray-bg: "#e0e0e0"
  tag-gray-text: "#161616"
  tag-blue-bg: "#d0e2ff"
  tag-blue-text: "#002d9c"
  tag-green-bg: "#a7f0ba"
  tag-green-text: "#0e6027"
  tag-purple-bg: "#e8daff"
  tag-purple-text: "#491d8b"
  avatar-manager: "#a6c8ff"
  avatar-ink: "#001141"
  chart-before: "#a8a8a8"
  chart-after: "#0f62fe"
typography:
  display-01:
    fontFamily: IBM Plex Sans
    fontSize: 76px
    fontWeight: 300
    lineHeight: 88px
    letterSpacing: -0.5px
  display-02:
    fontFamily: IBM Plex Sans
    fontSize: 60px
    fontWeight: 300
    lineHeight: 70px
    letterSpacing: -0.4px
  display-03:
    fontFamily: IBM Plex Sans
    fontSize: 42px
    fontWeight: 300
    lineHeight: 50px
  heading-01:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: 300
    lineHeight: 40px
  heading-02:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: 300
    lineHeight: 36px
  heading-03:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: 400
    lineHeight: 28px
  heading-04:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 22px
  body-01:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0.16px
  body-02:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0.16px
  body-emphasis:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0.16px
  label-01:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0.32px
  button:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0.16px
  code:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
rounded:
  none: 0px
  tag: 24px
  full: 9999px
spacing:
  "01": 2px
  "02": 4px
  "03": 8px
  "04": 12px
  "05": 16px
  "06": 24px
  "07": 32px
  "09": 48px
  "10": 64px
  control-sm: 32px
  control-md: 40px
  control-lg: 48px
  control-xl: 64px
  sidenav: 256px
  sidenav-rail: 48px
  page-padding: 32px
  setup-column: 900px
  auth-form: 360px
  content-max: 1312px
components:
  button-primary:
    backgroundColor: "{colors.interactive}"
    textColor: "{colors.text-on-color}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.interactive-hover}"
  button-primary-active:
    backgroundColor: "{colors.interactive-active}"
  button-secondary:
    backgroundColor: "{colors.button-secondary}"
    textColor: "{colors.text-on-color}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  button-secondary-hover:
    backgroundColor: "{colors.button-secondary-hover}"
  button-tertiary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.link}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  button-tertiary-hover:
    backgroundColor: "{colors.interactive-hover}"
    textColor: "{colors.text-on-color}"
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.link}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  button-ghost-hover:
    backgroundColor: "{colors.layer-hover}"
  button-danger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.support-error}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  button-danger-hover:
    backgroundColor: "{colors.support-error}"
    textColor: "{colors.text-on-color}"
  button-disabled:
    backgroundColor: "{colors.button-disabled}"
    textColor: "{colors.text-disabled}"
  button-footer:
    backgroundColor: "{colors.interactive}"
    textColor: "{colors.text-on-color}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 16px 0"
    height: 64px
  button-sso:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  text-input:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 40px
  text-input-error:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
  field-label:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-01}"
  field-helper:
    textColor: "{colors.text-helper}"
    typography: "{typography.label-01}"
  field-error:
    textColor: "{colors.support-error}"
    typography: "{typography.label-01}"
  tag-gray:
    backgroundColor: "{colors.tag-gray-bg}"
    textColor: "{colors.tag-gray-text}"
    typography: "{typography.label-01}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: 24px
  tag-blue:
    backgroundColor: "{colors.tag-blue-bg}"
    textColor: "{colors.tag-blue-text}"
    typography: "{typography.label-01}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: 24px
  tag-green:
    backgroundColor: "{colors.tag-green-bg}"
    textColor: "{colors.tag-green-text}"
    typography: "{typography.label-01}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: 24px
  tag-purple:
    backgroundColor: "{colors.tag-purple-bg}"
    textColor: "{colors.tag-purple-text}"
    typography: "{typography.label-01}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: 24px
  toggle-off:
    backgroundColor: "{colors.border-strong}"
    rounded: 12px
    width: 48px
    height: 24px
  toggle-on:
    backgroundColor: "{colors.support-success}"
    rounded: 12px
    width: 48px
    height: 24px
  tab:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: 48px
  tab-selected:
    textColor: "{colors.text-primary}"
    typography: "{typography.body-emphasis}"
  content-switcher:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: 40px
  content-switcher-selected:
    backgroundColor: "{colors.layer-inverse}"
    textColor: "{colors.text-inverse}"
  selectable-tile:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: 16px
  selectable-tile-hover:
    backgroundColor: "{colors.layer-hover}"
  notification-info:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
  notification-success:
    backgroundColor: "{colors.support-success-bg}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
  toast:
    backgroundColor: "{colors.layer-inverse}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: "14px 16px"
    width: 320px
  toast-rule:
    backgroundColor: "{colors.support-success-inverse}"
    width: 3px
  progress-bar:
    backgroundColor: "{colors.border-subtle}"
    height: 4px
    rounded: "{rounded.none}"
  progress-bar-fill:
    backgroundColor: "{colors.interactive}"
  stat-tile:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    typography: "{typography.display-03}"
    rounded: "{rounded.none}"
    padding: 16px
  side-nav:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-emphasis}"
    width: 256px
  side-nav-rail:
    width: 48px
  side-nav-item:
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-emphasis}"
    padding: "0 16px"
    height: 32px
  side-nav-item-hover:
    backgroundColor: "{colors.layer-hover}"
    textColor: "{colors.text-primary}"
  side-nav-item-selected:
    backgroundColor: "{colors.layer-selected}"
    textColor: "{colors.text-primary}"
  org-block:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    padding: 8px
  avatar-manager:
    backgroundColor: "{colors.avatar-manager}"
    textColor: "{colors.avatar-ink}"
    typography: "{typography.label-01}"
    rounded: "{rounded.none}"
    size: 32px
  menu:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    width: 260px
  menu-item:
    height: 40px
    padding: "0 16px"
  modal:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    rounded: "{rounded.none}"
    padding: 16px
    width: 560px
  table-header:
    backgroundColor: "{colors.layer-selected}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-emphasis}"
    height: 48px
    padding: "0 16px"
  table-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-02}"
    height: 48px
    padding: "0 16px"
  auth-panel:
    backgroundColor: "{colors.layer-01}"
    textColor: "{colors.text-primary}"
    typography: "{typography.heading-01}"
    padding: 48px
  logo-brackets:
    textColor: "{colors.text-primary}"
    size: 24px
  logo-block:
    backgroundColor: "{colors.interactive}"
    size: 8px
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-02}"
  link:
    textColor: "{colors.link}"
    typography: "{typography.body-02}"
  link-hover:
    textColor: "{colors.link-hover}"
  focus-ring:
    backgroundColor: "{colors.focus}"
    width: 2px
  notification-info-rule:
    backgroundColor: "{colors.support-info}"
    width: 3px
  warning-icon:
    textColor: "{colors.support-warning}"
    size: 16px
  tile-selected-outline:
    backgroundColor: "{colors.border-inverse}"
    width: 1px
  chart-bar-before:
    backgroundColor: "{colors.chart-before}"
    height: 24px
  chart-bar-after:
    backgroundColor: "{colors.chart-after}"
    height: 24px
---

# Lead the Way

Concept prototype. Not an official IBM product. This file is the single design reference for building Lead the Way. The machine-readable tokens are in the front matter above; the detailed sources it was written from live in `docs/design/design-system/` (brand book, `tokens.json`, `tokens.css`, `tailwind-theme.css`, component guidelines and a reference implementation) and the screens in `docs/design/wireframes/`. If this file and those sources ever disagree, `tokens.json` wins for values and the wireframe PNG wins for layout.

## Overview

Lead the Way helps a manager give their team one protected hour a week to learn AI on real work, over a four-week sprint built on IBM SkillsBuild courses. The people using it are busy: a team manager (Priya) setting it up between meetings, and an experienced employee (Dan) fitting learning into a working week. The interface has to feel like a calm, trustworthy work tool that takes privacy seriously.

The look follows IBM's Carbon language without copying IBM's own product UI or logo:

- **Flat and square.** No rounded cards, no gradients, no decorative shadows. Surfaces are told apart by fill (`background` and `layer-01`) and 1px hairlines (`border-subtle`).
- **Typographic.** IBM Plex Sans throughout. Large type is set light (300), which gives the product its quiet, confident voice. Body copy is small (14/20) with Carbon's 0.16px tracking.
- **One blue.** `interactive` (#0f62fe) marks the next action, progress, the current week and focus. Everything else is ink and greys.
- **Privacy visible, not buried.** Aggregate-only language and the privacy promise appear where people share things, in the product's own components.

The emotional target: reassuring, practical, a little understated. Nothing should feel like marketing inside the app.

## Colors

The palette is Carbon's White theme (light, default) and Gray 100 theme (dark). Light is the default; dark follows the OS unless the person picks a theme in Settings. The front matter holds the light values; the table below has both. `tokens.css` implements both themes as CSS variables, and components must use the variables, never raw hex.

- **Interactive blue (#0f62fe):** primary buttons, the 3px active-nav rule, progress fills, the selected week, focus rings, links. Never a card fill, never a large heading colour. It is scarce on purpose.
- **Ink (#161616):** headings and body text, the selected outline on tiles, the content switcher outline, the logo brackets.
- **Greys:** `background` white for pages, `layer-01` (#f4f4f4) for fields, tiles and stat blocks, `layer-hover` and `layer-selected` for interaction, `border-subtle` for hairlines, `border-strong` for the bottom rule of fields.
- **Highlight (#edf5ff):** the present moment and the privacy promise: current week, info notifications, the agreement quote.
- **Status:** green (`support-success`) for done, always with a word or check icon; red (`support-error`) for errors and destructive actions only; yellow (`support-warning`) for warning icons only, never text.
- **Tags:** blue pair for current or active, green pair for finished, grey pair for neutral, purple pair for the Grow in my role track tag only.


| Token                    | Light (White)   | Dark (Gray 100) | Use                                                                                                                                             |
| ------------------------ | --------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `background`             | `#ffffff`       | `#161616`       | Page and main content ground. Everything else layers on it.                                                                                     |
| `layer-01`               | `#f4f4f4`       | `#262626`       | Tiles, stat blocks, input fields, the sidebar organisation block, the agreement preview backdrop.                                               |
| `layer-hover`            | `#e8e8e8`       | `#333333`       | Hover on nav items, list rows, ghost buttons and tiles.                                                                                         |
| `layer-selected`         | `#e0e0e0`       | `#393939`       | Selected nav item and table header row. Pair with the 3px interactive rule on nav.                                                              |
| `border-subtle`          | `#e0e0e0`       | `#393939`       | 1px hairlines between rows, sections and cards. Never a drop shadow instead.                                                                    |
| `border-strong`          | `#8d8d8d`       | `#6f6f6f`       | Bottom rule of inputs, content switcher dividers, toggle off track.                                                                             |
| `border-inverse`         | `#161616`       | `#f4f4f4`       | Content switcher outline, selected tile outline, heading rules above a list.                                                                    |
| `text-primary`           | `#161616`       | `#f4f4f4`       | Headings and body copy on background and layer-01.                                                                                              |
| `text-secondary`         | `#525252`       | `#c6c6c6`       | Supporting copy, labels and captions on background and layer-01 (7.6:1 light, 9.9:1 dark on background).                                        |
| `text-helper`            | `#6f6f6f`       | `#a8a8a8`       | Placeholder and helper text only, on background and layer-01. Never for anything a person must read to finish a task.                           |
| `text-on-color`          | `#ffffff`       | `#ffffff`       | Text and icons on interactive, button-secondary, support-error and support-success fills.                                                       |
| `text-inverse`           | `#f4f4f4`       | `#161616`       | Text on layer-inverse (toasts).                                                                                                                 |
| `layer-inverse`          | `#393939`       | `#f4f4f4`       | Toast notifications. The only high-contrast surface in the product.                                                                             |
| `interactive`            | `#0f62fe`       | `#0f62fe`       | Primary buttons, active nav rule, progress fill, selected week, focus ring in light. The one accent: never a card background or eyebrow colour. |
| `interactive-hover`      | `#0050e6`       | `#0050e6`       | Hover on primary buttons and tertiary buttons.                                                                                                  |
| `interactive-active`     | `#002d9c`       | `#002d9c`       | Pressed primary button.                                                                                                                         |
| `link`                   | `#0f62fe`       | `#78a9ff`       | Text links and ghost button labels on background and layer-01.                                                                                  |
| `link-hover`             | `#0043ce`       | `#a6c8ff`       | Hovered links.                                                                                                                                  |
| `focus`                  | `#0f62fe`       | `#ffffff`       | 2px focus outline, inset by 2px, on every interactive element.                                                                                  |
| `button-secondary`       | `#393939`       | `#6f6f6f`       | Secondary button fill (Back, Cancel, Add). White text on it.                                                                                    |
| `button-secondary-hover` | `#474747`       | `#8d8d8d`       | Hovered secondary button.                                                                                                                       |
| `button-disabled`        | `#c6c6c6`       | `#525252`       | Disabled button fill, e.g. Save project before both safety checks are ticked.                                                                   |
| `text-disabled`          | `#8d8d8d`       | `#8d8d8d`       | Label on button-disabled and disabled fields. Exempt from contrast rules.                                                                       |
| `highlight`              | `#edf5ff`       | `#001d6c`       | Info notifications, the current week, the privacy promise and the team agreement quote.                                                         |
| `support-info`           | `#0043ce`       | `#78a9ff`       | Left rule and icon of info notifications on highlight.                                                                                          |
| `support-success`        | `#24a148`       | `#42be65`       | Completed module icons, toggle on track, success notification rule. Always paired with a word or check icon.                                    |
| `support-success-inverse` | `#42be65`       | `#24a148`       | Toast rule and check icon on `layer-inverse`. 4.8:1 light, 3.0:1 dark.                                                                          |
| `support-success-bg`     | `#defbe6`       | `#044317`       | Success notification ground (Saved, Invitations sent).                                                                                          |
| `support-error`          | `#da1e28`       | `#fa4d56`       | Field errors, the error outline on inputs, destructive actions.                                                                                 |
| `support-warning`        | `#f1c21b`       | `#f1c21b`       | Warning icons only, with dark text beside them. Never text colour.                                                                              |
| `tag-gray-bg`            | `#e0e0e0`       | `#525252`       | Neutral tags: Draft, Not started, member names.                                                                                                 |
| `tag-gray-text`          | `#161616`       | `#f4f4f4`       | Text on tag-gray-bg.                                                                                                                            |
| `tag-blue-bg`            | `#d0e2ff`       | `#002d9c`       | State tags that mean current or active: Active, Now, In progress, Week 4.                                                                       |
| `tag-blue-text`          | `#002d9c`       | `#d0e2ff`       | Text on tag-blue-bg.                                                                                                                            |
| `tag-green-bg`           | `#a7f0ba`       | `#044317`       | State tags that mean finished: Completed, Done, Saved, Output reviewed.                                                                         |
| `tag-green-text`         | `#0e6027`       | `#a7f0ba`       | Text on tag-green-bg.                                                                                                                            |
| `tag-purple-bg`          | `#e8daff`       | `#491d8b`       | The Grow in my role track tag only.                                                                                                              |
| `tag-purple-text`        | `#491d8b`       | `#e8daff`       | Text on tag-purple-bg.                                                                                                                           |
| `avatar-manager`         | `#a6c8ff`       | `#a6c8ff`       | Manager avatar fill. Text on it is avatar-ink.                                                                                                  |
| `avatar-ink`             | `#001141`       | `#001141`       | Initials on avatar-manager (Blue 100 navy from the brand palette).                                                                              |
| `chart-before`           | `#a8a8a8`       | `#6f6f6f`       | The before bar in before and after comparisons. Always labelled with its value.                                                                 |
| `chart-after`            | `{interactive}` | `{interactive}` | The after bar in before and after comparisons.                                                                                                  |


Contrast: every text token meets 4.5:1 on the grounds named in its use note, in both themes. The focus ring is a solid 2px line at 3:1 or more on every surface it lands on.

## Typography

One family, IBM Plex Sans (Google Fonts, weights 300, 400, 600), with IBM Plex Mono only for code-like strings such as links shown as text. Fallback stack: `"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`.

- **Display and page titles** use weight 300. Only one `display-01` per page at most.
- **Section headings** step up in weight as they get smaller: `heading-03` is 400, `heading-04` is 600.
- **Body** is `body-02` (14/20) in the app and `body-01` (16/24) for lead paragraphs and marketing.
- **Labels, helpers, captions and tags** are `label-01` (12/16, 0.32px tracking). Never uppercase with wide tracking.
- Use `font-variant-numeric: tabular-nums` wherever numbers line up (stats, tables, progress counts).
- Keep running text under about 65 characters wide. Give headings `text-wrap: balance`.


| Style           | Size / line | Weight | Tracking | Use                                                                     |
| --------------- | ----------- | ------ | -------- | ----------------------------------------------------------------------- |
| `display-01`    | 76px / 88px | 300    | -0.5px   | One per page at most: the prototype guide hero.                         |
| `display-02`    | 60px / 70px | 300    | -0.4px   | Marketing and invitation heroes; headline numbers such as 40 min saved. |
| `display-03`    | 42px / 50px | 300    | 0        | Setup flow titles, landing section heads, stat numbers.                 |
| `heading-01`    | 32px / 40px | 300    | 0        | Page titles inside the app.                                             |
| `heading-02`    | 28px / 36px | 300    | 0        | Section heroes and case study titles.                                   |
| `heading-03`    | 20px / 28px | 400    | 0        | Section headings and card titles.                                       |
| `heading-04`    | 16px / 22px | 600    | 0        | Form group titles and list headings.                                    |
| `body-01`       | 16px / 24px | 400    | 0.16px   | Lead paragraphs under page titles, marketing body.                      |
| `body-02`       | 14px / 20px | 400    | 0.16px   | The UI default: rows, buttons, form values.                             |
| `body-emphasis` | 14px / 20px | 600    | 0.16px   | Nav items, the lead words of a notification, selected tabs.             |
| `label-01`      | 12px / 16px | 400    | 0.32px   | Field labels, captions, helper and error text, tags.                    |


## Layout

Carbon's 2, 4, 8 spacing scale. Lay out groups with flex or grid and `gap`, not margins.

| Token          | Value | Use                                                                        |
| -------------- | ----- | --------------------------------------------------------------------------- |
| `spacing-01`   | 2px   | Gap between tiles in a tile grid and between tag rows.                      |
| `spacing-02`   | 4px   | Label to helper text; icon nudges.                                          |
| `spacing-03`   | 8px   | Label to field, icon to text, tags in a row.                                |
| `spacing-04`   | 12px  | Icon to text in notifications and nav items.                                |
| `spacing-05`   | 16px  | Tile and notification padding, button horizontal padding, side nav inset.   |
| `spacing-06`   | 24px  | Between form fields in a group; section padding inside tiles.               |
| `spacing-07`   | 32px  | Main content padding and the gap between page sections.                     |
| `spacing-09`   | 48px  | Gap between editor and aside columns; large hero padding.                   |
| `spacing-10`   | 64px  | Setup flow side padding and landing section rhythm.                         |

Fixed sizes:

| Token                  | Value | Use                                                                  |
| ----------------------- | ----- | --------------------------------------------------------------------- |
| `size-control-sm`      | 32px  | Small buttons, nav items, table row actions.                        |
| `size-control-md`      | 40px  | Inputs, selects, medium buttons, content switcher.                  |
| `size-control-lg`      | 48px  | Default buttons, tabs, table rows, mobile touch targets.            |
| `size-control-xl`      | 64px  | Full-width footer buttons in setup flows and modals.                |
| `size-sidenav`         | 256px | Default expanded sidebar width. Drag range 200px to 400px.          |
| `size-sidenav-rail`    | 48px  | Collapsed sidebar rail: icons, logo and avatars only.                |

- **App shell:** a left side nav (256px, drag 200 to 400px, collapses to a 48px rail) and a main column padded `spacing-07` (32px). There is no top header inside the app.
- **Setup flows** (team, protected hour, invite) drop the side nav for a centred 900px column with progress steps at the top and a 64px full-width button pair at the bottom.
- **Sign up and log in** use the shadcn `login-02` split: brand top-left, a 360px form centred in the left half, a `layer-01` brand panel on the right with the stair blocks and the Mon to Fri tile grid (Wednesday in blue). Below 1024px the panel hides.
- **Grids of tiles** use a 2px gap (`spacing-01`) so the tiles read as one object.
- **Marketing pages** use a 1312px content width with 32px gutters (16px on phones).

## Elevation and Depth

Flat. Hierarchy comes from fill and hairlines, not shadow:

- Page on `background`; grouped content on `layer-01`; rows separated by `border-subtle`.
- Selection shows as `layer-selected` plus, in navigation, a 3px `interactive` rule on the left edge.
- `shadow-float` (`0 2px 6px rgba(0, 0, 0, 0.3)`) is used only for things that float above the page: the account menu, toasts and modals. Nothing else casts a shadow.
- Modals sit on a 50% ink scrim.

## Shapes

Square is the brand. Every button, field, tile, card, modal, avatar and menu uses `rounded.none` (0px).

- `rounded.tag` (24px, fully rounded at 24px height) is used only on tags.
- The toggle track radius is 12px. `rounded.full` is used only for status icons, the radio dot and the toggle knob.
- Never round a button or card, even slightly. A 4px radius is already drift.
- The logo is square-cornered and built from whole units on a 24px grid.

## Components

The reference implementation for every component is `docs/design/design-system/components/bundle.css` (exact values) with guidelines in `components/*.md`. Build them as typed React components using Radix primitives for behaviour, styled only with tokens.

- **Buttons.** 48px high by default, label left and icon right, 16px side padding, gap of at least 32px between label and icon. Kinds: primary (one per view, the next step), secondary (the partner in a pair: Back, Cancel), tertiary (a 1px `link` outline beside content), ghost (low emphasis in toolbars), danger (text until hovered). 40px beside fields, 32px in table rows. Footer pairs in setup and modals are 64px, full width, secondary left and primary right with no gap, label at the top-left. Disabled buttons use `button-disabled` with `text-disabled` (disabled controls are exempt from contrast minimums, as in Carbon) and must have the reason visible nearby. The single sign-on button is white with a 1px `border-strong` outline and a Carbon `enterprise` icon; no third-party logos.
- **Fields.** `layer-01` fill, no box, a 1px `border-strong` bottom rule, 40px high, label above in `label-01` `text-secondary`, helper or error below. Error: 2px `support-error` outline and a message that says how to fix it. Placeholders are examples, never labels. Password fields have a 40px show/hide button (`view` / `view--off`, with `aria-pressed`).
- **Checkbox.** 16px square, ink accent, label to the right. Two checkboxes gating one button is the safety-check pattern.
- **Toggle.** 48 by 24, green when on, grey when off; for settings that apply immediately only, never inside a form with Save.
- **Tabs.** 48px line tabs; selected is `text-primary`, weight 600, with a 2px `interactive` underline.
- **Content switcher.** Ink-outlined segmented control, 40px, selected segment filled with `layer-inverse`.
- **Selectable tile.** `layer-01`, 16px padding, selected shows a 1px ink outline and a filled check icon at the right. A single-choice group (one answer, native radios in a fieldset) shows a 16px radio dot on the left instead of the check.
- **Inline notification.** Info on `highlight` with a 3px `support-info` left rule; success on `support-success-bg` with a 3px `support-success` rule. Bold lead words, one sentence. This is where the privacy promise lives.
- **Toast.** 320px on `layer-inverse`, 3px green left rule, top-right, `shadow-float`. Only for confirming an action just taken.
- **Progress bar.** 4px `interactive` fill on a `border-subtle` track, label and count above ("5 of 8 teammates"), never a named person's percentage.
- **Progress steps.** Horizontal, a 2px top rule per step, `interactive` for done and current, check icons for done.
- **Stat tile.** `layer-01`, label on top, one large light number (`display-03`), optional helper. In groups of two to four with 2px gaps.
- **Side nav.** Brand, organisation block, grouped links (32px rows, 600 weight, `text-secondary`), a status block, a Collapse row, the account block that opens a menu upward, and the disclaimer. Collapsed, only the logo, avatars and icons remain and every label hides. Avatar initials use `label-01` at weight 600.
- **Modal.** `layer-01` panel up to 560px, label and title at the top, a 48px close button, body with 48px bottom padding, 64px button pair.
- **Tables.** 48px rows, a `layer-selected` header row in 600 weight, hairlines between rows. The members table shows name, email, role and invitation state only, never participation data.

## Two tracks

One account can hold a team track (Grow in my role, through a workspace seat) and a career track (Change careers, Pivot Crews).

- Track tags are purple (team) and blue (careers). They are only ever tags, never a fill or a heading colour.
- **TrackTile** is the choice on `/start`: icon, track tag, title and one sentence stating that track's privacy rule.
- **TrackSwitcher** sits at the top of the side nav, only when the account has two learner tracks. Its rows are links: switching tracks navigates.
- **WhoSeesWhat** is a plain table that states the strongest true statement about who sees what, per track.
- Career data is never visible to an employer.

## Do's and Don'ts

- Do use `interactive` blue for exactly one primary action per view, plus progress and focus.
- Do keep every corner square except tags and status dots.
- Do separate content with `layer-01` fills and `border-subtle` hairlines.
- Do write in sentence case, name the time and day plainly ("Wednesday 2:00 to 3:00 PM"), and show counts ("5 of 8 teammates").
- Do pair every status colour with a word or an icon.
- Do show "Concept prototype. Not an official IBM product." somewhere quiet on every surface.
- Don't show a named individual's progress, time, score or ranking anywhere a manager can see it.
- Don't use rounded cards, gradients, glows, emoji, or a second accent colour.
- Don't use em or en dashes, title case buttons, or more than one middle dot in a line.
- Don't put drop shadows on cards or tiles; only floating layers get `shadow-float`.
- Don't use IBM's logo, its striped letterforms, or any other company's logo.
- Don't use uppercase, wide-tracked eyebrow labels above headings.

## Logo

The mark is the **held hour**: one `interactive` blue 8 by 8 block held between two square brackets, drawn on a 24px grid (brackets 3 units thick). It reads like a value in code and says what the product does: the week holds one hour for learning.

```svg
<svg width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">
  <path fill="currentColor" d="M1 2h7v3H4v14h4v3H1zM23 2h-7v3h4v14h-4v3h7z"/>
  <rect x="8" y="8" width="8" height="8" fill="var(--interactive)"/>
</svg>

```

- Brackets take `currentColor` (ink on light, white on dark); the block stays `interactive`. On an `interactive` blue ground, brackets are white and the block is ink.
- 24px beside the name "Lead the Way" in Plex Sans 600 (14px in the side nav, 16px in marketing), 10px gap. Minimum 16px. Clear space of 4px.
- Files: `docs/design/design-system/assets/logos/ltw-mark.svg`, `ltw-mark-reverse.svg`, `ltw-mark-mono.svg`. The name is always live type; there is no wordmark file.

## Iconography

Official Carbon icons from `@carbon/icons-react` (32px source grid, `currentColor` fill). 16px in UI, 20px in tiles and the modal close, 24 to 32px only on marketing pages. Always paired with a label except in the collapsed side nav, where the link keeps a `title`. Common mapping: Dashboard `Dashboard`, Team AI Agreement `DocumentTasks`, Sprint `Calendar`, Courses `Education`, Outcomes `ChartColumn`, Credential `Certificate`, Settings `Settings`, privacy notes `ViewOff` or `Locked`, single sign-on `Enterprise`. No emoji, no illustrations.

## Motion

Carbon productive easing, `cubic-bezier(.2, 0, .38, .9)`, inside the app: 70ms for hovers, toggles and button presses, 150ms for the side nav width, 240ms for progress fills. Nothing loops. The marketing landing page may use scroll-linked motion (GSAP ScrollTrigger) with expressive easing `cubic-bezier(.16, 1, .3, 1)`. Everything respects `prefers-reduced-motion`, animates only transform, opacity or clip-path, and is complete and readable with motion off.

## Content and voice

- Plain, specific and warm. Say what happens and when: "One hour of your working week is protected for practical AI learning."
- Sentence case everywhere. The product name "From Zero to Hero" and the terms "Team AI Agreement", "Pivot Map", "Crew Agreement", "Pathway Guide" and "Pivot Crews" are the only title-case terms.
- "You" for the reader; the manager by first name ("Priya sees team totals"); "your team", never "resources" or "users".
- Buttons are 1 to 3 words starting with a verb: Continue, Save agreement, Send invitations, Log in, Create account.
- Privacy wording is exact and repeated: "Aggregate only." "Your answers are private to you." "Priya sees team totals, never your individual answers."
- Errors say how to fix the problem. Log-in errors never reveal which field was wrong or whether an account exists.

## Responsive behaviour

- Desktop 1280 to 1440px is the primary experience. The employee core loop (invitation, this week, work project, credential) is also designed at 390px.
- Below 1056px the side nav becomes the rail by default and marketing navigation moves into the full-screen menu.
- Below 900px multi-column layouts stack to one column; below 672px gutters drop to 16px.
- Touch targets are at least 48px on mobile. Full-width buttons on phones.
- Only tables may scroll sideways, inside their own container.

## Iteration guide

1. Use the tokens by name (`{colors.layer-01}`, `{typography.body-02}`); never hard-code a hex value or font size.
2. Before building a screen, open its PNG in `docs/design/wireframes/png/` and its section in `docs/design/wireframes/screens.md`; match layout and copy.
3. Add new states as new component entries (`button-primary-pressed`, `text-input-focused`) rather than one-off styles.
4. When a new surface is needed, choose between `background` and `layer-01`; a third grey is almost always wrong.
5. After edits to this file, run `npx @google/design.md lint DESIGN.md`.
</content>
