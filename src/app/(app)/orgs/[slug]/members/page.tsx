"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Link2, Mail, Send, Trash2 } from "lucide-react";
import { initialsFor } from "@/lib/account/avatar";
import { userMessage } from "@/lib/errors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plate } from "@/components/kit/Plate";
import { PageBody, PagePending } from "@/app/(app)/_components/page-body";
import {
  ConfirmDialog,
  FormSection,
  IDLE,
  SettingsHeading,
  SettingsSection,
  type FormStatus,
} from "@/components/settings";

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

/**
 * Who is in a workspace, and who has been asked to join.
 *
 * THE ROUTE OWNS EVERY SUBSCRIPTION AND EVERY MUTATION, per
 * `.docs/coding-conventions.md`. Roles themselves live on `/orgs/[slug]/roles`.
 *
 * EVERY QUERY IS SKIPPED UNLESS THE CALLER MAY RUN IT. `invites.list` refuses
 * anybody without `members:manage`, and a refused subscription throws into the
 * page -- which is how someone who had just accepted an invitation as a plain
 * member used to open this screen and get an error instead of a member list.
 * The server still refuses on its own; the gate here is only so it never has to.
 */
export default function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const seated = useQuery(api.orgs.bySlug, { slug });
  const orgId = seated?.org._id;
  const canRead = seated?.permissions.includes("members:read") ?? false;
  const canManage = seated?.permissions.includes("members:manage") ?? false;

  const members = useQuery(
    api.members.list,
    orgId && canRead ? { orgId } : "skip",
  );
  const roles = useQuery(
    api.orgRoles.list,
    orgId && canRead ? { orgId } : "skip",
  );
  const invites = useQuery(
    api.invites.list,
    orgId && canManage ? { orgId } : "skip",
  );

  const changeRole = useMutation(api.members.changeRole);
  const removeMember = useMutation(api.members.remove);
  const createInvite = useMutation(api.invites.create);
  const resendInvite = useMutation(api.invites.resend);
  const revokeInvite = useMutation(api.invites.revoke);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Id<"orgRoles"> | null>(null);
  const [inviteStatus, setInviteStatus] = useState<FormStatus>(IDLE);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  // The one invitation whose link is shown in full, because the clipboard
  // refused it. Beside its own row, selectable, and not an alert.
  const [shownLink, setShownLink] = useState<string | null>(null);

  if (seated === undefined) return <PagePending />;
  if (seated === null) {
    return (
      <PageBody>
        <h1 className="display text-[32px] leading-[1.1] text-foreground">
          No workspace here
        </h1>
        <Plate variant="ghost" center href="/" label="Back to the start" />
      </PageBody>
    );
  }

  const { org, isOwner } = seated;
  // The owner role is never offered: ownership is handed over, not invited.
  const invitable = roles?.filter((role) => !role.isOwner) ?? [];
  const chosenRole =
    invitable.find((role) => role._id === inviteRole) ??
    invitable.find((role) => role.name === "Member") ??
    invitable[0];
  const linkFor = (token: string) => `${window.location.origin}/join/${token}`;

  /** Copy a link, or show it when the clipboard says no. True if copied. */
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setShownLink(null);
      return true;
    } catch {
      setShownLink(token);
      return false;
    }
  }

  async function invite() {
    if (!chosenRole) return;
    const to = inviteEmail.trim();
    setInviteStatus({ state: "busy" });
    try {
      const { token, emailed } = await createInvite({
        orgId: org._id,
        roleId: chosenRole._id,
        ...(to ? { email: to } : {}),
      });
      setInviteEmail("");
      let message: string;
      if (to && emailed) message = `Invitation sent to ${to}.`;
      else if (to) {
        message =
          "Invitation created, but email is not set up here. Copy its link below and send it yourself.";
      } else {
        message = (await copy(token))
          ? "Link copied. Anyone who opens it can join once."
          : "Link created. Copy it from the list below.";
      }
      setInviteStatus({ state: "done", message });
    } catch (e) {
      setInviteStatus({
        state: "error",
        message: userMessage(e, "Could not create that invitation."),
      });
    }
  }

  return (
    <PageBody>
      <SettingsHeading
        title="Members"
        description={`Who is in ${org.name}, and who has been invited.`}
      />

      {canManage ? (
        <FormSection
          title="Invite people"
          description="They get an email with a link that works once and expires in seven days. Leave the email empty to make a link you can share yourself."
          submitLabel={inviteEmail.trim() ? "Send invite" : "Create link"}
          status={inviteStatus}
          onSubmit={() => void invite()}
        >
          {roles !== undefined && invitable.length === 0 ? (
            <p className="text-sm leading-snug text-muted-foreground">
              Invitations need a role other than Owner.{" "}
              <Link
                href={`/orgs/${org.slug}/roles`}
                className="text-primary underline underline-offset-4"
              >
                Create a role
              </Link>{" "}
              first.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field>
              <FieldLabel htmlFor="invite-email">Email (optional)</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select
                value={chosenRole?._id ?? ""}
                onValueChange={(value) =>
                  setInviteRole(value as Id<"orgRoles">)
                }
                disabled={invitable.length === 0}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {invitable.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>
      ) : null}

      {canManage ? (
        <SettingsSection
          title="Pending invitations"
          description="Waiting to be accepted. Revoking one stops its link working straight away."
        >
          <p
            role="status"
            className="text-sm text-muted-foreground empty:hidden"
          >
            {pendingNote ?? ""}
          </p>
          {invites === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invitations waiting.
            </p>
          ) : (
            <ul className="divide-y divide-hairline rounded-md border border-hairline">
              {invites.map((pending) => (
                <li key={pending._id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline text-muted-foreground"
                      >
                        {pending.email ? (
                          <Mail className="size-4" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <p className="truncate text-sm font-medium text-foreground">
                          {pending.email ?? "Anyone with the link"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pending.roleName}, expires{" "}
                          {shortDate(pending.expiresAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void copy(pending.token).then((copied) =>
                            setPendingNote(copied ? "Link copied." : null),
                          )
                        }
                      >
                        <Link2 />
                        Copy link
                      </Button>
                      {pending.email ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void resendInvite({
                              orgId: org._id,
                              inviteId: pending._id,
                            }).then(
                              ({ emailed }) =>
                                setPendingNote(
                                  emailed
                                    ? `Sent again to ${pending.email}.`
                                    : "Email is not set up here. Copy the link instead.",
                                ),
                              (e) =>
                                setPendingNote(
                                  userMessage(e, "Could not resend that."),
                                ),
                            )
                          }
                        >
                          <Send />
                          Resend
                        </Button>
                      ) : null}
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost">
                            <Trash2 />
                            Revoke
                          </Button>
                        }
                        title="Revoke this invitation?"
                        description="Its link stops working. You can always send a new one."
                        cancelLabel="Keep it"
                        confirmLabel="Revoke invitation"
                        onConfirm={async () => {
                          try {
                            await revokeInvite({
                              orgId: org._id,
                              inviteId: pending._id,
                            });
                          } catch (e) {
                            throw new Error(
                              userMessage(e, "Could not revoke that."),
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                  {shownLink === pending.token ? (
                    <Input
                      readOnly
                      aria-label={`Invitation link for ${pending.email ?? pending.roleName}`}
                      value={linkFor(pending.token)}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      ) : null}

      <SettingsSection
        title="People"
        description={
          members
            ? `${members.length} ${members.length === 1 ? "person" : "people"} in this workspace.`
            : "Everyone in this workspace."
        }
      >
        <p
          role="alert"
          className="text-sm leading-snug text-destructive empty:hidden"
        >
          {peopleError ?? ""}
        </p>
        {!canRead ? (
          <p className="text-sm text-muted-foreground">
            Your role cannot see who else is here.
          </p>
        ) : members === undefined || roles === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {members.map((member) => {
              // An admin cannot act on an owner; `requireOutranks` on the
              // server is the rule, this only avoids offering it. An owner can
              // act on another owner, which is how ownership is handed over.
              const actionable = canManage && (isOwner || !member.isOwner);
              return (
                <li
                  key={member.membershipId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="size-9 border border-hairline">
                      <AvatarFallback aria-hidden="true">
                        {initialsFor(member.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate text-sm font-medium text-foreground">
                        {member.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Joined {shortDate(member.joinedAt)}
                      </p>
                    </div>
                  </div>
                  {actionable ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.roleId}
                        onValueChange={(roleId) => {
                          setPeopleError(null);
                          changeRole({
                            orgId: org._id,
                            membershipId: member.membershipId,
                            roleId: roleId as Id<"orgRoles">,
                          }).catch((e) =>
                            setPeopleError(
                              userMessage(e, "Could not change that role."),
                            ),
                          );
                        }}
                      >
                        <SelectTrigger
                          className="w-40"
                          aria-label={`Role for ${member.displayName}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* The owner role is offered only by an owner: it
                              is how a sole owner hands the workspace over. */}
                          {roles
                            .filter(
                              (role) =>
                                isOwner ||
                                !role.isOwner ||
                                role._id === member.roleId,
                            )
                            .map((role) => (
                              <SelectItem key={role._id} value={role._id}>
                                {role.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${member.displayName}`}
                          >
                            <Trash2 />
                          </Button>
                        }
                        title={`Remove ${member.displayName}?`}
                        description="They lose access to this workspace straight away. Anything they made here stays."
                        cancelLabel="Keep them"
                        confirmLabel="Remove from workspace"
                        onConfirm={async () => {
                          try {
                            await removeMember({
                              orgId: org._id,
                              membershipId: member.membershipId,
                            });
                          } catch (e) {
                            throw new Error(
                              userMessage(e, "Could not remove that person."),
                            );
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <Badge>{member.roleName}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>
    </PageBody>
  );
}
