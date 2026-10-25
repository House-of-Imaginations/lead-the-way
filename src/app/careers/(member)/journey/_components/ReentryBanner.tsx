"use client";

import { Close, Renew } from "@carbon/icons-react";
import { useState, type ReactNode } from "react";

/** Screen 7's banner after a missed week. Dismissing it stores nothing (P6). */
export function ReentryBanner({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;
  return (
    <div className="ltw-ntf">
      <Renew className="ltw-i" aria-hidden="true" />
      <div className="flex-1">
        <b>Missed last week? No problem.</b> {children}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="-my-03 -mr-03 flex size-control-sm shrink-0 items-center justify-center text-text-primary hover:bg-layer-hover"
        onClick={() => setShown(false)}
      >
        <Close size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
