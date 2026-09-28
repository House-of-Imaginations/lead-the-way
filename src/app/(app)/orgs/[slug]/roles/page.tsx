"use client";

import { use } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { Pencil, Plus } from "lucide-react";
import { HELP } from "@/lib/help";
import { userMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plate } from "@/components/kit/Plate";
import { PageBody, PagePending } from "@/app/(app)/_components/page-body";
import {
  ConfirmDialog,
  DangerButton,
  SettingsHeading,
  SettingsSection,
} from "@/components/settings";
import { RoleDialog } from "./_components/RoleDialog";
import { PERMISSION_LABELS } from "./_components/permissionLabels";

/**
 * A workspace's roles: what each one can do, and -- for somebody holding
 * `roles:manage` -- creating, editing and deleting them.
 *
 * Its own page rather than a section under Members, because who is here and
 * what a role means are different questions asked by different people.
 * Everybody who can see members can read this; only the controls are gated,
 * and the server refuses on its own either way.
 */
export default function RolesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const seated = useQuery(api.orgs.bySlug, { slug });
  const orgId = seated?.org._id;
  const canRead = seated?.permissions.includes("members:read") ?? false;
  const roles = useQuery(
    api.orgRoles.list,
    orgId && canRead ? { orgId } : "skip",
  );

  const createRole = useMutation(api.orgRoles.create);
  const updateRole = useMutation(api.orgRoles.update);
  const removeRole = useMutation(api.orgRoles.remove);

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

  const { org, permissions } = seated;
  const canManage = permissions.includes("roles:manage");

  /** A save's refusal as a sentence for the dialog, or null once it worked. */
  const attempt = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
      return null;
    } catch (e) {
      return userMessage(e, fallback);
    }
  };

  return (
    <PageBody>
      <SettingsHeading
        title="Roles"
        description={`What each role can do in ${org.name}. Everybody has exactly one.`}
      />

      <SettingsSection
        title="Roles"
        description={
          <>
            {HELP.roles.body[0]}{" "}
            {canManage
              ? "You can only give permissions your own role has."
              : "Ask someone who can manage roles to change them."}
          </>
        }
      >
        {canManage ? (
          <div>
            <RoleDialog
              trigger={
                <Button>
                  <Plus />
                  Create role
                </Button>
              }
              title="Create a role"
              submitLabel="Create role"
              reach={permissions}
              onSave={(name, next) =>
                attempt(
                  () => createRole({ orgId: org._id, name, permissions: next }),
                  "Could not create that role.",
                )
              }
            />
          </div>
        ) : null}

        {!canRead ? (
          <p className="text-sm text-muted-foreground">
            Your role cannot see this workspace&apos;s roles.
          </p>
        ) : roles === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {roles.map((role) => (
              <li
                key={role._id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {role.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {role.isOwner ? (
                      <Badge>Every permission, always</Badge>
                    ) : role.permissions.length === 0 ? (
                      <Badge>No permissions</Badge>
                    ) : (
                      role.permissions.map((permission) => (
                        <Badge key={permission}>
                          {PERMISSION_LABELS[permission]}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* The owner role has no stored permissions to edit and is
                    never deletable -- see `convex/tables/orgs.ts`. */}
                {canManage && !role.isOwner ? (
                  <div className="flex shrink-0 gap-2">
                    <RoleDialog
                      // Keyed on content so an edit made elsewhere reseeds the
                      // draft instead of being overwritten by a stale one.
                      key={`${role.name}:${role.permissions.join(",")}`}
                      trigger={
                        <Button variant="outline">
                          <Pencil />
                          Edit
                        </Button>
                      }
                      title={`Edit ${role.name}`}
                      submitLabel="Save role"
                      initialName={role.name}
                      initialPermissions={role.permissions}
                      reach={permissions}
                      onSave={(name, next) =>
                        attempt(
                          () =>
                            updateRole({
                              orgId: org._id,
                              roleId: role._id,
                              name,
                              permissions: next,
                            }),
                          "Could not save that role.",
                        )
                      }
                    />
                    <ConfirmDialog
                      trigger={<DangerButton>Delete</DangerButton>}
                      title={`Delete the ${role.name} role?`}
                      description="Pending invitations for this role are cancelled. A role somebody still has cannot be deleted; move them to another role first."
                      cancelLabel="Keep role"
                      confirmLabel="Delete role"
                      onConfirm={async () => {
                        const failure = await attempt(
                          () =>
                            removeRole({ orgId: org._id, roleId: role._id }),
                          "Could not delete that role.",
                        );
                        if (failure) throw new Error(failure);
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </PageBody>
  );
}
