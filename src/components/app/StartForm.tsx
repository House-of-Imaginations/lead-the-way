"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useState, useTransition } from "react";
import { Button, Checkbox } from "@/components/ui";
import { startAccount } from "@/lib/account/start";

/** R8: the terms show once. Accepted already: just Continue. */
export function StartForm({ needsTerms }: { needsTerms: boolean }) {
  const [agreed, setAgreed] = useState(!needsTerms);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex max-w-auth-form flex-col gap-05"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const started = await startAccount(needsTerms);
          if ("error" in started) setError(started.error);
          else window.location.assign(started.next);
        });
      }}
    >
      {needsTerms && (
        <Checkbox
          label="I agree to the terms of use and privacy notice."
          checked={agreed}
          onChange={(e) => setAgreed(e.currentTarget.checked)}
        />
      )}
      <Button type="submit" icon={ArrowRight} disabled={!agreed || pending}>
        Continue
      </Button>
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </form>
  );
}
