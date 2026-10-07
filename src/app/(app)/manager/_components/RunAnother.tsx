"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Button } from "@/components/ui";
import { userMessage } from "@/lib/errors";

const FAILED = "We couldn't start another sprint. Try again.";

/** 16's and 08's primary action (P7a Ruling 14, R-d): a draft copy of this sprint, then setup at 04. */
export function RunAnother({ size = "md" }: { size?: "md" | "lg" }) {
  const router = useRouter();
  const expectOrgId = useExpectOrgId();
  const runAnother = useMutation(api.sprints.runAnother);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const { href } = await runAnother({ expectOrgId });
      // The draft now exists, so `canRunAnother` turns false and this button
      // unmounts; `router.push` then lands on setup.
      router.push(href);
    } catch (e) {
      setError(userMessage(e, FAILED));
      setPending(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        className="max-[672px]:w-full"
        icon={ArrowRight}
        onClick={run}
        disabled={pending}
        aria-busy={pending}
      >
        Run another sprint
      </Button>
      {error ? (
        <p role="alert" className="basis-full text-label-01 text-support-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
