"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, InlineNotification, PasswordInput } from "@/components/ui";
import { authClient } from "@/lib/account/auth-client";

export function ResetForm({ token }: { token: string | null }) {
  const [expired, setExpired] = useState(token === null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (expired || token === null)
    return (
      <div className="flex flex-col gap-05">
        <InlineNotification>
          This reset link has expired or was already used.
        </InlineNotification>
        <Link
          href="/login"
          className="self-center text-body-02 text-link hover:text-link-hover"
        >
          Get a new link
        </Link>
      </div>
    );

  const submit = (form: FormData) => {
    const newPassword = String(form.get("password"));
    if (newPassword.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.resetPassword({ newPassword, token });
      if (error) {
        setExpired(true);
        return;
      }
      router.push("/login?reset=1");
    });
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-06"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <PasswordInput
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        helper="At least 12 characters. A short phrase works well."
        error={error ?? undefined}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        Save password
      </Button>
    </form>
  );
}
