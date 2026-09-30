"use client";

import { ArrowRight } from "@carbon/icons-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Checkbox, PasswordInput, TextInput } from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { startAccount } from "@/lib/account/start";
import { AuthAlternatives } from "./AuthAlternatives";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

/** Better Auth's sign-up refusals, as a fix the person can make. */
function signUpErrors(error: {
  code?: string;
  status: number;
  message?: string;
}): Errors {
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { email: "An account already uses this email. Log in instead." };
    case "INVALID_EMAIL":
      return { email: "Enter an email address like name@company.com." };
    case "PASSWORD_TOO_SHORT":
      return { password: "Use at least 12 characters." };
    case "PASSWORD_TOO_LONG":
      return { password: "Use 128 characters or fewer." };
  }
  // 403 carries our own sentence (the demo address refusal in convex/auth.ts).
  return {
    form:
      error.status === 403 && error.message
        ? error.message
        : "We couldn't create your account. Try again.",
  };
}

export function SignUpForm({ providers }: { providers: Provider[] }) {
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    const name = String(form.get("name")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const found: Errors = {};
    if (!name) found.name = "Enter your full name.";
    if (!email) found.email = "Enter your work email.";
    if (password.length < 12) found.password = "Use at least 12 characters.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (error) {
        setErrors(signUpErrors(error));
        return;
      }
      const started = await startAccount(true);
      if ("error" in started) {
        setErrors({ form: started.error });
        return;
      }
      // A full load: the next layout mounts Convex with the new session.
      window.location.assign(started.next);
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
          id="signup-name"
          name="name"
          label="Full name"
          autoComplete="name"
          error={errors.name}
        />
        <TextInput
          id="signup-email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          helper="Use your work address so your team can find you."
          error={errors.email}
        />
        <PasswordInput
          id="signup-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          helper="At least 12 characters. A short phrase works well."
          error={errors.password}
        />
        {/* Ruling 9: plain text; no terms or privacy page exists to link to. */}
        <Checkbox
          label="I agree to the terms of use and privacy notice."
          checked={agreed}
          onChange={(e) => setAgreed(e.currentTarget.checked)}
        />
        <div className="flex flex-col gap-05">
          <Button
            type="submit"
            icon={ArrowRight}
            className="w-full"
            disabled={!agreed || pending}
          >
            Create account
          </Button>
          {errors.form && (
            <p role="alert" className="text-label-01 text-support-error">
              {errors.form}
            </p>
          )}
        </div>
      </form>
      <AuthAlternatives
        providers={providers}
        ssoLabel="Sign up with single sign-on"
        emailId="signup-email"
        next={null}
      />
      <p className="text-center text-body-02">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-link underline hover:text-link-hover"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
