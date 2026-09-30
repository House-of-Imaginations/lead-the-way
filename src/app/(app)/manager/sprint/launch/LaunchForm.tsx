"use client";

import { Add, ArrowRight, Copy, Locked, Send } from "@carbon/icons-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState, type ReactNode, type SubmitEvent } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  InlineNotification,
  Tag,
  TextArea,
  TextInput,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";

type LaunchPage = NonNullable<
  FunctionReturnType<typeof api.sprints.launchPage>
>;

const GATE_REASON =
  "Protect the hour, finish the pathway and save the agreement first.";
const BAD_EMAIL = "Enter an email address like name@example.com.";
const LAUNCHED = "Your sprint has already launched.";
// ponytail: client mirrors of `launch`'s EMAIL, normalEmail, MAX_LAUNCH_INVITES
// and MAX_MESSAGE; those live in function modules, and `launch` re-checks all four.
const EMAIL =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;
const normalEmail = (email: string) =>
  email.trim().toLowerCase().replace(/\.$/, "");
const MAX_INVITES = 50;
const MAX_MESSAGE = 500;
const STATUS = {
  pending: { label: "Invited", color: "gray" },
  accepted: { label: "Joined", color: "green" },
  declined: { label: "Declined", color: "gray" },
  revoked: { label: "Withdrawn", color: "gray" },
} as const;

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
const invitations = (n: number) =>
  n === 1 ? "1 invitation" : `${n} invitations`;

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-05 border-t border-border-subtle py-04">
      <dt className="text-body-02 text-text-secondary">{term}</dt>
      <dd className="text-body-02">{children}</dd>
    </div>
  );
}

function Summary({ summary }: { summary: LaunchPage["summary"] }) {
  return (
    <section
      aria-labelledby="summary-title"
      className="flex flex-col bg-layer-01 px-05 pt-05 pb-03"
    >
      <h2 id="summary-title" className="pb-03 text-heading-03">
        Sprint summary
      </h2>
      {/* The first row has no rule above it, as in the PNG. */}
      <dl className="[&>div:first-child]:border-t-0">
        <Row term="Protected hour">{summary.hour}</Row>
        <Row term="Runs">{summary.runs}</Row>
        <Row term="Learning">
          <span className="flex flex-col gap-02">
            <span>{summary.course}</span>
            <span className="text-label-01 text-text-secondary">
              Existing SkillsBuild course, 4 sessions of 15 min
            </span>
          </span>
        </Row>
        <Row term="Weekly task">Apply one idea to real work</Row>
        <Row term="Week 4">{summary.showAndTell}</Row>
        <Row term="Agreement">
          <span className="flex flex-col gap-02">
            <Link
              href="/manager/agreement"
              className="text-link underline-offset-2 hover:text-link-hover hover:underline"
            >
              Team AI Agreement
            </Link>
            <span className="text-label-01 text-text-secondary">
              {summary.agreementSaved ?? "Not saved yet"}
            </span>
          </span>
        </Row>
      </dl>
    </section>
  );
}

function Heading({
  id,
  title,
  count,
}: {
  id: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-05">
      <h2 id={id} className="text-heading-03">
        {title}
      </h2>
      <span className="text-label-01 text-text-secondary tabular-nums">
        {people(count)}
      </span>
    </div>
  );
}

