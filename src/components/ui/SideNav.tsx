"use client";

import {
  CheckmarkOutline,
  ChevronLeft,
  ChevronSort,
  Locked,
  RadioButton,
  RadioButtonChecked,
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
} from "react";
import {
  NAV,
  NAV_COOKIE,
  clampWidth,
  parseNav,
  serializeNav,
  type NavState,
} from "@/lib/navState";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { Menu, type MenuItem } from "./Menu";
import { ProgressBar } from "./ProgressBar";
import { TrackSwitcher, type TrackSwitcherProps } from "./TrackSwitcher";

export type SideNavLink = {
  label: string;
  href: string;
  icon: CarbonIconType;
  current?: boolean;
};
/** A null title is an untitled group (the employee nav on 11). */
export type SideNavSection = { title: string | null; links: SideNavLink[] };
export type SideNavChecklist = {
  title: string;
  items: { label: string; href: string; state: "done" | "current" | "todo" }[];
};
export type SideNavStatus = {
  heading: string | null;
  progress: { value: number; max: number } | null;
  label: string;
  value: string;
  note: string | null;
};
export type SideNavProps = {
  homeHref: string;
  org: { initials: string; name: string; team: string };
  orgMenu?: MenuItem[];
  sections: SideNavSection[];
  checklist?: SideNavChecklist | null;
  status?: SideNavStatus | null;
  /** Signed out (the careers map before sign-up): no account block. */
  user?: { initials: string; name: string; role: string; manager?: boolean };
  accountMenu?: MenuItem[];
  /** The careers nav reads "Pivot Crews" (pack DESIGN.md, Logo). */
  brand?: string;
  /** The careers path block: an icon in place of the org avatar. */
  orgIcon?: CarbonIconType;
  resizable?: boolean;
  /** The saved state as the server read it from the cookie: the first paint matches. */
  initialState?: NavState | null;
  /** Called with a link's href on hover and focus, so the app can warm that page's data. */
  onWarm?: (href: string) => void;
  /** Two learner tracks: the switcher replaces the org block. */
  tracks?: TrackSwitcherProps;
};

const SNAP = 140;
const STEP = 16;
const NARROW = "(max-width: 1055px)"; // below DESIGN.md's 1056px (lg) breakpoint
const STEP_ICONS = {
  done: CheckmarkOutline,
  current: RadioButtonChecked,
  todo: RadioButton,
} as const;

// ponytail: one module-level store, because the app renders one resizable side nav.
// No cross-tab sync: a cookie has no change event (Ruling 10).
let cached: string | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string {
  if (cached === undefined) {
    const raw =
      document.cookie.match(new RegExp(`(?:^|; )${NAV_COOKIE}=([^;]*)`))?.[1] ??
      "";
    cached = parseNav(raw) ? raw : ""; // junk counts as nothing saved
  }
  // Nothing saved: below 1056px the rail is the default (DESIGN.md, Responsive behaviour).
  if (cached === "" && window.matchMedia(NARROW).matches) return "rail";
  return cached;
}

