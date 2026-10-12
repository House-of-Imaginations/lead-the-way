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
    return row.member.canManage ? ["Change role", "Remove member"] : [];
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
  // Cancel or Escape on a dialog goes back to this row's Manage button.
  const manageRef = useRef<HTMLButtonElement>(null);
  // The live list can take the row's Manage button away while a dialog is
  // open, so focus falls back to the header the remove path uses.
  const backToRow = (e: Event) => {
    e.preventDefault();
    if (manageRef.current?.isConnected) manageRef.current.focus();
    else document.getElementById("members-heading")?.focus();
  };

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
        // The row and its Manage button go, so focus would fall to the page.
        document.getElementById("members-heading")?.focus();
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
            ref={manageRef}
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
            key={row.member.personId}
            member={row.member}
            roles={roles}
            open={dialog === "role"}
            onOpenChange={(open) => setDialog(open ? "role" : null)}
            onCloseAutoFocus={backToRow}
          />
          <RemoveMember
            member={row.member}
            open={dialog === "remove"}
            onOpenChange={(open) => setDialog(open ? "remove" : null)}
            onCloseAutoFocus={backToRow}
          />
        </>
      )}
    </>
  );
}

/** A removed row has no Manage button left to return focus to. */
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
  onCloseAutoFocus,
}: {
  member: Member;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const changeRole = useMutation(api.members.changeRole);
  const toast = useToast();
  const [roleId, setRoleId] = useState<string>(member.roleId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formId = `change-role-${member.personId}`;
  // The parent opens it, so the Modal never reports the open: each opening
  // starts from the member's role as it is now, read during render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRoleId(member.roleId);
      setError(null);
    }
  }

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
      // The next opening resets the pick from the new role.
      setError(null);
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
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form
        id={formId}
        className="flex flex-col gap-06 pt-06"
        onSubmit={(e) => void onSubmit(e)}
      >
        {/* What this seat may give (the server's `assignable`), and the current role. */}
        <Select
          id={`${formId}-role`}
          label="Role"
          options={roles
            .filter((r) => r.assignable || r._id === member.roleId)
            .map((r) => ({ value: r._id, label: r.name }))}
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
  onCloseAutoFocus,
}: {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const remove = useMutation(api.members.remove);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const removed = useRef(false);

  async function onRemove() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await remove({ personId: member.personId, expectOrgId });
      removed.current = true;
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
      // Removed: the row and its Manage button are gone, so the header.
      onCloseAutoFocus={(e) =>
        removed.current ? focusHeader(e) : onCloseAutoFocus(e)
      }
    >
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
