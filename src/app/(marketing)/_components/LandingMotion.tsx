"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";
import { reduceMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The landing's root and its scroll motion (landing.md). Motion only adds:
 * the server HTML is the finished page, with bars at length and counters at
 * their values. Nothing runs when motion is reduced (R4). Every tween and
 * ScrollTrigger is made inside useGSAP, so leaving "/" reverts them all.
 * `data-motion` says motion is registered; the e2e reads it.
 */
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      // Off until registered, so the e2e can tell "off" from "not hydrated yet".
      if (el) el.dataset.motion = "off";
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (reduceMotion()) return;
        // Read once: crossing 901px must not replay the animations.
        const wide = window.matchMedia("(min-width: 901px)").matches;
        if (el) el.dataset.motion = "on";

        gsap.to(".nav-prog", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
        });

        // The product tilts flat as it arrives; the hero copy lifts away.
        gsap.fromTo(
          ".shot",
          { rotateX: wide ? 24 : 12, scale: 0.92 },
          {
            rotateX: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero-stage",
              start: "top bottom",
              end: "top 72px",
              scrub: 0.6,
            },
          },
        );
        gsap.to(".hero-copy", {
          y: -90,
          opacity: 0.15,
          ease: "none",
          scrollTrigger: {
            trigger: ".hero",
            start: "top top",
            end: "+=520",
            scrub: true,
          },
        });
        for (const [stair, yPercent] of [
          [".st-1", -60],
          [".st-2", -35],
          [".st-3", -18],
        ] as const)
          gsap.to(stair, {
            yPercent,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero-stage",
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });

        // Manifesto: words light in reading order as it crosses the viewport.
        gsap.fromTo(
          ".mf .w",
          { opacity: 0.16 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.08,
            scrollTrigger: {
              trigger: ".mf",
              start: "top 78%",
              end: "bottom 42%",
              scrub: 0.4,
            },
          },
        );

        ScrollTrigger.batch("[data-rise]", {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.from(batch, {
              y: 48,
              opacity: 0,
              duration: 1,
              ease: "expo.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });
        ScrollTrigger.batch("[data-row]", {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.from(batch, {
              x: -32,
              opacity: 0,
              duration: 0.8,
              ease: "expo.out",
              stagger: 0.07,
            }),
        });

        gsap.to(".how-rail i", {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "#steps",
            start: "top 55%",
            end: "bottom 55%",
            scrub: true,
          },
        });

        // Bento: the two phones and the team crop drift at different speeds.
        for (const [target, cell, from, to] of [
          [".ph-1", ".c-dan", 60, -40],
          [".ph-2", ".c-dan", 140, -80],
          [".par-a", ".c-team", 24, -24],
        ] as const)
          gsap.fromTo(
            target,
            { y: from },
            {
              y: to,
              ease: "none",
              scrollTrigger: {
                trigger: cell,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );

        // Results: counters count up once, bars grow to scale once.
        const counters: [HTMLElement, string][] = [];
        for (const counter of gsap.utils.toArray<HTMLElement>("[data-count]")) {
          const tally = { v: 0 };
          // From 0 when it arrives, not a jump from the final value to 0.
          counter.textContent = "0";
          counters.push([counter, counter.dataset.count ?? ""]);
          gsap.to(tally, {
            v: Number(counter.dataset.count),
            duration: 1.4,
            ease: "power3.out",
            onUpdate: () => {
              counter.textContent = String(Math.round(tally.v));
            },
            scrollTrigger: { trigger: counter, start: "top 85%", once: true },
          });
        }
        for (const bar of gsap.utils.toArray<HTMLElement>(".bar .t i"))
          gsap.fromTo(
            bar,
            { scaleX: 0 },
            {
              scaleX: Number(bar.dataset.v) / 5,
              duration: 1.2,
              ease: "expo.out",
              scrollTrigger: { trigger: bar, start: "top 88%", once: true },
            },
          );

        // Closing band: the stair climbs in.
        gsap.from(".cta-st", {
          yPercent: 100,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: {
            trigger: ".cta",
            start: "top 85%",
            end: "top 25%",
            scrub: 0.6,
          },
        });

        return () => {
          if (el) el.dataset.motion = "off";
          for (const [counter, count] of counters) counter.textContent = count;
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="lp">
      {children}
    </div>
  );
}
