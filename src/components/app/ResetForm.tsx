"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Button, InlineNotification, PasswordInput } from "@/components/ui";
import { authClient } from "@/lib/account/auth-client";

export function ResetForm({ token: fromUrl }: { token: string | null }) {
  // Held in state: after the address bar drops it, a refetch renders with null.
  const [token] = useState(fromUrl);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // The token stays in state; the address bar and history don't keep it.
  useEffect(() => {
    if (token) window.history.replaceState(null, "", "/reset-password");
  }, [token]);

  if (expired || token === null)
    return (
      <div className="flex flex-col gap-05">
        <InlineNotification>
          This reset link has expired or was already used.
        </InlineNotification>
        <Link
          href="/login"
          id="reset-new-link"
          className="self-center text-body-02 text-link hover:text-link-hover"
        >
          Get a new link
        </Link>
      </div>
    );

  const submit = (form: FormData) => {
    const newPassword = String(form.get("password"));
    if (newPassword.length < 12) {
      flushSync(() => setError("Use at least 12 characters."));
      document.getElementById("reset-password")?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.resetPassword({ newPassword, token });
      if (error) {
        // The form unmounts; keep focus in the page.
        flushSync(() => setExpired(true));
        document.getElementById("reset-new-link")?.focus();
        return;
      }
      router.replace("/login?reset=1");
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
