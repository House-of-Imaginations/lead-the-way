"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { THRESHOLDS } from "@convex/lib/setupOptions";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { NeverSees } from "@/components/settings/NeverSees";
import { SaveBar } from "@/components/settings/SaveBar";
import { Select, useToast } from "@/components/ui";
import { userMessage } from "@/lib/errors";
import type { WorkspaceData } from "./WorkspaceSettings";

const OPTIONS = THRESHOLDS.map((n) => ({
  value: String(n),
  label: `${n} responses`,
}));

/** 18's Data and privacy: the small-group threshold (spec rule 3) and what managers see. */
export function PrivacyTab({ data }: { data: WorkspaceData }) {
  const expectOrgId = useExpectOrgId();
  const setThreshold = useMutation(api.workspace.setThreshold);
  const toast = useToast();
  const [threshold, setValue] = useState(String(data.threshold));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setThreshold({ threshold: Number(threshold), expectOrgId });
      toast({ title: "Changes saved." });
    } catch (e) {
      setError(userMessage(e, "Your changes weren't saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-07" noValidate>
      <div className="flex max-w-[640px] flex-col gap-06">
        <Select
          id="privacy-threshold"
          label="Small-group threshold"
          helper="Team totals stay hidden until this many people respond. It can't go below 5."
          options={OPTIONS}
          value={threshold}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-05 max-[900px]:grid-cols-1">
          <NeverSees
            heading="Managers can see"
            items={[
              "Team totals once enough people respond",
              "How many people joined and finished",
              "Projects people chose to present",
            ]}
          />
          <NeverSees
            heading="Managers never see"
            items={[
              "Anyone's course progress",
              "Time anyone spent learning",
              "Quiz scores",
              "Individual survey answers",
              "Anything people haven't shared",
            ]}
          />
        </div>
      </div>
      <SaveBar saving={saving} error={error} />
    </form>
  );
}
