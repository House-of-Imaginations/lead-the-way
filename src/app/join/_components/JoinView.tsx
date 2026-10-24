"use client";

import { ArrowRight, Calendar, Locked } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { JoinFacts } from "@convex/invites";
import { CheckIn } from "@/components/app/CheckIn";
import {
  Avatar,
  Button,
  ButtonLink,
  InlineNotification,
  Logo,
  Tag,
} from "@/components/ui";
import { authClient } from "@/lib/account/auth-client";
import { userMessage } from "@/lib/errors";
import { landingAfterJoin } from "./landing";

export type JoinState =
  | "SIGNED_OUT"
  | "READY"
  | "WRONG_ACCOUNT"
  | "ALREADY_MEMBER"
  | "REVOKED"
  | "DECLINED"
  | "USED"
  | "DEMO_ACCOUNT"
  | "PREVIEW";

type You = { name: string; initials: string } | null;

// "Team AI Agreement" is the one title-case term (spec 3.2).
const VIEW_AGREEMENT = "View Team AI Agreement";
// Phones: full width, 48px high (the default size).
const WIDE = "max-[900px]:w-full";

/** 09's top bar: brand, workspace, disclaimer, and who is signed in. */
export function JoinBar({
  orgName,
  you,
  preview = false,
}: {
  orgName: string | null;
  you: You;
  preview?: boolean;
}) {
  return (
    <header className="flex min-h-control-lg flex-wrap items-center gap-x-05 gap-y-02 border-b border-border-subtle px-05 py-03">
      <Link
        href="/"
        className="flex items-center gap-[10px] text-body-emphasis"
      >
        <Logo />
        From Zero to Hero
      </Link>
      {orgName && (
        <span className="text-body-02 text-text-secondary">{orgName}</span>
      )}
      {preview && <Tag>Preview</Tag>}
      <p className="ml-auto text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
      {you && (
        <span className="flex items-center gap-03 text-body-02">
          <Avatar initials={you.initials} manager={false} />
          <span className="max-[672px]:sr-only">{you.name}</span>
        </span>
      )}
    </header>
  );
}

/** A token that names no live invitation (Ruling 18). */
export function JoinInvalid({ you }: { you: You }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <JoinBar orgName={null} you={you} />
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-04 px-05 py-09">
        <h1 className="text-heading-01">
          This invitation link isn&apos;t valid.
        </h1>
        <p className="text-body-01 text-text-secondary">
          Ask your manager for a new one.
        </p>
      </main>
    </div>
  );
}

function Actions({
  token,
  state,
  orgName,
  invitedBy,
  onJoined,
}: {
  token: string;
  state: JoinState;
  orgName: string;
  invitedBy: string;
  onJoined: (orgId: Id<"orgs">) => void;
}) {
  const accept = useMutation(api.invites.accept);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const say = (text: string) => <p className="w-full text-body-01">{text}</p>;
  const logOut = (
    <Button
      kind="secondary"
      className={WIDE}
      onClick={() =>
        void authClient
          .signOut()
          .catch(() => null)
          .then(() => location.reload())
      }
    >
      Log out
    </Button>
  );

  switch (state) {
    case "SIGNED_OUT":
      return (
        <>
          <ButtonLink
            href={`/signup?invite=${encodeURIComponent(token)}`}
            icon={ArrowRight}
            className={WIDE}
          >
            Join team sprint
          </ButtonLink>
          <ButtonLink
            kind="tertiary"
            href={`/login?next=/join/${encodeURIComponent(token)}`}
            className={WIDE}
          >
            Log in
          </ButtonLink>
        </>
      );
    case "READY":
      return (
        <>
          <Button
            icon={ArrowRight}
            className={WIDE}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                onJoined((await accept({ token })).orgId);
              } catch (e) {
                setError(
                  userMessage(
                    e,
                    "We couldn't add you to the sprint. Try again.",
                  ),
                );
                setPending(false);
              }
            }}
          >
            Join team sprint
          </Button>
          {error && (
            <p role="alert" className="w-full text-label-01 text-support-error">
              {error}
            </p>
          )}
        </>
      );
    case "ALREADY_MEMBER":
      return (
        <>
          {say(`You're already in ${orgName}.`)}
          <ButtonLink href="/home" icon={ArrowRight} className={WIDE}>
            Go to your home
          </ButtonLink>
          <ButtonLink kind="tertiary" href="/me/agreement" className={WIDE}>
            {VIEW_AGREEMENT}
          </ButtonLink>
        </>
      );
    case "WRONG_ACCOUNT":
      return (
        <>
          {say(
            "This invitation is for a different email address. Log out, then open the link again.",
          )}
          {logOut}
        </>
      );
    case "DEMO_ACCOUNT":
      return (
        <>
          {say(
            "Demo accounts can only join the demo workspace. Log in with your own account to accept this invitation.",
          )}
          {logOut}
        </>
      );
    case "PREVIEW":
      return (
        <>
          <Button icon={ArrowRight} className={WIDE} disabled>
            Join team sprint
          </Button>
          <Button kind="tertiary" className={WIDE} disabled>
            {VIEW_AGREEMENT}
          </Button>
          <p className="w-full text-label-01 text-text-secondary">
            This is how your team sees the invitation.
          </p>
        </>
      );
    default:
      // REVOKED, DECLINED and USED read the same (Ruling 18).
      return say(
        `This invitation is no longer active. Ask ${invitedBy} for a new one.`,
      );
  }
}