function save(state: NavState) {
  cached = serializeNav(state);
  document.cookie = `${NAV_COOKIE}=${cached}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

const never = () => () => {};

function stateOf(raw: string): NavState {
  if (raw === "rail") return { width: NAV.default, collapsed: true };
  return parseNav(raw) ?? { width: NAV.default, collapsed: false };
}

export function SideNav({
  homeHref,
  org,
  orgMenu,
  sections,
  checklist,
  status,
  user,
  accountMenu = [],
  brand = "From Zero to Hero",
  orgIcon: OrgIcon,
  resizable = true,
  initialState = null,
  onWarm,
  tracks,
}: SideNavProps) {
  const serverRaw = initialState ? serializeNav(initialState) : "";
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => serverRaw);
  const mounted = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  const stored = resizable
    ? stateOf(raw)
    : { width: NAV.default, collapsed: false };
  // Nothing saved and not yet mounted: CSS picks expanded or rail by width.
  const auto = resizable && !mounted && raw === "";
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; width: number } | null>(null);

  const collapsed = drag === null ? stored.collapsed : drag < SNAP;
  const width = drag === null ? stored.width : clampWidth(drag);
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
        width: clampWidth(
          stored.width + (e.key === "ArrowRight" ? STEP : -STEP),
        ),
        collapsed: false,
      });
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return; // primary button only
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = {
      x: e.clientX,
      width: stored.collapsed ? NAV.rail : stored.width,
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
          : { width: clampWidth(drag), collapsed: false },
      );
    start.current = null;
    setDrag(null);
  }

  const orgBlock = (
    <>
      {OrgIcon ? (
        <OrgIcon className="ltw-i text-interactive" aria-hidden="true" />
      ) : (
        <Avatar initials={org.initials} kind="org" />
      )}
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
      className={clsx(
        "ltw-sn",
        collapsed && "ltw-sn-col",
        auto && "ltw-sn-auto",
      )}
      style={{
        width: !resizable || collapsed || auto ? undefined : width,
        // No animation on the first paint or while dragging.
        transition: mounted && drag === null ? undefined : "none",
      }}
    >
      <div className="ltw-sn-in">
        {/* Titles are the rail's tooltips; expanded, the labels show. */}
        <Link
          className="ltw-sn-brand"
          href={homeHref}
          title={collapsed ? brand : undefined}
        >
          <Logo />
          <span className="ltw-sn-t">{brand}</span>
        </Link>
        {tracks ? (
          <TrackSwitcher {...tracks} />
        ) : orgMenu ? (
          <Menu
            items={orgMenu}
            trigger={
              <button
                type="button"
                className="ltw-sn-org"
                title={collapsed ? org.name : undefined}
                aria-label={org.name}
              >
                {orgBlock}
              </button>
            }
          />
        ) : (
          <div className="ltw-sn-org" title={collapsed ? org.name : undefined}>
            {orgBlock}
          </div>
        )}
        {sections.map((section, i) => (
          <Fragment key={section.title ?? i}>
            {section.title && (
              <div className="ltw-sn-h">
                <span className="ltw-sn-t">{section.title}</span>
              </div>
            )}
            {section.links.map(({ label, href, icon: Icon, current }) => (
              <Link
                key={label}
                className="ltw-sn-a"
                href={href}
                prefetch
                onPointerEnter={() => onWarm?.(href)}
                onFocus={() => onWarm?.(href)}
                title={collapsed ? label : undefined}
                aria-current={current ? "page" : undefined}
              >
                <Icon className="ltw-i" aria-hidden="true" />
                <span className="ltw-sn-t">{label}</span>
              </Link>
            ))}
          </Fragment>
        ))}
        {status && (
          <div className="ltw-sn-st ltw-sn-x">
            {status.heading && (
              <span className="ltw-sn-sh">
                {status.heading}
                <span className="ltw-sn-shc">Sprint</span>
              </span>
            )}
            {status.progress && (
              <ProgressBar
                label="Sprint progress"
                hideLabel
                valueText={status.heading ?? undefined}
                value={status.progress.value}
                max={status.progress.max}
              />
            )}
            <span>{status.label}</span>
            <span className="ltw-sn-v">{status.value}</span>
            {status.note && (
              <span className="ltw-sn-note">
                <Locked className="ltw-i" aria-hidden="true" />
                {status.note}
              </span>
            )}
          </div>
        )}
        {/* 05: the setup checklist takes the bottom slot, directly above Collapse. */}
        {checklist && (
          <div className="ltw-sn-ck">
            <span className="ltw-sn-ckh ltw-sn-x">{checklist.title}</span>
            <ol>
              {checklist.items.map(({ label, href, state }) => {
                const Icon = STEP_ICONS[state];
                return (
                  <li key={label}>
                    <Link
                      className="ltw-sn-a"
                      href={href}
                      prefetch
                      onPointerEnter={() => onWarm?.(href)}
                      onFocus={() => onWarm?.(href)}
                      title={collapsed ? label : undefined}
                      data-state={state}
                      aria-current={state === "current" ? "step" : undefined}
                    >
                      <Icon className="ltw-i" aria-hidden="true" />
                      <span className="ltw-sn-t">
                        {state === "done" && (
                          <span className="sr-only">Done: </span>
                        )}
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {resizable && (
          <button
            type="button"
            className="ltw-sn-tg"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : undefined}
            onClick={toggle}
          >
            <ChevronLeft className="ltw-i" aria-hidden="true" />
            <span className="ltw-sn-t">Collapse</span>
          </button>
        )}
        {user && (
          <Menu
            side="top"
            items={accountMenu}
            trigger={
              <button
                type="button"
                className="ltw-sn-acct"
                title={collapsed ? user.name : undefined}
                aria-label={user.name}
              >
                <Avatar initials={user.initials} manager={user.manager} />
                <span className="ltw-sn-who ltw-sn-x">
                  <span className="ltw-sn-name">{user.name}</span>
                  <span className="ltw-sn-sub">{user.role}</span>
                </span>
                <ChevronSort className="ltw-i ltw-sn-x" aria-hidden="true" />
              </button>
            }
          />
        )}
        <p className="ltw-sn-cap ltw-sn-x">
          Concept prototype. Not an official IBM product.
        </p>
      </div>
      {/* Last in the DOM so it is the last Tab stop; it is absolutely positioned, so nothing moves. */}
      {resizable && (
        <div
          className="ltw-sn-rs"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          aria-valuemin={NAV.rail}
          aria-valuemax={NAV.max}
          aria-valuenow={collapsed ? NAV.rail : width}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={toggle}
        />
      )}
    </nav>
  );
}
