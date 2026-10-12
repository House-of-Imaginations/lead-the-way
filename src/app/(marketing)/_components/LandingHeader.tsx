"use client";

import { ArrowRight } from "@carbon/icons-react";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { PROTOTYPE_HREF } from "../links";

const SECTIONS = [
  { href: "#how", title: "How it works" },
  { href: "#privacy", title: "Privacy" },
  { href: "#results", title: "Results" },
  { href: "#kit", title: "Starter kit" },
];

/**
 * The landing's header. Transparent at the top of the page; once the page
 * moves it settles into a floating glass bar. An observer on a sentinel at
 * the top of the page decides that, never a scroll listener (landing.md).
 */
export function LandingHeader() {
  const [glass, setGlass] = useState(false);
  const sentinel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver((entries) =>
      setGlass(entries[0]?.isIntersecting === false),
    );
    if (sentinel.current) io.observe(sentinel.current);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <span ref={sentinel} className="nav-sentinel" aria-hidden="true" />
      <header className={clsx("nav", glass && "nav-glass")}>
        <div className="nav-bar">
          <span className="nav-sheen" aria-hidden="true">
            <i />
          </span>
          <a className="brand" href="#top">
            <Logo />
            Lead the Way
          </a>
          <nav className="nav-links" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href}>
                {s.title}
              </a>
            ))}
          </nav>
          {/* R9: no prefetch, so "/" never makes the server read Convex. */}
          <div className="nav-end">
            <Link className="nav-login" href="/login" prefetch={false}>
              Log in
            </Link>
            <Link className="btn btn-g" href={PROTOTYPE_HREF} prefetch={false}>
              See the prototype
            </Link>
            <Link className="btn btn-p btn-sm" href="/signup" prefetch={false}>
              Start your sprint
              <ArrowRight className="i" aria-hidden="true" />
            </Link>
          </div>
          <span className="nav-prog" aria-hidden="true" />
        </div>
      </header>
    </>
  );
}