/** 09 and M1. Every fact comes from Convex as a label; the before check-in follows a join. */
export function JoinView({
  token,
  orgName,
  invitedBy,
  join,
  state,
  you,
}: {
  token: string;
  orgName: string;
  invitedBy: string;
  join: JoinFacts | null;
  state: JoinState;
  you: You;
}) {
  const [joined, setJoined] = useState<Id<"orgs"> | null>(null);
  const first = join?.managerFirstName ?? invitedBy;

  return (
    <div className="flex min-h-dvh flex-col">
      <JoinBar orgName={orgName} you={you} preview={state === "PREVIEW"} />
      {joined ? (
        <main className="mx-auto w-full max-w-[640px] px-05 py-09">
          <CheckIn
            phase="before"
            headingLevel={1}
            autoFocus
            expectOrgId={joined}
            onDone={() => {
              // A full load to the person's own home: the app layout reads the new seat and workspace.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
              window.location.assign("/home");
            }}
          />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 content-start [grid-template-areas:'intro'_'aside'_'actions'] min-[900px]:grid-cols-2 min-[900px]:grid-rows-[auto_1fr] min-[900px]:content-stretch min-[900px]:[grid-template-areas:'intro_aside'_'actions_aside']">
          <section className="flex flex-col gap-06 px-05 pt-07 [grid-area:intro] min-[900px]:px-10 min-[900px]:pt-[80px]">
            {join && (
              <p className="flex items-center gap-03 text-body-02 text-text-secondary">
                <Avatar initials={join.managerInitials} />
                {`${join.managerName}, ${join.managerRole}`}
              </p>
            )}
            <h1 className="text-heading-01 [text-wrap:balance] min-[900px]:text-display-02">
              {`${first} invited you to From Zero to Hero`}
            </h1>
            <p className="max-w-[44ch] text-body-01 text-text-secondary min-[900px]:max-w-[34ch] min-[900px]:text-heading-03">
              For the next four weeks, one hour of your working week is
              protected for practical AI learning.
            </p>
            {join?.quote && (
              <figure className="flex max-w-[56ch] flex-col gap-03 border-t border-border-subtle pt-06 max-[900px]:hidden">
                <blockquote className="text-body-01">{`“${join.quote}”`}</blockquote>
                <figcaption className="text-label-01 text-text-secondary">
                  {join.managerName}
                </figcaption>
              </figure>
            )}
          </section>

          {join && (
            <div className="flex flex-col gap-06 px-05 py-06 [grid-area:aside] min-[900px]:bg-layer-01 min-[900px]:px-10 min-[900px]:py-[80px]">
              <section
                aria-labelledby="join-hour"
                className="flex gap-05 bg-layer-01 p-05 min-[900px]:bg-background min-[900px]:p-06"
              >
                <Calendar
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-interactive max-[900px]:hidden"
                />
                <div className="flex flex-col gap-02">
                  <h2
                    id="join-hour"
                    className="text-label-01 text-text-secondary"
                  >
                    Your protected hour
                  </h2>
                  <p className="text-heading-03 font-light min-[900px]:text-heading-02">
                    {join.hour}
                  </p>
                  <p className="text-body-02 text-text-secondary">
                    {`${join.span}. Paid work time, already in your calendar.`}
                  </p>
                </div>
              </section>

              <section
                aria-labelledby="join-goal"
                className="flex flex-col gap-05"
              >
                <h2
                  id="join-goal"
                  className="text-heading-04 min-[900px]:text-heading-03"
                >
                  Your four-week goal
                </h2>
                <ol className="grid min-[900px]:grid-cols-3 min-[900px]:gap-01">
                  {[
                    {
                      title: "Learn one thing",
                      body: `15-minute sessions of ${join.course}`,
                    },
                    {
                      title: "Apply it to real work",
                      body: "Use it on one task you already do each week",
                    },
                    {
                      title: "Show what changed",
                      body: `Share it at the team show and tell on ${join.showAndTell}`,
                    },
                  ].map((goal) => (
                    <li
                      key={goal.title}
                      className="flex flex-col gap-02 border-b border-border-subtle py-04 min-[900px]:border-b-0 min-[900px]:border-t-[3px] min-[900px]:border-interactive min-[900px]:bg-background min-[900px]:p-05"
                    >
                      <h3 className="text-body-02 min-[900px]:text-body-emphasis">
                        {goal.title}
                      </h3>
                      <p className="text-body-02 text-text-secondary max-[900px]:hidden">
                        {goal.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="max-[900px]:hidden">
                <InlineNotification
                  icon={Locked}
                  title="Your learning stays private."
                >
                  Your individual SkillsBuild activity is private. Your manager
                  sees only aggregate team participation and the work you choose
                  to share at the final show and tell. Participation is for
                  development and is not used as a performance score.
                </InlineNotification>
              </div>
              <div className="min-[900px]:hidden">
                <InlineNotification icon={Locked}>
                  {`Your SkillsBuild activity is private. ${first} sees only team totals and what you choose to share.`}
                </InlineNotification>
              </div>
            </div>
          )}

          <section
            aria-label="Your invitation"
            className="flex flex-col gap-03 px-05 pb-07 pt-06 [grid-area:actions] min-[900px]:flex-row min-[900px]:flex-wrap min-[900px]:items-start min-[900px]:px-10 min-[900px]:pt-07"
          >
            <Actions
              token={token}
              state={state}
              orgName={orgName}
              invitedBy={invitedBy}
              onJoined={(orgId) => {
                const to = landingAfterJoin(join);
                // A full load, as CheckIn's onDone does.
                if (to) window.location.assign(to);
                else setJoined(orgId);
              }}
            />
          </section>
        </main>
      )}
    </div>
  );
}
