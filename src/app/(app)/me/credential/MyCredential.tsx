"use client";

import { Link as LinkIcon, Locked, LogoLinkedin } from "@carbon/icons-react";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Credential } from "@/components/app/Credential";
import {
  Button,
  ButtonLink,
  InlineNotification,
  useToast,
} from "@/components/ui";

export function MyCredential({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.badges.mine>;
}) {
  const credential = usePreloadedQuery(preloaded);
  const toast = useToast();
  const [copyError, setCopyError] = useState<string | null>(null);

  async function copy(slug: string) {
    const url = `${window.location.origin}/credential/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      toast({ title: "Credential link copied." });
    } catch {
      setCopyError(`Couldn't copy. Select the link and copy it: ${url}`);
    }
  }

  return (
    <div className="grid max-w-content-max grid-cols-[minmax(0,1fr)_auto] items-start gap-07 max-[900px]:grid-cols-1">
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01">Your credential</h1>
        <p className="text-body-01 text-text-secondary">
          Your existing SkillsBuild badge, with evidence of how you used it at
          work.
        </p>
      </header>
      {credential === null ? (
        <div className="col-span-full">
          <InlineNotification>
            Your badge appears here when you finish AI Productivity
            Fundamentals.
          </InlineNotification>
        </div>
      ) : (
        <>
          {/* Beside the title on desktop; under the cards below 900px, LinkedIn first (M4). */}
          <div className="flex max-[900px]:order-2 max-[900px]:flex-col-reverse max-[900px]:gap-03">
            <Button
              kind="tertiary"
              icon={LinkIcon}
              onClick={() => copy(credential.slug)}
            >
              Copy credential link
            </Button>
            <Button
              icon={LogoLinkedin}
              onClick={() => toast({ title: "Simulated in this prototype." })}
            >
              Share on LinkedIn
            </Button>
          </div>
          <div className="col-span-full max-[900px]:order-1">
            <Credential
              credential={credential}
              empty={
                <div className="flex flex-col items-start gap-04">
                  <p className="text-body-02 text-text-secondary">
                    Add the reflection from your show and tell project to show
                    how you used it.
                  </p>
                  <ButtonLink href="/me/show-and-tell" kind="ghost">
                    Open show and tell
                  </ButtonLink>
                </div>
              }
            />
          </div>
          {copyError ? (
            <p
              role="alert"
              className="col-span-full text-label-01 text-support-error max-[900px]:order-3"
            >
              {copyError}
            </p>
          ) : null}
          <p className="col-span-full flex items-center gap-03 text-body-02 text-text-secondary max-[900px]:order-4">
            <Locked size={16} aria-hidden="true" className="shrink-0" />
            You choose what goes on your credential. Your course activity and
            time spent are never shown.
          </p>
        </>
      )}
    </div>
  );
}
