"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Toggle, useToast } from "@/components/ui";
import { userMessage } from "@/lib/errors";

export type ToggleKey =
  | "weeklyReminder"
  | "showAndTellReminder"
  | "askBeforeSharing"
  | "reflectionsOnCredential"
  | "includeInTeamTotals";
export type ToggleRow = { key: ToggleKey; label: string; description: string };

/** Notifications on 17 and 19: what `reminders.send` reads. */
export const REMINDER_ROWS: ToggleRow[] = [
  {
    key: "weeklyReminder",
    label: "Weekly reminder before the protected hour",
    description: "An email the day before each protected hour.",
  },
  {
    key: "showAndTellReminder",
    label: "Show and tell reminder",
    description: "An email the day before the team show and tell.",
  },
];

/**
 * Settings that apply at once (spec 7.2): each change saves and a toast says
 * so. No Cancel or Save. The switch follows `settings.mine` once the write
 * commits, so it never shows a state that wasn't saved (Ruling 20).
 */
export function ToggleList({
  rows,
  values,
}: {
  rows: ToggleRow[];
  values: Record<ToggleKey, boolean>;
}) {
  const expectOrgId = useExpectOrgId();
  const setToggle = useMutation(api.settings.setToggle);
  const toast = useToast();
  const [busy, setBusy] = useState<ReadonlySet<ToggleKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function change(row: ToggleRow, on: boolean) {
    setBusy((s) => new Set(s).add(row.key));
    setError(null);
    try {
      await setToggle({ key: row.key, on, expectOrgId });
      toast({
        title: "Setting saved.",
        body: `${row.label}: ${on ? "on" : "off"}.`,
      });
    } catch (e) {
      setError(userMessage(e, "That setting wasn't saved. Try again."));
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(row.key);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col border-t border-border-subtle">
      {rows.map((row) => (
        <Toggle
          key={row.key}
          id={`setting-${row.key}`}
          label={row.label}
          description={row.description}
          checked={values[row.key]}
          pending={busy.has(row.key)}
          onChange={(on) => void change(row, on)}
        />
      ))}
      {error ? (
        <p role="alert" className="pt-05 text-label-01 text-support-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
