export type AcceptState =
  "READY" | "VERIFY_EMAIL" | "WRONG_ACCOUNT" | "ALREADY_MEMBER";

export function acceptCopy(
  state: AcceptState,
  invite: {
    orgName: string;
    emailConfigured: boolean;
  },
  email: string,
): { title: string; description: string } {
  switch (state) {
    case "READY":
      return {
        title: `Join ${invite.orgName}`,
        description: "Your role and access are set by the invitation.",
      };
    case "VERIFY_EMAIL":
      return {
        title: "Confirm your email first",
        description: invite.emailConfigured
          ? `Open the confirmation link sent to ${email}, then come back to this invitation.`
          : "This deployment cannot send email yet. Ask your administrator to confirm your address.",
      };
    case "WRONG_ACCOUNT":
      return {
        title: "This invitation is for another account",
        description: `You are signed in as ${email}. Sign out and sign in with the invited address.`,
      };
    case "ALREADY_MEMBER":
      return {
        title: `You are already in ${invite.orgName}`,
        description:
          "Nothing more to do. Switch to the workspace from the header.",
      };
  }
}
