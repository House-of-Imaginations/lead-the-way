"use client";

import { TrashCan, ViewOff } from "@carbon/icons-react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import type { api } from "@convex/_generated/api";
import {
  Button,
  InlineNotification,
  Modal,
  Tabs,
  TextInput,
  Toggle,
  useToast,
} from "@/components/ui";
import {
  deleteCareerTrack,
  deleteMapAnswers,
  saveContactEmail,
  setCareerSetting,
} from "@/lib/careers/actions";

type Settings = FunctionReturnType<
  typeof api.careers.careerSettings.mine
>["settings"];
type Key = keyof Settings;
type Row = { key: Key; label: string; description: string };

const REMINDERS: Row[] = [
  {
    key: "learningHour",
    label: "Remind me when my learning hours start",
    description: "At the start of the hours you protected.",
  },
  {
    key: "crewCheckIn",
    label: "Remind me before crew check-ins",
    description: "The day before each weekly check-in.",
  },
  {
    key: "missedWeekNudge",
    label: "Nudge me after a missed week",
    description: "One kind message with where to pick up. Never a streak.",
  },
  {
    key: "sundaySummary",
    label: "Send a Sunday summary",
    description: "What is coming up in the week ahead.",
  },
  {
    key: "listenInstead",
    label: "Offer to listen instead",
    description: "Audio versions of lessons for low energy days.",
  },
];

const NEVER_SEES = [
  "That you have an account",
  "Your Pivot Map or target career",
  "Lessons, time spent or scores",
  "Your project, unless you share the link",
];

