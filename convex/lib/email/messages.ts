import { sendEmail, type EmailCtx } from "./send";

/**
 * Every email this product sends, as one function each.
 *
 * THE WORDS LIVE HERE, not at the call sites: text held as data can be
 * checked as data, and three subjects written in three files drift into
 * three different voices.
 * Nothing in here formats HTML -- `./template.ts` owns the shape, and these
 * only decide what to say.
 *
 * Each one returns whether it was queued, which is false on a deployment with
 * no sending domain. A caller that tells somebody "we emailed them" has to ask.
 */

type Invite = {
  to: string;
  orgName: string;
  roleName: string;
  inviterName: string;
  link: string;
  /** The manager's own words. `renderEmail` escapes it, like every paragraph. */
  message?: string;
};

/**
 * The invitation's subject and content, apart from sending it, so
 * `scripts/preview-email.ts` renders exactly what goes out.
 */
export function inviteEmail(invite: Invite) {
  return {
    // Who, then where: a name the reader knows is what gets an unexpected
    // email opened rather than reported.
    subject: `${invite.inviterName} invited you to ${invite.orgName} on Lead the Way`,
    content: {
      heading: `Join ${invite.orgName} on Lead the Way`,
      paragraphs: [
        `${invite.inviterName} invited you to join ${invite.orgName} as ${invite.roleName}.`,
        ...(invite.message
          ? [`${invite.inviterName} wrote: "${invite.message}"`]
          : []),
        `Open the invitation with this email address (${invite.to}). If you do not have an account yet, you can create one on the way.`,
      ],
      action: { label: "Accept invitation", url: invite.link },
      // The expiry and the single use are stated because both are surprising
      // when met without warning, and the last sentence is the one that matters
      // to somebody who did not expect this at all.
      footer:
        "This link works once and expires in seven days. If you were not expecting it, you can ignore this message.",
    },
  };
}

/** The link that turns whoever opens it into a member. */
export async function sendInviteEmail(
  ctx: EmailCtx,
  invite: Invite,
): Promise<boolean> {
  const { subject, content } = inviteEmail(invite);
  return await sendEmail(ctx, invite.to, subject, content);
}

/**
 * Prove the address is yours.
 *
 * NOT OPTIONAL POLISH: `convex/invites.ts` refuses an invitation pinned to an
 * address unless `emailVerified` is true, because an unverified address is a
 * claim rather than a fact. Without this email nothing ever sets that flag for
 * an email-and-password account, and pinned invitations would be a feature that
 * cannot be used.
 */
export async function sendVerificationEmail(
  ctx: EmailCtx,
  verification: { to: string; link: string },
): Promise<boolean> {
  return await sendEmail(ctx, verification.to, "Confirm your email address", {
    heading: "Confirm your email address",
    paragraphs: [
      "Confirming your address lets people invite you to a workspace by email, and lets you get back in if you forget your password.",
    ],
    action: { label: "Confirm this address", url: verification.link },
    footer:
      "If you did not create an account, somebody typed this address by mistake. Ignoring this message is enough. Nothing happens until the link is opened.",
  });
}

/** Get back in without the password. */
export async function sendPasswordResetEmail(
  ctx: EmailCtx,
  reset: { to: string; link: string },
): Promise<boolean> {
  return await sendEmail(ctx, reset.to, "Reset your password", {
    heading: "Reset your password",
    paragraphs: [
      "Open the link below to choose a new password. Your current one keeps working until you do.",
    ],
    action: { label: "Choose a new password", url: reset.link },
    footer:
      "If you did not ask for this, ignore it. Nothing changes until the link is opened, and your password is unchanged.",
  });
}

type Reminder = {
  kind: "weekly" | "showAndTell";
  week: number;
  weeks: number;
  /** "Wednesday 16 September at 2:00 PM", plus the zone note when it differs. */
  when: string;
  /** The person's home; no button without one. */
  link?: string;
};

/**
 * The day-before reminders (S-d). Says when, says what the hour is for, and
 * says how to stop them, because an email nobody asked to keep getting is
 * the one that gets reported.
 */
export function reminderEmail(r: Reminder) {
  const heading =
    r.kind === "showAndTell"
      ? "Show and tell is tomorrow"
      : "Your protected hour is tomorrow";
  const paragraphs =
    r.kind === "showAndTell"
      ? [
          `Your team's show and tell is in the protected hour on ${r.when}.`,
          "Bring one way you used AI at work, if you want to share it. Nothing is shared unless you choose to.",
        ]
      : [
          `Week ${r.week} of ${r.weeks}: ${r.when}.`,
          "One hour of your working week is protected for practical AI learning.",
        ];
  return {
    subject: heading,
    content: {
      heading,
      paragraphs,
      ...(r.link ? { action: { label: "Open your week", url: r.link } } : {}),
      footer:
        "You get this because reminders are on in Lead the Way. Turn them off in Settings, Notifications.",
    },
  };
}
