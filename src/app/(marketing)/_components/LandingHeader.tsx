"use client";

import { ArrowRight } from "@carbon/icons-react";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/ui/Logo";
import { PROTOTYPE_HREF } from "../links";

const SECTIONS = [
  { href: "#top", title: "Overview", note: "back to the top" },
  { href: "#how", title: "How it works", note: "five steps, one sprint" },
  {
    href: "#privacy",
    title: "Privacy",
    note: "what managers can and cannot see",
  },
  {
    href: "#results",
    title: "Results",
    note: "an example sprint, start to finish",
  },
  { href: "#kit", title: "Starter kit", note: "nothing to design or buy" },
];

/**
 * The landing's header and, below 1057px, its full-screen menu (R3).
 * The header settles into a glass bar once the page moves; an observer on a
 * sentinel decides that, never a scroll listener (landing.md).
 */
export function LandingHeader() {
  const [glass, setGlass] = useState(false);
  const [open, setOpen] = useState(false);
  const sentinel = useRef<HTMLSpanElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver((entries) =>
      setGlass(entries[0]?.isIntersecting === false),
    );
    if (sentinel.current) io.observe(sentinel.current);
    return () => io.disconnect();
  }, []);

  // While open, the menu owns the page: the rest is inert and doesn't scroll.
  // The cleanup also runs when a menu link leaves "/", so nothing stays locked.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const rest = document.querySelectorAll<HTMLElement>(
      ".lp > main, .lp > footer",
    );
    root.style.overflow = "hidden";
    rest.forEach((el) => {
      el.inert = true;
    });
    const focusFirst = window.setTimeout(
      () =>
        sheet.current
          ?.querySelector<HTMLElement>("a")
          ?.focus({ preventScroll: true }),
      260,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        toggleButton.current?.focus({ preventScroll: true });
        return;
      }
      if (e.key !== "Tab" || !toggleButton.current || !sheet.current) return;
      // The ring: the toggle, then every link in the sheet.
      const ring = [
        toggleButton.current,
        ...sheet.current.querySelectorAll<HTMLElement>("a"),
      ];
      const at = ring.indexOf(document.activeElement as HTMLElement);
      if (at === -1) {
        // Focus is outside the ring: pull it back in.
        e.preventDefault();
        (e.shiftKey ? ring.at(-1) : ring[0])?.focus();
      } else if (e.shiftKey && at === 0) {
        e.preventDefault();
        ring.at(-1)?.focus();
      } else if (!e.shiftKey && at === ring.length - 1) {
        e.preventDefault();
        ring[0]?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 1057px)");
    const onWide = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.clearTimeout(focusFirst);
      root.style.overflow = "";
      rest.forEach((el) => {
        el.inert = false;
      });
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const toggle = () => {
    // The sheet opens as a circle from the toggle and closes back into it.
    // ponytail: measured on toggle only; nothing moves while the page is locked.
    const r = toggleButton.current?.getBoundingClientRect();
    if (r && sheet.current) {
      sheet.current.style.setProperty("--mx", `${r.left + r.width / 2}px`);
      sheet.current.style.setProperty("--my", `${r.top + r.height / 2}px`);
    }
    setOpen((was) => !was);
  };
  // A chosen link closes the menu and does its job; focus goes with it.
  const choose = () => setOpen(false);

  return (
    <>
      <span ref={sentinel} className="nav-sentinel" aria-hidden="true" />
      <header className={clsx("nav", glass && "nav-glass", open && "nav-open")}>
        <div className="nav-bar">
          <span className="nav-sheen" aria-hidden="true">
            <i />
          </span>
          <a className="brand" href="#top">
            <Logo />
            Lead the Way
          </a>
          <nav className="nav-links" aria-label="Sections">
            {SECTIONS.slice(1).map((s) => (
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
            {/* Last in the bar, so Tab from it lands in the sheet. */}
            <button
              ref={toggleButton}
              className="menu-btn"
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mnav"
              onClick={toggle}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
          <span className="nav-prog" aria-hidden="true" />
        </div>
      </header>
      <div
        ref={sheet}
        id="mnav"
        className={clsx("mnav", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <ul className="mnav-list">
          {SECTIONS.map((s, i) => (
            <li key={s.href}>
              <a
                className="mnav-item"
                href={s.href}
                onClick={choose}
                aria-describedby={`mnav-note-${i}`}
                style={{ "--i": i } as CSSProperties}
              >
                <span
                  className="lvl"
                  aria-hidden="true"
                  style={{ "--f": `${(i + 1) * 20}%` } as CSSProperties}
                >
                  <i />
                </span>
                <span className="mnav-txt">
                  <span className="mnav-mask">
                    <span className="mnav-t">{s.title}</span>
                  </span>
                  <span className="mnav-s" id={`mnav-note-${i}`}>
                    {s.note}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mnav-foot">
          <div className="mnav-ctas">
            <Link
              className="btn btn-w"
              href={PROTOTYPE_HREF}
              prefetch={false}
              onClick={choose}
            >
              See the prototype
            </Link>
            <Link
              className="btn btn-p"
              href="/signup"
              prefetch={false}
              onClick={choose}
            >
              Start your sprint
              <ArrowRight className="i" aria-hidden="true" />
            </Link>
          </div>
          <Link
            className="mnav-row"
            href="/login"
            prefetch={false}
            onClick={choose}
          >
            Log in
          </Link>
          <p className="mnav-fine">
            Concept prototype. Not an official IBM product.
          </p>
        </div>
        {[1, 2, 3].map((n, i) => (
          <span
            key={n}
            className={`mnav-st ms-${n}`}
            style={{ "--i": i } as CSSProperties}
            aria-hidden="true"
          />
        ))}
      </div>
    </>
  );
}
