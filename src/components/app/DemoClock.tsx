"use client";

import { Time } from "@carbon/icons-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { DEMO_TIME_ZONE } from "@convex/lib/demo/schedule";
import { hourLabel } from "@convex/lib/sprintTime";
import { Menu, buttonClass } from "@/components/ui";
import { forwardTargets } from "@/lib/demo/targets";

/**
 * The floating demo clock (spec 3.2): bottom left of the main column, sticky
 * in its scroll (R11), for anyone seated in the demo while DEMO_MODE is on.
 * The caller renders it only when `shell.isDemo`. A move echoes the live
 * `demo.orgId` and reloads the page in full: the server layouts read the
 * clock, and a page left stale by a reset elsewhere recovers.
 */
export function DemoClock({
  inline = false,
}: {
  /** Setup only: a plain block at the top. Floating, it covered the in-flow footer buttons on short pages. */
  inline?: boolean;
}) {
  const status = useQuery(api.demo.status, {});
  const setClock = useMutation(api.demo.setClock);
  const [failed, setFailed] = useState(false);
  const demo = status?.demo;
  if (!demo) return null;

  const items = [
    ...forwardTargets(demo.demoNow).map(({ target, label }) => ({
      label,
      onSelect: () =>
        void setClock({ target, expectOrgId: demo.orgId }).then(
          () => window.location.reload(),
          () => setFailed(true),
        ),
    })),
    { label: "Open guide", href: "/guide" },
  ];

  return (
    <section
      aria-label="Demo clock"
      className={`${inline ? "" : "sticky bottom-05 z-30 shadow-float "}flex w-fit items-center gap-04 self-start bg-layer-01 py-03 pr-03 pl-05`}
    >
      <Time size={16} aria-hidden="true" />
      <span className="flex flex-col">
        <span className="text-label-01 text-text-secondary">Demo clock</span>
        <span className="text-body-02 font-semibold tabular-nums">
          {hourLabel(demo.demoNow, DEMO_TIME_ZONE)}
        </span>
        {failed && (
          <span role="alert" className="text-label-01 text-support-error">
            Couldn&apos;t move the clock. Reload and try again.
          </span>
        )}
      </span>
      <Menu
        side="top"
        align="start"
        items={items}
        trigger={
          <button type="button" className={buttonClass("ghost", "sm")}>
            Move clock
          </button>
        }
      />
    </section>
  );
}
