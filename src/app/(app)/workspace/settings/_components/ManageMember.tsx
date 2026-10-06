"use client";

import { useMutation } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  Menu,
  Modal,
  Select,
  useToast,
  type MenuItem,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import type { Member, MemberRow, Role } from "./MembersTab";

type Action =
  "Change role" | "Remove member" | "Copy link" | "Resend" | "Revoke";

/** What the Manage menu offers on a row (Ruling 16). */
export function actionsFor(row: MemberRow): Action[] {
  if (row.kind === "person")
    return row.member.you ? [] : ["Change role", "Remove member"];
  if (row.state === "Declined") return [];
  return row.invite.email
    ? ["Copy link", "Resend", "Revoke"]
    : ["Copy link", "Revoke"];
}

/**
 * One row's Manage menu. A refusal from the menu's own actions goes to
 * `onError`, shown above the table; the two modals show theirs inside.
 */
export function ManageMember({
  row,
  roles,
  onError,
}: {
  row: MemberRow;
  roles: Role[];
  onError: (message: string | null) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const toast = useToast();
  const resend = useMutation(api.invites.resend);
  const revoke = useMutation(api.invites.revoke);
  const [dialog, setDialog] = useState<"role" | "remove" | null>(null);
  // The menu closes after a dialog is chosen and would pull focus back to its
  // trigger, past the dialog's own return to the header.
  const toDialog = useRef(false);

  const actions = actionsFor(row);
  if (actions.length === 0) return null;

  async function run(action: () => Promise<void>, fallback: string) {
    onError(null);
    try {
      await action();
    } catch (error) {
      onError(userMessage(error, fallback));
    }
  }

  const handlers: Record<Action, () => void> = {
    "Change role": () => {
      toDialog.current = true;
      setDialog("role");
    },
    "Remove member": () => {
      toDialog.current = true;
      setDialog("remove");
    },
    "Copy link": () =>
      void (async () => {
        if (row.kind !== "invite") return;
        // As LaunchForm: a refused clipboard still leaves the link to copy.
        const url = `${window.location.origin}/join/${row.invite.token}`;
        onError(null);
        try {
          await navigator.clipboard.writeText(url);
          toast({ title: "Link copied" });
        } catch {
          onError(`Couldn't copy. Select the link and copy it: ${url}`);
        }
      })(),
    Resend: () =>
      void run(async () => {
        if (row.kind !== "invite") return;
        const { emailed } = await resend({
          inviteId: row.invite._id,
          expectOrgId,
        });
        // Renewed either way; the demo workspace never sends.
        toast({ title: emailed ? "Invitation sent." : "Invitation renewed." });
      }, "The invitation wasn't sent again. Try again."),
    Revoke: () =>
      void run(async () => {
        if (row.kind !== "invite") return;
        await revoke({ inviteId: row.invite._id, expectOrgId });
        toast({ title: "Invitation revoked." });
      }, "The invitation wasn't revoked. Try again."),
  };
  const items: MenuItem[] = actions.map((label) => ({
    label,
    onSelect: handlers[label],
  }));

  return (
    <>
      <Menu
        align="end"
        items={items}
        onCloseAutoFocus={(e) => {
          if (toDialog.current) e.preventDefault();
          toDialog.current = false;
        }}
        trigger={
          <Button
            kind="ghost"
            size="sm"
            className="max-md:h-size-control-lg"
            aria-label={`Manage ${row.name}`}
          >
            Manage
          </Button>
        }
      />
      {row.kind === "person" && (
        <>
          <ChangeRole
            key={row.member.roleId}
            member={row.member}
            roles={roles}
            open={dialog === "role"}
            onOpenChange={(open) => setDialog(open ? "role" : null)}
          />
          <RemoveMember
            member={row.member}
            open={dialog === "remove"}
            onOpenChange={(open) => setDialog(open ? "remove" : null)}
          />
        </>
      )}
    </>
  );
}

/** The dialogs open from a menu item, so focus has no trigger to return to. */
const focusHeader = (e: Event) => {
  e.preventDefault();
  document.getElementById("members-heading")?.focus();
};

const MID_SPRINT =
  "during a sprint can hide the rest of that sprint's team totals.";

function ChangeRole({
  member,
  roles,
  open,
  onOpenChange,
}: {
  member: Member;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const changeRole = useMutation(api.members.changeRole);
  const toast = useToast();
  const [roleId, setRoleId] = useState<string>(member.roleId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formId = `change-role-${member.personId}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await changeRole({
        personId: member.personId,
        roleId: roleId as Id<"orgRoles">,
        expectOrgId,
      });
      toast({ title: "Role changed." });
      onOpenChange(false);
    } catch (e) {
      setError(userMessage(e, "The role wasn't changed. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
          setRoleId(member.roleId);
        }
      }}
      label={member.name}
      title="Change role"
      formId={formId}
      primaryText="Change role"
      primaryDisabled={pending}
      secondaryText="Cancel"
      onCloseAutoFocus={focusHeader}
    >
      <form
        id={formId}
        className="flex flex-col gap-06 pt-06"
        onSubmit={(e) => void onSubmit(e)}
      >
        {/* Every role: the server refuses what this seat may not give (M-b). */}
        <Select
          id={`${formId}-role`}
          label="Role"
          options={roles.map((r) => ({ value: r._id, label: r.name }))}
          value={roleId}
          onChange={(e) => setRoleId(e.currentTarget.value)}
          className="bg-background"
        />
        <p className="text-body-02 text-text-secondary">
          {`Changing a role ${MID_SPRINT}`}
        </p>
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function RemoveMember({
  member,
  open,
  onOpenChange,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const remove = useMutation(api.members.remove);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onRemove() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await remove({ personId: member.personId, expectOrgId });
      toast({ title: "Member removed." });
      onOpenChange(false);
    } catch (e) {
      setError(userMessage(e, "They weren't removed. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        // Cancel, Escape and the close button all wait for the removal.
        if (pending) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
      label="Members"
      title={`Remove ${member.name}?`}
      description={`They lose access to this workspace. Their credential link keeps working. Removing someone ${MID_SPRINT}`}
      primaryText="Remove member"
      primaryKind="danger"
      onPrimary={() => void onRemove()}
      primaryDisabled={pending}
      secondaryText="Cancel"
      onCloseAutoFocus={focusHeader}
    >
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
