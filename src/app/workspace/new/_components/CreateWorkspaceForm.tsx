"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { Button, ButtonLink, TextInput } from "@/components/ui";
import { errorCode, userMessage } from "@/lib/errors";

/** The two names, then a full load into 03 in the new workspace (R-e). */
export function CreateWorkspaceForm({ cancelHref }: { cancelHref: string }) {
  const create = useMutation(api.orgs.create);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const noName = !name.trim();
    const noTeam = !teamName.trim();
    setNameError(noName ? "Enter a name for the workspace." : null);
    setTeamError(noTeam ? "Enter a name for your team." : null);
    setError(null);
    if (noName || noTeam) return;
    setPending(true);
    try {
      await create({ name, teamName });
      // A full load: the shell and every cached query follow the new workspace.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
      window.location.assign("/setup/team");
    } catch (e) {
      const message = userMessage(
        e,
        "The workspace wasn't created. Try again.",
      );
      const code = errorCode(e);
      if (code === "ORG_NAME_REQUIRED" || code === "SLUG_TAKEN") {
        setNameError(message);
      } else if (code === "NAME_REQUIRED") setTeamError(message);
      else setError(message);
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-1 flex-col gap-07"
    >
      <div className="mx-auto flex w-full max-w-setup-column flex-col gap-06">
        <div className="flex max-w-auth-form flex-col gap-06">
          <TextInput
            id="new-workspace-name"
            label="Workspace name"
            placeholder="For example, Calder Lane"
            maxLength={60}
            value={name}
            error={nameError ?? undefined}
            onChange={(e) => {
              setName(e.currentTarget.value);
              setNameError(null);
            }}
          />
          <TextInput
            id="new-workspace-team"
            label="Team name"
            placeholder="For example, Client Services team"
            maxLength={60}
            value={teamName}
            error={teamError ?? undefined}
            onChange={(e) => {
              setTeamName(e.currentTarget.value);
              setTeamError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-label-01 text-support-error">
              {error}
            </p>
          )}
        </div>
      </div>
      {/* 03's footer pair: 64px, full width, flush with the bottom. */}
      <div className="-mx-10 mt-auto flex justify-end border-t border-border-subtle max-md:-mx-05">
        <ButtonLink
          kind="secondary"
          size="xl"
          href={cancelHref}
          className="w-60 max-md:w-auto max-md:flex-1"
        >
          Cancel
        </ButtonLink>
        <Button
          type="submit"
          size="xl"
          icon={ArrowRight}
          disabled={pending}
          aria-busy={pending}
          className="w-60 max-md:w-auto max-md:flex-1"
        >
          Create workspace
        </Button>
      </div>
    </form>
  );
}
