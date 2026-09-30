"use client";

import { ArrowRight } from "@carbon/icons-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  Button,
  InlineNotification,
  PasswordInput,
  TextInput,
} from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { AuthAlternatives } from "./AuthAlternatives";

// R10: one message, under the password, whatever was wrong.
const NEUTRAL = "Check your email and password and try again.";

export function LogInForm({
  providers,
  next,
  reset,
}: {
  providers: Provider[];
  next: string | null;
  reset: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const email = useRef<HTMLInputElement>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // R10 and 02b: the same answer whether or not the account exists.
  function forgot() {
    const address = email.current?.value.trim() ?? "";
    if (!address) {
      setEmailError("Enter your work email first.");
      email.current?.focus();
      return;
    }
    setEmailError(null);
    startTransition(async () => {
      await authClient.requestPasswordReset({
        email: address,
        redirectTo: "/reset-password",
      });
      setSent(true);
    });
  }

  function submit(form: FormData) {
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    startTransition(async () => {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(NEUTRAL);
        return;
      }
      window.location.assign(next ?? "/home");
    });
  }

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-06"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {sent && (
          <InlineNotification kind="success" title="Check your email.">
            If an account exists for that address, we sent a reset link.
          </InlineNotification>
        )}
        {reset && !sent && (
          <InlineNotification kind="success" title="Password saved.">
            Log in with your new password.
          </InlineNotification>
        )}
        <TextInput
          id="login-email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          ref={email}
          error={emailError ?? undefined}
        />
        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          labelAction={
            <button
              type="button"
              className="text-label-01 text-link underline hover:text-link-hover"
              onClick={forgot}
            >
              Forgot your password?
            </button>
          }
          error={error ?? undefined}
        />
        <Button
          type="submit"
          icon={ArrowRight}
          className="w-full"
          disabled={pending}
        >
          Log in
        </Button>
      </form>
      <AuthAlternatives
        providers={providers}
        ssoLabel="Log in with single sign-on"
        emailId="login-email"
        next={next}
      />
      <p className="text-center text-body-02">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-link underline hover:text-link-hover"
        >
          Sign up
        </Link>
      </p>
    </>
  );
}
