"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import {
  TIME_ZONES,
  TIME_ZONE_LABELS,
  type TimeZone,
} from "@convex/lib/profileFields";
import { HOUR_STARTS } from "@convex/lib/setupOptions";
import { clockLabel } from "@convex/lib/sprintTime";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { SaveBar } from "@/components/settings/SaveBar";
import { ContentSwitcher, Select, TextInput, useToast } from "@/components/ui";
import { userMessage } from "@/lib/errors";
import type { WorkspaceData } from "./WorkspaceSettings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((label, i) => ({
  value: String(i + 1),
  label,
}));
const STARTS = HOUR_STARTS.map((s) => ({ value: s, label: clockLabel(s) }));
const ZONES = TIME_ZONES.map((zone) => ({
  value: zone,
  label: TIME_ZONE_LABELS[zone],
}));

/**
 * 18's Sprint defaults: the day, start and zone a new sprint starts from. A
 * sprint in setup takes them too; a launched one never does (decision 5).
 */
export function SprintDefaultsTab({ data }: { data: WorkspaceData }) {
  const expectOrgId = useExpectOrgId();
  const save = useMutation(api.workspace.saveSprintDefaults);
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    ...data.sprintDefaults,
    // ponytail: zones are kept on-list by signup and saveProfile, so the cast holds.
    timeZone: data.sprintDefaults.timeZone as TimeZone,
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await save({ ...form, expectOrgId });
      toast({ title: "Changes saved." });
    } catch (e) {
      setError(userMessage(e, "Your changes weren't saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Saving also rewrites a draft sprint, so it needs sprint:manage too. A
          disabled fieldset disables every field and Save in one place. */}
      <fieldset
        disabled={!data.canSetDefaults}
        className="m-0 flex min-w-0 flex-col gap-07 border-0 p-0"
      >
        <div className="flex max-w-[640px] flex-col gap-06">
          <div className="flex flex-col gap-03">
            {/* The switcher names its group; this is the same words, for the eye. */}
            <span
              aria-hidden="true"
              className="text-label-01 text-text-secondary"
            >
              Default learning day
            </span>
            <ContentSwitcher
              label="Default learning day"
              options={DAYS}
              value={String(form.weekday)}
              onChange={(v) => setForm({ ...form, weekday: Number(v) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-06 max-[900px]:grid-cols-1">
            <Select
              id="defaults-start"
              label="Default start time"
              options={STARTS}
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
            <Select
              id="defaults-zone"
              label="Time zone"
              helper="Each sprint runs in this zone."
              options={ZONES}
              value={form.timeZone}
              onChange={(e) =>
                setForm({ ...form, timeZone: e.target.value as TimeZone })
              }
            />
            <TextInput
              id="defaults-length"
              label="Sprint length"
              value="4 weeks"
              disabled
              helper="Fixed at four weeks in this prototype"
            />
            <TextInput
              id="defaults-course"
              label="Course"
              value={data.course}
              disabled
            />
          </div>
        </div>
        {data.canSetDefaults ? null : (
          <p className="text-label-01 text-text-secondary">
            Only people who manage sprints can change sprint defaults.
          </p>
        )}
        <SaveBar saving={saving} error={error} />
      </fieldset>
    </form>
  );
}
