"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plate } from "@/components/kit/Plate";
import { PageBody, PagePending } from "@/app/(app)/_components/page-body";
import { userMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ConfirmDialog,
  DangerButton,
  DangerItem,
  FormSection,
  IDLE,
  PictureField,
  runSave,
  SettingsHeading,
  SettingsSection,
  type FormStatus,
} from "@/components/settings";

/**
 * A workspace's settings: its name and picture, the way into its members, and
 * leaving or deleting it -- each destructive action behind a confirm dialog.
 *
 * THE URL CARRIES THE SLUG, NOT THE ID, and one `api.orgs.bySlug` resolves it
 * to the org, the caller's role and their whole permission list in a single
 * round trip. Every other query on this route takes the `orgId` that came back.
 *
 * `bySlug` returns null for a workspace that does not exist AND for one that is
 * not yours, which are the same screen here on purpose: an id or a name that
 * can be confirmed by probing is a leak, and "we do not have that" is the true
 * answer either way as far as this visitor is concerned.
 */
export default function OrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const seated = useQuery(api.orgs.bySlug, { slug });

  // THE ROUTE OWNS EVERY MUTATION, per `.docs/coding-conventions.md`. All three
  // are declared before the early returns below, because a hook cannot be
  // called conditionally -- the `orgId` they need is bound at call time
  // instead, which is also why `orgId` is a per-call argument rather than
  // closed over here.
  const uploadUrl = useMutation(api.orgs.generateImageUploadUrl);
  const setImage = useMutation(api.orgs.setImage);
  const clearImage = useMutation(api.orgs.clearImage);
  const rename = useMutation(api.orgs.rename);
  const leave = useMutation(api.members.leave);
  const deleteOrg = useMutation(api.orgs.remove);
  const router = useRouter();
  const [general, setGeneral] = useState<FormStatus>(IDLE);
  const [error, setError] = useState<string | null>(null);

  const orgId = seated?.org._id;
  const picture = useImageUpload({
    noun: "workspace picture",
    onError: setError,
    getUploadUrl: () => {
      if (!orgId) throw new Error("no workspace");
      return uploadUrl({ orgId });
    },
    attach: (storageId) => {
      if (!orgId) throw new Error("no workspace");
      return setImage({ orgId, storageId });
    },
    detach: () => {
      if (!orgId) throw new Error("no workspace");
      return clearImage({ orgId });
    },
  });

  // Undefined is "still asking", which is not an answer and must not render
  // the not-found screen for the moment before the real one arrives.
  if (seated === undefined) return <PagePending />;

  if (seated === null) {
    return (
      <PageBody>
        <div className="flex w-full flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="label text-[11px] text-signal">Not found</p>
            <h1 className="display text-[32px] leading-[1.1] text-foreground">
              No workspace here
            </h1>
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
              Either this workspace does not exist, or you are not in it. If
              somebody invited you, open their link rather than this address.
            </p>
          </div>
          <Plate variant="ghost" center href="/" label="Back to the start" />
        </div>
      </PageBody>
    );
  }

  const { org, roleName, permissions, isOwner } = seated;
  const canSeeMembers = permissions.includes("members:read");
  // Workspace-wide changes are offered to the people who may make one.
  // Everybody else still sees the name and picture; the server refuses on its
  // own either way.
  const canManage = permissions.includes("org:manage");

  /** A destructive call, in the words the confirm dialog shows on failure. */
  async function orThrow(action: () => Promise<unknown>, fallback: string) {
    try {
      await action();
    } catch (e) {
      throw new Error(userMessage(e, fallback));
    }
  }

  return (
    <PageBody>
      <div className="flex w-full flex-col gap-8">
        <SettingsHeading
          title={org.name}
          description={
            <>
              Workspace settings. You are{" "}
              {/* The role, not the permission list: "Editor" is what somebody
                  was told they are. */}
              <span className="text-foreground">{roleName}</span> here.
            </>
          }
        />

        {canManage ? (
          <FormSection
            title="General"
            description="The name and picture everybody in this workspace sees."
            submitLabel="Save changes"
            status={general}
            onSubmit={(form) =>
              void runSave(
                setGeneral,
                async () => {
                  const name = String(new FormData(form).get("name") ?? "");
                  await rename({ orgId: org._id, name });
                  return "Saved.";
                },
                (e) => userMessage(e, "Could not rename the workspace."),
              )
            }
          >
            <PictureField
              id="workspace-image"
              name={org.name}
              imageUrl={org.imageUrl}
              shape="workspace"
              uploading={picture.uploading}
              fileInput={picture.fileInput}
              upload={picture.upload}
              remove={picture.remove}
              error={error}
            />
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
              <Input
                key={org.name}
                id="workspace-name"
                name="name"
                defaultValue={org.name}
                required
                maxLength={60}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-address">Address</FieldLabel>
              {/* Read-only on purpose: `rename` never touches the slug,
                  because links to it already exist. */}
              <Input
                id="workspace-address"
                value={`/orgs/${org.slug}`}
                readOnly
                className="text-muted-foreground"
              />
            </Field>
          </FormSection>
        ) : null}

        {canSeeMembers ? (
          <SettingsSection
            title="People and roles"
            description="Invite people, change what they can do, and define the roles they hold."
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`/orgs/${org.slug}/members`}>Manage members</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/orgs/${org.slug}/roles`}>Manage roles</Link>
              </Button>
            </div>
          </SettingsSection>
        ) : null}

        <SettingsSection
          title="Danger zone"
          description="A workspace always keeps at least one owner, so the last one has to hand it over or delete it."
        >
          <DangerItem
            title="Leave workspace"
            description="You lose access. Everything you made here stays in the workspace."
            action={
              <ConfirmDialog
                trigger={<DangerButton>Leave</DangerButton>}
                title={`Leave ${org.name}?`}
                description="You will need a new invitation to come back."
                cancelLabel="Stay"
                confirmLabel="Leave workspace"
                onConfirm={async () => {
                  await orThrow(
                    () => leave({ orgId: org._id }),
                    "Could not leave the workspace.",
                  );
                  router.replace("/dashboard");
                }}
              />
            }
          />
          <DangerItem
            title="Delete workspace"
            description={
              isOwner
                ? "Deletes the workspace and everything in it, for everyone."
                : "Only an owner can delete this workspace."
            }
            action={
              <ConfirmDialog
                trigger={
                  <DangerButton disabled={!isOwner}>
                    Delete workspace
                  </DangerButton>
                }
                title={`Delete ${org.name}?`}
                description="Everything in it is deleted for every member, and it cannot be brought back."
                cancelLabel="Keep workspace"
                confirmLabel="Delete for everyone"
                onConfirm={async () => {
                  await orThrow(
                    () => deleteOrg({ orgId: org._id }),
                    "Could not delete the workspace.",
                  );
                  router.replace("/dashboard");
                }}
              />
            }
          />
        </SettingsSection>
      </div>
    </PageBody>
  );
}
