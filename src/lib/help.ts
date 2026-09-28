import { PURGE_WINDOW_DAYS } from "@convex/lib/account/window";
import { MAX_AVATAR_MB } from "@convex/lib/account/avatar";

/**
 * Every explanation a screen offers, asked for by a question mark rather than
 * printed permanently beside the control.
 *
 * Help set at a size that says "skip me" and then left in the way is help
 * nobody reads and everybody scrolls past. These are the same sentences, shown
 * at a readable size in a dialog, only when asked for.
 *
 * WHY IT LIVES IN `src/lib` AND NOT IN THE JSX. Two reasons, and the second is
 * the real one. The test suite runs a single `edge-runtime` environment with no
 * DOM, so anything inside a component is unreachable to it -- the same reason
 * `menu.ts` and `avatar.ts` are here. And prose held as data can be checked as
 * data: `help.test.ts` asserts the deletion topic still states the window the
 * backend actually enforces, which a sentence typed into a `<p>` cannot.
 *
 * BODIES ARE PARAGRAPHS, NOT ONE STRING. A dialog that has to explain the two
 * halves of account deletion has three things to say and needs the breaks; a
 * dialog explaining an image format has one.
 */
export type HelpEntry = {
  /** Names the dialog, and the trigger's accessible name is built from it. */
  title: string;
  body: readonly string[];
};

export const HELP = {
  picture: {
    title: "Your picture",
    body: [
      `PNG, JPEG, WebP or GIF, under ${MAX_AVATAR_MB}MB. Without one your roundel shows your initials.`,
      // Said because the preview beside the control is 44px and looks like a
      // mistake otherwise. It is the size the picture is actually used at.
      "It is only ever drawn at the size of the roundel in the corner of the screen, so a face fills it better than a landscape.",
    ],
  },
  name: {
    title: "Your display name",
    body: ["What this app calls you, and what other people see."],
  },
  push: {
    title: "Notifications",
    body: [
      "The moments worth knowing about happen while this app is closed, so the phone is where they have to land.",
      "A notification says that something happened and nothing more — never private content. It is drawn on a locked screen, in front of whoever is holding the phone.",
      "This is per device, and turning it off here turns it off on this one. You are never notified about something you did yourself.",
    ],
  },
  signout: {
    title: "Signing out",
    body: [
      "Signing out ends the session on this device. Anything this browser was holding on your behalf goes with it.",
      "Signing back in restores everything the account itself holds.",
    ],
  },
  organization: {
    title: "Workspaces",
    body: [
      "A workspace is a shared place. Everything created inside one belongs to it rather than to you, and everybody in it sees the same thing.",
      "You can be in more than one, and the roundel in the corner switches between them. Leaving a workspace does not delete anything you made in it.",
    ],
  },
  roles: {
    title: "Roles and permissions",
    body: [
      "A role is a bundle of permissions, and every member has exactly one. Workspaces invent their own roles, so what a role is called is up to you.",
      "You can only hand out permissions you hold yourself, and only change somebody whose role does not reach further than yours.",
      "The owner role always has every permission. It cannot be edited or deleted, and a workspace always keeps at least one owner.",
    ],
  },
  invites: {
    title: "Invitations",
    body: [
      "An invitation is a link that grants one role, once. Whoever opens it first joins with that role, and the link stops working.",
      "Links expire after seven days. Pin one to an email address and only a verified holder of that address can use it.",
      "Widening a role cancels any invitation still waiting on it, because the link promised what the role was.",
    ],
  },
  deletion: {
    title: "Deleting your account",
    body: [
      "Notifications stop immediately, and the subscriptions behind them are not restored. That part cannot be undone.",
      `Everything else is kept for ${PURGE_WINDOW_DAYS} days. Sign back in within that time and the account comes back as it was. After that it is erased.`,
    ],
  },
  workspace: {
    title: "Your workspace",
    body: ["Sections follow your role."],
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpTopic = keyof typeof HELP;

export const HELP_TOPICS = Object.keys(HELP) as HelpTopic[];
