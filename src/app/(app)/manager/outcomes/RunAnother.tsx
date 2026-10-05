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

/** 16's primary action (P7a Ruling 14): a draft copy of this sprint, then setup at 04. */
export function RunAnother() {
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
      // Stays busy until setup replaces this page.
      router.push(href);
    } catch (e) {
      setError(userMessage(e, FAILED));
      setPending(false);
    }
  }

  return (
    <>
      <Button
        size="md"
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