/** D8's three tabs. Switches save at once; the contact email saves with its button. */
export function CareerSettings({
  settings,
  contactEmail,
  hasAnswers,
  guide,
}: {
  settings: Settings;
  /** A private track's contact address; null for a partner track. */
  contactEmail: string | null;
  hasAnswers: boolean;
  guide: string | null;
}) {
  const toast = useToast();
  const [values, setValues] = useState(settings);
  const [busy, setBusy] = useState<Key | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flip(row: Row, on: boolean) {
    setValues((v) => ({ ...v, [row.key]: on }));
    setBusy(row.key);
    setError(null);
    const result = await setCareerSetting(row.key, on);
    if (result) {
      setValues((v) => ({ ...v, [row.key]: !on }));
      setError(result.error);
    } else {
      toast({
        title: "Setting saved.",
        body: `${row.label}: ${on ? "on" : "off"}.`,
      });
    }
    setBusy(null);
  }

  const toggles = (rows: Row[]) => (
    <div className="flex flex-col border-t border-border-subtle">
      {rows.map((row) => (
        <Toggle
          key={row.key}
          id={`career-${row.key}`}
          label={row.label}
          description={row.description}
          checked={values[row.key]}
          pending={busy === row.key}
          onChange={(on) => void flip(row, on)}
        />
      ))}
    </div>
  );

  const privacy: Row[] = [
    {
      key: "showDoneToCrew",
      label: "Show “done this week” to my crew",
      description: "Never scores or time spent.",
    },
    {
      key: "guideSeesProgress",
      label: "Let my guide see lesson progress",
      description: `${guide ?? "Your guide"} uses it to plan check-ins.`,
    },
    {
      key: "reflectionOnProof",
      label: "Show my reflection on shared proof links",
      description: "Only on links you choose to share.",
    },
    {
      key: "researchOptIn",
      label: "Include my answers in anonymous research",
      description: "Grouped, and hidden when fewer than 5 people answer.",
    },
  ];

  return (
    <div className="flex flex-col gap-05">
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
      <Tabs
        label="Settings"
        defaultValue="privacy"
        items={[
          {
            value: "profile",
            label: "Profile",
            content: <Profile contactEmail={contactEmail} />,
          },
          {
            value: "reminders",
            label: "Reminders",
            content: (
              <div className="max-w-[744px] pt-06">{toggles(REMINDERS)}</div>
            ),
          },
          {
            value: "privacy",
            label: "Privacy",
            content: (
              <div className="grid gap-07 pt-06 lg:grid-cols-[minmax(0,744px)_320px] lg:justify-between lg:gap-09">
                <div className="flex flex-col gap-06">
                  {toggles(privacy)}
                  <DeleteAnswers hasAnswers={hasAnswers} />
                  <DeleteTrack />
                </div>
                <aside
                  aria-labelledby="never-sees"
                  className="flex flex-col gap-04 self-start bg-layer-01 p-05"
                >
                  <h2
                    id="never-sees"
                    className="flex items-center gap-03 text-body-emphasis"
                  >
                    <ViewOff className="ltw-i" aria-hidden="true" />
                    No employer ever sees
                  </h2>
                  <ul className="flex list-[square] flex-col gap-02 pl-05 text-body-02">
                    {NEVER_SEES.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-label-01 text-text-secondary">
                    There is no employer view in From Zero to Hero. Partners
                    only see anonymous totals of 5 people or more.
                  </p>
                </aside>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function Profile({ contactEmail }: { contactEmail: string | null }) {
  const toast = useToast();
  const [email, setEmail] = useState(contactEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (contactEmail === null) {
    return (
      <p className="max-w-[65ch] pt-06 text-body-02 text-text-secondary">
        We contact you at the address you log in with. Your crew sees only your
        first name.
      </p>
    );
  }
  return (
    <form
      className="flex max-w-[480px] flex-col gap-06 pt-06"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const result = await saveContactEmail(email);
        if (result) setError(result.error);
        else toast({ title: "Changes saved." });
        setSaving(false);
      }}
    >
      <TextInput
        id="career-contact-email"
        label="Contact email"
        type="email"
        autoComplete="email"
        helper="A personal address. Never your work email, and never shared with an employer."
        error={error ?? undefined}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" className="self-start" disabled={saving}>
        Save changes
      </Button>
    </form>
  );
}

/** P8: an in-page confirmation, no dialog. Badges stay. */
function DeleteAnswers({ hasAnswers }: { hasAnswers: boolean }) {
  const [state, setState] = useState<
    "none" | "idle" | "confirm" | "deleting" | "done"
  >(hasAnswers ? "idle" : "none");
  const [error, setError] = useState<string | null>(null);
  return (
    <section
      aria-labelledby="delete-answers"
      className="flex flex-col items-start gap-04 border border-border-subtle p-05"
    >
      <h2 id="delete-answers" className="text-heading-04">
        Delete my Pivot Map answers
      </h2>
      <p className="text-body-02">
        Removes your current role, target career and hours. Badges you earned
        stay yours.
      </p>
      {state === "none" ? (
        <p className="text-body-02 text-text-secondary">
          You have no answers saved.
        </p>
      ) : state === "done" ? (
        <InlineNotification kind="success" title="Answers deleted.">
          Your badges, projects and endorsements stay.
        </InlineNotification>
      ) : state === "idle" ? (
        <Button
          kind="danger"
          icon={TrashCan}
          className="border-support-error"
          onClick={() => setState("confirm")}
        >
          Delete my answers
        </Button>
      ) : (
        <div className="flex flex-col gap-04">
          <p className="text-body-emphasis">
            Delete your answers? This can&apos;t be undone.
          </p>
          <div className="flex">
            <Button
              kind="secondary"
              disabled={state === "deleting"}
              onClick={() => setState("idle")}
            >
              Cancel
            </Button>
            <Button
              kind="danger"
              disabled={state === "deleting"}
              onClick={async () => {
                setState("deleting");
                setError(null);
                const result = await deleteMapAnswers();
                if (result) {
                  setError(result.error);
                  setState("confirm");
                } else setState("done");
              }}
            >
              Delete answers
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </section>
  );
}

/** MS4's delete modal (`PrivacyByTrack`), for the whole career track. */
function DeleteTrack() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteCareerTrack();
    if (result) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    // Stays pending: the page is leaving. A full load, so the shell drops the track.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
    window.location.assign("/home");
  }

  return (
    <section
      aria-labelledby="delete-track"
      className="flex flex-col items-start gap-04 border border-border-subtle p-05"
    >
      <h2 id="delete-track" className="text-heading-04">
        Delete my Change careers track
      </h2>
      <p className="text-body-02">
        Removes your map, crew place, lessons, projects and proof links. Badges
        and endorsements stay yours.
      </p>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (deleting) return;
          setOpen(next);
          if (!next) setError(null);
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
        label="Privacy and settings"
        title="Delete your Change careers track?"
        description="Your map, crew place, lessons, projects and proof links go. Your badges and endorsements stay. This can't be undone."
        primaryText="Delete track"
        primaryKind="danger"
        primaryDisabled={deleting}
        onPrimary={() => void onDelete()}
        secondaryText="Cancel"
      >
        {error && (
          <p role="alert" className="pt-06 text-label-01 text-support-error">
            {error}
          </p>
        )}
      </Modal>
    </section>
  );
}
