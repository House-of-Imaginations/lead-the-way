"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  Modal,
  Select,
  Tag,
  TextInput,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { useTimedQuery } from "@/lib/useTimedQuery";
import { ManageMember } from "./ManageMember";

export type Member = FunctionReturnType<typeof api.members.list>[number];
export type Invite = FunctionReturnType<typeof api.invites.list>[number];
export type Role = FunctionReturnType<typeof api.orgRoles.list>[number];
export type MembersData = {
  people: Member[];
  invites: Invite[];
  roles: Role[];
};

export type MemberRow =
  | {
      kind: "person";
      key: string;
      name: string;
      email: string;
      role: string;
      state: "Joined";
      member: Member;
    }
  | {
      kind: "invite";
      key: string;
      name: string;
      email: string;
      role: string;
      state: "Invited" | "Declined";
      invite: Invite;
    };

/**
 * One row per person (privacy rule 7: name, email, role and state, nothing
 * about participation). People first, then open invitations, then declined
 * ones; an address already shown is not shown again.
 */
export function memberRows(people: Member[], invites: Invite[]): MemberRow[] {
  const seen = new Set(people.map((p) => p.email.toLowerCase()));
  const rows: MemberRow[] = people.map((member) => ({
    kind: "person",
    key: member.personId,
    name: member.name,
    email: member.email,
    role: member.roleName,
    state: "Joined",
    member,
  }));
  for (const status of ["pending", "declined"] as const) {
    for (const invite of invites) {
      if (invite.status !== status) continue;
      const email = invite.email?.toLowerCase();
      if (email) {
        if (seen.has(email)) continue;
        seen.add(email);
      }
      rows.push({
        kind: "invite",
        key: invite._id,
        name: invite.name ?? invite.email ?? "Anyone with the link",
        email: invite.email ?? "Shareable link",
        role: invite.roleName,
        state: status === "pending" ? "Invited" : "Declined",
        invite,
      });
    }
  }
  return rows;
}

/** The spec's "9 people in this workspace": seated people and open invitations. */
export function headcount(rows: MemberRow[]): string {
  const n = rows.filter((r) => r.state !== "Declined").length;
  return `${n} ${n === 1 ? "person" : "people"} in this workspace`;
}

/** 18's Members (P7b-3a): who is in the workspace, and inviting more. */
export function MembersTab({ initial }: { initial: MembersData }) {
  const people = useQuery(api.members.list, {}) ?? initial.people;
  const invites =
    useTimedQuery(api.invites.list, initial.invites) ?? initial.invites;
  const roles = useQuery(api.orgRoles.list, {}) ?? initial.roles;
  const rows = memberRows(people, invites);
  // A refusal from a row's menu (resend, revoke, copy), said once above the table.
  const [error, setError] = useState<string | null>(null);
  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-05">
      <div className="flex flex-wrap items-center justify-between gap-05">
        <h2 id="members-heading" tabIndex={-1} className="text-heading-03">
          {headcount(rows)}
        </h2>
        <InviteMember roles={roles} />
      </div>
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
      {/* Only a table scrolls sideways, inside its own container. */}
      <div
        role="region"
        aria-label="Members"
        tabIndex={0}
        className="overflow-x-auto"
      >
        <table className="ltw-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.role}</td>
                <td>
                  <Tag color={row.state === "Joined" ? "green" : "gray"}>
                    {row.state}
                  </Tag>
                </td>
                <td className="text-right">
                  <ManageMember row={row} roles={roles} onError={setError} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** "Invite member": an address and a role. The owner role is never offered. */
function InviteMember({ roles }: { roles: Role[] }) {
  const expectOrgId = useExpectOrgId();
  const create = useMutation(api.invites.create);
  const toast = useToast();
  const choices = roles.filter((r) => !r.isOwner);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>(
    () => (choices.find((r) => r.name === "Employee") ?? choices[0])?._id ?? "",
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim()) {
      setEmailError("Enter the email address to send the invitation to.");
      return;
    }
    setEmailError(null);
    setError(null);
    setPending(true);
    try {
      const { emailed } = await create({
        roleId: roleId as Id<"orgRoles">,
        email: email.trim(),
        expectOrgId,
      });
      // The demo workspace never sends: its link is copied from the row.
      toast({ title: emailed ? "Invitation sent." : "Invitation created." });
      setOpen(false);
      setEmail("");
    } catch (e) {
      setError(userMessage(e, "The invitation wasn't created. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setEmailError(null);
        }
      }}
      trigger={
        <Button size="md" className="max-md:h-size-control-lg max-md:w-full">
          Invite member
        </Button>
      }
      label="Members"
      title="Invite member"
      description="They get a link to join this workspace."
      formId="invite-member-form"
      primaryText="Send invitation"
      primaryDisabled={pending}
      secondaryText="Cancel"
    >
      <form
        id="invite-member-form"
        className="flex flex-col gap-06 pt-06"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
      >
        <TextInput
          id="invite-email"
          label="Email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          value={email}
          error={emailError ?? undefined}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="bg-background"
        />
        <Select
          id="invite-role"
          label="Role"
          options={choices.map((r) => ({ value: r._id, label: r.name }))}
          value={roleId}
          onChange={(e) => setRoleId(e.currentTarget.value)}
          className="bg-background"
        />
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
