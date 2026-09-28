"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import {
  Building2,
  CircleCheck,
  Link2Off,
  MailCheck,
  MailOpen,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/account/auth-client";
import { userMessage } from "@/lib/errors";
import { acceptCopy } from "@/lib/workspace/onboarding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Taking up an invitation.
 *
 * IT DOES NOT ACCEPT ON ARRIVAL, and that is deliberate rather than an extra
 * tap for its own sake. A link in an email is followed by mail scanners, link
 * previewers and whatever proxy sits in front of a corporate inbox; a page that
 * joined on mount would have the invitation consumed by a machine before its
 * recipient ever saw it. So the page shows what the link offers, and a person
 * commits to it.
 *
 * A SIGNED-OUT VISITOR IS SENT TO SIGN IN AND BACK. `preview` is an
 * authenticated query, so it returns null for them, which would otherwise read
 * as "this link is dead" to somebody holding a perfectly good one. Both sign-in
 * routes already take a `redirect` parameter.
 *
 * `preview.access` SAYS WHAT STANDS IN THE WAY before anybody presses Join: an
 * address not yet confirmed gets the confirmation link again, pointed back
 * here, and the wrong account gets a way to switch. `preview` is reactive, so
 * confirming the address in another tab turns this page into the Join card on
 * its own.
 *
 * Every state is the same small card -- the shadcnstudio "Verify Email 05"
 * shape: an icon, one sentence of what is going on, one thing to do.
 */
export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const { token } = use(params);

  const user = useQuery(api.auth.getCurrentUser, {});
  const invite = useQuery(api.invites.preview, user ? { token } : "skip");
  const accept = useMutation(api.invites.accept);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const back = `/join/${token}`;
  const switchAccount = async () => {
    await authClient.signOut();
    router.push(`/sign-in?redirect=${encodeURIComponent(back)}`);
  };

  if (user === undefined || (user && invite === undefined)) {
    return (
      <JoinCard icon={MailOpen} title="Opening your invitation…">
        <Skeleton className="h-10 w-full" />
      </JoinCard>
    );
  }

  if (user === null) {
    const redirect = encodeURIComponent(back);
    return (
      <JoinCard
        icon={MailOpen}
        title="You have been invited"
        description="Sign in or create an account to see the invitation and join the workspace."
        footer={
          <>
            Already have an account?{" "}
            <TextLink href={`/sign-in?redirect=${redirect}`}>Sign in</TextLink>
          </>
        }
      >
        <Button asChild size="touch" className="w-full">
          <Link href={`/sign-up?redirect=${redirect}`}>Create an account</Link>
        </Button>
      </JoinCard>
    );
  }

  // Expired, already used, revoked, or never real. One card for all four:
  // telling them apart is an oracle for guessing tokens, and the backend
  // already refuses to tell this page which it was.
  if (!invite) {
    return (
      <JoinCard
        icon={Link2Off}
        title="This invitation is no longer valid"
        description="Invitations work once and expire after seven days. Ask whoever sent it for a new one."
      >
        <Button asChild size="touch" variant="outline" className="w-full">
          <Link href="/">Go to Lead the Way</Link>
        </Button>
      </JoinCard>
    );
  }

  const state = invite.acceptState;
  const copy = acceptCopy(state, invite, user.email);

  if (state === "VERIFY_EMAIL") {
    return (
      <JoinCard
        icon={MailCheck}
        title={copy.title}
        description={copy.description}
        footer={
          invite.emailConfigured ? (
            <>
              Didn&apos;t get the email?{" "}
              <button
                type="button"
                disabled={busy}
                className="font-medium text-foreground underline-offset-4 hover:underline disabled:text-muted-foreground"
                onClick={async () => {
                  setBusy(true);
                  const { error } = await authClient.sendVerificationEmail({
                    email: user.email,
                    callbackURL: back,
                  });
                  setBusy(false);
                  setNote(
                    error
                      ? (error.message ??
                          "Could not send the link. Please try again.")
                      : `Sent again to ${user.email}.`,
                  );
                }}
              >
                {busy ? "Sending…" : "Resend"}
              </button>
            </>
          ) : undefined
        }
        note={note}
      >
        <Button
          size="touch"
          variant="outline"
          className="w-full"
          onClick={() => void switchAccount()}
        >
          Use a different account
        </Button>
      </JoinCard>
    );
  }

  if (state === "WRONG_ACCOUNT") {
    return (
      <JoinCard
        icon={UserRoundX}
        title={copy.title}
        description={copy.description}
      >
        <Button
          size="touch"
          className="w-full"
          onClick={() => void switchAccount()}
        >
          Switch account
        </Button>
      </JoinCard>
    );
  }

  if (state === "ALREADY_MEMBER") {
    return (
      <JoinCard
        icon={CircleCheck}
        title={copy.title}
        description={copy.description}
      >
        <Button asChild size="touch" className="w-full">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </JoinCard>
    );
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await accept({ token });
      router.push("/dashboard?joined=1");
    } catch (e) {
      setError(userMessage(e, "Could not use that invitation."));
      setBusy(false);
    }
  }

  return (
    <JoinCard
      icon={Building2}
      title={copy.title}
      description={copy.description}
      footer={
        <>
          Signed in as {user.email}. Not you?{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => void switchAccount()}
          >
            Switch account
          </button>
        </>
      }
      note={error}
      noteIsError
    >
      <Button
        size="touch"
        className="w-full"
        onClick={() => void join()}
        disabled={busy}
      >
        {busy ? "Joining…" : `Join ${invite.orgName}`}
      </Button>
    </JoinCard>
  );
}

/** The one shape every state of this page takes. */
function JoinCard({
  icon: Icon,
  title,
  description,
  children,
  footer,
  note,
  noteIsError = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  note?: string | null;
  noteIsError?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 rounded-md border border-hairline bg-card px-6 py-8 text-center sm:px-8">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-muted text-institution"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-balance text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-3">
        {/* Mounted once and rewritten, so what arrives is announced. */}
        <p
          role={noteIsError ? "alert" : "status"}
          className={
            noteIsError
              ? "text-sm leading-snug text-destructive empty:hidden"
              : "text-sm leading-snug text-muted-foreground empty:hidden"
          }
        >
          {note ?? ""}
        </p>
        {children}
      </div>
      {footer ? (
        <p className="text-sm text-muted-foreground">{footer}</p>
      ) : null}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
