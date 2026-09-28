# Landing page (route `/`)

`index.html` in this folder is the approved landing page. It replaces wireframe `02-Landing`. Open it in a browser (serve the folder so `img/` resolves) and scroll through it at 1440px and 390px before building. Port it to Next.js faithfully: same sections, copy, spacing, motion and behaviour. It is written as a page fragment (no `<html>`/`<body>`), with its own tokens in `:root` that match the design system.

## Sections, in order

1. **Glass header** (fixed). Transparent at the top of the page; once the page scrolls (an IntersectionObserver on a 24px sentinel, not a scroll listener) it settles into a narrower floating frosted-glass bar (`backdrop-filter: blur(20px) saturate(1.7)`, 1px light edge, inset highlight, soft shadow) with a one-time light sheen. It **stays visible while scrolling** (no hide-on-scroll). A 2px blue reading-progress line runs along its bottom edge. Links: How it works, Privacy, Results, Starter kit. Actions: "See the prototype" (ghost) and "Start your sprint" (primary).
2. **Mobile menu** (below 1057px). A three-line button morphs into an X. The menu opens as a circular `clip-path` reveal from the button over a frosted dark sheet (the page stays visible, blurred). Five rows (Overview, How it works, Privacy, Results, Starter kit), each with a large light title, a small blue caption and a square "level" icon that fills 20% more per row. Rows slide up out of a mask with a 70ms stagger, hairlines draw left to right, then the two CTAs and the disclaimer fade up while three blue stair blocks rise at the bottom. Closing reverses into the button. Esc closes, focus is trapped, background is `inert` and scroll-locked, choosing a link closes and navigates.
3. **Hero**: left-aligned headline "Make AI learning part of the working week." (two lines at desktop), 18-word subline, two CTAs. Below, the real manager dashboard screenshot in a hairline frame that starts tilted (`rotateX` about 24deg) and flattens as it scrolls into place, with three stair blocks behind it moving at different parallax speeds. The hero copy fades and lifts as you scroll away.
4. **Facts row**: 4 weeks, 1 hour, 1 real task, Free. Rules above each, staggered rise.
5. **Manifesto**: one large paragraph whose words light from 16% to full opacity in reading order as it crosses the viewport (scrubbed).
6. **How it works**: five steps (Learn to lead it, Agree the rules together, Protect the hour, Learn then apply it that week, Show what changed). Desktop: steps scroll on the left while a sticky frame on the right cross-fades between the matching app screens; a blue rail fills as you pass the steps. Below 900px: the frame is hidden and each step shows its own screenshot inline.
7. **Privacy bento**: "What managers see" (team progress crop and four ticks), "Dan keeps his learning his own." (full blue cell with two phone screenshots drifting at different speeds), "What managers never see" (highlight cell, four `view--off` items).
8. **Results**: 8 / 7 / 6 counters that count up once, before-and-after bars that grow to scale (1 to 5 axis), and Dan's three-line quote. Labelled as an example sprint.
9. **Starter kit**: four editorial rows with a sliding arrow on hover.
10. **Closing CTA band** in `interactive` blue with stair blocks climbing in from the bottom.
11. **Footer** (light, the current one): brand, one-line program description with the disclaimer, three short link columns. The user tried and rejected a dark footer with a giant wordmark; keep this one.

## Porting notes

- Build it as `app/(marketing)/page.tsx` with small server components for static sections and client components only where there is motion or state (`GlassHeader`, `MobileMenu`, `HeroStage`, `Manifesto`, `HowItWorks`, `Outcomes`).
- Use `gsap` + `ScrollTrigger` with `@gsap/react` (`useGSAP`) and `gsap.matchMedia()` exactly as the inline script does: every scroll effect sits inside `(prefers-reduced-motion: no-preference)`, and the page must be complete and readable with reduced motion or with JavaScript off (bars get their final `scaleX` inline).
- Animate only `transform`, `opacity` and `clip-path`. No `window.addEventListener("scroll")`.
- The header and menu work without GSAP (CSS transitions plus IntersectionObserver).
- Replace the screenshot images in `img/` with fresh captures of the built app once the screens exist (`scripts/capture-landing-shots.ts` with Playwright), keeping the same crops and sizes.
- CTAs: "Start your sprint" goes to `/signup`, "See the prototype" goes to `/guide`. Add a quiet "Log in" link in the header for returning users (text link before the two buttons on desktop, a row in the mobile menu footer).
