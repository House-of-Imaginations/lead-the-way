"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Button, Modal } from "@/components/ui";
import { userMessage } from "@/lib/errors";

/**
 * The foot of Profile on 17 and 19 (R4). Hidden for a demo persona (R6),
 * disabled with its reason for the only owner (R5). After leaving, a full
 * load of /home picks the next seat, or /start (R7).
 */
export function LeaveWorkspace({
  leave,
  orgName,
}: {
  leave: "allowed" | "lastOwner" | "demo";
  orgName: string;
}) {
  const expectOrgId = useExpectOrgId();
  const leaveWorkspace = useMutation(api.members.leave);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (leave === "demo") return null;
  const lastOwner = leave === "lastOwner";

  async function onLeave() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await leaveWorkspace({ expectOrgId });
      // Stays pending: the page is leaving. A full load, so /home picks the next seat (R7).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
      window.location.assign("/home");
    } catch (e) {
      setError(userMessage(e, "You're still in this workspace. Try again."));
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="leave-workspace"
      className="flex flex-col items-start gap-05 border-t border-border-subtle pt-07"
    >
      <h2 id="leave-workspace" className="text-heading-04">
        Leave workspace
      </h2>
      <p className="max-w-[65ch] text-body-02 text-text-secondary">
        You lose your seat and settings here. A credential link you shared keeps
        working. Leaving during a sprint hides the rest of its team totals.
      </p>
      <Button
        kind="danger"
        size="md"
        disabled={lastOwner}
        aria-describedby={lastOwner ? "leave-workspace-reason" : undefined}
        onClick={() => setOpen(true)}
      >
        Leave workspace
      </Button>
      {lastOwner ? (
        <p
          id="leave-workspace-reason"
          className="max-w-[65ch] text-label-01 text-text-secondary"
        >
          You&apos;re the only owner. Make somebody else an owner in Workspace
          settings, or delete the workspace.
        </p>
      ) : null}
      <Modal
        open={open}
        onOpenChange={(next) => {
          // Cancel, Escape and the close button all wait for the leave.
          if (pending) return;
          setOpen(next);
          if (!next) setError(null);
        }}
        title={`Leave ${orgName}?`}
        primaryText="Leave workspace"
        primaryKind="danger"
        onPrimary={() => void onLeave()}
        primaryDisabled={pending}
        secondaryText="Cancel"
      >
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </Modal>
    </section>
  );
}
