"use client";

import { useState } from "react";
import { Button, Modal, TextInput, useToast } from "@/components/ui";

/**
 * Ruling 13: share Lead the Way with another manager. `link` is the path
 * Convex made ("/signup?ref=calder-lane"); the origin is the browser's.
 */
export function InviteTeamModal({ link }: { link: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      setOpen(false);
      toast({ title: "Link copied." });
    } catch {
      setError("Couldn't copy. Select the link and copy it.");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
      }}
      trigger={
        <Button kind="tertiary" className="max-[672px]:w-full">
          Invite another team
        </Button>
      }
      label="Share"
      title="Invite another team"
      description="Know another manager? Share Lead the Way."
      primaryText="Copy link"
      onPrimary={copy}
      secondaryText="Close"
    >
      <ShareLink link={link} error={error} />
    </Modal>
  );
}

/** Rendered only while the dialog is open, so `window` is always there. */
function ShareLink({ link, error }: { link: string; error?: string }) {
  return (
    <TextInput
      id="invite-team-link"
      label="Sign-up link"
      value={`${window.location.origin}${link}`}
      readOnly
      error={error}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
