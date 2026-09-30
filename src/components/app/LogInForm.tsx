"use client";

import { ArrowRight } from "@carbon/icons-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, PasswordInput, TextInput } from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { AuthAlternatives } from "./AuthAlternatives";

// R10: one message, under the password, whatever was wrong.
const NEUTRAL = "Check your email and password and try again.";

export function LogInForm({
  providers,
  next,
}: {
  providers: Provider[];
  next: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        <TextInput
          id="login-email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
        />
        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
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
