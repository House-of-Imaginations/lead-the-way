"use client";

import { Locked, TrashCan } from "@carbon/icons-react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Avatar, Button, Modal, Toggle, useToast } from "@/components/ui";
import { initialsOf } from "@convex/lib/initials";
import { userMessage } from "@/lib/errors";

type TeamKey =
  "askBeforeSharing" | "reflectionsOnCredential" | "includeInTeamTotals";
type CareerKey = "showDoneToCrew" | "guideSeesProgress" | "reflectionOnProof";
type Row<K> = { key: K; label: string; description: string };

const whoCanSee = "flex flex-col gap-03 p-05 text-body-02";

/** MS4: one column per track. Toggles save at once and confirm with a toast. */
export function PrivacyByTrack({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.privacy.byTrack>;
}) {
  const { team, career } = usePreloadedQuery(preloaded);
  const expectOrgId = useExpectOrgId();
  const setTeam = useMutation(api.privacy.setTeam);
  const setCareer = useMutation(api.privacy.setCareer);
  const deleteCareer = useMutation(api.careers.tracks.deleteCareer);
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function save(key: string, body: string, write: () => Promise<null>) {
    setBusy(key);
    setError(null);
    try {
      await write();
      toast({ title: "Setting saved.", body });
    } catch (e) {
      setError(userMessage(e, "That setting wasn't saved. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCareer({});
      // Stays pending: the page is leaving. A full load, so the shell drops the switcher.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
      window.location.assign("/home");
    } catch (e) {
      setDeleteError(userMessage(e, "The track wasn't deleted. Try again."));
      setDeleting(false);
    }
  }

  const manager = team?.manager ?? "Your manager";
  const orgName = team?.orgName ?? "Your workspace";
  const teamRows: Row<TeamKey>[] = [
    {
      key: "askBeforeSharing",
      label: "Ask me before anything is shared",
      description: `Nothing reaches your team or ${manager} without your say-so.`,
    },
    {
      key: "reflectionsOnCredential",
      label: "Add applied reflections to my credential",
      description: "Shown only on credential links you share.",
    },
    {
      key: "includeInTeamTotals",
      label: "Include my survey answers in team averages",
      description: `Always anonymous. Hidden when fewer than ${team?.threshold ?? 5} people respond.`,
    },
  ];
  const careerRows: Row<CareerKey>[] = [
    {
      key: "showDoneToCrew",
      label: "Show “done this week” to my crew",
      description: "Never scores or time spent.",
    },
    {
      key: "guideSeesProgress",
      label: "Let my guide see lesson progress",
      description: `${career?.guide ?? "Your guide"} uses it to plan check-ins.`,
    },
    {
      key: "reflectionOnProof",
      label: "Show my reflection on shared proof links",
      description: "Only on links you choose to share.",
    },
  ];

  return (
    <div className="flex flex-col gap-07">
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01">Privacy by track</h1>
        <p className="text-body-01 text-text-secondary">
          Each track keeps its own rules. Nothing moves from one track to the
          other unless you move it.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
      <div className="grid gap-09 min-[900px]:grid-cols-2">
        {team && (
          <section
            aria-labelledby="privacy-team"
            className="flex flex-col gap-05"
          >
            <h2
              id="privacy-team"
              className="flex items-center gap-04 text-heading-04"
            >
              <Avatar initials={initialsOf(orgName)} kind="org" />
              Grow in my role, {orgName}
            </h2>
            <div className={`${whoCanSee} bg-layer-01`}>
              <span className="text-label-01 text-text-secondary">
                Who can see
              </span>
              <p>
                <strong className="font-semibold">
                  {manager} sees team totals only.
                </strong>{" "}
                Totals hide when fewer than {team.threshold} people answer. This
                is set by your workspace and can&apos;t be turned off.
              </p>
            </div>
            <div className="flex flex-col border-t border-border-subtle">
              {teamRows.map((row) => (
                <Toggle
                  key={row.key}
                  id={`privacy-${row.key}`}
                  label={row.label}
                  description={row.description}
                  checked={team.settings[row.key]}
                  pending={busy === row.key}
                  onChange={(on) =>
                    void save(
                      row.key,
                      `${row.label}: ${on ? "on" : "off"}.`,
                      () => setTeam({ key: row.key, on, expectOrgId }),
                    )
                  }
                />
              ))}
            </div>
            <p className="text-label-01 text-text-secondary">
              Your course activity, time spent and scores are never shown to{" "}
              {manager}.
            </p>
          </section>
        )}
        {career && (
          <section
            aria-labelledby="privacy-career"
            className="flex flex-col items-start gap-05"
          >
            <h2
              id="privacy-career"
              className="flex items-center gap-04 text-heading-04"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center border border-border-inverse"
              >
                <Locked />
              </span>
              {career.private ? "Change careers, private" : "Change careers"}
            </h2>
            <div className={`${whoCanSee} w-full border border-border-inverse`}>
              <span className="text-label-01 text-text-secondary">
                Who can see
              </span>
              <p>
                <strong className="font-semibold">
                  No employer sees anything.
                </strong>{" "}
                {orgName} can&apos;t see this track, its email or that it
                exists.
              </p>
            </div>
            <div className="flex w-full flex-col border-t border-border-subtle">
              {careerRows.map((row) => (
                <Toggle
                  key={row.key}
                  id={`privacy-${row.key}`}
                  label={row.label}
                  description={row.description}
                  checked={career.settings[row.key]}
                  pending={busy === row.key}
                  onChange={(on) =>
                    void save(
                      row.key,
                      `${row.label}: ${on ? "on" : "off"}.`,
                      () => setCareer({ key: row.key, on }),
                    )
                  }
                />
              ))}
            </div>
            <Modal
              open={open}
              onOpenChange={(next) => {
                if (deleting) return;
                setOpen(next);
                if (!next) setDeleteError(null);
              }}
              trigger={
                <Button
                  kind="danger"
                  icon={TrashCan}
                  className="border-support-error"
                >
                  Delete this track
                </Button>
              }
              label="Privacy by track"
              title="Delete your Change careers track?"
              description="Your map, crew place, lessons, projects and proof links go. Your badges and endorsements stay. This can't be undone."
              primaryText="Delete track"
              primaryKind="danger"
              primaryDisabled={deleting}
              onPrimary={() => void onDelete()}
              secondaryText="Cancel"
            >
              {deleteError && (
                <p
                  role="alert"
                  className="pt-06 text-label-01 text-support-error"
                >
                  {deleteError}
                </p>
              )}
            </Modal>
          </section>
        )}
      </div>
    </div>
  );
}
