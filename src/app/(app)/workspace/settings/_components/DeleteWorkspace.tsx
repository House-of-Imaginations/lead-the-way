"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Button, Modal, TextInput } from "@/components/ui";
import { userMessage } from "@/lib/errors";

/**
 * The foot of 18's General, for the owner only and never in the demo (R2).
 * The danger button waits for the workspace name, typed exactly (R3). After
 * the delete, a full load of /home picks the next seat (R7).
 */
export function DeleteWorkspace({ name }: { name: string }) {
  const expectOrgId = useExpectOrgId();
  const remove = useMutation(api.orgs.remove);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const matches = typed.trim() === name;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matches || pending) return;
    setError(null);
    setPending(true);
    try {
      await remove({ expectOrgId, name: typed });
      // Stays pending: the page is leaving. A full load, so /home picks the next seat (R7).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
      window.location.assign("/home");
    } catch (e) {
      setError(userMessage(e, "The workspace wasn't deleted. Try again."));
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="delete-workspace"
      className="flex flex-col items-start gap-05 border-t border-border-subtle pt-07"
    >
      <h2 id="delete-workspace" className="text-heading-04">
        Delete workspace
      </h2>
      <p className="max-w-[65ch] text-body-02 text-text-secondary">
        Deleting removes the team, its sprints, projects and everyone&apos;s
        seat. Shared credential links keep working. This can&apos;t be undone.
      </p>
      <Modal
        open={open}
        onOpenChange={(next) => {
          // Cancel, Escape and the close button all wait for the delete.
          if (pending) return;
          setOpen(next);
          if (!next) {
            setTyped("");
            setError(null);
          }
        }}
        trigger={
          <Button kind="danger" size="md">
            Delete workspace
          </Button>
        }
        label="Workspace settings"
        title={`Delete ${name}?`}
        formId="delete-workspace-form"
        primaryText="Delete workspace"
        primaryKind="danger"
        primaryDisabled={!matches || pending}
        secondaryText="Cancel"
      >
        <form
          id="delete-workspace-form"
          className="flex flex-col gap-06 pt-06"
          onSubmit={(e) => void onSubmit(e)}
        >
          <TextInput
            id="delete-workspace-name"
            label={`Type ${name} to confirm`}
            helper="The name must match exactly."
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            className="bg-background"
          />
          {error && (
            <p role="alert" className="text-label-01 text-support-error">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </section>
  );
}
