"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { HELP } from "@/lib/help";
import { authClient } from "@/lib/account/auth-client";
import { userMessage } from "@/lib/errors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  FormSection,
  IDLE,
  PictureField,
  runSave,
  SettingsHeading,
  type FormStatus,
} from "@/components/settings";

const NAME_MAX = 40;
const PASSWORD_MIN = 8;

/** Read one named field out of a submitted form. */
const read = (form: HTMLFormElement, name: string) =>
  String(new FormData(form).get(name) ?? "");

const describe = (e: unknown) =>
  userMessage(e, "Could not save that. Please try again.");

/** Better Auth answers `{ error }` rather than throwing; this puts it in words. */
function authError(error: { code?: string; message?: string }) {
  if (error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
    return "This account signs in with Google or Discord, so it has no password to change.";
  }
  if (error.code === "INVALID_PASSWORD") {
    return "That current password is not right.";
  }
  return error.message ?? "Could not save that. Please try again.";
}

/**
 * Everything about you that you can change: picture, display name, username,
 * the email you sign in with, and your password.
 *
 * The picture and display name are the product's own (`profiles`); username,
 * email and password belong to Better Auth, so those go through `authClient`
 * and flow back into `getCurrentUser` on their own.
 */
export default function ProfileSettingsPage() {
  const user = useQuery(api.auth.getCurrentUser, {});
  const profile = useQuery(api.profiles.me, {});
  const saveProfile = useMutation(api.profiles.saveProfile);
  const uploadUrl = useMutation(api.profiles.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.profiles.setAvatar);
  const clearAvatar = useMutation(api.profiles.clearAvatar);

  const [pictureError, setPictureError] = useState<string | null>(null);
  const [details, setDetails] = useState<FormStatus>(IDLE);
  const [email, setEmail] = useState<FormStatus>(IDLE);
  const [password, setPassword] = useState<FormStatus>(IDLE);

  const picture = useImageUpload({
    noun: "picture",
    onError: setPictureError,
    getUploadUrl: () => uploadUrl({}),
    attach: (storageId) => setAvatar({ storageId }),
    detach: () => clearAvatar({}),
  });

  // The layout has already turned away a guest; this is the type narrowing.
  if (!user) return null;

  const username = user.displayUsername ?? user.username ?? "";

  return (
    <>
      <SettingsHeading
        title="Profile"
        description="Your details, how you sign in, and how other people see you."
      />

      <FormSection
        title="Personal information"
        description={HELP.name.body[0]}
        submitLabel="Save changes"
        status={details}
        onSubmit={(form) =>
          void runSave(
            setDetails,
            async () => {
              const nextName = read(form, "displayName").trim();
              const nextUsername = read(form, "username").trim();
              // Only what changed is sent: the two live in different systems,
              // and re-saving an untouched username is a uniqueness check
              // somebody can fail for no reason.
              if (nextName !== profile?.displayName) {
                await saveProfile({ displayName: nextName });
              }
              if (nextUsername !== username) {
                const { error } = await authClient.updateUser({
                  username: nextUsername,
                });
                if (error) return { error: authError(error) };
              }
              return "Saved.";
            },
            describe,
          )
        }
      >
        <PictureField
          id="avatar"
          name={profile?.displayName ?? user.name ?? user.email}
          imageUrl={profile?.avatarUrl}
          shape="person"
          uploading={picture.uploading}
          fileInput={picture.fileInput}
          upload={picture.upload}
          remove={picture.remove}
          error={pictureError}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="display-name">Display name</FieldLabel>
            {/* Keyed on the stored value, so the field fills once the profile
                arrives and shows what was actually saved afterwards. */}
            <Input
              key={profile?.displayName}
              id="display-name"
              name="displayName"
              defaultValue={profile?.displayName ?? ""}
              required
              maxLength={NAME_MAX}
              autoComplete="name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              key={username}
              id="username"
              name="username"
              defaultValue={username}
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_.]+"
              autoComplete="username"
            />
            <FieldDescription>
              Letters, numbers, underscores and dots. You can sign in with it.
            </FieldDescription>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Email"
        description={
          <>
            You sign in with {user.email}
            {user.emailVerified ? "." : ", which is not verified yet."} A new
            address takes effect once you open the link we send to it.
          </>
        }
        submitLabel="Send link"
        status={email}
        onSubmit={(form) =>
          void runSave(
            setEmail,
            async () => {
              const newEmail = read(form, "newEmail").trim();
              const { error } = await authClient.changeEmail({
                newEmail,
                callbackURL: "/settings/profile",
              });
              if (error) return { error: authError(error) };
              form.reset();
              return `Check ${newEmail} for the link.`;
            },
            describe,
          )
        }
      >
        <Field>
          <FieldLabel htmlFor="new-email">New email</FieldLabel>
          <Input
            id="new-email"
            name="newEmail"
            type="email"
            required
            autoComplete="email"
          />
        </Field>
      </FormSection>

      <FormSection
        title="Password"
        description="Changing it signs you out on every other device."
        submitLabel="Change password"
        status={password}
        onSubmit={(form) =>
          void runSave(
            setPassword,
            async () => {
              const newPassword = read(form, "newPassword");
              if (newPassword !== read(form, "confirm")) {
                return { error: "The two new passwords do not match." };
              }
              const { error } = await authClient.changePassword({
                currentPassword: read(form, "current"),
                newPassword,
                revokeOtherSessions: true,
              });
              if (error) return { error: authError(error) };
              form.reset();
              return "Password changed.";
            },
            describe,
          )
        }
      >
        <Field>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <Input
            id="current-password"
            name="current"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              required
              minLength={PASSWORD_MIN}
              autoComplete="new-password"
            />
            <FieldDescription>
              At least {PASSWORD_MIN} characters.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">
              Confirm new password
            </FieldLabel>
            <Input
              id="confirm-password"
              name="confirm"
              type="password"
              required
              minLength={PASSWORD_MIN}
              autoComplete="new-password"
            />
          </Field>
        </div>
      </FormSection>
    </>
  );
}
