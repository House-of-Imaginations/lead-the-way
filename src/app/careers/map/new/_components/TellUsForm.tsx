"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useState, useTransition } from "react";
import { Button, Checkbox, ContentSwitcher, Select } from "@/components/ui";
import {
  CURRENT_ROLES,
  TARGETS,
  type Hours,
  type TargetId,
} from "@convex/lib/careers/catalog";
import { saveMap } from "@/lib/careers/actions";
import { HOUR_OPTIONS, hoursLine } from "../../hours";

type CurrentRole = (typeof CURRENT_ROLES)[number];

export function TellUsForm({
  partner,
  draft,
}: {
  partner?: string;
  draft: {
    currentRole: string;
    targetRole: TargetId;
    hoursPerWeek: Hours;
  } | null;
}) {
  const [currentRole, setCurrentRole] = useState<CurrentRole>(
    (draft?.currentRole as CurrentRole | undefined) ?? CURRENT_ROLES[0],
  );
  const [targetRole, setTargetRole] = useState<TargetId>(
    draft?.targetRole ?? TARGETS[0].id,
  );
  const [hours, setHours] = useState<Hours>(draft?.hoursPerWeek ?? 2);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveMap({
            partner,
            currentRole,
            targetRole,
            hoursPerWeek: hours,
            consent,
          });
          // Success redirects to the map; only a refusal comes back.
          if (result?.error) setError(result.error);
        });
      }}
    >
      <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-06 px-05 pt-06 pb-07">
        <div className="flex flex-col gap-03">
          <p className="text-label-01 text-text-secondary">
            Step 1 of 2, about 2 minutes
          </p>
          <h1 className="text-heading-01 text-balance">Where are you now?</h1>
        </div>
        <Select
          id="map-current"
          label="Current role"
          options={CURRENT_ROLES.map((r) => ({ value: r, label: r }))}
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value as CurrentRole)}
        />
        <Select
          id="map-target"
          label="Where do you want to go?"
          options={TARGETS.map((t) => ({ value: t.id, label: t.name }))}
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value as TargetId)}
        />
        <div className="ltw-cs-fill flex flex-col gap-03">
          <p className="text-label-01 text-text-secondary" aria-hidden="true">
            Hours you can give each week
          </p>
          <ContentSwitcher
            label="Hours you can give each week"
            options={HOUR_OPTIONS}
            value={String(hours)}
            onChange={(v) => setHours(Number(v) as Hours)}
          />
          <p className="text-label-01 text-text-helper" aria-live="polite">
            {hoursLine(hours)} You can change this any time.
          </p>
        </div>
        <div className="bg-layer-01 p-05">
          <Checkbox
            label={
              <>
                Use my answers only to suggest pathways.{" "}
                <b className="font-semibold">My employer never sees my plan.</b>
              </>
            }
            helper="You can delete your answers from Settings."
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
          />
        </div>
      </main>
      <div className="ltw-cf">
        <div className="mx-auto flex max-w-[568px] flex-col gap-03">
          <Button
            type="submit"
            icon={ArrowRight}
            className="w-full"
            disabled={!consent || pending}
            aria-describedby={consent ? undefined : "map-why"}
          >
            Build my map
          </Button>
          {!consent && (
            <p
              id="map-why"
              className="text-center text-label-01 text-text-secondary"
            >
              Tick the box above to continue.
            </p>
          )}
          {error && (
            <p role="alert" className="text-label-01 text-support-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
