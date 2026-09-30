"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Button, Modal, Select, TextArea } from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import { NOT_READY_REASONS } from "@convex/lib/setupOptions";

const SOMETHING_ELSE = "Something else";

/**
 * A1 "not ready" (Ruling 20). Both buttons record the reason. Keep exploring
 * also clears the commitment and opens the pathway. Back to scheduling
 * closes the dialog. A refusal stays in the dialog, so nothing is lost.
 */
export function NotReadyDialog() {
  const expectOrgId = useExpectOrgId();
  const router = useRouter();
  const notReady = useMutation(api.sprints.notReady);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function record(choice: "keepExploring" | "backToScheduling") {
    setError(null);
    setPending(true);
    try {
      await notReady({
        expectOrgId,
        choice,
        reason: reason || undefined,
        detail:
          reason === SOMETHING_ELSE && detail.trim()
            ? detail.trim()
            : undefined,
      });
      if (choice === "keepExploring") router.push("/manager/learning");
      else setOpen(false);
    } catch (error) {
      setError(userMessage(error, "We couldn't save that. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      trigger={
        <Button kind="ghost" className="h-control-xl self-center md:ml-09">
          I&apos;m not ready to commit
        </Button>
      }
      label="Protected time"
      title="The sprint depends on this hour"
      description="Protected time is the core assumption behind Lead the Way. You can keep exploring, but the team sprint should not launch until learning time is agreed."
      formId="not-ready-form"
      primaryText="Back to scheduling"
      primaryDisabled={pending}
      secondaryText="Keep exploring"
      onSecondary={() => void record("keepExploring")}
    >
      <form
        id="not-ready-form"
        className="flex flex-col gap-06 pt-06"
        onSubmit={(e) => {
          e.preventDefault();
          // The dialog is portalled, but React still bubbles this submit up
          // its own tree, to the setup form around the trigger.
          e.stopPropagation();
          void record("backToScheduling");
        }}
      >
        <Select
          id="not-ready-reason"
          label="What would make this easier? (optional)"
          options={[
            { value: "", label: "Choose a reason" },
            ...NOT_READY_REASONS.map((r) => ({ value: r, label: r })),
          ]}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          className="bg-background"
        />
        {reason === SOMETHING_ELSE && (
          <TextArea
            id="not-ready-detail"
            label="Tell us more"
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(e.currentTarget.value)}
            className="bg-background"
          />
        )}
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
