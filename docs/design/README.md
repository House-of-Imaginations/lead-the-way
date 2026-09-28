# Design pack: what is here

| Path | What | Use it for |
|---|---|---|
| `product-brief.md` | The original product brief, with the stack and auth sections updated for Next.js + Convex | Intent, personas, assumptions A1 to A4, test targets, ethics |
| `design-system/README.md` | Brand book | Voice, colour, type, spacing, shape, motion, layout, privacy patterns |
| `design-system/tokens.json` | Tokens (light "White" and dark "Gray 100") | Source of truth for values |
| `design-system/tokens.css` | Tokens as CSS variables plus type classes | Import once in the app |
| `design-system/tailwind-theme.css` | Tailwind v4 `@theme` mapping | Utilities such as `bg-layer-01`, `p-05`, `h-control-lg`, `text-heading-01` |
| `design-system/components/*.md` | One guideline file per component | Props, when to use, do and don't |
| `design-system/components/bundle.css`, `bundle.js`, `index.d.ts` | Reference implementation of every component (plain React, no JSX) | Exact paddings, sizes, states. Rebuild as typed components, don't import it |
| `design-system/assets/icons/*.svg`, `assets/logos/*.svg` | Carbon icons used and the Lead the Way mark | Icon names map to `@carbon/icons-react`. The mark is the held hour: a blue block between two square brackets (see `design-system/assets/logos/README.md`). |
| `wireframes/screens.md` | Every screen: route, persona, research note, links, verbatim copy | The build checklist |
| `wireframes/png/` | Rendered screens (1440 desktop, 390 mobile) | Visual target |
| `wireframes/source/*.dc.html` | Prototype HTML for each screen | Exact CSS values and states (ignore the canvas runtime markup) |
| `landing/index.html`, `landing/img/`, `landing/landing.md` | The approved marketing landing page and how to port it | Route `/` |
| `data-model.md` | Convex schema draft, seed data, function map, privacy rules | Backend and tests |

The live versions of these live in three Claude artifacts (the clickable canvas, the design system and the landing page). This folder is a snapshot of them.