export function LaunchForm({ initial }: { initial: LaunchPage }) {
  // null only if the team vanished mid-visit; keep showing the last page then.
  const data = useQuery(api.sprints.launchPage, {}) || initial;
  const expectOrgId = useExpectOrgId();
  const launch = useMutation(api.sprints.launch);
  const toast = useToast();

  const [emails, setEmails] = useState<string[]>(initial.suggested);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState(initial.message);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [launchedHere, setLaunchedHere] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const ready =
    data.gate.committed && data.gate.pathwayDone && data.gate.agreementSaved;
  const reason = !ready
    ? GATE_REASON
    : emails.length === 0
      ? "Add at least one email address."
      : null;
  const links = new Map((data.links ?? []).map((l) => [l.email, l.token]));

  // Its own form, so Enter in "Add by email" adds the address and can never
  // launch: "Send invitations" is a plain button outside it.
  function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = normalEmail(draft);
    if (!EMAIL.test(email)) {
      setFieldError(BAD_EMAIL);
      return;
    }
    if (!emails.includes(email)) {
      if (emails.length >= MAX_INVITES) {
        setFieldError(
          `You can invite up to ${MAX_INVITES} people at once. Remove one to add another.`,
        );
        return;
      }
      setEmails([...emails, email]);
    }
    setFieldError(null);
    setDraft("");
  }

  async function send() {
    setPending(true);
    setSendError(null);
    try {
      const { invited, emailed } = await launch({
        expectOrgId,
        emails,
        message,
      });
      setLaunchedHere(true);
      toast({
        title: "Sprint launched",
        body:
          emailed > 0
            ? `${invitations(invited)} sent.`
            : `${invitations(invited)} ready. Copy each link below.`,
      });
    } catch (error) {
      setSendError(
        userMessage(error, "The invitations didn't send. Try again."),
      );
    } finally {
      setPending(false);
    }
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      toast({ title: "Link copied" });
    } catch {
      setCopyError(`Couldn't copy. Select the link and copy it: ${url}`);
    }
  }

  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <header className="flex flex-wrap items-end justify-between gap-05">
        <div className="flex max-w-[640px] flex-col gap-03">
          <h1 className="text-heading-01">Launch your 4-week sprint</h1>
          <p className="text-body-01 text-text-secondary">
            Protect 1 hour per person per week. Each person applies what they
            learn to one real task, then shares it at the week 4 show and tell.
          </p>
        </div>
        <ButtonLink
          href="/join/preview"
          kind="ghost"
          size="md"
          icon={ArrowRight}
        >
          Preview invitation
        </ButtonLink>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-07 max-[900px]:grid-cols-1">
        {data.launched ? (
          <section
            aria-labelledby="invited-title"
            className="flex flex-col gap-05"
          >
            {/* While this tab's own launch is in flight the query can flip first. */}
            {launchedHere || pending ? null : (
              <InlineNotification>{LAUNCHED}</InlineNotification>
            )}
            <Heading
              id="invited-title"
              title="Invitations"
              count={data.invited.length}
            />
            <ul aria-labelledby="invited-title" className="flex flex-col">
              {data.invited.map(({ email, status }) => {
                const token = links.get(email);
                return (
                  <li
                    key={email}
                    className="flex min-h-control-lg items-center gap-05 border-b border-border-subtle first:border-t"
                  >
                    <span className="min-w-0 flex-1 truncate text-body-02">
                      {email}
                    </span>
                    <Tag color={STATUS[status].color}>
                      {STATUS[status].label}
                    </Tag>
                    {token ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        icon={Copy}
                        aria-label={`Copy link for ${email}`}
                        onClick={() => copy(token)}
                      >
                        Copy link
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {copyError ? (
              <p
                role="alert"
                className="text-label-01 break-all text-support-error"
              >
                {copyError}
              </p>
            ) : null}
          </section>
        ) : (
          <section
            aria-labelledby="invite-title"
            className="flex flex-col gap-06"
          >
            <div className="flex flex-col gap-05">
              <Heading
                id="invite-title"
                title="Invite your team"
                count={emails.length}
              />
              {emails.length ? (
                <ul
                  aria-labelledby="invite-title"
                  className="flex flex-wrap gap-03"
                >
                  {emails.map((email) => (
                    <li key={email}>
                      <Tag
                        onDismiss={() =>
                          setEmails(emails.filter((e) => e !== email))
                        }
                      >
                        {email}
                      </Tag>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-02 text-text-secondary">
                  Add your team by email.
                </p>
              )}
            </div>
            <form noValidate onSubmit={add} className="flex items-start">
              <div className="min-w-0 flex-1">
                <TextInput
                  id="add-email"
                  type="email"
                  label="Add by email"
                  placeholder="name@example.com"
                  autoComplete="off"
                  value={draft}
                  error={fieldError ?? undefined}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>
              {/* 24px: the label and its gap, so the button lines up with the field. */}
              <Button
                type="submit"
                kind="secondary"
                size="md"
                icon={Add}
                className="mt-06"
              >
                Add
              </Button>
            </form>
            <TextArea
              id="invite-message"
              label="Message from you"
              helper="Shown at the top of the invitation."
              rows={4}
              maxLength={MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-05 border-t border-border-subtle pt-05">
              <p className="flex items-center gap-03 text-body-02 text-text-secondary">
                <Locked size={16} aria-hidden="true" />
                Joining is voluntary and never used as a performance score.
              </p>
              <div className="ml-auto flex flex-col items-end gap-02">
                <Button
                  icon={Send}
                  disabled={reason !== null || pending}
                  aria-describedby={reason ? "send-reason" : undefined}
                  onClick={send}
                >
                  Send invitations
                </Button>
                {reason ? (
                  <p
                    id="send-reason"
                    className="max-w-[320px] text-right text-label-01 text-text-secondary"
                  >
                    {reason}
                  </p>
                ) : null}
                {sendError ? (
                  <p
                    role="alert"
                    className="max-w-[320px] text-right text-label-01 text-support-error"
                  >
                    {sendError}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}
        <Summary summary={data.summary} />
      </div>
    </div>
  );
}
