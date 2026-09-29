"use client";

import {
  ChevronLeft,
  ChevronSort,
  type CarbonIconType,
} from "@carbon/icons-react";
import clsx from "clsx";
import Link from "next/link";
import {
  Fragment,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { Menu, type MenuItem } from "./Menu";

export type SideNavLink = {
  label: string;
  href: string;
  icon: CarbonIconType;
  current?: boolean;
};
export type SideNavSection = { title: string; links: SideNavLink[] };
export type SideNavProps = {
  homeHref: string;
  org: { initials: string; name: string; team: string };
  orgMenu?: MenuItem[];
  sections: SideNavSection[];
  status?: ReactNode;
  user: { initials: string; name: string; role: string };
  accountMenu: MenuItem[];
  resizable?: boolean;
};

const KEY = "ltw:sidenav";
const RAIL = 48;
const MIN = 200;
const MAX = 400;
const DEFAULT = 256;
const SNAP = 140;
const STEP = 16;
const NARROW = "(max-width: 1055px)";

type NavState = { width: number; collapsed: boolean };

// ponytail: one module-level store, because the app renders one resizable side nav.
// The cache keeps the page working when storage throws (private windows, blocked site data).
let cached: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = null;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  if (cached === null) {
    try {
      cached = localStorage.getItem(KEY) ?? "";
    } catch {
      cached = "";
    }
  }
  // Nothing stored: below 1056px the rail is the default (DESIGN.md, Responsive behaviour).
  // ponytail: read once per render, not on resize; the next stored choice wins anyway.
  if (cached === "" && window.matchMedia(NARROW).matches) return "rail";
  return cached;
}

const getServerSnapshot = () => "";

function save(state: NavState) {
  cached = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, cached);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

const clamp = (width: number) =>
  Math.min(MAX, Math.max(MIN, Math.round(width)));

function parse(raw: string): NavState {
  if (raw === "rail") return { width: DEFAULT, collapsed: true };
  try {
    const v: unknown = JSON.parse(raw);
    if (
      typeof v === "object" &&
      v !== null &&
      "width" in v &&
      "collapsed" in v &&
      typeof v.width === "number" &&
      typeof v.collapsed === "boolean"
    )
      return { width: clamp(v.width), collapsed: v.collapsed };
  } catch {
    // Empty or malformed: fall through to the default.
  }
  return { width: DEFAULT, collapsed: false };
}

export function SideNav({
  homeHref,
  org,
  orgMenu,
  sections,
  status,
  user,
  accountMenu,
  resizable = true,
}: SideNavProps) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stored = resizable ? parse(raw) : { width: DEFAULT, collapsed: false };
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; width: number } | null>(null);

  const collapsed = drag === null ? stored.collapsed : drag < SNAP;
  const width = drag === null ? stored.width : clamp(drag);
  const toggle = () => save({ ...stored, collapsed: !stored.collapsed });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      if (stored.collapsed) {
        if (e.key === "ArrowRight") save({ ...stored, collapsed: false });
        return;
      }
      save({
        width: clamp(stored.width + (e.key === "ArrowRight" ? STEP : -STEP)),
        collapsed: false,
      });
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = {
      x: e.clientX,
      width: stored.collapsed ? RAIL : stored.width,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (start.current)
      setDrag(start.current.width + e.clientX - start.current.x);
  }

  function onPointerUp() {
    // A click without movement (half of a double-click) changes nothing.
    if (drag !== null)
      save(
        drag < SNAP
          ? { width: stored.width, collapsed: true }
          : { width: clamp(drag), collapsed: false },
      );
    start.current = null;
    setDrag(null);
  }

  const orgBlock = (
    <>
      <Avatar initials={org.initials} kind="org" />
      <span className="ltw-sn-who ltw-sn-x">
        <span className="ltw-sn-name">{org.name}</span>
        <span className="ltw-sn-sub">{org.team}</span>
      </span>
      {orgMenu && <ChevronSort className="ltw-i ltw-sn-x" aria-hidden="true" />}
    </>
  );

  return (
    <nav
      aria-label="Main"
      className={clsx("ltw-sn", collapsed && "ltw-sn-col")}
      style={{
        width: !resizable || collapsed ? undefined : width,
        transition: drag === null ? undefined : "none",
      }}
    >
      {resizable && (
        <div
          className="ltw-sn-rs"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          aria-valuemin={RAIL}
          aria-valuemax={MAX}
          aria-valuenow={collapsed ? RAIL : width}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={toggle}
        />
      )}
      <Link className="ltw-sn-brand" href={homeHref} title="Lead the Way">
        <Logo />
        <span className="ltw-sn-t">Lead the Way</span>
      </Link>
      {orgMenu ? (
        <Menu
          items={orgMenu}
          trigger={
            <button type="button" className="ltw-sn-org" title={org.name}>
              {orgBlock}
            </button>
          }
        />
      ) : (
        <div className="ltw-sn-org" title={org.name}>
          {orgBlock}
        </div>
      )}
      {sections.map((section) => (
        <Fragment key={section.title}>
          <div className="ltw-sn-h">
            <span className="ltw-sn-t">{section.title}</span>
          </div>
          {section.links.map(({ label, href, icon: Icon, current }) => (
            <Link
              key={label}
              className="ltw-sn-a"
              href={href}
              title={label}
              aria-current={current ? "page" : undefined}
            >
              <Icon className="ltw-i" aria-hidden="true" />
              <span className="ltw-sn-t">{label}</span>
            </Link>
          ))}
        </Fragment>
      ))}
      {status && <div className="ltw-sn-st ltw-sn-x">{status}</div>}
      {resizable && (
        <button
          type="button"
          className="ltw-sn-tg"
          aria-expanded={!collapsed}
          title={collapsed ? "Expand navigation" : undefined}
          onClick={toggle}
        >
          <ChevronLeft className="ltw-i" aria-hidden="true" />
          <span className="ltw-sn-t">Collapse</span>
        </button>
      )}
      <Menu
        side="top"
        items={accountMenu}
        trigger={
          <button type="button" className="ltw-sn-acct" title={user.name}>
            <Avatar initials={user.initials} />
            <span className="ltw-sn-who ltw-sn-x">
              <span className="ltw-sn-name">{user.name}</span>
              <span className="ltw-sn-sub">{user.role}</span>
            </span>
            <ChevronSort className="ltw-i ltw-sn-x" aria-hidden="true" />
          </button>
        }
      />
      <p className="ltw-sn-cap ltw-sn-x">
        Concept prototype. Not an official IBM product.
      </p>
    </nav>
  );
}
